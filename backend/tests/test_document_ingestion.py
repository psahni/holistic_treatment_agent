"""Resumable document ingestion: status tracking, resume after failure, restart, and replace.

Qdrant, embeddings and PDF parsing are replaced by in-memory fakes, so these tests never touch
the real vector database. Files are synthetic: their content encodes how many chunks they parse into.
"""
import time

import pytest
from fastapi.testclient import TestClient

import ingest_docs
from admin import router as admin_router
from config import get_settings
from database import models as db_models
from database.models import DocumentIngestion
from main import app

FILENAME = "synthetic_book.pdf"


class FakeQdrant:
    def __init__(self):
        self.points = {}        # point id -> {"source", "file_hash"}
        self.add_calls = []     # list of id lists, one per add_document_chunks call
        self.fail_on_call = None

    def add(self, chunks, file_hash="", doc_id="", ids=None):
        self.add_calls.append(list(ids))
        if self.fail_on_call == len(self.add_calls):
            raise RuntimeError("synthetic embedding failure")
        for chunk, pid in zip(chunks, ids):
            self.points[pid] = {"source": chunk["source"], "file_hash": file_hash, "text": chunk["text"]}
        return len(chunks)

    def delete(self, filename, keep_file_hash=None, raise_errors=False):
        self.points = {
            pid: p for pid, p in self.points.items()
            if not (p["source"] == filename and (keep_file_hash is None or p["file_hash"] != keep_file_hash))
        }
        return True

    def count(self, filename):
        return sum(1 for p in self.points.values() if p["source"] == filename)

    def get_hash(self, filename):
        for p in self.points.values():
            if p["source"] == filename:
                return p["file_hash"]
        return None

    def set_hash(self, filename, file_hash):
        for p in self.points.values():
            if p["source"] == filename:
                p["file_hash"] = file_hash

    def get_texts(self, filename):
        return [p.get("text") for p in self.points.values() if p["source"] == filename]

    def hashes(self, filename):
        return sorted({p["file_hash"] for p in self.points.values() if p["source"] == filename})


def fake_extract_chunks(file_path):
    """File content looks like b'synthetic-v1:250' -> 250 chunks."""
    with open(file_path, "rb") as f:
        version, count = f.read().decode().split(":")
    name = file_path.replace("\\", "/").split("/")[-1]
    return [{"text": f"{version} chunk {i}", "source": name, "page": 1 + i // 4,
             "title": "Synthetic", "category": "naturopathy_book"} for i in range(int(count))]


@pytest.fixture
def fake(tmp_path, monkeypatch):
    store = FakeQdrant()
    monkeypatch.setattr(ingest_docs, "DOCS_DIR", str(tmp_path))
    monkeypatch.setattr(ingest_docs, "extract_chunks", fake_extract_chunks)
    monkeypatch.setattr(ingest_docs, "add_document_chunks", store.add)
    monkeypatch.setattr(ingest_docs, "delete_document_by_source", store.delete)
    monkeypatch.setattr(ingest_docs, "get_document_chunk_count", store.count)
    monkeypatch.setattr(ingest_docs, "get_document_hash", store.get_hash)
    monkeypatch.setattr(ingest_docs, "set_document_hash", store.set_hash)
    monkeypatch.setattr(ingest_docs, "get_document_texts", store.get_texts)
    monkeypatch.setattr(admin_router, "get_document_chunk_count", store.count)
    monkeypatch.setattr(admin_router, "delete_document_by_source", store.delete)
    with db_models.SessionLocal() as db:
        db.query(DocumentIngestion).delete()
        db.commit()
    yield store


def write_doc(tmp_path, content, name=FILENAME):
    (tmp_path / name).write_bytes(content.encode())
    return ingest_docs.file_sha256(str(tmp_path / name))


def get_row(name=FILENAME):
    with db_models.SessionLocal() as db:
        row = db.get(DocumentIngestion, name)
        if row is not None:
            db.expunge(row)
        return row


def first_index_of_call(store, call_no, file_hash, name=FILENAME):
    """Chunk index of the first id sent in add call number `call_no` (1-based)."""
    first_id = store.add_calls[call_no - 1][0]
    for i in range(10_000):
        if ingest_docs.chunk_point_id(name, file_hash, i) == first_id:
            return i
    raise AssertionError("id not found")


