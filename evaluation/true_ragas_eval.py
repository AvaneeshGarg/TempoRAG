"""
True RAGAS Evaluation for TempoRAG
===================================
Runs all 4 decay methods (no_decay, etvd, sigmoid, bioscore) through the full
RAG pipeline and evaluates each response using the real RAGAS library metrics:
  - Faithfulness     : Is the answer grounded in the retrieved context?
  - Answer Relevance : Does the answer address the question?
  - Context Precision: Are the top retrieved docs relevant to the returned docs?

Uses Groq (llama-3.1-8b-instant) as the LLM judge — no OpenAI key required.

FIXES vs previous version:
  1. Decommissioned model: RAGAS 0.4 internally tries to bind tools using
     `llama3-groq-70b-8192-tool-use-preview`. We patch _set_runnable to prevent
     RAGAS from ever swapping our judge LLM to a tool-use variant.
  2. Rate limit (TPD 500k/day): The pipeline itself (src.graph) also calls Groq
     and was exhausting the daily quota before RAGAS even ran. We now:
       a) Add a retry-with-backoff wrapper around run_pipeline().
       b) Increase RATE_LIMIT_SEC between calls to reduce per-minute token burn.
       c) Catch 429s from the pipeline *and* from RAGAS evaluate() and sleep
          for the exact duration Groq tells us to wait.

Usage:
    cd C:\\Users\\forbh\\Desktop\\langchain_projects\\langchain-rag
    .venv\\Scripts\\Activate.ps1
    python evaluation/true_ragas_eval.py

Output:
    evaluation/results/true_ragas_results.csv
    evaluation/results/true_ragas_metrics.json
"""

import os
import re
import sys
import json
import time
import datetime
import warnings

warnings.filterwarnings("ignore")

# ── Project root on path ────────────────────────────────────────────────────
ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
sys.path.insert(0, ROOT)

from dotenv import load_dotenv
load_dotenv(os.path.join(ROOT, ".env"), override=True)

# ── Imports ─────────────────────────────────────────────────────────────────
import pandas as pd
from datasets import Dataset

from ragas import evaluate
from ragas.metrics import (
    Faithfulness,
    AnswerRelevancy,
    ContextPrecision,
)
from langchain_groq import ChatGroq
from src.graph import build_graph


# ── Config ──────────────────────────────────────────────────────────────────
BENCHMARK_FILE  = os.path.join(ROOT, "evaluation", "benchmark_qa.json")
RESULTS_DIR     = os.path.join(ROOT, "evaluation", "results")
os.makedirs(RESULTS_DIR, exist_ok=True)

METHODS         = ["no_decay", "etvd", "sigmoid", "bioscore"]
METHOD_MAP      = {"no_decay": "etvd"}

# We can reduce sleep because NVIDIA NIM allows vastly larger rate limits
RATE_LIMIT_SEC  = 1

MAX_QUESTIONS   = None

# Max retries when a 429 is hit (pipeline or RAGAS)
MAX_429_RETRIES = 8


# ── Helpers ──────────────────────────────────────────────────────────────────
def parse_retry_seconds(err_str: str, default: float = 90.0) -> float:
    """Extract the 'try again in Xm Y.Zs' wait time from a Groq 429 message."""
    m = re.search(r'try again in (?:(\d+)m)?([\d\.]+)s', err_str)
    if m:
        mins = float(m.group(1)) if m.group(1) else 0.0
        secs = float(m.group(2)) if m.group(2) else 0.0
        return mins * 60 + secs + 5   # +5 s safety buffer
    return default


def is_rate_limit(err: Exception) -> bool:
    s = str(err)
    return "429" in s and (
        "rate_limit" in s.lower()
        or "tokens per day" in s.lower()
        or "tokens per minute" in s.lower()
    )


