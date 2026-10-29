# Codex implementation context

Last source review: 2026-10-28. This is repository documentation, not a runtime health report. Recheck relevant code before editing. Start with `../AGENTS.md` for project rules and `CODEX_MEMORY.md` for handoff state.

## Stack and map

- Backend: FastAPI, Pydantic v2, SQLAlchemy, LangGraph/LangChain, PyJWT and bcrypt; `backend/main.py` is the application entry point.
- Frontend: Next.js 15 App Router, React 19, plain JS/JSX, CSS variables/inline styles, Framer Motion, react-markdown. Routes: `/`, `/history`, `/admin`.
- Generation: `backend/naturopathy/nodes.py:get_llm`, Gemini API-key path or `ChatVertexAI`. Model identifiers and fallbacks are configuration/code facts; provider availability is unverified.
- Embeddings: `backend/rag/qdrant_store.py`, `models/gemini-embedding-001`, 3072-dimensional cosine vectors. Code always uses the API-key embedding client, including for Vertex generation. Do not infer provider-wide limitations from this choice.
- SQL: `backend/database/models.py`; PostgreSQL with automatic SQLite fallback. Startup creates tables, applies handwritten column migrations, and seeds templates. Alembic is a dependency without an implemented revision history.
- Redis: `backend/memory/session_store.py` (one-hour session TTL), plus optional LangChain LLM cache. Both have process-memory fallbacks.
- Other source: `backend/auth/`, `admin/`, `guardrails/`, `utils/mailer.py`, `knowledge_base/`, `tests/`, `evals/`; `frontend/src/services/api.js`, `components/`, `lib/`; `scripts/dev.py`.

## Request paths

### Question Mode

`ChatInterface.jsx` -> `api.js` -> POST `/api/naturo/start`, then `/api/naturo/chat` -> input guardrails -> session/agent -> graph -> output guardrails -> `AssessmentResponse`.

The current UI uses JSON chat. SSE exists at `/api/naturo/chat_stream` and in `api.js`, but is not used by the main chat send handler. `API_BASE` uses `NEXT_PUBLIC_API_URL`, else the browser hostname with port 5000. Fetch includes credentials. A Next.js `/api/backend/*` rewrite exists separately.

Graph: `qdrant_query -> intake -> END` for ordinary turns; treatment analysis runs `root_cause -> medical_triage -> recommendation -> guardrail -> END`. The conditional emergency branch after intake has no normal upstream setter of `emergency_detected`; API input checks handle emergency messages before the graph.

Question prompt = system + question-mode instructions + retrieved context + history. Greeting prompts omit retrieved context, though retrieval already ran. The LLM's textual mode tag sets `recommended_mode`. Suggested questions are keyword-based buckets.

### Treatment and practitioner review

Treatment requires patient authentication. The UI collects a three-step form, then POST `/api/naturo/submit_intake` persists it directly without AI analysis and redirects to history. A separate chat path triggers analysis at eight accumulated response entries (not eight validated clinical fields).

Admin review supports pending cases, details, templates, drafts, approval, and optional AI generation. AI generation reruns the graph with a doctor instruction appended to history. Approval commits the prescription and attempts SMTP delivery, falling back to local HTML files.

SQL models: `User`, `PatientProfile`, `ConsultationSession`, `PrescriptionTemplate`, `DocumentIngestion`. Active sessions are separate from completed SQL cases. Patient case IDs are integers; session IDs are UUIDs. Avoid confusing them in API calls.

## RAG and ingestion

- Shared CLI/admin PDF ingestion: `backend/ingest_docs.py`. pypdf extraction per page, 800-character chunks/150 overlap, embedding batches of 100, deterministic UUID5 IDs derived from filename/hash/index.
- `DocumentIngestion` tracks hashes, previous version, status, totals, progress, and errors. Resume/restart/replacement are implemented. Previous-version chunks remain searchable until replacement completes. No OCR or durable distributed worker.
- Admin upload is authenticated; changed content under the same filename requires replacement intent. POST `/api/admin/ingest/{filename}` launches a background thread. GET `/api/admin/docs` supplies progress and can backfill status rows.
- Qdrant: remote when configured, otherwise embedded disk; temporary memory storage is test-only. A local disk lock now raises an actionable error instead of silently switching storage. Remote keyword indexes on `source` and `file_hash` are implemented.
- Payload: text, source, page, title, category, file_hash, doc_id.
- Retrieval: latest user message -> top three vector hits -> top two web snippets, sequentially -> formatted context. No relevance threshold, reranker, sparse retrieval, or query rewriting.
- `retrieve_hybrid_context` uses `lru_cache(128)` without TTL/invalidation; single-query embeddings also have a bounded memory cache.
- Web search uses `resources.yaml` site filters but has an unrestricted fallback and no URL-host postfilter.
- Root-cause analysis uses responses/history; protocol selection retrieves again; recommendation synthesis receives root causes/protocols without direct excerpts.
- Generated structured output is parsed with `json.loads`, not validated through report models. Citations have no structured API response field and are deferred by product scope.
- KB seeding is currently broken: Makefile references the wrong script location; the script resolves the wrong KB directory. It also lacks deterministic seeding IDs and fine-grained chunking.

