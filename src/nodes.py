import os
import time
import faiss
import pandas as pd
import numpy as np
from sentence_transformers import SentenceTransformer
from langchain_groq import ChatGroq
from langchain_openai import ChatOpenAI
from langchain_core.prompts import ChatPromptTemplate
from langchain_core.output_parsers import StrOutputParser

from .state import GraphState
from .utils import (
    dist_to_similarity, 
    temporal_decay_weight, 
    sigmoid_decay_weight, 
    compute_bioscore
)

from langchain_core.messages import HumanMessage, SystemMessage, ToolMessage
from .tools import predict_heart_failure_risk, search_pubmed
import json

# Constants (mirroring ingestion)
_PROJECT_ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
DATA_DIR = os.path.join(_PROJECT_ROOT, "data")
METADATA_FILENAME = "pubmed_metadata.csv"
FAISS_INDEX_FILENAME = "pubmed_faiss.index"
MODEL_NAME = "cambridgeltl/SapBERT-from-PubMedBERT-fulltext"

# Global Catching
_INDEX = None
_METADATA = None
_EMBED_MODEL = None

def _load_resources():
    global _INDEX, _METADATA, _EMBED_MODEL
    if _INDEX is None:
        print("Loading FAISS index and metadata...")
        index_path = os.path.join(DATA_DIR, FAISS_INDEX_FILENAME)
        meta_path = os.path.join(DATA_DIR, METADATA_FILENAME)
        
        if os.path.exists(index_path) and os.path.exists(meta_path):
            _INDEX = faiss.read_index(index_path)
            _METADATA = pd.read_csv(meta_path)
            # Replace NaNs
            _METADATA.fillna("", inplace=True) 
        else:
            raise FileNotFoundError("FAISS index or metadata not found. Run ingestion first.")
            
    if _EMBED_MODEL is None:
        print("Loading embedding model...")
        _EMBED_MODEL = SentenceTransformer(MODEL_NAME)

def retrieve_node(state: GraphState):
    """
    Retrieves documents based on the question.
    """
    t0 = time.perf_counter()
    _load_resources()
    question = state["question"]
    print(f"Retrieving for: {question}")
    
    # Embed query
    q_vec = _EMBED_MODEL.encode([question]).astype("float32")
    
    # Search — top 50 candidates
    D, I = _INDEX.search(q_vec, 50) 
    
    distances = D[0]
    indices = I[0]
    
    # Package retrieval results
    docs = []
    for dist, idx in zip(distances, indices):
        if idx == -1: continue
        row = _METADATA.iloc[idx]
        docs.append({
            "pmid": str(row.get("pmid", "")),
            "year": str(row.get("year", "")),
            "title": str(row.get("title", "")),
            "content": str(row.get("text_chunk", "")),
            "distance": float(dist)
        })

    elapsed_ms = (time.perf_counter() - t0) * 1000
    existing_timings = state.get("timings") or {}
    return {
        "documents": docs,
        "timings": {**existing_timings, "retrieve_ms": round(elapsed_ms, 2)}
    }

def rerank_node(state: GraphState):
    """
    Reranks documents based on the selected temporal method.
    """
    t0 = time.perf_counter()
    method = state.get("method", "etvd")
    documents = state["documents"]
    
    ranked_docs = []
    
    for doc in documents:
        # Calculate base similarity
        sim = dist_to_similarity(doc["distance"])
        year = doc["year"]
        
        # Calculate decay weight
        if method == "sigmoid":
            weight = sigmoid_decay_weight(year, threshold=10, steepness=0.5)
            final_score = sim * weight
        elif method == "bioscore":
            score = compute_bioscore(sim, year, alpha=0.7, beta=0.3)
            weight = 1.0
            final_score = score
        else: # etvd
            weight = temporal_decay_weight(year, lambda_decay=0.05)
            final_score = sim * weight
            
        doc["similarity"] = sim
        doc["decay_weight"] = weight
        doc["final_score"] = final_score
        ranked_docs.append(doc)
        
    # Sort descending
    ranked_docs.sort(key=lambda x: x["final_score"], reverse=True)
    
    # Keep top 5 for generation context
    top_k = 5
    elapsed_ms = (time.perf_counter() - t0) * 1000
    existing_timings = state.get("timings") or {}
    return {
        "documents": ranked_docs[:top_k],
        "timings": {**existing_timings, "rerank_ms": round(elapsed_ms, 2)}
    }

