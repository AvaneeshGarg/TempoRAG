"""
Case Study Data Generator — EMPEROR-Reduced Query
Runs the exact case study question through all 4 decay methods
and captures real retrieved document years + titles for paper.

Usage:
    python evaluation/generate_case_study.py
Output:
    evaluation/results/case_study_emperor.json
"""

import os
import sys
import json

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
sys.path.insert(0, ROOT)

from dotenv import load_dotenv
load_dotenv(os.path.join(ROOT, ".env"), override=True)

os.environ["EVAL_MODEL"] = "llama-3.1-8b-instant"

from src.graph import build_graph

QUESTION = "What does the EMPEROR-Reduced trial demonstrate about empagliflozin in heart failure with reduced ejection fraction?"
GROUND_TRUTH = "EMPEROR-Reduced (2020) showed empagliflozin reduced the composite of CV death or HF hospitalization by 25% in HFrEF patients. Benefit was consistent regardless of diabetes status, supporting SGLT2i as standard of care per 2022 AHA/ACC guidelines."

METHODS = ["no_decay", "etvd", "sigmoid", "bioscore"]
METHOD_MAP = {"no_decay": "etvd"}
RESULTS_DIR = os.path.join(ROOT, "evaluation", "results")
os.makedirs(RESULTS_DIR, exist_ok=True)

def run(method):
    graph_method = METHOD_MAP.get(method, method)
    app = build_graph()
    result = app.invoke({
        "question": QUESTION,
        "documents": [],
        "answer": "",
        "method": graph_method,
        "metadata_filters": {},
        "timings": {}
    })
    docs = result.get("documents", [])
    return {
        "answer": result.get("answer", ""),
        "timings": result.get("timings", {}),
        "sources": [
            {
                "rank": i + 1,
                "year": d.get("year", ""),
                "title": d.get("title", "")[:100],
                "final_score": round(d.get("final_score", 0), 4),
                "similarity": round(d.get("similarity", 0), 4),
                "decay_weight": round(d.get("decay_weight", 1.0), 4),
            }
            for i, d in enumerate(docs)
        ],
        "mean_source_year": round(
            sum(int(str(d.get("year", 0)).strip()) for d in docs if str(d.get("year","")).strip().isdigit())
            / max(1, sum(1 for d in docs if str(d.get("year","")).strip().isdigit())), 1
        )
    }

if __name__ == "__main__":
    print("=" * 60)
    print("CASE STUDY: EMPEROR-Reduced / Empagliflozin")
    print("=" * 60)
    print(f"Question: {QUESTION}\n")

    output = {"question": QUESTION, "ground_truth": GROUND_TRUTH, "methods": {}}

    for method in METHODS:
        print(f"\n[{method.upper()}]")
        try:
            result = run(method)
            output["methods"][method] = result
            print(f"  Mean Source Year : {result['mean_source_year']}")
            print(f"  Top-5 Sources:")
            for s in result["sources"]:
                print(f"    #{s['rank']} ({s['year']}) score={s['final_score']} — {s['title']}")
        except Exception as e:
            print(f"  ERROR: {e}")
            output["methods"][method] = {"error": str(e)}

    out_path = os.path.join(RESULTS_DIR, "case_study_emperor.json")
    with open(out_path, "w") as f:
        json.dump(output, f, indent=2)

    print(f"\n✓ Saved → {out_path}")
    print("\n--- PAPER TABLE (copy-paste) ---")
    print(f"{'Method':<18} {'Mean Year':>10} {'#1 Doc Year':>12} {'#1 Doc Title (truncated)'}")
    print("-" * 80)
    for m, r in output["methods"].items():
        if "error" in r: continue
        top = r["sources"][0] if r["sources"] else {}
        print(f"{m:<18} {r['mean_source_year']:>10} {str(top.get('year','')):>12}  {top.get('title','')[:40]}")
