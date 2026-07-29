"""
Document Ingestion Script for Naturopathy Vector Search (Qdrant)

Scans backend/data/docs/ for PDF files, extracts text page by page,
chunks text into semantic sections, and indexes them into Qdrant.
"""

import os
import sys
import logging
from typing import List, Dict, Any

# Ensure backend root is in import path
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))

from pypdf import PdfReader
from rag.qdrant_store import add_document_chunks, get_qdrant_client

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
