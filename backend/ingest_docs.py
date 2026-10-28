"""
Document Ingestion for Naturopathy Vector Search (Qdrant)

Parses PDFs in backend/data/docs/ page by page, chunks the text and indexes it into Qdrant.

Ingestion is resumable. Progress per document is kept in the `document_ingestions` table:
- Chunking is deterministic, so chunk N of a given file version is always the same text.
- Each chunk gets a deterministic point id (filename + file hash + chunk index), so re-sending a
  batch overwrites it instead of duplicating it.
- `embedded_chunks` only advances after Qdrant has stored a batch, and the status becomes
  `completed` only after the last batch. A failed run resumes from `embedded_chunks`.
- Replacing a document keeps the old version searchable (`previous_hash`) until the new version
  completes; then the old chunks are deleted.

Run from the CLI with `python ingest_docs.py` (same resumable path as the admin UI). Don't run it
while the admin UI is ingesting the same file.
"""

import os
import sys
import logging
import uuid
import hashlib
import threading
from collections import Counter
from contextlib import contextmanager
from typing import List, Dict, Any, Optional, Callable

# Ensure backend root is in import path
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))

from pypdf import PdfReader
from rag.qdrant_store import (
    add_document_chunks,
    get_document_hash,
    get_document_chunk_count,
    delete_document_by_source,
    set_document_hash,
    get_document_texts,
)
from database import models as db_models
from database.models import DocumentIngestion

logger = logging.getLogger("ingest_docs")

DOCS_DIR = os.path.join(os.path.dirname(__file__), "data", "docs")
EMBED_BATCH_SIZE = 100

PENDING = "pending"
IN_PROGRESS = "in_progress"
COMPLETED = "completed"
FAILED = "failed"
LEGACY_UNVERIFIED_HASH = "legacy-unverified"  # marks stored chunks that couldn't be matched to the file
INTERRUPTED = "interrupted"  # shown for in_progress rows whose run is no longer alive (e.g. server restart)


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


def doc_path(filename: str) -> str:
    return os.path.join(DOCS_DIR, os.path.basename(filename))


def file_sha256(file_path: str) -> str:
    sha256_hash = hashlib.sha256()
    with open(file_path, "rb") as f:
        for byte_block in iter(lambda: f.read(65536), b""):
            sha256_hash.update(byte_block)
    return sha256_hash.hexdigest()


def chunk_point_id(filename: str, file_hash: str, index: int) -> str:
    return str(uuid.uuid5(uuid.NAMESPACE_URL, f"{filename}:{file_hash}:{index}"))


def extract_chunks(file_path: str) -> List[Dict[str, Any]]:
    """Parses a PDF into ordered text chunks with page metadata. Raises on unreadable files."""
    file_name = os.path.basename(file_path)
    reader = PdfReader(file_path)
    chunks_with_metadata = []
    for page_num, page in enumerate(reader.pages, start=1):
        text = page.extract_text() or ""
        if not text.strip():
            continue
        for chunk in chunk_text(text):
            chunks_with_metadata.append({
                "text": chunk,
                "source": file_name,
                "page": page_num,
                "title": file_name.replace(".pdf", "").replace("_", " ").title(),
                "category": "naturopathy_book"
            })
    return chunks_with_metadata


# ---------------------------------------------------------------------------
# Which documents are being ingested by this process
# ---------------------------------------------------------------------------
_active_lock = threading.Lock()
_active_ingestions: set = set()


def is_ingestion_running(filename: str) -> bool:
    with _active_lock:
        return filename in _active_ingestions


@contextmanager
def _claim(filename: str):
    with _active_lock:
        if filename in _active_ingestions:
            raise RuntimeError(f"{filename} is already being ingested")
        _active_ingestions.add(filename)
    try:
        yield
    finally:
        with _active_lock:
            _active_ingestions.discard(filename)


def start_ingestion_thread(filename: str, restart: bool = False) -> bool:
    """Starts ingestion in a background thread. Returns False if it is already running."""
    with _active_lock:
        if filename in _active_ingestions:
            return False
        _active_ingestions.add(filename)

    def _run():
        try:
            ingest_document(filename, restart=restart)
        except Exception:
            logger.exception(f"Ingestion thread for {filename} crashed")
        finally:
            with _active_lock:
                _active_ingestions.discard(filename)

    threading.Thread(target=_run, daemon=True, name=f"ingest-{filename}").start()
    return True


# ---------------------------------------------------------------------------
# Status rows
# ---------------------------------------------------------------------------
def _new_session():
    if db_models.SessionLocal is None:
        raise RuntimeError("Database unavailable: ingestion status can't be stored")
    return db_models.SessionLocal()


def _start_new_version(row: DocumentIngestion, new_hash: str) -> None:
    """Points the row at a new file version. A completed old version stays live until the new one completes."""
    if row.status == COMPLETED and row.file_hash:
        row.previous_hash = row.file_hash
    # Otherwise keep the existing previous_hash: that older version is still the live one, and the
    # unfinished version's chunks are cleaned up when the new version starts from chunk 0.
    row.file_hash = new_hash
    row.status = PENDING
    row.total_chunks = 0
    row.embedded_chunks = 0
    row.last_error = None


