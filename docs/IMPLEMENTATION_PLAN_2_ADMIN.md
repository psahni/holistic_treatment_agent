# Admin Page and RAG Pipeline Management

This plan outlines the implementation of an Admin Page for the Holistic Treatment Agent. It will allow administrators to upload PDFs, trigger ingestion into Qdrant, monitor progress, view embeddings, and delete documents.

## Proposed Changes

---

### Backend API (FastAPI)

We will introduce a dedicated router for admin functions and update the RAG store to support targeted deletions and progress streaming.

#### [NEW] `backend/admin/router.py`
Creates endpoints for the admin functionality:
- `POST /api/admin/login`: Username/password login endpoint returning a JWT in an HttpOnly cookie.
- `GET /api/admin/docs`: Lists all PDFs in the `data/docs/` directory and checks their ingestion status in Qdrant.
- `POST /api/admin/upload`: Accepts a PDF file upload and saves it to `data/docs/`.
- `GET /api/admin/ingest/{filename}`: An SSE (Server-Sent Events) endpoint that streams the progress of PDF extraction and embedding insertion. **(Per file ingestion)**
- `DELETE /api/admin/docs/{filename}`: Deletes the PDF from the file system and issues a delete command to Qdrant.
- `GET /api/admin/embeddings/search`: Allows the admin to search Qdrant specifically to test if the embeddings are working as expected.

#### [MODIFY] `backend/main.py`
- Include the new admin router (`app.include_router(admin_router, prefix="/api/admin")`).

#### [MODIFY] `backend/rag/qdrant_store.py`
Add functions to manage documents:
- `delete_document_by_source(filename: str)`: Uses Qdrant's filter to delete all points where `payload.source == filename`.
- `get_document_chunk_count(filename: str)`: Uses Qdrant's count API with a filter to see if a document has been ingested and how many chunks exist.

#### [MODIFY] `backend/ingest_docs.py`
- Refactor the ingestion logic into a generator function (e.g., `yield_ingestion_progress(file_path)`) that yields progress updates (e.g., page 1/10 parsed, chunk 5/50 embedded). This enables the SSE endpoint to report real-time status to the frontend.

---

### Frontend UI (Next.js)

We will create a new route for the admin dashboard using the existing design system.

#### [NEW] `frontend/src/app/admin/page.js`
- The main page layout for the Admin interface with an integrated UI for login.

#### [NEW] `frontend/src/components/admin/AdminLogin.jsx`
- Simple username and password UI.

#### [NEW] `frontend/src/components/admin/AdminDashboard.jsx`
The dashboard will have the following sections:
1. **Document Management Table**:
   - Lists uploaded PDFs.
   - Shows status (e.g., "Not Ingested", "Ingested (120 chunks)").
   - Action buttons: "Ingest" and "Delete".
2. **Upload Section**:
   - A drag-and-drop or file selection area to upload new PDFs.
3. **Ingestion Progress Modal/Bar**:
   - When "Ingest" is clicked, it connects to the SSE endpoint and displays a progress bar (e.g., "Extracting page 3/10...", "Generating embeddings...").
4. **Vector Search Tester**:
   - A small search bar to query the Vector DB directly and see the raw chunks returned, helping the admin verify the pipeline is working.

## Verification Plan

### Manual Verification
1. Access the `/admin` route on the web app. Log in.
2. Upload a sample Naturopathy PDF.
3. Click "Ingest" and observe the real-time progress bar updating as pages are processed.
4. Verify the document status changes to "Ingested" with the correct chunk count.
5. Use the "Vector Search Tester" section to search for a term in the PDF and verify chunks are returned.
6. Click "Delete" on the document and verify it is removed from the list and the Vector DB (search yields no results).
