from langgraph.graph import StateGraph, START, END
from .state import GraphState
from .nodes import retrieve_node, rerank_node, generate_node

def build_graph():
    """
    Constructs the RAG workflow graph.
    """
    workflow = StateGraph(GraphState)
    
    # Add nodes
    workflow.add_node("retrieve", retrieve_node)
    workflow.add_node("rerank", rerank_node)
    workflow.add_node("generate", generate_node)
    
    # Add edges
    workflow.add_edge(START, "retrieve")
    workflow.add_edge("retrieve", "rerank")
    workflow.add_edge("rerank", "generate")
    workflow.add_edge("generate", END)
    
    # Compile
    app = workflow.compile()
    return app
