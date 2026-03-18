
import os
import sys
import json
import time
from fastapi import FastAPI, HTTPException, Query
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import StreamingResponse
from pydantic import BaseModel
from dotenv import load_dotenv
from starlette.middleware.sessions import SessionMiddleware

# Add project root to sys.path
current_dir = os.path.dirname(os.path.abspath(__file__))
project_root = os.path.dirname(current_dir)
sys.path.append(project_root)

from src.graph import build_graph
from backend.auth import router as auth_router, get_current_user

load_dotenv(override=True)

app = FastAPI(title="Clinical RAG API", version="1.0")

# ── Session middleware (must come BEFORE CORS) ───────────────────────────────
SESSION_SECRET = os.getenv("SESSION_SECRET", "changeme-session-secret-32chars!")
app.add_middleware(SessionMiddleware, secret_key=SESSION_SECRET)

# ── CORS ─────────────────────────────────────────────────────────────────────
FRONTEND_URL = os.getenv("FRONTEND_URL", "http://localhost:8000")
ALLOWED_ORIGINS = [
    "http://localhost:8000",
    "http://127.0.0.1:8000",
    FRONTEND_URL,
]

app.add_middleware(
    CORSMiddleware,
    allow_origins=ALLOWED_ORIGINS,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# ── Mount auth routes ─────────────────────────────────────────────────────────
app.include_router(auth_router)

# ─── Schemas ────────────────────────────────────────────────────────────────
class QueryRequest(BaseModel):
    question: str
    method: str = "etvd"

class PredictRequest(BaseModel):
    age: int
    anaemia: int
    creatinine_phosphokinase: int
    diabetes: int
    ejection_fraction: int
    high_blood_pressure: int
    platelets: float
    serum_creatinine: float
    serum_sodium: int
    sex: int
    smoking: int

class SearchRequest(BaseModel):
    query: str

class EvaluateRequest(BaseModel):
    question: str
    ground_truth: str
    methods: list = ["no_decay", "etvd", "sigmoid", "bioscore"]

from src.tools import get_risk_predictions, search_pubmed

class QueryResponse(BaseModel):
    answer: str
    sources: list
    timings: dict = {}

# ─── Persistent metrics store (in-memory, updated by eval script via file) ──
METRICS_FILE = os.path.join(project_root, "evaluation", "results", "latest_metrics.json")

# ─── Endpoints ───────────────────────────────────────────────────────────────
@app.get("/health")
def health_check():
    return {"status": "ok"}

@app.get("/metrics")
def get_metrics():
    """Return latest RAGAS evaluation results."""
    if not os.path.exists(METRICS_FILE):
        return {
            "status": "no_results",
            "message": "Run evaluation/ragas_eval.py first to generate metrics.",
            "results": {}
        }
    with open(METRICS_FILE, "r") as f:
        data = json.load(f)
    return {"status": "ok", "results": data}

@app.post("/evaluate")
def evaluate_single(request: EvaluateRequest):
    """Run a single Q&A through all requested decay methods and compare."""
    results = {}
    for method in request.methods:
        m = method if method != "no_decay" else "etvd"
        t0 = time.perf_counter()
        rag_app = build_graph()
        inputs = {
            "question": request.question,
            "documents": [],
            "answer": "",
            "method": m,
            "metadata_filters": {},
            "timings": {}
        }
        result = rag_app.invoke(inputs)
        elapsed = round((time.perf_counter() - t0) * 1000, 1)
        results[method] = {
            "answer": result.get("answer", ""),
            "timings": result.get("timings", {}),
            "total_ms": elapsed,
            "sources": [
                {"year": d.get("year"), "title": d.get("title"), "score": d.get("final_score")}
                for d in result.get("documents", [])
            ]
        }
    return {"question": request.question, "ground_truth": request.ground_truth, "results": results}

@app.post("/search")
def search_medical(request: SearchRequest):
    """Search using Groq LLM synthesis + PubMed papers."""
    synthesis = ""
    pubmed_results = ""

    try:
        from langchain_groq import ChatGroq
        from langchain_core.messages import SystemMessage, HumanMessage

        llm = ChatGroq(model_name="llama-3.3-70b-versatile")
        system = SystemMessage(content="""You are a senior clinical research analyst with access to the full landscape of medical literature.
When given a medical query, synthesize findings from multiple authoritative sources including:
- PubMed / MEDLINE
- NIH (National Institutes of Health)
- WHO (World Health Organization)
- AHA (American Heart Association)
- CDC (Centers for Disease Control)
- ESC (European Society of Cardiology)
- Cochrane Reviews
- NEJM, The Lancet, JAMA, BMJ

Provide a structured, evidence-based synthesis with:
1. A concise summary of findings
2. Key statistics or risk factors if available
3. Notable studies or guidelines
4. Source references (mention the institution/journal)

Be specific and cite source types (e.g. 'According to NIH...', 'AHA guidelines state...').""")
        human = HumanMessage(content=f"Research query: {request.query}")
        response = llm.invoke([system, human])
        synthesis = response.content
    except Exception as e:
        synthesis = f"LLM synthesis unavailable: {str(e)}"

    try:
        pubmed_results = search_pubmed.invoke(request.query)
    except Exception as e:
        pubmed_results = f"PubMed search unavailable: {str(e)}"

    return {"synthesis": synthesis, "pubmed_results": pubmed_results}

@app.post("/predict")
def predict_risk(request: PredictRequest):
    try:
        data = request.model_dump()
        result = get_risk_predictions(**data)
        return result
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@app.post("/query", response_model=QueryResponse)
def query_rag(request: QueryRequest):
    try:
        rag_app = build_graph()
        inputs = {
            "question": request.question,
            "documents": [],
            "answer": "",
            "method": request.method,
            "metadata_filters": {},
            "timings": {}
        }
        result = rag_app.invoke(inputs)

        formatted_sources = []
        for doc in result.get("documents", []):
            formatted_sources.append({
                "year": doc.get("year"),
                "title": doc.get("title"),
                "score": doc.get("final_score"),
                "pmid": doc.get("pmid", ""),
            })

        return {
            "answer": result.get("answer", "No answer generated."),
            "sources": formatted_sources,
            "timings": result.get("timings", {})
        }

    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@app.get("/query/stream")
async def query_stream(
    question: str = Query(...),
    method: str = Query(default="etvd")
):
    """
    True SSE streaming endpoint.
    Runs retrieve+rerank synchronously, then streams LLM tokens.
    Each event is a JSON object: {type, content}
    """
    from src.nodes import retrieve_node, rerank_node, _load_resources
    from langchain_groq import ChatGroq
    from langchain_openai import ChatOpenAI
    from langchain_core.messages import SystemMessage, HumanMessage

    async def event_gen():
        try:
            # ── 1. Retrieval + Reranking (non-streaming) ─────────────────────
            state = {
                "question": question,
                "documents": [],
                "answer": "",
                "method": method,
                "metadata_filters": {},
                "timings": {}
            }
            state.update(retrieve_node(state))
            state.update(rerank_node(state))

            docs = state["documents"]
            context_str = ""
            for i, doc in enumerate(docs):
                content = doc['content'][:500] + "..." if len(doc['content']) > 500 else doc['content']
                context_str += f"[{i+1}] Year: {doc['year']} | Title: {doc['title']}\n{content}\n\n"

            # ── 2. Choose streaming LLM ──────────────────────────────────────
            if os.environ.get("NVIDIA_API_KEY"):
                llm_stream = ChatOpenAI(
                    model="qwen/qwen3.5-397b-a17b",
                    api_key=os.environ["NVIDIA_API_KEY"],
                    base_url="https://integrate.api.nvidia.com/v1",
                    streaming=True,
                )
            elif os.environ.get("GROQ_API_KEY"):
                llm_stream = ChatGroq(
                    model_name="llama-3.3-70b-versatile",
                    streaming=True,
                )
            else:
                yield f"data: {json.dumps({'type': 'error', 'content': 'No LLM API key configured.'})}\n\n"
                return

            system_msg = SystemMessage(content="You are a clinical assistant. Answer based on the provided evidence context. Be comprehensive but concise.")
            human_msg = HumanMessage(content=f"Context:\n{context_str}\n\nQuestion: {question}")

            # ── 3. Stream tokens ─────────────────────────────────────────────
            t0 = time.perf_counter()
            async for chunk in llm_stream.astream([system_msg, human_msg]):
                token = chunk.content
                if token:
                    yield f"data: {json.dumps({'type': 'token', 'content': token})}\n\n"

            elapsed_ms = round((time.perf_counter() - t0) * 1000, 1)

            # ── 4. Send sources after streaming completes ────────────────────
            formatted_sources = [
                {
                    "year": d.get("year"),
                    "title": d.get("title"),
                    "score": d.get("final_score"),
                    "pmid": d.get("pmid", ""),
                }
                for d in docs
            ]
            yield f"data: {json.dumps({'type': 'sources', 'content': formatted_sources, 'timings': {'generate_ms': elapsed_ms, **state.get('timings', {})}})}\n\n"
            yield f"data: {json.dumps({'type': 'done'})}\n\n"

        except Exception as e:
            yield f"data: {json.dumps({'type': 'error', 'content': str(e)})}\n\n"

    return StreamingResponse(
        event_gen(),
        media_type="text/event-stream",
        headers={
            "Cache-Control": "no-cache",
            "X-Accel-Buffering": "no",
            "Access-Control-Allow-Origin": "http://localhost:8000",
        }
    )

if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=8001)