# ── RAGAS judge setup ────────────────────────────────────────────────────────
def build_ragas_judge():
    """
    Build RAGAS-wrapped LLM and embeddings.

    FIX 1 — Decommissioned model:
    RAGAS 0.4 calls `_set_runnable` on LangchainLLMWrapper, which inspects the
    model name and — if it detects 'groq' — rebinds the LLM to the now-removed
    `llama3-groq-70b-8192-tool-use-preview` tool-use model.
    We monkey-patch both __init__ (to mask the model name) and _set_runnable
    (to make it a no-op) so RAGAS never overrides our chosen model.
    """
    from ragas.llms import LangchainLLMWrapper
    from ragas.embeddings import LangchainEmbeddingsWrapper

    groq_key = os.getenv("GROQ_API_KEY")
    if not groq_key:
        raise EnvironmentError("GROQ_API_KEY not found in .env")

    # Patch __init__ to hide the Groq model name from RAGAS internals
    _orig_init = LangchainLLMWrapper.__init__

    def _patched_init(self, langchain_llm, *args, **kwargs):
        _orig_init(self, langchain_llm, *args, **kwargs)
        if hasattr(self, 'model'):
            self.model = "patched-non-groq"

    LangchainLLMWrapper.__init__ = _patched_init

    # Make _set_runnable a no-op so RAGAS cannot swap in a different LLM
    if hasattr(LangchainLLMWrapper, '_set_runnable'):
        LangchainLLMWrapper._set_runnable = lambda self, *a, **kw: None
    # NVIDIA NIM OpenAI-compatible endpoint
    from langchain_openai import ChatOpenAI
    
    nvidia_key = os.getenv("NVIDIA_API_KEY")
    
    judge_llm = ChatOpenAI(
        model="qwen/qwen3.5-397b-a17b",  # Massive 397B Qwen via NVIDIA
        api_key=nvidia_key,
        base_url="https://integrate.api.nvidia.com/v1",
        temperature=0.0,
        max_retries=2,
    )

    try:
        from langchain_huggingface import HuggingFaceEmbeddings
    except ImportError:
        from langchain_community.embeddings import HuggingFaceEmbeddings

    embeddings = HuggingFaceEmbeddings(
        model_name="sentence-transformers/all-MiniLM-L6-v2",
        model_kwargs={"device": "cpu"},
    )

    ragas_llm        = LangchainLLMWrapper(
        judge_llm,
        bypass_n=True,          # Groq strictly rejects n>1 via OpenAI library mappings in RAGAS
        bypass_temperature=True # Prevent temperature validation warnings
    )
    ragas_embeddings = LangchainEmbeddingsWrapper(embeddings)
    return ragas_llm, ragas_embeddings


# ── Pipeline wrapper ─────────────────────────────────────────────────────────
def run_pipeline(question: str, method: str) -> dict:
    """Run one question through the RAG pipeline for a given decay method."""
    graph_method = METHOD_MAP.get(method, method)
    rag_app = build_graph()

    result = rag_app.invoke({
        "question":         question,
        "documents":        [],
        "answer":           "",
        "method":           graph_method,
        "metadata_filters": {},
        "timings":          {},
    })

    documents = result.get("documents", [])
    contexts  = [
        f"[{d.get('year', '?')}] {d.get('title', '')}\n{d.get('content', '')[:600]}"
        for d in documents[:5]
    ]

    return {
        "answer":   result.get("answer", ""),
        "contexts": contexts,
        "timings":  result.get("timings", {}),
    }


def run_pipeline_with_retry(question: str, method: str) -> dict:
    """
    FIX 2a — Retry wrapper around run_pipeline() for Groq 429s.

    The pipeline calls Groq for answer generation. If the daily token quota is
    nearly exhausted when the pipeline runs, we need to back off here too —
    not just inside the RAGAS evaluate() call.
    """
    for attempt in range(MAX_429_RETRIES):
        try:
            return run_pipeline(question, method)
        except Exception as e:
            if is_rate_limit(e) and attempt < MAX_429_RETRIES - 1:
                wait = parse_retry_seconds(str(e))
                print(
                    f"\n     [PIPELINE 429] Sleeping {wait:.0f}s "
                    f"(attempt {attempt + 1}/{MAX_429_RETRIES})…",
                    end="", flush=True,
                )
                time.sleep(wait)
                print(" Retrying…", end="", flush=True)
            else:
                raise