## API groups and authentication

- `/api/auth`: signup, login, logout, me. Patient JWT in HTTP-only `access_token` cookie or Bearer header; bcrypt password hashing.
- `/api/naturo`: start, chat, chat_stream, submit_intake, history, cases/{case_id}.
- `/api/session/{id}`: GET/DELETE live session.
- `/api/admin`: login/logout/check-auth, docs/upload/ingest, embedding search and synthesis, pending-cases/cases, draft/approve/generate-ai-prescription, template CRUD. Admin JWT cookie uses environment credentials.
- `/health`: static success, not dependency readiness. FastAPI also exposes its generated API documentation.

## Commands (reference only; not blanket execution authorization)

From repository root:

```text
python scripts/dev.py start|stop|restart|status
python scripts/dev.py logs backend -f
python scripts/dev.py run backend
python scripts/dev.py run frontend
make test
```

Development ports: backend 5000, frontend 5001. The runner selects an existing virtual environment. Compose runs PostgreSQL (host 5433) and Redis; Qdrant/application containers are not included.

From `backend`:

```text
python -m pytest tests -q
python -m pytest evals/test_naturopathy_evals.py -k "not Quality" -v
```

From `frontend`:

```text
npm run dev
npm run build
npm test
npx playwright test
```

`make test` runs guardrail/KB eval checks, not the backend workflow suite. `make eval` runs full evals and may contact providers. Playwright launches the frontend and needs a backend; it uses installed Chrome. Jest coverage thresholds cover selected files, not the full source tree. Backend workflow tests use SQLite and mock LLM/retrieval unless `REAL_LLM` enables live behavior. Ingestion tests use synthetic files and fake Qdrant/embedding/parser implementations. No current test pass claim is recorded here.

## Environment and deployment

Names only. Required backend settings: `DATABASE_URL`, `APP_ENV`, `SECRET_KEY`.

Other settings: `USE_VERTEX_AI`, `GEMINI_API_KEY`, `GEMINI_MODEL`, `GCP_PROJECT`, `GCP_LOCATION`, `MAX_TOKENS`, `TEMPERATURE`, `REDIS_URL`, `CACHE_LLM`, `CACHE_TTL_SECONDS`, `QDRANT_URL`, `QDRANT_API_KEY`, `QDRANT_COLLECTION`, `ALGORITHM`, `ACCESS_TOKEN_EXPIRE_MINUTES`, `CORS_ORIGINS`, `DISABLE_WEB_SEARCH`, `ADMIN_USERNAME`, `ADMIN_PASSWORD`.

Mailer: `SMTP_HOST`, `SMTP_PORT`, `SMTP_USERNAME`, `SMTP_PASSWORD`, `SMTP_FROM_EMAIL` (read through `os.getenv`; Pydantic dotenv loading does not itself populate process environment).

Frontend/test/deployment: `NEXT_PUBLIC_API_URL`, `REAL_LLM`, `CI`, `PORT`. Compose: `POSTGRES_DB`, `POSTGRES_USER`, `POSTGRES_PASSWORD`.

Deployment files/docs describe Vercel + Render + Neon + Qdrant Cloud + Gemini. No live deployment, cost, credential, or provider availability was verified. Cross-site cookie behavior requires attention before relying on this topology.

## Restored CLAUDE.md corrections

Preserve it as the user's restored handover unless editing it is requested. Prefer current source over these stale claims:

- Main chat uses JSON, not streaming.
- PDF ingestion is resumable with deterministic IDs; CLI no longer necessarily duplicates every run.
- Ingestion is authenticated POST with background work/polling, not unauthenticated SSE GET.
- Remote Qdrant payload indexes exist; SQL includes `DocumentIngestion`.
- `Any`, `ddgs`, `google-genai`, and PyYAML declarations/imports have been addressed in current source.
- `scripts/dev.py` replaces the old PowerShell runner; application ports are 5000/5001.
- Ingestion tests exist. Historical test counts and credential/cluster status are not fresh evidence.
