import os
from graphviz import Digraph

def generate():
    dot = Digraph("TempoRAG", format="pdf")
    # splines=ortho makes lines perfectly straight and rectilinear
    # dpi=1200 ensures the PNG output is extreme high resolution
    dot.attr(rankdir="LR", splines="ortho", nodesep="0.6", ranksep="0.8", dpi="1200", compound="true")
    
    # Global node and edge settings - matching the reference image closely
    dot.attr("node", fontname="Arial", fontsize="14", shape="box", style="filled,rounded", margin="0.25,0.15", penwidth="1.2", color="#475569")
    dot.attr("edge", penwidth="2.2", color="#1E293B", arrowsize="1.0", fontname="Arial", fontsize="13")

    # --- CLINICAL INPUT (Frontend) ---
    with dot.subgraph(name="cluster_input") as c:
        # Dark blue solid container
        c.attr(style="filled,rounded", fillcolor="#3B82F6", color="#1E3A8A", penwidth="1.5")
        c.attr(label="CLINICAL\nINPUT\n(Frontend)", fontname="Arial Bold", fontsize="15", fontcolor="white")
        
        # White boxes inside
        c.node_attr.update(fillcolor="white", color="#1E3A8A")
        c.node("q_input", "Clinical\nQuery Input", height="0.8")
        c.node("r_input", "Risk\nParameter\nInput", height="0.8")
        c.edge("q_input", "r_input", style="invis") # Force vertical stacking

    # --- API GATEWAY ---
    dot.node("api", "API\nGATEWAY", fillcolor="#BAE6FD", color="#0284C7", height="5.5", width="1.0", fontname="Arial Bold")

    # --- RAG PIPELINE ---
    with dot.subgraph(name="cluster_rag") as c:
        c.attr(style="filled,rounded", fillcolor="#F8FAFC", color="#64748B", penwidth="1.2")
        c.attr(label="AGENTIC RAG PIPELINE\n(LangGraph)", fontname="Arial Bold", fontsize="14", fontcolor="black")
        
        c.node_attr.update(fillcolor="#E0F2FE", color="#64748B", width="1.4", height="1.6")
        c.node("retrieve", "1. RETRIEVE\nNODE\n\nSapBERT\n&\nFAISS")
        c.node("rerank", "2. RERANK\nNODE\n\nConfigurable\nDecay: ETVD,\nSigmoid,\nBioScore")
        c.node("generate", "3. GENERATE\nNODE\n\nTool-\nAugmented\nLLM")
        
        c.edge("retrieve", "rerank")
        c.edge("rerank", "generate")

    # --- CLINICAL TOOL LAYER ---
    with dot.subgraph(name="cluster_tools") as c:
        c.attr(style="filled,rounded", fillcolor="#F8FAFC", color="#64748B", penwidth="1.2")
        c.attr(label="CLINICAL TOOL LAYER\n(LangChain)", fontname="Arial Bold", fontsize="14", fontcolor="black")
        
        c.node_attr.update(fillcolor="#E0F2FE", color="#64748B", width="2.4", height="0.8")
        c.node("pubmed", "search_pubmed")
        c.node("chronos", "predict_heart_\nfailure_risk\n(ChronosModel)")
        
        c.edge("pubmed", "chronos", style="invis") # vertical stacking

    # --- OFFLINE EVALUATION ---
    with dot.subgraph(name="cluster_eval") as c:
        c.attr(style="filled,rounded", fillcolor="#F8FAFC", color="#64748B", penwidth="1.2")
        c.attr(label="OFFLINE EVALUATION SUBSYSTEM", fontname="Arial Bold", fontsize="14", fontcolor="black")
        
        c.node_attr.update(fillcolor="#E0F2FE", color="#64748B", height="0.8", width="1.4")
        c.node("bench", "BENCHMARK\nDATASET")
        c.node("ablation", "ABLATION\nRUNNER")
        c.node("metrics", "METRICS\nENGINE")
        c.node("results", "RESULTS")
        
        c.edge("bench", "ablation")
        c.edge("ablation", "metrics")
        c.edge("metrics", "results")

    # --- SUMMARY ---
    dot.node("summary", "CLINICAL INSIGHT & RESULTS SUMMARY", fillcolor="#FEF08A", color="#CA8A04", width="8.0", height="0.8", fontname="Arial Bold")

    # --- INTER-COMPONENT EXPLICIT CONNECTIONS ---
    
    # Inputs -> Gateway
    dot.edge("q_input", "api")
    dot.edge("r_input", "api")
    
    # Gateway -> RAG
    dot.edge("api", "retrieve")
    
    # Gateway -> Eval
    dot.edge("api", "bench")

    # Generate <-> Tools (Bidirectional)
    dot.edge("generate", "pubmed", dir="both")
    dot.edge("generate", "chronos", dir="both")

    # RAG <-> Eval (Bidirectional compound edge connecting the two large blocks)
    dot.edge("generate", "metrics", ltail="cluster_rag", lhead="cluster_eval", dir="both", constraint="false")

    # Eval -> Summary
    dot.edge("ablation", "summary", ltail="cluster_eval", constraint="false")

    # Summary -> Input Cluster (Feedback Loop)
    dot.edge("summary", "q_input", lhead="cluster_input", dir="forward", xlabel="Dashboard display  \n to TempoRAG   ", constraint="false")

    # Render at high resolution in three formats
    output_path = "docs/architecture_publication_ready"
    print(f"Rendering high quality outputs at {output_path} ...")
    
    dot.render(output_path, format="pdf", cleanup=True)
    dot.render(output_path, format="png", cleanup=True)
    dot.render(output_path, format="svg", cleanup=True)
    
    print("Done! High quality PDF, PNG (1200 DPI), and SVG generated.")

if __name__ == "__main__":
    generate()
