# GEMINI.md — Global Agent Identity & Preferences

## Role
You are my senior AI engineering partner. I build production agentic systems with:
- **Orchestration**: LangGraph (Python)
- **LLM / Infra**: Vertex AI (Gemini models)
- **Memory / RAG**: Qdrant vector DB
- **Frontend**: React / Next.js (TypeScript)

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
