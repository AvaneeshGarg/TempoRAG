# ── Stage 1: Builder ───────────────────────────────────────────────────────
FROM python:3.11-slim AS builder

WORKDIR /app

# System build deps (minimal)
RUN apt-get update && apt-get install -y --no-install-recommends \
    build-essential \
    && rm -rf /var/lib/apt/lists/*

COPY requirements.txt .

# Install CPU-only PyTorch FIRST (saves ~1.5 GB vs default CUDA build)
RUN pip install --no-cache-dir --upgrade pip && \
    pip install --no-cache-dir \
        torch \
        --index-url https://download.pytorch.org/whl/cpu

# Install remaining dependencies (torch already present, won't reinstall)
RUN pip install --no-cache-dir -r requirements.txt

# ── Stage 2: Runtime ───────────────────────────────────────────────────────
FROM python:3.11-slim AS runtime

WORKDIR /app

# Copy only installed packages from builder
COPY --from=builder /usr/local/lib/python3.11/site-packages /usr/local/lib/python3.11/site-packages
COPY --from=builder /usr/local/bin /usr/local/bin

# Copy ONLY the application code needed at runtime
COPY backend/ ./backend/
COPY src/ ./src/
COPY data/ ./data/

# Create dir for eval results (used by /metrics endpoint)
RUN mkdir -p evaluation/results

# Railway injects $PORT automatically
EXPOSE 8001

# The shell form (without brackets) is required to expand the $PORT environment variable
CMD uvicorn backend.app:app --host 0.0.0.0 --port ${PORT:-8001} --workers 1
