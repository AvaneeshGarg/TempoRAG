from typing import TypedDict, List, Dict, Any, Optional

class GraphState(TypedDict):
    """
    Represents the state of our graph.
    """
    question: str
    documents: List[Dict[str, Any]]
    answer: Optional[str]
    method: str  # 'etvd' | 'sigmoid' | 'bioscore'
    metadata_filters: Optional[Dict[str, Any]]
    timings: Optional[Dict[str, float]]  # ms per stage: retrieve, rerank, generate
