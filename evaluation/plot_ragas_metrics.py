import pandas as pd
import json
import matplotlib.pyplot as plt
import numpy as np
import os

# IEEE Style Plot Configurations
plt.rcParams.update({
    'font.size': 11,
    'font.family': 'sans-serif',
    'axes.labelsize': 12,
    'axes.titlesize': 14,
    'xtick.labelsize': 11,
    'ytick.labelsize': 11,
    'legend.fontsize': 10,
    'figure.autolayout': True
})

RESULTS_DIR = os.path.join(os.path.dirname(os.path.abspath(__file__)), "results")
METRICS_FILE = os.path.join(RESULTS_DIR, "true_ragas_metrics.json")
OUTPUT_FIG = os.path.join(RESULTS_DIR, "ragas_comparison_chart.png")

def main():
    if not os.path.exists(METRICS_FILE):
        print(f"Error: {METRICS_FILE} not found. Please run the evaluation script first.")
        return

    with open(METRICS_FILE, "r") as f:
        data = json.load(f)

    methods_data = data.get("methods", {})
    if not methods_data:
        print("No method data found in the JSON.")
        return

    methods = ["no_decay", "etvd", "sigmoid", "bioscore"]
    display_names = ["No Decay", "ETVD", "Sigmoid", "BioScore"]
    
    labels = ['Faithfulness', 'Answer Relevancy', 'Context Precision', 'Keyword Overlap']
    x = np.arange(len(labels))
    width = 0.2

    fig, ax = plt.subplots(figsize=(10, 6))
    
    # Clean IEEE-appropriate palette
    colors = ['#adb5bd', '#339af0', '#fcc419', '#51cf66'] 

    for i, method in enumerate(methods):
        m_data = methods_data.get(method, {})
        scores = [
            m_data.get("faithfulness", 0.0),
            m_data.get("answer_relevancy", 0.0),
            m_data.get("context_precision", 0.0),
            m_data.get("keyword_overlap", 0.0)
        ]
        
        ax.bar(x + (i - 1.5) * width, scores, width, 
               label=display_names[i], color=colors[i], 
               edgecolor='black', linewidth=1.0)

    ax.set_ylabel('Score (0.0 to 1.0)', fontweight='bold')
    ax.set_title('RAGAS Metrics Comparison by Decay Method', fontweight='bold', pad=15)
    ax.set_xticks(x)
    ax.set_xticklabels(labels, fontweight='normal')
    
    # Legend formatting
    ax.legend(title='Temporal Method', loc='upper right', framealpha=0.9, edgecolor='black')
    
    ax.set_ylim([0, 1.1])
    ax.grid(axis='y', linestyle='--', alpha=0.7)

    # Save high-res for publication
    os.makedirs(RESULTS_DIR, exist_ok=True)
    plt.savefig(OUTPUT_FIG, dpi=300, bbox_inches='tight')
    print(f"\n[SUCCESS] IEEE-formatted bar chart saved to: {OUTPUT_FIG}")

if __name__ == "__main__":
    main()
