# Temporal RAG Project

A LangChain and LangGraph implementation of Retrieval Augmented Generation with Temporal Decay ranking.

## Setup

```bash
uv sync
```

## Usage

### Ingestion
Run this first to prepare the data:
```bash
uv run python main.py ingest
```

### Querying
Ask questions:
```bash
uv run python main.py query "standard of care for heart failure" --method etvd
```
