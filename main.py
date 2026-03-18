import argparse
import sys
import os
from dotenv import load_dotenv

# Load env before imports
load_dotenv(override=True)

api_key = os.getenv("GROQ_API_KEY")
if api_key:
    print(f"DEBUG: Loaded GROQ_API_KEY starting with: {api_key[:10]}...")
else:
    print("DEBUG: GROQ_API_KEY not found in environment.")

from src.ingestion import ingest_data
from src.graph import build_graph

def main():
    parser = argparse.ArgumentParser(description="Temporal RAG CLI")
    subparsers = parser.add_subparsers(dest="command", required=True)
    
    # Ingest command
    parser_ingest = subparsers.add_parser("ingest", help="Run data ingestion pipeline")
    
    # Query command
    parser_query = subparsers.add_parser("query", help="Ask a question")
    parser_query.add_argument("question", type=str, help="The clinical question")
    parser_query.add_argument("--method", type=str, choices=["etvd", "sigmoid", "bioscore"], default="etvd", help="Temporal decay method")
    
    args = parser.parse_args()
    
    if args.command == "ingest":
        print("Running ingestion...")
        ingest_data()
        
    elif args.command == "query":
        print(f"Querying with method: {args.method}")
        app = build_graph()
        
        inputs = {
            "question": args.question,
            "documents": [],
            "answer": "",
            "method": args.method,
            "metadata_filters": {}
        }
        
        result = app.invoke(inputs)
        
        print("\n=== ANSWER ===")
        print(result["answer"])
        print("\n=== SOURCES ===")
        for doc in result["documents"]:
            print(f"- {doc['year']} | Score: {doc['final_score']:.3f} | {doc['title']}")

if __name__ == "__main__":
    main()