def generate_node(state: GraphState):
    """
    Generates answer using LLM, with access to prediction tools.
    """
    t0 = time.perf_counter()
    documents = state["documents"]
    question = state["question"]
    
    # Build context
    context_str = ""
    for i, doc in enumerate(documents):
        content = doc['content'][:500] + "..." if len(doc['content']) > 500 else doc['content']
        context_str += f"[{i+1}] Year: {doc['year']} | Title: {doc['title']}\n{content}\n\n"
        
    # Choose LLM — allow override for eval scripts to avoid rate limits
    model_name = os.environ.get("EVAL_MODEL", "llama-3.3-70b-versatile")
    if os.environ.get("NVIDIA_API_KEY"):
        llm_tools = ChatOpenAI(
            model="meta/llama3-70b-instruct", # Native tool caller
            api_key=os.environ["NVIDIA_API_KEY"], 
            base_url="https://integrate.api.nvidia.com/v1"
        )
        llm = ChatOpenAI(
            model="qwen/qwen3.5-397b-a17b", 
            api_key=os.environ["NVIDIA_API_KEY"], 
            base_url="https://integrate.api.nvidia.com/v1"
        )
    elif os.environ.get("GROQ_API_KEY"):
        # Use the tool-use–tuned model for function calling (avoids XML format bugs),
        # and the versatile model for final answer synthesis.
        llm_tools = ChatGroq(model_name="llama-3.1-8b-instant")
        llm       = ChatGroq(model_name=model_name)
    elif os.environ.get("OPENAI_API_KEY"):
        llm_tools = ChatOpenAI(model="gpt-4o-mini")
        llm       = ChatOpenAI(model="gpt-4o-mini")
    else:
        return {"answer": "No API key found for Nvidia, Groq or OpenAI."}
    
    # Tools available to the agent
    tools = [predict_heart_failure_risk, search_pubmed]
    
    # Bind tools to the tool-use–tuned model
    llm_with_tools = llm_tools.bind_tools(tools)

    
    system_msg = SystemMessage(content="""You are a clinical assistant.
    You have access to tools:
    1. 'predict_heart_failure_risk': For specific patient data.
    2. 'search_pubmed': For medical research and guidelines.

    Use them as needed to answer the user's question.
    When using 'predict_heart_failure_risk', assume 3-horizon risk (1-day, 7-day, 30-day).
    """)
    
    human_context = f"""Context:
    {context_str}
    
    Question: 
    {question}
    """
    
    messages = [system_msg, HumanMessage(content=human_context)]
    
    # 1. Invoke LLM — with fallback if tool-call format fails (Groq 400 / tool_use_failed)
    try:
        response = llm_with_tools.invoke(messages)
        tool_call_failed = False
    except Exception as e:
        err_str = str(e)
        if "tool_use_failed" in err_str or "400" in err_str or "failed_generation" in err_str:
            print(f"Tool call format error — retrying without tools: {e}")
            response = llm.invoke(messages)
            tool_call_failed = True
        else:
            raise

    messages.append(response)
    
    # 2. Check for tool calls (skip if we already fell back)
    if not tool_call_failed and response.tool_calls:
        print(f"Tool call detected: {response.tool_calls}")
        for tool_call in response.tool_calls:
            tool_output = "Unknown tool"
            if tool_call["name"] == "predict_heart_failure_risk":
                try:
                    tool_output = predict_heart_failure_risk.invoke(tool_call["args"])
                except Exception as e:
                    tool_output = f"Tool execution error: {str(e)}"
            elif tool_call["name"] == "search_pubmed":
                 try:
                    tool_output = search_pubmed.invoke(tool_call["args"])
                 except Exception as e:
                    tool_output = f"Tool execution error: {str(e)}"
            
            messages.append(ToolMessage(
                tool_call_id=tool_call["id"],
                content=str(tool_output),
                name=tool_call["name"]
            ))
        
        try:
            final_response = llm.invoke(messages)
            answer = final_response.content
        except Exception as e:
            # If final generation also fails, return what we have
            answer = response.content or f"Generation error: {str(e)}"
    else:
        answer = response.content

    elapsed_ms = (time.perf_counter() - t0) * 1000
    existing_timings = state.get("timings") or {}
    return {
        "answer": answer,
        "timings": {**existing_timings, "generate_ms": round(elapsed_ms, 2)}
    }
