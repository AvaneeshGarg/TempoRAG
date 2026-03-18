from graphviz import Digraph

dot = Digraph(format='svg')
dot.attr(rankdir='LR', size='16,10')
dot.attr(fontname="Helvetica")

# Global node style
dot.attr('node', shape='box', style='rounded,filled', fontname="Helvetica")

# ---------------------------
# CLINICAL INPUT
# ---------------------------
with dot.subgraph(name='cluster_input') as c:
    c.attr(label='CLINICAL INPUT (Frontend)',
           style='rounded,filled',
           color='#1f4e79',
           fillcolor='#dbe9f4',
           fontname="Helvetica-Bold")

    c.node('clinical_query', 'Clinical Query Input', fillcolor='white')
    c.node('risk_param', 'Risk Parameter Input', fillcolor='white')

# ---------------------------
# API GATEWAY
# ---------------------------
dot.node('api', 'API GATEWAY',
         fillcolor='#a9d6e5',
         color='#2a6f97',
         style='rounded,filled')

# ---------------------------
# AGENTIC RAG PIPELINE
# ---------------------------
with dot.subgraph(name='cluster_rag') as c:
    c.attr(label='AGENTIC RAG PIPELINE (LangGraph)',
           style='rounded,filled',
           color='#3a5a40',
           fillcolor='#e9f5ec')

    c.node('retrieve', '1. RETRIEVE NODE\nSapBERT + FAISS',
           fillcolor='#cfe2ff')

    c.node('rerank', '2. RERANK NODE\nDecay: ETVD, Sigmoid, BioScore',
           fillcolor='#cfe2ff')

    c.node('generate', '3. GENERATE NODE\nTool-Augmented LLM',
           fillcolor='#cfe2ff')

# ---------------------------
# CLINICAL TOOL LAYER
# ---------------------------
with dot.subgraph(name='cluster_tools') as c:
    c.attr(label='CLINICAL TOOL LAYER (LangChain)',
           style='rounded,filled',
           color='#6c757d',
           fillcolor='#f1f3f5')

    c.node('pubmed', 'search_pubmed',
           fillcolor='#ffffff')

    c.node('predict', 'predict_heart_failure_risk\n(ChronosModel)',
           fillcolor='#ffffff')

# ---------------------------
# OFFLINE EVALUATION
# ---------------------------
with dot.subgraph(name='cluster_eval') as c:
    c.attr(label='OFFLINE EVALUATION SUBSYSTEM',
           style='rounded,filled',
           color='#7f5539',
           fillcolor='#fff4e6')

    c.node('benchmark', 'BENCHMARK DATASET', fillcolor='white')
    c.node('ablation', 'ABLATION RUNNER', fillcolor='white')
    c.node('metrics', 'METRICS ENGINE', fillcolor='white')
    c.node('results', 'RESULTS', fillcolor='white')

# ---------------------------
# FINAL SUMMARY
# ---------------------------
dot.node('summary',
         'CLINICAL INSIGHT & RESULTS SUMMARY',
         fillcolor='#fde68a',
         color='#b45309',
         style='rounded,filled')

# ---------------------------
# CONNECTIONS
# ---------------------------
dot.edge('clinical_query', 'api')
dot.edge('risk_param', 'api')

dot.edge('api', 'retrieve')
dot.edge('retrieve', 'rerank')
dot.edge('rerank', 'generate')

dot.edge('generate', 'pubmed')
dot.edge('generate', 'predict')

dot.edge('api', 'benchmark')
dot.edge('benchmark', 'ablation')
dot.edge('ablation', 'metrics')
dot.edge('metrics', 'results')
dot.edge('results', 'summary')

# Render file
dot.render('TempoRAG_Research_Methodology_Diagram', view=True)