def _adoptable_prefix(filename: str, chunks: List[Dict[str, Any]], stored_count: int) -> int:
    """Returns stored_count if the stored chunk texts are exactly the first stored_count chunks, else 0."""
    try:
        stored = get_document_texts(filename)
    except Exception as e:
        logger.warning(f"{filename}: could not read stored chunks to resume ({type(e).__name__}); will restart instead.")
        return 0
    if len(stored) != stored_count:
        return 0
    expected = [c["text"] for c in chunks[:stored_count]]
    return stored_count if Counter(stored) == Counter(expected) else 0


def _create_row(db, filename: str, current_hash: str, qdrant_count: Optional[int] = None) -> DocumentIngestion:
    """Creates the status row, recognising chunks ingested before status tracking existed."""
    if qdrant_count is None:
        qdrant_count = get_document_chunk_count(filename)
    if qdrant_count < 0:
        # Without the count we can't tell whether chunks already exist; don't guess.
        raise RuntimeError("The vector database query failed (see the backend log for the Qdrant error)")
    row = DocumentIngestion(filename=filename, file_hash=current_hash, status=PENDING,
                            total_chunks=0, embedded_chunks=0)
    if qdrant_count and qdrant_count > 0:
        stored_hash = get_document_hash(filename)
        if stored_hash and stored_hash != current_hash:
            # Qdrant holds an older version of this file: keep it live until the file on disk is ingested.
            row.previous_hash = stored_hash
        else:
            chunks = extract_chunks(doc_path(filename))
            expected = len(chunks)
            row.total_chunks = expected
            if qdrant_count >= expected:
                if not stored_hash:
                    set_document_hash(filename, current_hash)
                row.status = COMPLETED
                row.embedded_chunks = expected
            else:
                # Chunking is deterministic, so a stopped run leaves the first N chunks stored. Adopt them
                # (instead of re-embedding everything) only if they are exactly the first N chunks of this file.
                adopted = _adoptable_prefix(filename, chunks, qdrant_count)
                if adopted and not stored_hash:
                    set_document_hash(filename, current_hash)
                row.embedded_chunks = adopted
                row.status = FAILED
                if adopted:
                    detail = "Resume continues after the chunks already stored."
                else:
                    # Keep the stored chunks searchable while the whole file is embedded again; they are
                    # removed only once the new run completes (same mechanism as replacing a document).
                    set_document_hash(filename, LEGACY_UNVERIFIED_HASH)
                    row.previous_hash = LEGACY_UNVERIFIED_HASH
                    detail = ("The stored chunks can't be matched exactly to this file, so Resume embeds the whole file again. "
                              "The stored chunks stay searchable until it finishes.")
                row.last_error = f"An earlier ingestion stopped part-way ({qdrant_count} of {expected} chunks). {detail}"
    db.add(row)
    db.commit()
    return row


def register_upload(filename: str, new_hash: str) -> None:
    """Records a newly uploaded or replaced file. Call it after the file has been written to disk."""
    db = _new_session()
    try:
        row = db.get(DocumentIngestion, filename)
        if row is None:
            db.add(DocumentIngestion(filename=filename, file_hash=new_hash, status=PENDING,
                                     total_chunks=0, embedded_chunks=0))
        elif row.file_hash != new_hash:
            _start_new_version(row, new_hash)
        db.commit()
    finally:
        db.close()


def ensure_status_row(filename: str, qdrant_count: Optional[int] = None) -> None:
    """Makes sure a status row exists for a file on disk (backfills documents ingested earlier)."""
    db = _new_session()
    try:
        if db.get(DocumentIngestion, filename) is None:
            _create_row(db, filename, file_sha256(doc_path(filename)), qdrant_count)
    finally:
        db.close()


def describe_document(filename: str, qdrant_count: int) -> Dict[str, Any]:
    """Status of one document for the admin UI."""
    if qdrant_count < 0:
        return {"filename": filename, "status": "db_error", "chunks": 0, "total_chunks": 0,
                "embedded_chunks": 0, "last_error": "The vector database query failed. Check the backend log for the Qdrant error.", "replacing": False}
    db = _new_session()
    try:
        row = db.get(DocumentIngestion, filename)
        if row is None:
            row = _create_row(db, filename, file_sha256(doc_path(filename)), qdrant_count)
        status = row.status
        if status == IN_PROGRESS and not is_ingestion_running(filename):
            status = INTERRUPTED
        return {
            "filename": filename,
            "status": status,
            "chunks": qdrant_count,
            "total_chunks": row.total_chunks or 0,
            "embedded_chunks": row.embedded_chunks or 0,
            "last_error": row.last_error,
            "replacing": bool(row.previous_hash),
        }
    finally:
        db.close()


def delete_status_row(filename: str) -> None:
    db = _new_session()
    try:
        row = db.get(DocumentIngestion, filename)
        if row is not None:
            db.delete(row)
            db.commit()
    finally:
        db.close()


def _error_text(e: Exception) -> str:
    return f"{type(e).__name__}: {str(e)[:300]}"


