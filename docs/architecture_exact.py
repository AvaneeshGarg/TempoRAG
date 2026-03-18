from graphviz import Digraph

def create_architecture_diagram():
    dot = Digraph("TempoRAG_Architecture", format="svg")
    dot.attr(rankdir="LR", size="12,8!", dpi="300")
    dot.attr(fontname="Arial, Helvetica, sans-serif")
    dot.attr(nodesep="0.6", ranksep="0.8")

    # Global styles
    base_color = "black"
    border_width = "1.5"
    font_family = "Arial, Helvetica, sans-serif"

    # --- Title ---
    dot.attr(label="TempoRAG: Research Methodology Diagram\n\n", labelloc="t", fontsize="24", fontname=f"{font_family} Bold", fontcolor="black")

    # --- Clinical Input (Frontend) [Left] ---
    with dot.subgraph(name="cluster_input") as input_cluster:
        input_cluster.attr(label="CLINICAL\nINPUT\n(Frontend)", style="filled,rounded", color="#2B71B9", fillcolor="#4785C6", fontcolor="white", fontname=f"{font_family} Bold", fontsize="14", penwidth="2")
        input_cluster.node_attr.update(shape="box", style="filled,rounded", fillcolor="#F8FAFC", color="black", penwidth="1", fontname=font_family, fontsize="14", width="1.6", height="0.8")
        
        input_cluster.node("query_input", "Clinical\nQuery Input")
        input_cluster.node("risk_input", "Risk\nParameter\nInput")

        # Invisible edge to force vertical stacking
        input_cluster.edge("query_input", "risk_input", style="invis")

    # --- API Gateway [Middle Left] ---
    dot.node("api_gateway", "API\nGATEWAY", shape="box", style="filled,rounded", fillcolor="#A8D0E6", color="black", penwidth="1", fontname=f"{font_family} Bold", fontsize="14", width="1.2", height="5.5")

    # --- Right Side Grouping (to manage layout) ---
    with dot.subgraph(name="cluster_right_side") as right_side:
        right_side.attr(style="invis")

        # --- Agentic RAG Pipeline [Top Middle] ---
        with right_side.subgraph(name="cluster_rag") as rag_cluster:
            rag_cluster.attr(label="AGENTIC RAG PIPELINE\n(LangGraph)", style="filled,rounded", color="black", fillcolor="#F1F5F9", fontname=f"{font_family} Bold", fontsize="14", penwidth=border_width)
            rag_cluster.node_attr.update(shape="box", style="filled,rounded", fillcolor="#DDEBFA", color="black", penwidth="1", fontname=font_family, fontsize="13", width="1.8", height="2.2")
            
            rag_cluster.node("retrieve", "1. RETRIEVE\nNODE\n\nSapBERT\n&\nFAISS")
            rag_cluster.node("rerank", "2. RERANK\nNODE\n\nConfigurable\nDecay: ETVD,\nSigmoid,\nBioScore")
            rag_cluster.node("generate", "3. GENERATE\nNODE\n\nTool-\nAugmented\nLLM")

            # Sequential flow
            rag_cluster.edge("retrieve", "rerank", penwidth="2", arrowhead="normal")
            rag_cluster.edge("rerank", "generate", penwidth="2", arrowhead="normal")

        # --- Clinical Tool Layer [Top Right] ---
        with right_side.subgraph(name="cluster_tools") as tools_cluster:
            tools_cluster.attr(label="CLINICAL TOOL\nLAYER\n(LangChain)", style="filled,rounded", color="black", fillcolor="#F1F5F9", fontname=f"{font_family} Bold", fontsize="12", penwidth=border_width)
            tools_cluster.node_attr.update(shape="box", style="filled,rounded", fillcolor="#DDEBFA", color="black", penwidth="1", fontname=font_family, fontsize="13", width="2.2", height="0.8")
            
            tools_cluster.node("tool_pubmed", "search_pubmed")
            tools_cluster.node("tool_predict", "predict_heart_\nfailure_risk\n(ChronosModel)")

            # Invisible edge for vertical stacking inside the cluster
            tools_cluster.edge("tool_pubmed", "tool_predict", style="invis")

        # --- Offline Evaluation Subsystem [Bottom Middle/Right] ---
        with right_side.subgraph(name="cluster_eval") as eval_cluster:
            eval_cluster.attr(label="OFFLINE EVALUATION SUBSYSTEM", style="filled,rounded", color="black", fillcolor="#F1F5F9", fontname=f"{font_family} Bold", fontsize="14", penwidth=border_width)
            eval_cluster.node_attr.update(shape="box", style="filled,rounded", fillcolor="#DDEBFA", color="black", penwidth="1", fontname=font_family, fontsize="12", width="1.4", height="0.8")
            
            eval_cluster.node("eval_benchmark", "BENCHMARK\nDATASET")
            eval_cluster.node("eval_ablation", "ABLATION\nRUNNER")
            eval_cluster.node("eval_metrics", "METRICS\nENGINE")
            eval_cluster.node("eval_results", "RESULTS")

            # Sequential flow
            eval_cluster.edge("eval_benchmark", "eval_ablation", penwidth="2", arrowhead="normal")
            eval_cluster.edge("eval_ablation", "eval_metrics", penwidth="2", arrowhead="normal")
            eval_cluster.edge("eval_metrics", "eval_results", penwidth="2", arrowhead="normal")

        # --- Summary Box [Very Bottom] ---
        dot.node("summary_insight", "CLINICAL INSIGHT & RESULTS SUMMARY", shape="box", style="filled,rounded", fillcolor="#FFF3CD", color="black", penwidth=border_width, fontname=f"{font_family} Bold", fontsize="14", width="8.5", height="1.0")


    # --- Main Edges / Connections ---
    
    # Input to Gateway (Merge points logically)
    dot.edge("query_input", "api_gateway", penwidth="2", arrowhead="normal")
    
    # Gateway to RAG & Eval
    dot.edge("api_gateway", "retrieve", penwidth="2", arrowhead="normal")
    dot.edge("api_gateway", "eval_benchmark", penwidth="2", arrowhead="normal")

    # Generate to/from Tools (Bidirectional)
    # Graphviz doesn't do true bidirectional straight easily without constraint=false hacks,
    # but dir="both" works for simple endpoints.
    dot.edge("generate", "tool_pubmed", dir="both", penwidth="2", arrowhead="normal", arrowtail="normal")
    dot.edge("generate", "tool_predict", dir="both", penwidth="2", arrowhead="normal", arrowtail="normal")

    # RAG <-> Eval (Bi-directional in the image between RAG box and EVAL box)
    # We'll attach it roughly from generate to the top of eval
    dot.edge("generate", "eval_metrics", dir="both", penwidth="2", arrowhead="normal", arrowtail="normal", constraint="false")

    # Eval to Summary
    dot.edge("eval_ablation", "summary_insight", penwidth="2", arrowhead="normal", constraint="false")
    
    # Summary feedback to Input
    # We draw an edge from left side of summary to bottom of input cluster using orthogonal routing
    dot.attr(splines="ortho")
    
    # Create an invisible point to force the "Dashboard display to TempoRAG" text placement
    dot.node("feedback_anchor", shape="point", width="0", height="0")
    dot.edge("summary_insight", "feedback_anchor", dir="none", penwidth="2", tailport="w")
    dot.edge("feedback_anchor", "query_input", penwidth="2", arrowhead="normal", xlabel="Dashboard display\n to TempoRAG", fontname=font_family, fontsize="14", headport="s")


    # Render the graph
    output_path = "docs/architecture_exact_match"
    dot.render(output_path, view=False, cleanup=True)
    print(f"Diagram successfully generated at: {output_path}.svg")

if __name__ == "__main__":
    create_architecture_diagram()