# ---------------------------------------------------------------------------
# ingest_document
# ---------------------------------------------------------------------------
def test_fresh_ingest_completes(fake, tmp_path):
    write_doc(tmp_path, "synthetic-v1:250")
    result = ingest_docs.ingest_document(FILENAME)

    assert result["status"] == "completed"
    assert fake.count(FILENAME) == 250
    assert len(fake.add_calls) == 3
    row = get_row()
    assert (row.status, row.embedded_chunks, row.total_chunks) == ("completed", 250, 250)


def test_failure_is_recorded_and_resume_continues_from_last_stored_chunk(fake, tmp_path):
    h = write_doc(tmp_path, "synthetic-v1:250")
    fake.fail_on_call = 2

    result = ingest_docs.ingest_document(FILENAME)
    assert result["status"] == "failed"
    row = get_row()
    assert row.status == "failed"
    assert row.embedded_chunks == 100          # only the batch Qdrant confirmed
    assert "synthetic embedding failure" in row.last_error
    assert fake.count(FILENAME) == 100

    fake.fail_on_call = None
    calls_before = len(fake.add_calls)
    result = ingest_docs.ingest_document(FILENAME)

    assert result["status"] == "completed"
    assert first_index_of_call(fake, calls_before + 1, h) == 100   # resumed, not restarted
    assert fake.count(FILENAME) == 250
    assert get_row().last_error is None


def test_resending_an_already_stored_batch_creates_no_duplicates(fake, tmp_path):
    write_doc(tmp_path, "synthetic-v1:250")
    fake.fail_on_call = 3
    ingest_docs.ingest_document(FILENAME)
    assert fake.count(FILENAME) == 200

    # Simulate a batch that reached Qdrant but whose progress was never recorded.
    with db_models.SessionLocal() as db:
        db.get(DocumentIngestion, FILENAME).embedded_chunks = 100
        db.commit()

    fake.fail_on_call = None
    ingest_docs.ingest_document(FILENAME)
    assert fake.count(FILENAME) == 250


def test_completed_document_is_not_embedded_again(fake, tmp_path):
    write_doc(tmp_path, "synthetic-v1:120")
    ingest_docs.ingest_document(FILENAME)
    calls = len(fake.add_calls)

    assert ingest_docs.ingest_document(FILENAME)["status"] == "completed"
    assert ingest_docs.ingest_document(FILENAME, restart=True)["status"] == "completed"
    assert len(fake.add_calls) == calls


def test_restart_discards_partial_chunks_and_starts_from_zero(fake, tmp_path):
    h = write_doc(tmp_path, "synthetic-v1:250")
    fake.fail_on_call = 3
    ingest_docs.ingest_document(FILENAME)
    assert get_row().embedded_chunks == 200

    fake.fail_on_call = None
    calls_before = len(fake.add_calls)
    ingest_docs.ingest_document(FILENAME, restart=True)

    assert first_index_of_call(fake, calls_before + 1, h) == 0
    assert fake.count(FILENAME) == 250
    assert get_row().status == "completed"


def test_empty_pdf_fails_with_clear_message(fake, tmp_path):
    write_doc(tmp_path, "synthetic-v1:0")
    result = ingest_docs.ingest_document(FILENAME)
    assert result["status"] == "failed"
    assert "No extractable text" in get_row().last_error


# ---------------------------------------------------------------------------
# Replacing a document
# ---------------------------------------------------------------------------
def test_replace_keeps_old_version_live_until_new_version_completes(fake, tmp_path):
    h1 = write_doc(tmp_path, "synthetic-v1:250")
    ingest_docs.ingest_document(FILENAME)

    h2 = write_doc(tmp_path, "synthetic-v2:180")
    ingest_docs.register_upload(FILENAME, h2)
    row = get_row()
    assert (row.status, row.previous_hash, row.file_hash) == ("pending", h1, h2)

    fake.fail_on_call = len(fake.add_calls) + 2     # fail on the new version's 2nd batch
    assert ingest_docs.ingest_document(FILENAME)["status"] == "failed"
    assert fake.hashes(FILENAME) == sorted([h1, h2])  # old version still searchable
    assert fake.count(FILENAME) == 250 + 100

    fake.fail_on_call = None
    assert ingest_docs.ingest_document(FILENAME)["status"] == "completed"
    assert fake.hashes(FILENAME) == [h2]              # old version removed only now
    assert fake.count(FILENAME) == 180
    assert get_row().previous_hash is None