# ---------------------------------------------------------------------------
# Ingestion
# ---------------------------------------------------------------------------
def ingest_document(filename: str, restart: bool = False,
                    on_progress: Optional[Callable[[int, int], None]] = None) -> Dict[str, Any]:
    """Ingests one PDF, resuming after the last chunk Qdrant confirmed.

    restart=True discards this version's partial chunks and starts again from chunk 0 (a completed
    version of the same file is left untouched). Returns the final status; never raises for
    ingestion errors, which are recorded on the status row instead.
    """
    path = doc_path(filename)
    if not os.path.exists(path):
        raise FileNotFoundError(filename)

    current_hash = file_sha256(path)
    doc_id = str(uuid.uuid5(uuid.NAMESPACE_URL, filename))
    db = _new_session()
    try:
        row = db.get(DocumentIngestion, filename)
        if row is None:
            row = _create_row(db, filename, current_hash)
        elif row.file_hash != current_hash:
            # The file on disk changed without going through upload (e.g. copied in manually).
            _start_new_version(row, current_hash)

        if row.status == COMPLETED:
            return {"filename": filename, "status": COMPLETED,
                    "embedded_chunks": row.embedded_chunks, "total_chunks": row.total_chunks}

        if restart:
            row.embedded_chunks = 0
        row.status = IN_PROGRESS
        row.last_error = None
        db.commit()

        chunks = extract_chunks(path)
        if not chunks:
            raise ValueError("No extractable text in this PDF (it may be a scanned image without OCR).")

        if row.embedded_chunks and row.total_chunks != len(chunks):
            # Chunking no longer matches the earlier run (e.g. pypdf upgrade), so positions can't be trusted.
            logger.warning(f"{filename}: chunk count changed since the last run; starting again from chunk 0.")
            row.embedded_chunks = 0
        row.total_chunks = len(chunks)
        if row.embedded_chunks >= row.total_chunks:
            row.embedded_chunks = row.total_chunks

        if row.embedded_chunks == 0:
            # Clean slate for this version: removes chunks of unfinished attempts (or of an old
            # ingestion without status), but keeps the live previous version.
            delete_document_by_source(filename, keep_file_hash=row.previous_hash, raise_errors=True)
        db.commit()

        start_at = row.embedded_chunks
        if start_at:
            logger.info(f"{filename}: resuming at chunk {start_at + 1} of {row.total_chunks}.")
        for start in range(start_at, row.total_chunks, EMBED_BATCH_SIZE):
            batch = chunks[start:start + EMBED_BATCH_SIZE]
            ids = [chunk_point_id(filename, current_hash, i) for i in range(start, start + len(batch))]
            add_document_chunks(batch, file_hash=current_hash, doc_id=doc_id, ids=ids)
            row.embedded_chunks = start + len(batch)
            db.commit()
            if on_progress:
                on_progress(row.embedded_chunks, row.total_chunks)

        # Every chunk of the new version is stored: drop any other version of this document.
        delete_document_by_source(filename, keep_file_hash=current_hash, raise_errors=True)
        row.previous_hash = None
        row.status = COMPLETED
        db.commit()
        logger.info(f"{filename}: ingestion complete ({row.total_chunks} chunks).")
        return {"filename": filename, "status": COMPLETED,
                "embedded_chunks": row.embedded_chunks, "total_chunks": row.total_chunks}

    except Exception as e:
        db.rollback()
        logger.error(f"{filename}: ingestion failed: {_error_text(e)}")
        row = db.get(DocumentIngestion, filename)
        if row is None:
            return {"filename": filename, "status": FAILED, "last_error": _error_text(e)}
        row.status = FAILED
        row.last_error = _error_text(e)
        db.commit()
        return {"filename": filename, "status": FAILED, "last_error": row.last_error,
                "embedded_chunks": row.embedded_chunks, "total_chunks": row.total_chunks}
    finally:
        db.close()


def run_ingestion():
    """CLI entrypoint: ingests (or resumes) every PDF in DOCS_DIR. Completed documents are skipped."""
    logging.basicConfig(level=logging.INFO, format="%(asctime)s - %(levelname)s - %(message)s")
    db_models.init_db()
    os.makedirs(DOCS_DIR, exist_ok=True)
    pdf_files = sorted(f for f in os.listdir(DOCS_DIR) if f.lower().endswith(".pdf"))

    if not pdf_files:
        logger.warning(
            f"No PDF files found in {DOCS_DIR}.\n"
            f"--> Please drop your Naturopathy PDF books into: {DOCS_DIR}\n"
            f"--> Then run: python ingest_docs.py"
        )
        return

    logger.info(f"Found {len(pdf_files)} PDF file(s) to process.")
    for file_name in pdf_files:
        with _claim(file_name):
            result = ingest_document(
                file_name,
                on_progress=lambda done, total, f=file_name: logger.info(f"{f}: {done}/{total} chunks"),
            )
        logger.info(f"{file_name}: {result['status']}"
                    + (f" ({result.get('last_error')})" if result["status"] == FAILED else ""))


if __name__ == "__main__":
    run_ingestion()