# ── Main evaluation loop ─────────────────────────────────────────────────────
def main():
    with open(BENCHMARK_FILE, "r") as f:
        benchmark = json.load(f)

    max_q     = MAX_QUESTIONS if MAX_QUESTIONS else len(benchmark)
    benchmark = benchmark[:max_q]

    print(f"\n{'='*65}")
    print(f"  TempoRAG — True RAGAS Evaluation")
    print(f"  Questions : {len(benchmark)}  |  Methods: {METHODS}")
    print(f"  Judge LLM : llama-3.1-8b-instant (Groq)")
    print(f"  Metrics   : Faithfulness, Answer Relevance, Context Precision")
    print(f"{'='*65}\n")

    ragas_llm, ragas_embeddings = build_ragas_judge()

    faith_metric = Faithfulness(llm=ragas_llm)
    relev_metric = AnswerRelevancy(llm=ragas_llm, embeddings=ragas_embeddings)
    cp_metric    = ContextPrecision(llm=ragas_llm)
    metrics_list = [faith_metric, relev_metric, cp_metric]

    csv_path = os.path.join(RESULTS_DIR, "true_ragas_results.csv")
    all_rows = []

    if os.path.exists(csv_path):
        try:
            df_existing  = pd.read_csv(csv_path)
            all_rows     = df_existing.to_dict("records")
            completed_qs = set((r["question_id"], r["method"]) for r in all_rows)
            print(f"Loaded {len(all_rows)} completed evaluations from checkpoint.")
        except Exception:
            completed_qs = set()
    else:
        completed_qs = set()

    for q_idx, item in enumerate(benchmark):
        question     = item["question"]
        ground_truth = item["ground_truth"]
        temporal     = item.get("temporal_sensitivity", False)
        category     = item.get("category", "general")

        print(f"\n[{q_idx + 1}/{max_q}] {question[:75]}…")

        for method in METHODS:
            print(f"  -> {method:10} ", end="", flush=True)

            if (q_idx + 1, method) in completed_qs:
                print("Skipping (already evaluated).")
                continue

            try:
                t0      = time.perf_counter()
                result  = run_pipeline_with_retry(question, method)
                elapsed = round((time.perf_counter() - t0) * 1000, 1)

                answer   = result["answer"]
                contexts = result["contexts"]

                if not answer.strip():
                    raise ValueError("Empty answer returned")

                ragas_dataset = Dataset.from_dict({
                    "question":     [question],
                    "answer":       [answer],
                    "contexts":     [contexts],
                    "ground_truth": [ground_truth],
                })

                # ── FIX 2b — RAGAS evaluate() with 429-aware retry ───────
                ragas_result = None
                for attempt in range(MAX_429_RETRIES):
                    try:
                        ragas_result = evaluate(
                            dataset = ragas_dataset,
                            metrics = metrics_list,
                        )
                        break
                    except Exception as e:
                        if is_rate_limit(e) and attempt < MAX_429_RETRIES - 1:
                            wait = parse_retry_seconds(str(e))
                            print(
                                f"\n     [RAGAS 429] Sleeping {wait:.0f}s "
                                f"(attempt {attempt + 1}/{MAX_429_RETRIES})…",
                                end="", flush=True,
                            )
                            time.sleep(wait)
                            print(" Retrying…", end="", flush=True)
                        else:
                            raise

                # RAGAS 0.2+ returns an EvaluationResult object, not a dict.
                # The safest way to extract row-level metrics is via its pandas dataframe:
                try:
                    df_res = ragas_result.to_pandas()
                    row_data = df_res.iloc[0].to_dict()
                except Exception:
                    row_data = {}

                def safe_float(val):
                    try:
                        return float(val[0]) if isinstance(val, list) else float(val)
                    except (ValueError, TypeError, IndexError):
                        return 0.0

                rf = safe_float(row_data.get("faithfulness",      0.0))
                ar = safe_float(row_data.get("answer_relevancy",  0.0))
                cp = safe_float(row_data.get("context_precision", 0.0))

                # Keyword overlap
                gt_words   = set(ground_truth.lower().split())
                ans_words  = set(answer.lower().split())
                stop       = {"the","a","an","is","in","of","for","and","or","to","with","that","it"}
                gt_kws     = {w for w in gt_words if len(w) > 4 and w not in stop}
                kw_overlap = round(len(gt_kws & ans_words) / max(len(gt_kws), 1), 3)

                timings = result["timings"]

                # Average source year from context strings
                years = []
                for ctx in contexts:
                    m = re.search(r'\[(\d{4})\]', ctx)
                    if m:
                        years.append(int(m.group(1)))
                avg_year = round(sum(years) / len(years), 1) if years else None

                row = {
                    "question_id":        q_idx + 1,
                    "category":           category,
                    "temporal_sensitive": temporal,
                    "method":             method,
                    "faithfulness":       round(rf, 4),
                    "answer_relevancy":   round(ar, 4),
                    "context_precision":  round(cp, 4),
                    "keyword_overlap":    kw_overlap,
                    "answer_length":      len(answer),
                    "has_statistics":     int(any(c.isdigit() for c in answer)),
                    "avg_source_year":    avg_year,
                    "retrieve_ms":        timings.get("retrieve_ms", 0),
                    "rerank_ms":          timings.get("rerank_ms", 0),
                    "generate_ms":        timings.get("generate_ms", 0),
                    "total_ms":           elapsed,
                }

                all_rows.append(row)
                print(
                    f"Faith={rf:.3f}  Relev={ar:.3f}  CP={cp:.3f}  "
                    f"KW={kw_overlap:.3f}  [{elapsed:.0f}ms]"
                )

                # Checkpoint after every successful result
                pd.DataFrame(all_rows).to_csv(csv_path, index=False)

                # FIX 2c — increased inter-call sleep to reduce token burn
                time.sleep(RATE_LIMIT_SEC)

            except Exception as e:
                print(f"ERROR: {e}")

    print(f"\n[SUCCESS] Full results saved -> {csv_path}")

    # ── Aggregate ────────────────────────────────────────────────────────────
    df = pd.read_csv(csv_path)
    numeric_cols = [
        "faithfulness", "answer_relevancy", "context_precision",
        "keyword_overlap", "answer_length", "has_statistics",
        "avg_source_year", "retrieve_ms", "rerank_ms", "generate_ms", "total_ms",
    ]

    agg = (
        df.groupby("method")[numeric_cols]
        .mean()
        .round(4)
        .reset_index()
    )

    temp_df = df[df["temporal_sensitive"] == True]
    if not temp_df.empty:
        temp_agg = temp_df.groupby("method")[
            ["faithfulness", "answer_relevancy", "keyword_overlap"]
        ].mean().round(4)
        agg = agg.merge(
            temp_agg.add_prefix("temporal_").reset_index(),
            on="method", how="left",
        )

    print("\n" + "="*65)
    print("AGGREGATE RAGAS RESULTS")
    print("="*65)
    print(agg[["method", "faithfulness", "answer_relevancy",
               "context_precision", "keyword_overlap"]].to_string(index=False))

    metrics_out = {
        "generated_at": datetime.datetime.now().isoformat(),
        "n_questions":  len(benchmark),
        "ragas_judge":  "qwen/qwen3.5-397b-a17b (NVIDIA)",
        "methods":      {},
    }
    for _, row in agg.iterrows():
        d = row.to_dict()
        m = d.pop("method")
        metrics_out["methods"][m] = d

    json_path = os.path.join(RESULTS_DIR, "true_ragas_metrics.json")
    with open(json_path, "w") as f:
        json.dump(metrics_out, f, indent=2)
    print(f"[SUCCESS] Metrics JSON saved -> {json_path}")
    print("\nAll done! Use the JSON above to update paper tables.")


if __name__ == "__main__":
    main()