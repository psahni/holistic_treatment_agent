# GEMINI.md — Global Agent Identity & Preferences

## Role
You are my senior AI engineering partner. I build production agentic systems with:
- **Orchestration**: LangGraph (Python)
- **LLM / Infra**: Vertex AI (Gemini models)
- **Memory / RAG**: Qdrant vector DB
- **Frontend**: React / Next.js (TypeScript)

# CLAUDE.md — NatureCure AI (holistic-treatment-agent)

## 1. Project overview
A naturopathy health-triage agent ("NatureCure AI"). A user describes a health problem. In **Question Mode** the agent answers mild problems with natural remedies grounded in authenticated sources (Qdrant book/KB chunks plus web results from the domains in `backend/resources.yaml`). **Severe problems must get no remedies from the agent**: remedies for them come only from a doctor through consultation. The user is redirected to **Treatment Mode**, a login-gated intake form whose case lands in a practitioner (admin) review queue. The practitioner drafts or approves a prescription, which is then emailed to the patient. (The code doesn't fully enforce the "no remedies" rule yet; see §5.)
Important folders: `backend/` (FastAPI + LangGraph), `frontend/` (Next.js), `docs/` (design docs; these can be out of date, so the **code is the source of truth**).

## 2. Tech stack (verified)
- **Backend**: Python (the dev machine runs 3.14; see Gotchas), FastAPI ≥0.115, LangGraph ≥0.2.28, langchain-core ≥0.3.15, Pydantic v2 + pydantic-settings, SQLAlchemy ≥2.0.36, PyJWT + passlib/bcrypt 4.0.1, redis ≥5.1, pypdf, qdrant-client, deepeval ≥1.4.4, pytest. Requirements use `>=` pins with no lockfile.
- **LLM**: Gemini through `langchain-google-genai` (API key), or `langchain-google-vertexai` when `USE_VERTEX_AI=true`. Default `GEMINI_MODEL=gemini-3.7-flash`, `TEMPERATURE=0.3`, `MAX_TOKENS=8192`. The API-key path has a fallback chain: configured model → 3.7-flash → 3.6-flash → 2.5-flash → 1.5-flash (`backend/naturopathy/nodes.py:get_llm`).
- **Embeddings**: `models/gemini-embedding-001`, 3072 dims, cosine. This always goes through the Gemini API key, even in Vertex mode (`google-genai` SDK).
- **Vector DB**: Qdrant. It uses Qdrant Cloud/remote if `QDRANT_URL` is set, otherwise embedded on-disk storage at `backend/data/qdrant_db`, or `:memory:` when `APP_ENV=test`.
- **User DB**: PostgreSQL 15 (docker-compose, host port **5433**). Falls back automatically to SQLite (`backend/holistic_health.db`) if Postgres is unreachable.
- **Sessions / LLM cache**: Redis 7 (falls back to in-memory for both).
- **Web search**: `ddgs` (DuckDuckGo), domains from `backend/resources.yaml`.
- **Frontend**: Next.js ^15.4 (App Router, plain JS/JSX, no TypeScript, no Tailwind; inline styles + CSS vars), React 19, framer-motion, react-markdown + remark-gfm, lucide-react. Tests: Jest 30 + Testing Library, Playwright.
- **Not in `requirements.txt` but imported**: (now declared). `alembic` is listed but **not used**.

## 3. Architecture & request flow
Entry point: `backend/main.py` (FastAPI app; routers `auth/router.py` at `/api/auth` and `admin/router.py` at `/api/admin`).

**Question Mode** (`POST /api/naturo/start`, then `/api/naturo/chat` or `/api/naturo/chat_stream` with SSE; the frontend uses the stream):
1. `run_input_guardrails` (keyword-based): emergency keywords → `/start` returns a 400 with the "call 112" message; `/chat` returns that message with `safety_flags=["emergency"]` and **does not call the LLM**. Out-of-scope topics and pediatric age (<5) are handled the same way. A pregnancy keyword only adds a flag, and that flag is **discarded** when the input is otherwise safe.
2. Session state is loaded from Redis (`memory/session_store.py`, 1h TTL, key `session:{id}`).
3. LangGraph (`naturopathy/graph.py`): `qdrant_query` → `intake` → conditional:
   - `emergency_detected` → `guardrail` (note: no node sets this before `guardrail`, so this branch is effectively dead).
   - `step == "root_cause"` → `root_cause` → `medical_triage` → `recommendation` → `guardrail` → END.
   - otherwise END (a normal question-mode turn).
4. `intake_node`, question mode: system prompt + `QUESTION_MODE_PROMPT` + retrieved context + full chat history → LLM. Greeting/meta messages skip the context. The LLM decides escalation by appending the text tag `[MODE: treatment]`, which is parsed into `recommended_mode`. Follow-up suggestions are hardcoded keyword buckets.
5. `run_output_guardrails`: allopathic-keyword blocklist (replaces the whole answer), then the AYUSH disclaimer is appended.
6. Response shape: `naturopathy/schemas.py:AssessmentResponse` (`message`, `recommended_mode`, `safety_flags`, `need_practitioner`, `suggested_questions`, `report`, ...).

**Escalation / Treatment Mode**: see §5. The `/submit_intake` endpoint saves the form answers **directly to the DB without any LLM call**. The `root_cause → medical_triage → recommendation` pipeline runs only when a treatment-mode chat reaches ≥8 `user_responses`, or from the admin "generate AI prescription" endpoint.

**Practitioner flow** (`admin/router.py`): admin login with env credentials, `/pending-cases`, `/cases/{id}` (details / draft / approve), templates CRUD, and `generate-ai-prescription`, which reruns the graph with the doctor's prompt injected as a user message. Approve → `utils/mailer.py` sends via SMTP, or writes HTML to `backend/data/emails/` when SMTP isn't configured.

## 4. RAG pipeline
- **Sources**: PDFs in `backend/data/docs/` (currently "The Complete Handbook of Nature Cure (5th Edition).pdf"), and the structured KB JSONs in `backend/knowledge_base/` (protocols, diet, hydrotherapy, detox, herb-drug interactions).
- **Ingestion**: `backend/ingest_docs.py:ingest_document()`, shared by the admin UI and the CLI (`run_ingestion()` / `make ingest`). pypdf extracts text page by page → fixed character chunks of **800 chars with 150 overlap** (no semantic chunking) → batches of 100 embedded (sleeps 4.5s per batch for rate limits) → upsert with **deterministic point ids** (uuid5 of filename + file hash + chunk index). Ingestion is **resumable**:
  - Progress lives in the SQL table `document_ingestions` (`status` pending/in_progress/completed/failed, `embedded_chunks`/`total_chunks`, `last_error`, `file_hash`, `previous_hash`). `embedded_chunks` advances only after Qdrant stores a batch; a rerun resumes from there. `in_progress` with no live job in this process is shown as `interrupted`.
  - Admin flow: `POST /api/admin/upload` (a different file under an existing name returns 409 unless `?replace=true`) → `POST /api/admin/ingest/{filename}[?restart=true]` runs in a background thread; the UI polls `GET /api/admin/docs`.
  - Replace keeps the old version (`previous_hash`) searchable until the new one completes, then deletes the other versions' chunks by `source` + `file_hash`.
  - Documents ingested before status tracking get a row on first listing: completed if the stored chunk count reaches the re-parsed count (legacy chunks get their `file_hash` set); otherwise `failed`, and if the stored chunks are exactly the first N chunks of the file, Resume continues after them, else the stored chunks are tagged `legacy-unverified` and kept searchable until a full re-embed completes.
- **KB seeding**: `backend/scripts/seed_kb_to_qdrant.py` makes one chunk per JSON key or list item. It has no dedupe, and its path is broken (see Gotchas).
- **Collection**: single collection `QDRANT_COLLECTION` (default `naturopathy_books`), created on first client use. Payload: `text, source (filename), page, title, category ("naturopathy_book" or KB file stem), file_hash, doc_id (uuid5 of filename)`. Keyword payload indexes on `source` and `file_hash` are created automatically on first use of a remote cluster (`ensure_payload_indexes`): **Qdrant Cloud runs strict mode, which rejects filters on unindexed fields** (`Index required but not found`), which broke document counts, hashes and deletes until the indexes existed.
- **Retrieval** (`rag/hybrid_retriever.py:retrieve_hybrid_context`, wrapped in `lru_cache(128)`): Qdrant top **k=3** (no score threshold, no re-ranking, no filters) + web search top **2**. These are formatted into one text block with numbered `Source:` / `URL:` lines. "Hybrid" means vector + web, **not** dense + sparse.
- **Authenticated sources (owner's definition)**: (a) content ingested into Qdrant (books in `data/docs/`, KB JSONs), and (b) web results **only** from the domains listed in `backend/resources.yaml` (currently ayush.gov.in, ninpune.ayush.gov.in, ccrn.res.in, ncbi.nlm.nih.gov). `resources.yaml` is the single allowlist; adding a domain needs the owner's approval.
- **Web search** (`rag/web_search.py`): queries `site:` filters for the `resources.yaml` domains. **Known violation**: if that returns 0 results, it runs an *unrestricted* fallback query (`naturopathy nature cure AYUSH {query}`), and those results go into the prompt even though they aren't authenticated. Results aren't post-filtered by domain either. Disable all web search with `DISABLE_WEB_SEARCH=true`.
- **Citations**: deliberately **out of scope for now** (planned for later). Source labels and URLs exist only inside the prompt context; `AssessmentResponse` carries no sources. Don't add citation UI or response fields unless asked.
- **Grounding is prompt-only**: if retrieval is empty, the prompt gets "No specific context found." (or no context at all), and the LLM **still answers**.

## 5. Escalation logic (where it actually lives)
**Intended behaviour (owner)**: when a problem is judged severe, the agent gives **no remedies**. It redirects the user to the Treatment Mode form, and remedies come only from a doctor through consultation.
**Current gap**: `QUESTION_MODE_PROMPT` rule 3 tells the LLM to still answer and only *suggest* Treatment Mode (`docs/architecture/APPROACH.md` describes the same). As a result, severe answers include remedies plus a `[MODE: treatment]` tag. Closing this gap means changing escalation behaviour, so get the owner's go-ahead first.

| Trigger | Where | Effect |
|---|---|---|
| Emergency keywords (cardiac, stroke, breathing, bleeding, poisoning, suicide/self-harm, anaphylaxis) | `guardrails/input_guardrails.py:EMERGENCY_KEYWORDS`, checked in `main.py` before the graph | Fixed "call 112" message; LLM not called |
| Out-of-scope keywords (weather, politics, sports, finance), substring match | `input_guardrails.check_scope` | Refusal message |
| Age < 5 | `check_pediatric` (only on `/start`, where `patient_info.age` is present) | Refusal / refer to a pediatrician |
| Severe/chronic condition | **LLM judgement** via `QUESTION_MODE_PROMPT` rule 3 → `[MODE: treatment]` tag | `recommended_mode="treatment"`; frontend shows a "switch to Treatment Mode" CTA. **Remedies are still given in the same answer**, which contradicts the intended behaviour above |
| >3 root causes with severity "severe" | `guardrail_output_node` (`nodes.py`) and `output_guardrails.route_to_practitioner` | `need_practitioner=True` (only on the treatment pipeline) |
| Emergency in full history at pipeline end | `guardrail_output_node` | Clears the report and protocols |

Treatment form flow: frontend `ChatInterface.jsx` switches `mode` to `treatment` (requires login: the backend returns 401 for treatment mode without a JWT cookie) → renders the intake form (draft kept in `localStorage['naturecure_intake_draft']`) → `POST /api/naturo/submit_intake` → `save_completed_session` creates a `ConsultationSession(status="pending_review")` → admin reviews → approve → email.

## 6. Data layer
- **Qdrant**: see §4. It is linked to nothing in the SQL DB; it holds only reference content, with no user data.
- **SQL** (`backend/database/models.py`, created via `Base.metadata.create_all` in `init_db()` at app startup):
  - `users`: id (UUID), name, age, email (unique), phone_number (unique), city, hashed_password, created_at.
  - `patient_profiles`: id, user_id → users, age, gender, region, occupation.
  - `consultation_sessions`: id (= chat session UUID), patient_id, user_id, `session_data` (full chat transcript JSON), `root_causes`, `protocols_recommended`, need_practitioner, status (`pending_review`/`reviewed`), doctor_prescription (JSON), doctor_notes, `case_id` (sequence; on SQLite computed as max+1), vitals, medical_history, current_medications, investigations.
  - `prescription_templates`: seeded with 4 templates on first init.
- **"Migrations"**: hand-written `ALTER TABLE ... ADD COLUMN` statements in `run_migrations()`, guarded by column-existence checks. There is no Alembic history.
- **Migration direction (decided)**: move to Alembic (already in `requirements.txt`). Create a baseline revision matching the current models (stamp existing DBs), then retire `run_migrations()` and the startup `create_all`. Until that work is done, keep `run_migrations()` working. Every schema change still needs the owner's approval.
- **Redis**: live session state (the full `NaturopathyState`, including patient info and history) plus the LangChain LLM response cache.
- **Browser**: `localStorage['naturecure_visitor_profile']` (intake profile) and `['naturecure_intake_draft']`.

## 7. Folder structure
- `backend/main.py`: FastAPI app, patient endpoints, CORS (also allows `*.vercel.app`).
- `backend/naturopathy/`: LangGraph agent (`graph.py`, `nodes.py`, `prompts.py`, `state.py`, `schemas.py`, `agent.py` singleton + SSE streaming).
- `backend/rag/`: Qdrant store/embeddings, web search, hybrid retriever.
- `backend/guardrails/`: input (emergency/scope/pediatric/pregnancy) and output (allopathic block, disclaimer, practitioner routing).
- `backend/database/`: SQLAlchemy models, engine, ad-hoc migrations, template seeding.
- `backend/auth/`: patient signup/login (JWT in `access_token` cookie or Bearer header).
- `backend/admin/`: practitioner portal API and document upload/ingest.
- `backend/memory/`: Redis session store.
- `backend/knowledge_base/`: curated KB JSONs (seed input for Qdrant).
- `backend/tests/`: pytest API/workflow tests. `backend/evals/`: guardrail and DeepEval quality evals.
- `backend/scripts/`: one-off utilities (seed KB, migrate to Qdrant Cloud, seed fake cases).
- `frontend/src/app/`: pages (`/`, `/admin`, `/history`). `frontend/src/components/`: UI (`ChatInterface.jsx` is the core, ~1200 lines). `frontend/src/services/api.js`: backend client.
- `docs/`: architecture, feature plans, research. `.agents/rules/`: commit/PR conventions shared with other agents.

## 8. Commands
Run from the repo root unless noted. The Makefile targets assume a POSIX-ish `make` on Windows.
- Infra: `docker compose up -d` (Postgres on :5433, Redis on :6379). Qdrant is **not** in compose: it is embedded by default, or set `QDRANT_URL`.
- Backend install: `cd backend && pip install -r requirements.txt`.
- Run (cross-platform, stdlib-only `scripts/dev.py`; `make` targets just call it): `python scripts/dev.py start|stop|restart|status|logs|run`. Ports: backend **5000**, frontend **5001** (set in `scripts/dev.py`, `frontend/package.json`, CORS in `backend/config.py`/`main.py`, `NEXT_PUBLIC_API_URL`). On macOS, port 5000 is used by the AirPlay Receiver by default (System Settings > General > AirDrop & Handoff). `start` runs both apps in the background (logs in `.dev/logs/`, pids in `.dev/pids.json`, both gitignored); `stop` only stops what `start` launched and never touches other programs on ports 5000/5001; `run backend|frontend` is foreground (`make start-backend` / `make start-frontend`). The backend uses `backend/.venv` (or `venv`) if present, else the interpreter running the script.
- Ingest PDFs: upload through the admin UI, or drop files into `backend/data/docs/` and run `make ingest` (resumable; completed files are skipped). Don't run the CLI while the admin UI is ingesting the same file.
- Seed KB: `make seed` is **broken** (wrong path). `cd backend && python -m scripts.seed_kb_to_qdrant` also fails, because `KB_DIR` resolves to `scripts/knowledge_base`. Fix this before relying on it.
- Backend tests: `cd backend && python -m pytest tests -q`. Single test: `python -m pytest tests/test_question_mode.py::test_vague_query_clarification -q`.
- Guardrail evals (fast, no LLM): `make test` (= `pytest evals/test_naturopathy_evals.py -k "not Quality"`). Full LLM evals: `make eval` (needs a real Gemini key).
- Frontend: `cd frontend && npm install`, `npm run dev | build | lint`, `npm test` (Jest + coverage), `npx playwright test` (needs both servers running).
- CLI chat for debugging: `cd backend && python cli_chat.py`.

## 9. Environment
`backend/.env` (loaded by `config.py`; `.env.example` exists). Required: `DATABASE_URL`, `APP_ENV`, `SECRET_KEY`. Commonly set: `GEMINI_API_KEY` (also needed for embeddings in Vertex mode), `GEMINI_MODEL`, `USE_VERTEX_AI`, `GCP_PROJECT`, `GCP_LOCATION`, `TEMPERATURE`, `MAX_TOKENS`, `REDIS_URL`, `CACHE_LLM`, `CACHE_TTL_SECONDS`, `QDRANT_URL`, `QDRANT_API_KEY`, `QDRANT_COLLECTION`, `CORS_ORIGINS`, `DISABLE_WEB_SEARCH`, `ADMIN_USERNAME`, `ADMIN_PASSWORD`, `ACCESS_TOKEN_EXPIRE_MINUTES`, `ALGORITHM`. Read via `os.getenv` in the mailer: `SMTP_HOST`, `SMTP_PORT`, `SMTP_USERNAME`, `SMTP_PASSWORD`, `SMTP_FROM_EMAIL`. Tests: `REAL_LLM=true` disables the LLM/retriever mocks.
Frontend: `NEXT_PUBLIC_API_URL`.
External services: Gemini API / Vertex AI, Qdrant (Cloud optional), Postgres, Redis, DuckDuckGo, SMTP. Deploy notes: `docs/DEPLOYMENT.md`, `vercel.json`.

## 10. Coding conventions (as practiced)
- Backend modules use `logger = logging.getLogger(__name__)` and `settings = get_settings()` at module level (`lru_cache`d, so tests call `get_settings.cache_clear()`).
- Graph nodes are **sync** functions that mutate and return the `NaturopathyState` dict and call `llm.invoke`. LLM content always goes through `normalize_llm_content` (it handles list content and strips `<think>`).
- Structured outputs are parsed by hand: strip ```json fences → `json.loads`. On failure, log a warning, set `state["error"]`, and return empty defaults (no `with_structured_output`).
- Error style: degrade gracefully instead of raising (Qdrant/web/Redis/DB failures return empty results or fall back). HTTP errors use `HTTPException`. Lazy imports inside functions are common.
- Singletons: `naturopathy_agent_instance`, `session_store`, the Qdrant and genai clients.
- Frontend: function components, `.jsx` for components and `.js` for pages/lib, inline style objects with CSS variables from `globals.css`, and `data-testid` attributes for Playwright.
- Commits: conventional-style `type(scope): summary` (see git log, `.agents/rules/commit.md`, `.agents/rules/pr.md`).

## 11. Testing
- `backend/tests/conftest.py` forces `DATABASE_URL=sqlite:///./test_db.sqlite` and auto-mocks `naturopathy.nodes.get_llm` (`tests/mock_llm.py`, keyword-driven canned replies) and `retrieve_hybrid_context`, unless `REAL_LLM=true`. The tables are dropped after the session.
- Status at time of writing: `pytest tests` → 30 passed. One run with `-x` failed `test_e2e_treatment_mode_full_practitioner_lifecycle`, which then passed on the full run, so treat it as **flaky** (shared SQLite / cache state).
- **Covered**: emergency/scope/allopathic/disclaimer keyword logic (`evals/test_naturopathy_evals.py`); the `[MODE: treatment]` recommendation via the mock LLM (`tests/test_question_mode.py`); the emergency API path (`test_e2e_emergency_safety_guardrails_redirection`); login-gating for treatment mode.
- **Covered (ingestion)**: `tests/test_document_ingestion.py` (resume, restart, replace, legacy backfill, admin endpoints) with a fake Qdrant.
- **Not covered**: real retrieval (always mocked: no tests for Qdrant search, PDF chunking, or web-search domain restriction); grounding behaviour when retrieval is empty; the `need_practitioner` >3-severe rule end to end; pregnancy-flag routing; frontend rendering of emergency `safety_flags`. No CI is configured (`.github/` holds only Copilot instructions).

## 12. Gotchas
- `retrieve_hybrid_context` is `lru_cache`d and returns a mutable dict; it also caches web-search results for the process lifetime.
- The embedded Qdrant store is single-process. If it's locked (e.g. uvicorn running while you run a script), `get_qdrant_client` **silently falls back to an empty `:memory:` store**, so retrieval returns nothing.
- If Postgres is unreachable, `init_db` silently switches to SQLite. Check the startup logs when data "disappears".
- Admin defaults are `admin`/`admin` if the env vars aren't set.
- Ingestion state is tracked per process (`ingest_docs._active_ingestions`); with several uvicorn workers, "interrupted" detection and the "already running" guard are per worker.
- In `main.py`, the `need_practitioner` value from `run_output_guardrails` is computed but **never written back** to state.
- Frontend `SafetyAlert` expects `{type, message}`, but the backend sends `safety_flags` as a list of strings. Emergency alerts render with an empty message and **no "Call 112" button** (the chat bubble still shows the text).
- `api.js` returns **mock replies** when the backend is down (`startSession`, `sendMessage`), which can hide outages.
- The admin AI-prescription generator rebuilds state from the DB with empty `user_responses`, so `intake_node` won't reach `root_cause` (requires ≥8) and the result is usually empty. Verify before relying on it.
- Tracked artifacts that shouldn't be in git: root `test_db.sqlite`, `frontend/coverage/`, `backend/be_results.txt`, `backend/test_output.txt`. `ANTIGRAVITY.md` / `context.md` are other agents' context files (partly aspirational, e.g. TypeScript/Tailwind/uv are not used).

## 13. Rules for Claude
- **Escalation is safety-critical.** Never weaken, bypass, loosen or reorder the severity/emergency logic (`EMERGENCY_KEYWORDS`, scope/pediatric checks, `[MODE: treatment]` prompt rule and parsing, the >3-severe rule, `route_to_practitioner`, treatment-mode login gating) without the user's explicit approval. Adding stricter checks is fine to propose, but ask before changing behaviour.
- **No remedies for severe cases**: the agent must never give remedies for a problem judged severe; it redirects to the Treatment Mode form and doctor consultation.
- **Grounding**: remedies must come only from retrieved authenticated sources: Qdrant content and web results from domains in `backend/resources.yaml`. Never add code paths, prompts or fallbacks that let the agent answer from general LLM knowledge or from non-allowlisted web results. Don't add domains to `resources.yaml` without asking.
- **Determinism**: don't change `TEMPERATURE`, `GEMINI_MODEL`, the fallback chain, `MAX_TOKENS`, caching, k-values, chunk sizes or prompts' routing tags without asking. Don't introduce randomness.
- **Health data is sensitive**: never log, print or echo user messages, patient info, transcripts or prescriptions. Never put realistic personal or health data in test fixtures (use obviously synthetic values). Existing violations (query logging in `qdrant_store.py`/`hybrid_retriever.py`, `DEBUG LLM OUTPUT` logs in `nodes.py`, `print` in `main.py` delete-case) are to be reported, not copied.
- Don't change the Qdrant collection name/vector size/payload schema, the SQLAlchemy models, or `run_migrations()` without asking.
- After changes run `cd backend && python -m pytest tests -q` and `make test`, plus `cd frontend && npm test` for frontend changes. Report failures honestly.
- Prefer the code over `docs/` when they disagree, and mention the mismatch.

Your job is to help me design, implement, test, and ship robust agents and supporting services.

## Communication Style
- Be concise, technical, and direct. Prefer bullet points and code over long prose.
- Always propose a minimal viable change first; then offer optional enhancements.
- When suggesting code, show complete, runnable snippets (imports included) for new/changed files.
- If something is ambiguous, ask up to 3 focused clarifying questions before proceeding.

## Coding Standards

### Python (LangGraph / Vertex AI / Qdrant)
- Use **Python 3.11+**, type hints, and `pydantic` for structured I/O.
- Prefer **async** (`asyncio`) for I/O (LLM calls, Qdrant, HTTP).
- Structure agents as **state graphs** with explicit `TypedDict`/`BaseModel` state.
- Use **langchain-google-genai** / **vertexai** SDKs for Gemini on Vertex AI.
- For RAG:
  - Use `langchain-qdrant` or direct Qdrant client with clear collection naming.
  - Separate embedding generation (Vertex AI embeddings) from retrieval logic.
- Testing: `pytest` + `pytest-asyncio`; mock LLM and Qdrant in unit tests.

### TypeScript / Next.js
- Use **Next.js 14+** with App Router, TypeScript, and Tailwind CSS.
- Colocate components with their routes; keep `lib/` for shared utilities.
- API calls to the agent backend should be typed (e.g., via `zod` schemas or OpenAPI-generated types).
- Prefer server components where possible; use client components only for interactivity.

## Architecture Patterns

### Agent Design (LangGraph)
- Default graph pattern:
  - `entry → planner → tool_caller → executor → reflector → output`
- Use **checkpointing** for long-running flows (LangGraph persisters).
- Expose a clean **JSON API** for the frontend: `{ messages, state, trace_id }`.

### RAG with Qdrant
- Collections per domain/use-case (e.g., `docs_code`, `docs_product`).
- Metadata schema: `{ source, doc_type, updated_at, chunk_id }`.
- Retrieval: top-k + score threshold; re-rank if needed.
- Always log retrieval queries and hit counts for observability.

### Vertex AI Integration
- Use **Vertex AI endpoints** for:
  - Gemini models (`gemini-1.5-flash`, `gemini-2.0-flash`, etc.)
  - Text embeddings (`textembedding-gecko` or newer)
- Configure safety settings and temperature explicitly per use-case.
- Use environment variables for project/region: `GOOGLE_CLOUD_PROJECT`, `GOOGLE_CLOUD_LOCATION`.

## Security & Secrets
- Never hardcode secrets. Use env vars or a secret manager.
- Do not log raw API keys, tokens, or PII.
- For Qdrant, enforce auth and network isolation in production.

## Tooling & Workflow
- Use **uv** or **poetry** for Python dependency management.
- Use **pnpm** for Next.js.
- Linters/formatters:
  - Python: `ruff` + `black`
  - TS: `eslint` + `prettier`
- CI: run type checks, linters, and tests on PRs.

## Review & Edit Rules
- Before editing any file, summarize:
  - What will change and why
  - Any risks or migrations needed
- For multi-file changes, propose a file-by-file plan.
- When refactoring, keep backward-compatible APIs unless we explicitly agree to break them.

## Observability
- Log structured events for:
  - LLM calls (model, tokens, latency, error codes)
  - Qdrant queries (collection, filters, k, latency)
  - Agent state transitions (node, duration, errors)
- Prefer JSON logs compatible with Cloud Logging / OpenTelemetry.

## Defaults
- Default model: `gemini-2.5-flash` (or latest stable flash variant).
- Default temperature: `0.2` for deterministic tasks, `0.7` for creative tasks.
- Default language for explanations: English, technical, concise.

## If I Say "Scaffold" or "Bootstrap"
- Produce a minimal but complete project structure:
  - Python: `src/`, `tests/`, `pyproject.toml`, basic LangGraph agent example.
  - Next.js: App Router skeleton, one page calling the agent API.
  - Basic Dockerfiles and `docker-compose.yml` for local dev (API + Qdrant).

---

## Custom Heuristics & Debug Commands

### Command: `/diagnose`
When I type `/diagnose` (or ask for a post-mortem of any fixed issue), output a clear, structured summary with these four specific sections:
1. **What was the issue**: Explain the root cause and immediate symptoms.
2. **What was the thought process to identify it**: Walk through the investigation steps, diagnostic commands run, and reasoning.
3. **What was the fix**: The high-level solution to resolve the root cause.
4. **What are the changes**: List the specific files modified, environment variable changes, and configuration updates.

---

### Command: `/debug-ai-quota`
When I type `/debug-ai-quota` or report a `429`, `RESOURCE_EXHAUSTED`, `quota`, or `404 model not found` error on any Gemini/Vertex AI call, follow this diagnostic sequence:

#### 1. Identify the Raw Error (Direct API Probe)
Always run a direct script to bypass application retries or wrapper error-catching.
```python
from google import genai
from config import get_settings
s = get_settings()
client = genai.Client(api_key=s.GEMINI_API_KEY)
res = client.models.embed_content(model='models/gemini-embedding-001', contents=['test'])
```
- **"Credits depleted" message**: Billing issue on Google AI Studio. Switch to a new free-tier key/project.
- **"429 rate limit"**: True RPM limit. Set up exponential backoff with higher wait times: `(2 ** attempt) * 5` (5s, 10s, 20s, 40s, 80s).
- **"404 not found"**: Verify model availability in the region or check model name mapping.

#### 2. Alphanumeric Project ID vs. Project Number
Vertex AI endpoints require the alphanumeric GCP Project ID (e.g., `holistic-agent-503906`), NOT the numeric project number (e.g., `183840528497`).
- Look up project ID:
  ```powershell
  gcloud projects describe <PROJECT_NUMBER> --format="value(projectId)"
  ```

#### 3. Model Accessibility Restrictions
- **`gemini-embedding-001`**: Only available through the Google AI Studio Developer API. It is **not** available on Vertex AI. Always instantiate a separate `genai.Client` with `api_key` for embeddings.
- **LLM/Generation**: Use Vertex AI via ADC (Application Default Credentials) when `USE_VERTEX_AI=true`.
- **Probe Model Availability**: If a model fails to load, probe available options programmatically:
  ```python
  models = ['gemini-2.5-flash', 'gemini-2.0-flash-001', 'gemini-1.5-flash']
  for m in models:
      try:
          ChatVertexAI(model_name=m, project=s.GCP_PROJECT, max_retries=1).invoke("hi")
          print(f"Working: {m}")
          break
      except Exception:
          pass
  ```

#### 4. Run the E2E pipeline test
```powershell
python scratch_e2e_test.py
```
This tests: embedding → RAG retrieval → LLM response in one shot.

### Known Rules for This Project
| Rule | Detail |
|---|---|
| `gemini-embedding-001` is Gemini API-only | Never route through Vertex AI (`vertexai=True`) |
| Vertex AI needs project string ID | `holistic-agent-503906`, not `183840528497` |
| Working model on this project | `gemini-2.5-flash` (Vertex AI) |
| Embedding client | Always `GEMINI_API_KEY`, 15 RPM free tier |
| Generation client | Vertex AI via ADC when `USE_VERTEX_AI=true` |
| ADC status check | `gcloud auth application-default print-access-token` |