def test_replacing_an_unfinished_replacement_keeps_the_original_live(fake, tmp_path):
    h1 = write_doc(tmp_path, "synthetic-v1:150")
    ingest_docs.ingest_document(FILENAME)

    h2 = write_doc(tmp_path, "synthetic-v2:250")
    ingest_docs.register_upload(FILENAME, h2)
    fake.fail_on_call = len(fake.add_calls) + 2
    ingest_docs.ingest_document(FILENAME)

    h3 = write_doc(tmp_path, "synthetic-v3:120")
    ingest_docs.register_upload(FILENAME, h3)
    assert get_row().previous_hash == h1

    fake.fail_on_call = None
    ingest_docs.ingest_document(FILENAME)
    assert fake.hashes(FILENAME) == [h3]
    assert fake.count(FILENAME) == 120


def test_file_changed_on_disk_is_treated_as_a_new_version(fake, tmp_path):
    h1 = write_doc(tmp_path, "synthetic-v1:150")
    ingest_docs.ingest_document(FILENAME)

    h2 = write_doc(tmp_path, "synthetic-v2:120")  # copied in without the upload endpoint
    assert ingest_docs.ingest_document(FILENAME)["status"] == "completed"
    assert fake.hashes(FILENAME) == [h2]


# ---------------------------------------------------------------------------
# Documents ingested before status tracking existed
# ---------------------------------------------------------------------------
def test_legacy_complete_document_is_marked_completed_without_reembedding(fake, tmp_path):
    h = write_doc(tmp_path, "synthetic-v1:120")
    for i in range(120):
        fake.points[f"legacy-{i}"] = {"source": FILENAME, "file_hash": ""}

    info = ingest_docs.describe_document(FILENAME, fake.count(FILENAME))
    assert info["status"] == "completed"
    assert fake.hashes(FILENAME) == [h]           # legacy chunks tagged with the file hash

    ingest_docs.ingest_document(FILENAME)
    assert fake.add_calls == []


def test_legacy_incomplete_document_is_marked_failed_and_resume_reembeds_cleanly(fake, tmp_path):
    write_doc(tmp_path, "synthetic-v1:250")
    for i in range(90):
        fake.points[f"legacy-{i}"] = {"source": FILENAME, "file_hash": ""}

    info = ingest_docs.describe_document(FILENAME, fake.count(FILENAME))
    assert info["status"] == "failed"
    assert "90 of 250" in info["last_error"]

    ingest_docs.ingest_document(FILENAME)
    assert fake.count(FILENAME) == 250            # legacy partial chunks replaced, no duplicates
    assert not any(pid.startswith("legacy-") for pid in fake.points)


def test_legacy_partial_document_whose_chunks_match_resumes_without_reembedding(fake, tmp_path):
    h = write_doc(tmp_path, "synthetic-v1:250")
    for i, chunk in enumerate(fake_extract_chunks(str(tmp_path / FILENAME))[:100]):
        fake.points[f"legacy-{i}"] = {"source": FILENAME, "file_hash": h, "text": chunk["text"]}

    info = ingest_docs.describe_document(FILENAME, fake.count(FILENAME))
    assert (info["status"], info["embedded_chunks"], info["total_chunks"]) == ("failed", 100, 250)
    assert "Resume continues" in info["last_error"]

    result = ingest_docs.ingest_document(FILENAME)
    assert result["status"] == "completed"
    assert first_index_of_call(fake, 1, h) == 100               # only chunks 100..249 were embedded
    assert fake.count(FILENAME) == 250                          # the 100 legacy chunks were kept, no gap, no duplicates
    assert all(f"legacy-{i}" in fake.points for i in range(100))


def test_legacy_partial_document_whose_chunks_do_not_match_restarts_cleanly(fake, tmp_path):
    h = write_doc(tmp_path, "synthetic-v1:250")
    for i in range(100):
        fake.points[f"legacy-{i}"] = {"source": FILENAME, "file_hash": h, "text": f"some other text {i}"}

    info = ingest_docs.describe_document(FILENAME, fake.count(FILENAME))
    assert info["status"] == "failed" and info["embedded_chunks"] == 0
    assert "embeds the whole file again" in info["last_error"]

    fake.fail_on_call = 2                                        # a failed resume must not empty the document
    assert ingest_docs.ingest_document(FILENAME)["status"] == "failed"
    assert all(f"legacy-{i}" in fake.points for i in range(100))  # old chunks still searchable

    fake.fail_on_call = None
    ingest_docs.ingest_document(FILENAME)
    assert fake.count(FILENAME) == 250
    assert not any(pid.startswith("legacy-") for pid in fake.points)  # removed only after completion


