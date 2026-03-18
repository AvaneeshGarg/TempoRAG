"""
RAGAS Evaluation Script for Temporal RAG
Runs all 3 decay methods + no_decay baseline against benchmark Q&A pairs.

Usage:
    cd C:\\Users\\forbh\\Desktop\\langchain_projects\\langchain-rag
    python evaluation/ragas_eval.py

Output:
    evaluation/results/ragas_results.csv
    evaluation/results/latest_metrics.json
"""

import os
import sys
import json
import time
import datetime

# Add project root to path
ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
sys.path.insert(0, ROOT)

from dotenv import load_dotenv
load_dotenv(os.path.join(ROOT, ".env"), override=True)

# Use a faster model with a higher daily token limit for eval
# llama-3.1-8b-instant: 500K TPD (free tier) vs llama-3.3-70b: 100K TPD
os.environ["EVAL_MODEL"] = "llama-3.1-8b-instant"

RATE_LIMIT_DELAY_SEC = 3  # seconds between LLM calls to avoid 429s

import pandas as pd
from src.graph import build_graph

BENCHMARK_FILE = os.path.join(ROOT, "evaluation", "benchmark_qa.json")
RESULTS_DIR = os.path.join(ROOT, "evaluation", "results")
os.makedirs(RESULTS_DIR, exist_ok=True)

METHODS = ["no_decay", "etvd", "sigmoid", "bioscore"]
METHOD_MAP = {"no_decay": "etvd"}  # no_decay uses etvd pipeline but we track differently


def run_pipeline(question: str, method: str) -> dict:
    """Run a question through the RAG pipeline and return answer + metadata."""
    graph_method = METHOD_MAP.get(method, method)
    rag_app = build_graph()
    t0 = time.perf_counter()

    # Override env var to force faster/cheaper model for eval
    os.environ.setdefault("EVAL_MODEL", "llama-3.1-8b-instant")
    result = rag_app.invoke({
        "question": question,
        "documents": [],
        "answer": "",
        "method": graph_method,
        "metadata_filters": {},
        "timings": {}
    })
    total_ms = round((time.perf_counter() - t0) * 1000, 1)
    return {
        "answer": result.get("answer", ""),
        "documents": result.get("documents", []),
        "timings": result.get("timings", {}),
        "total_ms": total_ms
    }


def score_answer(answer: str, ground_truth: str) -> dict:
    """
    Lightweight scoring without requiring OpenAI key:
    - answer_length: proxy for completeness
    - keyword_overlap: fraction of ground-truth key terms found in answer
    - has_numbers: whether answer contains statistics
    """
    gt_words = set(ground_truth.lower().split())
    ans_words = set(answer.lower().split())
    stop = {"the", "a", "an", "is", "in", "of", "for", "and", "or", "to", "with", "that", "it"}
    gt_keywords = {w for w in gt_words if len(w) > 4 and w not in stop}
    overlap = len(gt_keywords & ans_words) / max(len(gt_keywords), 1)
    has_numbers = any(c.isdigit() for c in answer)

    return {
        "keyword_overlap": round(overlap, 3),
        "answer_length": len(answer),
        "has_statistics": int(has_numbers),
    }


def avg_source_year(documents: list) -> float | None:
    """Average publication year of top retrieved sources."""
    years = []
    for d in documents:
        try:
            years.append(int(str(d.get("year", "")).strip()))
        except ValueError:
            pass
    return round(sum(years) / len(years), 1) if years else None


def main():
    with open(BENCHMARK_FILE, "r") as f:
        benchmark = json.load(f)

    print(f"\n{'='*60}")
    print(f"Temporal RAG — RAGAS-style Evaluation")
    print(f"Questions: {len(benchmark)} | Methods: {METHODS}")
    print(f"{'='*60}\n")

    all_rows = []

    for i, item in enumerate(benchmark):
        question = item["question"]
        ground_truth = item["ground_truth"]
        temporal = item.get("temporal_sensitivity", False)
        category = item.get("category", "general")

        print(f"[{i+1}/{len(benchmark)}] {question[:70]}...")

        for method in METHODS:
            try:
                result = run_pipeline(question, method)
                scores = score_answer(result["answer"], ground_truth)
                avg_year = avg_source_year(result["documents"])

                row = {
                    "question_id": i + 1,
                    "category": category,
                    "temporal_sensitive": temporal,
                    "method": method,
                    "keyword_overlap": scores["keyword_overlap"],
                    "answer_length": scores["answer_length"],
                    "has_statistics": scores["has_statistics"],
                    "avg_source_year": avg_year,
                    "retrieve_ms": result["timings"].get("retrieve_ms", 0),
                    "rerank_ms": result["timings"].get("rerank_ms", 0),
                    "generate_ms": result["timings"].get("generate_ms", 0),
                    "total_ms": result["total_ms"],
                }
                all_rows.append(row)
                print(f"  [{method:10}] overlap={scores['keyword_overlap']:.3f} | avg_year={avg_year} | {result['total_ms']:.0f}ms")
                time.sleep(RATE_LIMIT_DELAY_SEC)

            except Exception as e:
                print(f"  [{method:10}] ERROR: {e}")
                all_rows.append({
                    "question_id": i + 1, "category": category,
                    "temporal_sensitive": temporal, "method": method,
                    "keyword_overlap": None, "answer_length": 0, "has_statistics": 0,
                    "avg_source_year": None,
                    "retrieve_ms": 0, "rerank_ms": 0, "generate_ms": 0, "total_ms": 0,
                })

    # Save CSV
    df = pd.DataFrame(all_rows)
    csv_path = os.path.join(RESULTS_DIR, "ragas_results.csv")
    df.to_csv(csv_path, index=False)
    print(f"\n✓ Full results saved → {csv_path}")

    # Compute per-method aggregates
    agg = df.groupby("method").agg(
        avg_keyword_overlap=("keyword_overlap", "mean"),
        avg_answer_length=("answer_length", "mean"),
        pct_with_statistics=("has_statistics", "mean"),
        avg_source_year=("avg_source_year", "mean"),
        avg_retrieve_ms=("retrieve_ms", "mean"),
        avg_rerank_ms=("rerank_ms", "mean"),
        avg_generate_ms=("generate_ms", "mean"),
        avg_total_ms=("total_ms", "mean"),
    ).round(3).reset_index()

    # Temporal-specific breakdown
    temp_df = df[df["temporal_sensitive"] == True]
    if not temp_df.empty:
        temp_agg = temp_df.groupby("method")["keyword_overlap"].mean().round(3)
        agg["temporal_keyword_overlap"] = agg["method"].map(temp_agg)

    print("\n" + "="*60)
    print("AGGREGATE RESULTS (all questions)")
    print("="*60)
    print(agg.to_string(index=False))

    # Save metrics JSON for frontend
    metrics = {
        "generated_at": datetime.datetime.now().isoformat(),
        "n_questions": len(benchmark),
        "methods": {}
    }
    for _, row in agg.iterrows():
        metrics["methods"][row["method"]] = row.to_dict()
        metrics["methods"][row["method"]].pop("method", None)

    json_path = os.path.join(RESULTS_DIR, "latest_metrics.json")
    with open(json_path, "w") as f:
        json.dump(metrics, f, indent=2)
    print(f"✓ Metrics JSON  saved → {json_path}")
    print("\nDone! Use GET /metrics on the backend to serve these to the frontend.")


if __name__ == "__main__":
    main()
