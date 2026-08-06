"""
Document Ingestion Script for Naturopathy Vector Search (Qdrant)

Scans backend/data/docs/ for PDF files, extracts text page by page,
chunks text into semantic sections, and indexes them into Qdrant.
"""

import os
import sys
import logging
import json
import uuid
from typing import List, Dict, Any, Generator

# Ensure backend root is in import path
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))

from pypdf import PdfReader
import hashlib
from rag.qdrant_store import add_document_chunks, get_qdrant_client, get_document_hash, delete_document_by_source

logging.basicConfig(level=logging.INFO, format="%(asctime)s - %(levelname)s - %(message)s")
logger = logging.getLogger("ingest_docs")

DOCS_DIR = os.path.join(os.path.dirname(__file__), "data", "docs")

def chunk_text(text: str, chunk_size: int = 800, overlap: int = 150) -> List[str]:
    """Splits text into overlapping chunks of approximately chunk_size characters."""
    chunks = []
    start = 0
    while start < len(text):
        end = start + chunk_size
        chunk = text[start:end].strip()
        if chunk:
            chunks.append(chunk)
        start += (chunk_size - overlap)
    return chunks


def parse_pdf(file_path: str) -> List[Dict[str, Any]]:
    """Parses a single PDF file and extracts text chunks with page metadata."""
    file_name = os.path.basename(file_path)
    logger.info(f"Parsing PDF: {file_name}...")

    chunks_with_metadata = []
    try:
        reader = PdfReader(file_path)
        for page_num, page in enumerate(reader.pages, start=1):
            text = page.extract_text() or ""
            if not text.strip():
                continue

            page_chunks = chunk_text(text)
            for chunk in page_chunks:
                chunks_with_metadata.append({
                    "text": chunk,
                    "source": file_name,
                    "page": page_num,
                    "title": file_name.replace(".pdf", "").replace("_", " ").title(),
                    "category": "naturopathy_book"
                })

        logger.info(f"Extracted {len(chunks_with_metadata)} chunks from {file_name} across {len(reader.pages)} pages.")
    except Exception as e:
        logger.error(f"Failed to parse PDF {file_name}: {e}")

    return chunks_with_metadata


def yield_ingestion_progress(file_path: str) -> Generator[str, None, None]:
    """Generator that parses a PDF and yields progress updates for SSE, then embeds."""
    file_name = os.path.basename(file_path)
    
    yield json.dumps({"status": "starting", "message": f"Starting ingestion for {file_name}..."}) + "\n"
    
    # 1. Compute file hash
    sha256_hash = hashlib.sha256()
    with open(file_path, "rb") as f:
        for byte_block in iter(lambda: f.read(4096), b""):
            sha256_hash.update(byte_block)
    current_hash = sha256_hash.hexdigest()
    
    # Generate stable doc_id based on filename
    doc_id = str(uuid.uuid5(uuid.NAMESPACE_URL, file_name))
    
    # 2. Check if already ingested with same hash
    existing_hash = get_document_hash(file_name)
    if existing_hash == current_hash:
        yield json.dumps({"status": "complete", "progress": 100, "message": f"{file_name} is already up to date in Vector DB."}) + "\n"
        return
    elif existing_hash is not None:
        yield json.dumps({"status": "starting", "message": f"{file_name} was updated. Deleting old embeddings..."}) + "\n"
        delete_document_by_source(file_name)
    
    chunks_with_metadata = []
    try:
        reader = PdfReader(file_path)
        total_pages = len(reader.pages)
        
        for page_num, page in enumerate(reader.pages, start=1):
            text = page.extract_text() or ""
            if text.strip():
                page_chunks = chunk_text(text)
                for chunk in page_chunks:
                    chunks_with_metadata.append({
                        "text": chunk,
                        "source": file_name,
                        "page": page_num,
                        "title": file_name.replace(".pdf", "").replace("_", " ").title(),
                        "category": "naturopathy_book"
                    })
            
            # Yield progress every page
            yield json.dumps({
                "status": "parsing", 
                "progress": round(page_num / total_pages * 50), # 0-50% for parsing
                "message": f"Parsed page {page_num}/{total_pages}..."
            }) + "\n"
            
        yield json.dumps({
            "status": "embedding", 
            "progress": 55,
            "message": f"Extracted {len(chunks_with_metadata)} chunks. Starting embedding..."
        }) + "\n"
        
        if chunks_with_metadata:
            # Note: add_document_chunks could be slow. To be truly streaming during embedding, 
            # we would need to yield from inside add_document_chunks or chunk the chunks.
            # For simplicity, we chunk them here in batches of 10.
            total_chunks = len(chunks_with_metadata)
            batch_size = 10
            inserted = 0
            
            for i in range(0, total_chunks, batch_size):
                batch = chunks_with_metadata[i:i+batch_size]
                count = add_document_chunks(batch, file_hash=current_hash, doc_id=doc_id)
                inserted += count
                progress = 55 + round((inserted / total_chunks) * 45) # 55-100% for embedding
                yield json.dumps({
                    "status": "embedding",
                    "progress": progress,
                    "message": f"Embedded {inserted}/{total_chunks} chunks..."
                }) + "\n"
                
            yield json.dumps({
                "status": "complete",
                "progress": 100,
                "message": f"Successfully ingested {inserted} chunks into Qdrant!"
            }) + "\n"
        else:
            yield json.dumps({"status": "complete", "progress": 100, "message": "No text found in PDF."}) + "\n"
            
    except Exception as e:
        logger.error(f"Failed to ingest {file_name}: {e}")
        yield json.dumps({"status": "error", "message": f"Error: {str(e)}"}) + "\n"


def run_ingestion():
    """Main ingestion entrypoint."""
    os.makedirs(DOCS_DIR, exist_ok=True)
    pdf_files = [f for f in os.listdir(DOCS_DIR) if f.lower().endswith(".pdf")]

    if not pdf_files:
        logger.warning(
            f"No PDF files found in {DOCS_DIR}.\n"
            f"--> Please drop your Naturopathy PDF books into: {DOCS_DIR}\n"
            f"--> Then run: python ingest_docs.py"
        )
        return

    logger.info(f"Found {len(pdf_files)} PDF file(s) to process: {pdf_files}")
    total_inserted = 0

    for file_name in pdf_files:
        file_path = os.path.join(DOCS_DIR, file_name)
        chunks = parse_pdf(file_path)
        if chunks:
            count = add_document_chunks(chunks)
            total_inserted += count

    logger.info(f"🎉 Ingestion complete! Total {total_inserted} chunks stored in Qdrant.")


if __name__ == "__main__":
    run_ingestion()
