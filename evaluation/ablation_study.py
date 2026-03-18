"""
Ablation Study Runner — Temporal RAG
Compares all decay methods across question categories.

Usage:
    cd C:\\Users\\forbh\\Desktop\\langchain_projects\\langchain-rag
    python evaluation/ablation_study.py

Output:
    evaluation/results/ablation_results.csv  (paper-ready table)
"""

import os
import sys
import json

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
sys.path.insert(0, ROOT)

from dotenv import load_dotenv
load_dotenv(os.path.join(ROOT, ".env"), override=True)

import pandas as pd

RESULTS_CSV = os.path.join(ROOT, "evaluation", "results", "ragas_results.csv")
ABLATION_CSV = os.path.join(ROOT, "evaluation", "results", "ablation_results.csv")
BENCHMARK_FILE = os.path.join(ROOT, "evaluation", "benchmark_qa.json")


def generate_ablation_table(df: pd.DataFrame) -> pd.DataFrame:
    """Generate the ablation table grouped by method and temporal sensitivity."""
    
    # Overall comparison
    overall = df.groupby("method").agg(
        KW_Overlap=("keyword_overlap", "mean"),
        Avg_Src_Year=("avg_source_year", "mean"),
        Retrieve_ms=("retrieve_ms", "mean"),
        Rerank_ms=("rerank_ms", "mean"),
        Generate_ms=("generate_ms", "mean"),
        Total_ms=("total_ms", "mean"),
    ).round(3)

    # Temporal sensitive subset
    temp_df = df[df["temporal_sensitive"] == True]
    if not temp_df.empty:
        temp = temp_df.groupby("method")["keyword_overlap"].mean().round(3)
        overall["KW_Overlap_Temporal"] = temp

    # Non-temporal subset
    nontemp_df = df[df["temporal_sensitive"] == False]
    if not nontemp_df.empty:
        nontemp = nontemp_df.groupby("method")["keyword_overlap"].mean().round(3)
        overall["KW_Overlap_Static"] = nontemp

    # Compute relative improvement over no_decay baseline
    if "no_decay" in overall.index:
        baseline = overall.loc["no_decay", "KW_Overlap"]
        overall["Improvement_vs_Baseline_%"] = ((overall["KW_Overlap"] - baseline) / baseline * 100).round(1)

    return overall.reset_index()


def print_latex_table(df: pd.DataFrame):
    """Print a LaTeX-formatted table for the paper."""
    print("\n" + "="*60)
    print("LaTeX Table (copy into your paper)")
    print("="*60)
    print(r"\begin{table}[h]")
    print(r"\centering")
    print(r"\caption{Ablation Study: Temporal Decay Method Comparison}")
    print(r"\label{tab:ablation}")
    print(r"\begin{tabular}{lcccc}")
    print(r"\hline")
    print(r"\textbf{Method} & \textbf{KW Overlap} & \textbf{Temporal KW} & \textbf{Avg Year} & \textbf{Latency (ms)} \\")
    print(r"\hline")

    method_names = {"no_decay": "No Decay (Baseline)", "etvd": "ETVD (Ours)", "sigmoid": "Sigmoid Decay", "bioscore": "BioScore"}
    for _, row in df.iterrows():
        method = method_names.get(row.get("method", ""), row.get("method", ""))
        kw = row.get("KW_Overlap", "-")
        temp_kw = row.get("KW_Overlap_Temporal", "-")
        year = row.get("Avg_Src_Year", "-")
        lat = row.get("Total_ms", "-")
        print(f"{method} & {kw:.3f} & {temp_kw:.3f} & {year:.1f} & {lat:.0f} \\\\")

    print(r"\hline")
    print(r"\end{tabular}")
    print(r"\end{table}")


def main():
    if not os.path.exists(RESULTS_CSV):
        print("ERROR: results/ragas_results.csv not found.")
        print("→ Run   python evaluation/ragas_eval.py   first.")
        sys.exit(1)

    df = pd.read_csv(RESULTS_CSV)

    # Load benchmark for temporal flags
    with open(BENCHMARK_FILE) as f:
        benchmark = json.load(f)
    flag_map = {i + 1: b["temporal_sensitivity"] for i, b in enumerate(benchmark)}
    df["temporal_sensitive"] = df["question_id"].map(flag_map)

    ablation = generate_ablation_table(df)
    ablation.to_csv(ABLATION_CSV, index=False)

    print("\n" + "="*60)
    print("ABLATION STUDY — TEMPORAL RAG")
    print("="*60)
    pd.set_option("display.max_columns", None)
    pd.set_option("display.width", 120)
    print(ablation.to_string(index=False))

    print(f"\n✓ Ablation table saved → {ABLATION_CSV}")

    print_latex_table(ablation)

    # Category breakdown
    print("\n" + "="*60)
    print("CATEGORY BREAKDOWN")
    print("="*60)
    cat = df.groupby(["category", "method"])["keyword_overlap"].mean().round(3).unstack()
    print(cat.to_string())


if __name__ == "__main__":
    main()
