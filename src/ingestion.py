import os
import re
import uuid
import pandas as pd
import nltk
from nltk.tokenize import sent_tokenize
from sentence_transformers import SentenceTransformer
import faiss
import numpy as np
from typing import List, Dict
import tqdm

# Constants
DATA_DIR = "data"
CSV_FILENAME = "pubmed_heart_failure_extended.csv"
CLEANED_CSV_FILENAME = "pubmed_cleaned.csv"
CHUNKS_CSV_FILENAME = "pubmed_chunks.csv"
METADATA_FILENAME = "pubmed_metadata.csv"
FAISS_INDEX_FILENAME = "pubmed_faiss.index"
MODEL_NAME = "cambridgeltl/SapBERT-from-PubMedBERT-fulltext"

def setup_nltk():
    """Ensure NLTK data is downloaded."""
    try:
        nltk.data.find('tokenizers/punkt')
    except LookupError:
        nltk.download('punkt')
    try:
        nltk.data.find('tokenizers/punkt_tab')
    except LookupError:
        nltk.download('punkt_tab')

def clean_text(text):
    """Clean text by removing excessive whitespace."""
    text = re.sub(r"\s+", " ", str(text))
    text = text.replace("\n", " ")
    return text.strip()

def extract_pmid(url_str):
    """Extracts numbers from the end of a PubMed URL."""
    try:
        match = re.search(r'(\d+)/?$', str(url_str))
        return match.group(1) if match else "0"
    except:
        return "0"

def extract_year(date_str):
    """Extracts the first 4-digit year found in the string."""
    try:
        match = re.search(r'(\d{4})', str(date_str))
        return match.group(1) if match else "0"
    except:
        return "0"

def chunk_text(text, max_tokens=350, overlap=100) -> List[str]:
    """Chunks text into sliding windows based on sentence boundaries."""
    sentences = sent_tokenize(text)
    chunks = []
    current_chunk = []
    current_word_count = 0
    
    for sentence in sentences:
        sentence_words = sentence.split()
        sentence_len = len(sentence_words)
        
        if current_word_count + sentence_len > max_tokens:
            chunks.append(" ".join(current_chunk))
            if overlap > 0 and current_chunk:
                all_words = " ".join(current_chunk).split()
                overlap_words = all_words[-overlap:]
                current_chunk = [" ".join(overlap_words)]
                current_word_count = len(overlap_words)
            else:
                current_chunk = []
                current_word_count = 0
        
        current_chunk.append(sentence)
        current_word_count += sentence_len
    
    if current_chunk:
        chunks.append(" ".join(current_chunk))
    return chunks

def ingest_data():
    """Main ingestion function."""
    print("--- Starting Ingestion ---")
    setup_nltk()
    
    raw_path = os.path.join(DATA_DIR, CSV_FILENAME)
    if not os.path.exists(raw_path):
        print(f"Error: {raw_path} not found.")
        return

    print("Loading dataset...")
    df = pd.read_csv(raw_path)
    print(f"Initial rows: {len(df)}")

    # 1. Processing
    print("Processing columns (PMID, Year, Cleaning)...")
    df['pmid'] = df['url'].apply(extract_pmid)
    df['year'] = df['pub_date'].apply(extract_year)
    df['title'] = df['title'].apply(clean_text)
    df['abstract'] = df['abstract'].apply(clean_text)
    
    # Remove duplicates and short abstracts
    df.drop_duplicates(subset=["title", "abstract"], inplace=True)
    df = df[df['abstract'].notna() & (df['abstract'].str.strip() != "")]
    df = df[df['abstract'].str.len() > 50]
    
    print(f"Processed rows: {len(df)}")
    
    # 2. Chunking
    print("Chunking text...")
    chunk_rows = []
    for idx, row in df.iterrows():
        title = row.get("title", "")
        abstract = row.get("abstract", "")
        pmid = row.get("pmid", "0")
        year = row.get("year", "0")
        
        text = f"{title}. {abstract}"
        chunks = chunk_text(text)
        
        for chunk in chunks:
            chunk_rows.append({
                "chunk_id": str(uuid.uuid4()),
                "pmid": pmid,
                "year": year,
                "title": title,
                "text_chunk": chunk
            })
            
    chunk_df = pd.DataFrame(chunk_rows)
    print(f"Total chunks: {len(chunk_df)}")
    
    # Save chunks for debug (optional)
    # chunk_df.to_csv(os.path.join(DATA_DIR, CHUNKS_CSV_FILENAME), index=False)

    # 3. Embedding
    print("Loading embedding model...")
    model = SentenceTransformer(MODEL_NAME)
    
    print("Generating embeddings...")
    texts = chunk_df["text_chunk"].tolist()
    embeddings = model.encode(texts, batch_size=32, show_progress_bar=True)
    
    # Convert to float32 for FAISS
    embeddings = np.array(embeddings).astype("float32")
    
    # 4. Save FAISS Index
    print("Building FAISS index...")
    d = embeddings.shape[1]
    index = faiss.IndexFlatL2(d)
    index.add(embeddings)
    
    index_path = os.path.join(DATA_DIR, FAISS_INDEX_FILENAME)
    faiss.write_index(index, index_path)
    print(f"Saved FAISS index to {index_path}")
    
    # 5. Save Metadata
    # We must save metadata in the same order as embeddings
    metadata_path = os.path.join(DATA_DIR, METADATA_FILENAME)
    chunk_df.to_csv(metadata_path, index=False)
    print(f"Saved Metadata to {metadata_path}")
    print("--- Ingestion Complete ---")

if __name__ == "__main__":
    ingest_data()