def test_in_progress_row_without_a_running_job_shows_as_interrupted(fake, tmp_path):
    h = write_doc(tmp_path, "synthetic-v1:250")
    with db_models.SessionLocal() as db:
        db.add(DocumentIngestion(filename=FILENAME, file_hash=h, status="in_progress",
                                 total_chunks=250, embedded_chunks=100))
        db.commit()

    info = ingest_docs.describe_document(FILENAME, 100)
    assert info["status"] == "interrupted"
    assert (info["embedded_chunks"], info["total_chunks"]) == (100, 250)


# ---------------------------------------------------------------------------
# Admin endpoints
# ---------------------------------------------------------------------------
@pytest.fixture
def admin_client():
    settings = get_settings()
    original = (settings.ADMIN_USERNAME, settings.ADMIN_PASSWORD)
    settings.ADMIN_USERNAME, settings.ADMIN_PASSWORD = "testadmin", "testpassword"
    client = TestClient(app)
    assert client.post("/api/admin/login", json={"username": "testadmin", "password": "testpassword"}).status_code == 200
    yield client
    settings.ADMIN_USERNAME, settings.ADMIN_PASSWORD = original


def upload(client, content, replace=False, name=FILENAME):
    return client.post(f"/api/admin/upload?replace={'true' if replace else 'false'}",
                       files={"file": (name, content.encode(), "application/pdf")})


def wait_until_idle(name=FILENAME):
    deadline = time.time() + 10
    while ingest_docs.is_ingestion_running(name) and time.time() < deadline:
        time.sleep(0.05)
    assert not ingest_docs.is_ingestion_running(name)


def test_ingest_endpoint_requires_admin_login(fake, tmp_path):
    write_doc(tmp_path, "synthetic-v1:10")
    client = TestClient(app)
    client.cookies.clear()
    assert client.post(f"/api/admin/ingest/{FILENAME}").status_code == 401


def test_upload_same_name_needs_explicit_replace(fake, admin_client):
    assert upload(admin_client, "synthetic-v1:120").json()["status"] == "uploaded"
    assert admin_client.post(f"/api/admin/ingest/{FILENAME}").status_code == 202
    wait_until_idle()

    assert upload(admin_client, "synthetic-v1:120").json()["status"] == "unchanged"

    conflict = upload(admin_client, "synthetic-v2:80")
    assert conflict.status_code == 409
    assert conflict.json()["detail"]["code"] == "document_exists"

    replaced = upload(admin_client, "synthetic-v2:80", replace=True)
    assert replaced.json()["status"] == "replaced"
    docs = admin_client.get("/api/admin/docs").json()["docs"]
    assert docs[0]["status"] == "pending" and docs[0]["replacing"] is True
    assert docs[0]["chunks"] == 120               # old version still in Qdrant


def test_docs_list_reports_progress_and_resume_via_endpoint(fake, admin_client):
    upload(admin_client, "synthetic-v1:250")
    fake.fail_on_call = 2
    admin_client.post(f"/api/admin/ingest/{FILENAME}")
    wait_until_idle()

    doc = admin_client.get("/api/admin/docs").json()["docs"][0]
    assert (doc["status"], doc["embedded_chunks"], doc["total_chunks"]) == ("failed", 100, 250)
    assert doc["last_error"]

    fake.fail_on_call = None
    admin_client.post(f"/api/admin/ingest/{FILENAME}")
    wait_until_idle()
    doc = admin_client.get("/api/admin/docs").json()["docs"][0]
    assert (doc["status"], doc["chunks"]) == ("completed", 250)


def test_delete_removes_status_row(fake, admin_client):
    upload(admin_client, "synthetic-v1:50")
    admin_client.post(f"/api/admin/ingest/{FILENAME}")
    wait_until_idle()

    assert admin_client.delete(f"/api/admin/docs/{FILENAME}").status_code == 200
    assert get_row() is None
    assert fake.count(FILENAME) == 0
