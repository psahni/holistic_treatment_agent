# Improvement Tasks

Status: ⬜ todo · 🔄 in progress · ✅ done · ⏸️ blocked / needs decision

Out of scope: routing (Question Mode prompt and `[MODE: treatment]` handling) is owner-managed.

## Resumable ingestion: work required before live testing

These two high-priority tasks come from the resumable-ingestion code review. Complete and test them before using the new ingestion flow against live documents.

### I1 · Never fall back to temporary Qdrant storage during ingestion ✅

**Problem:** When the local on-disk Qdrant database is locked by another process, `backend/rag/qdrant_store.py` silently opens an in-memory Qdrant database. An ingestion can then write only to temporary memory while its SQL row is marked `completed`. The temporary vectors disappear when that process exits, leaving a false completed status.

**Approach:**

1. Allow in-memory Qdrant only when the application is explicitly running in the test environment.
2. If the local on-disk database is locked in development or production, raise a clear error instead of falling back.
3. Make sure ingestion records that error as `failed` and does not advance `embedded_chunks` or set `completed`.
4. Give the operator a useful message: stop the process holding the local store, or configure a shared Qdrant service. Do not include credentials or other secret values in the message.
5. Add a test that simulates the local-store lock/open failure and proves that no in-memory store is created and no completed status is written.

**Important files:** `backend/rag/qdrant_store.py`, `backend/ingest_docs.py`, and `backend/tests/test_document_ingestion.py` (or a focused Qdrant-store test file).

**Done when:** A locked or unavailable persistent Qdrant store produces a visible failed ingestion; SQL never says completed for vectors written only to memory; normal test-mode in-memory Qdrant still works.

**Implemented:** Local lock errors now stop the operation with a safe, actionable message. In-memory Qdrant is limited to explicit test mode. Regression tests verify both paths and confirm that a locked-store ingestion remains failed with zero saved chunks.

### I2 · Verify legacy chunks before marking a document completed ⬜

**Problem:** The first-time legacy backfill currently treats `qdrant_count >= expected_chunks` as completed and may apply the current file hash to every stored chunk. Extra, duplicate, or unrelated chunks under the same filename can therefore be accepted as the current PDF without being re-embedded.

**Approach:**

1. Do not accept `qdrant_count > expected_chunks` as a completed match.
2. When the counts are equal, fetch the stored chunk text payloads and compare them with the chunks extracted from the current PDF. The comparison may ignore Qdrant result order, but it must preserve duplicate counts.
3. Apply the current file hash and create a `completed` row only after that comparison succeeds.
4. If the count or content does not match, keep the existing chunks searchable as the previous unverified version, show a failed/retryable status, and re-embed the current PDF from chunk 1 when the admin retries.
5. Do not change metadata on the existing chunks until their match has been verified.
6. Add tests for an exact valid match, excess chunks, equal-count wrong content, duplicate-text differences, and failure while reading legacy payloads.

**Important files:** `backend/ingest_docs.py`, `backend/rag/qdrant_store.py`, and `backend/tests/test_document_ingestion.py`.

**Done when:** Only an exact content match is adopted without re-embedding; extra or different legacy chunks can never produce a completed status or receive the current file hash.

### Temporary concurrency decision

Run the backend with **one worker only** for now. The current `_active_ingestions` lock exists only inside one Python process. Do not configure multiple Uvicorn/Gunicorn workers or multiple backend instances for document ingestion until a database-backed lock or durable job queue is implemented. The local development runner already starts one Uvicorn worker.

## Current state (checked 2026-10-15)
- Qdrant cluster `naturopathy_books`: green, **900 points, all from the Nature Cure handbook PDF**. No knowledge-base JSON content is indexed, there are no payload indexes, and there are no duplicate chunks.
- **The Gemini API key in `backend/.env` is rejected (`API_KEY_INVALID`).** Every query embedding fails, `search_vector_store` swallows the error and returns `[]`, and the agent answers **with no retrieved sources** while nothing visible goes wrong.

---

## P0 · Owner action: replace the Gemini API key ⏸️
**Why:** embeddings (and the LLM when `USE_VERTEX_AI=false`) depend on it. With the current key, RAG returns nothing.
**Fixes:** restores retrieval. P1–P9 can't be verified until this is done.
**Done when:** a test search returns scored results from Qdrant.

## P1 · Make retrieval failures visible and don't cache them ⬜
**Why:** Qdrant and embedding errors are swallowed and turned into "no results" (`rag/qdrant_store.py:search_vector_store`, `rag/web_search.py`). `retrieve_hybrid_context` is wrapped in `@lru_cache`, so a single failure caches an empty result for that query until the process restarts. If the local Qdrant DB is locked, it silently switches to an empty in-memory store. The invalid API key above went unnoticed for exactly these reasons.
**Fixes:** "retrieval broken" becomes distinguishable from "nothing relevant found". Failures are logged at error level and never cached. The `/health` endpoint reports retrieval status.
**Scope:** `rag/hybrid_retriever.py`, `rag/qdrant_store.py`, `rag/web_search.py`, `main.py` `/health`. (Replaces former tasks 10 (Qdrant part) and 15.)
**Done when:** a broken key or unreachable Qdrant shows up as an error in the logs and in `/health`, and the next request retries instead of reusing a cached empty result.

## P2 · Don't give remedies when no authenticated source was retrieved ⬜
**Why:** when retrieval returns nothing, the prompt gets `"No specific context found."` (`rag/hybrid_retriever.py:49`) and the LLM answers anyway from its general knowledge. That breaks the core rule that remedies come only from authenticated sources.
**Fixes:** with no usable context, the agent replies with a fixed "I couldn't find a verified source for this" message (wording to be agreed) instead of LLM-generated remedies. Greetings and clarifying questions are unaffected.
**Scope:** `naturopathy/nodes.py` (`intake_node`, question-mode branch), plus a test. Routing and the `[MODE: treatment]` handling stay untouched.
**Done when:** a test with empty retrieval shows that the LLM isn't called for remedies and the fallback message is returned.

## P3 · Index the knowledge base into Qdrant correctly ⬜
**Why:** the curated KB (`backend/knowledge_base/*.json`: protocols, diet, hydrotherapy, detox, **herb–drug interactions**) is not in Qdrant at all. `make seed` points to the wrong path, and the script resolves `KB_DIR` to `scripts/knowledge_base`. Even if it ran, it makes one chunk per top-level key, so `herb_drug_interactions → interactions` would be a single ~17.7k-character chunk and `hydrotherapy → treatments` ~8.6k. Both exceed what the embedding model can take (~2,048 tokens), so most of that text would never be searchable.
**Fixes:** the KB becomes retrievable, including interaction warnings, in small, focused chunks. Re-running the script doesn't create duplicates (deterministic point IDs based on source, key and index).
**Scope:** `scripts/seed_kb_to_qdrant.py`, `Makefile` `seed` target, and `rag/qdrant_store.py` (an optional `ids` parameter). It writes to the live cluster using the existing payload fields, with no schema change. **Needs owner OK before running against the cluster.**
**Done when:** the KB chunks are in Qdrant, none is larger than about 2,000 characters, and a second run adds 0 new points.

## P4 · Restrict web search to `resources.yaml` domains ⬜
**Why:** if the `site:`-filtered search returns nothing, `rag/web_search.py:57` runs an **unrestricted** query, and those results are given to the LLM as "authentic" references. Results are also never checked against the allowlist.
**Fixes:** only results whose URL host is (a subdomain of) a domain in `resources.yaml` reach the prompt, and the unrestricted fallback is removed.
**Scope:** `rag/web_search.py`, plus tests. (Replaces former task 7.)
**Done when:** a test shows that off-list URLs are dropped and no fallback query is made.

## P5 · Retrieval evaluation set ⬜
**Why:** retrieval is always mocked in tests, so there's no way to tell whether a change (threshold, query, chunking) makes search better or worse.
**Fixes:** about 20 realistic synthetic queries, each with the expected source or category, plus a script that reports hit@3 and score distributions against the real collection. P6 and P7 are tuned with it.
**Scope:** `backend/evals/retrieval/` (data file plus script); it doesn't run in the default `pytest tests`.
**Done when:** the script prints a hit@3 baseline for the current collection.

## P6 · Minimum relevance score for Qdrant results ⬜
**Why:** search always returns the top 3 results, however unrelated, so off-topic queries still get "grounding" that is really just noise. Together with P2, a weak match should count as no match.
**Fixes:** chunks below a threshold (tuned using P5) are dropped.
**Scope:** `rag/qdrant_store.py` (`score_threshold`) and a config value in `config.py`. (Replaces former task 9.)
**Done when:** the threshold is chosen from P5 data and an off-topic query returns no chunks.

## P7 · Build the retrieval query from the conversation, not just the last message ⬜
**Why:** `naturopathy/nodes.py:285` searches only with the latest user message. Follow-ups such as "how long should I do that?" retrieve unrelated chunks, and with P2 in place they'd wrongly get the "no source" reply. Greetings also trigger a full Qdrant and web search that is then thrown away.
**Fixes:** the query combines the main complaint with the latest message (deterministic, no extra LLM call), and retrieval is skipped for greetings.
**Scope:** `naturopathy/nodes.py` (`qdrant_query_node`); measured with P5.
**Done when:** follow-up queries in P5 hit the same sources as the original question.

## P8 · Lock down admin endpoints ⬜
**Why:** ~~`GET /api/admin/ingest/{filename}` has no auth~~ (done: now `POST`, admin-only). Admin credentials fall back to `admin`/`admin` when unset, and nothing stops a weak `SECRET_KEY` in production.
**Fixes:** the ingest endpoint requires an admin session, and production startup fails with default credentials or a short secret.
**Scope:** `admin/router.py`, `config.py` or startup, and an admin UI check that `EventSource` still sends the cookie. (Replaces former tasks 2 and 3.)
**Done when:** unauthenticated ingest returns 401, the admin UI ingest still works, and `APP_ENV=production` with defaults refuses to start.

## P9 · Show emergency alerts correctly in the frontend ⬜
**Why:** `SafetyAlert.jsx` expects `{type, message}`, but the backend sends `safety_flags` as a list of strings such as `["emergency"]`. Emergency alerts render with an empty message and **no "Call 112" button**. This is display only; routing is not touched.
**Fixes:** the alert shows the emergency message and the Call 112 button.
**Scope:** `frontend/src/components/SafetyAlert.jsx` and/or `ChatInterface.jsx`, plus a Jest test. (Replaces former task 14.)
**Done when:** a Jest test renders `["emergency"]` with the message and the 112 link.

---

## Backlog (lower priority)
| # | Task | Status |
|---|------|--------|
| B1 | Remove outdated "severe cases still get remedies" note from `CLAUDE.md` §5 | ⏸️ awaiting confirmation |
| B2 | Stop returning raw exception text in API errors | ⬜ |
| B3 | Untrack committed artifacts (`test_db.sqlite`, `frontend/coverage/`, `backend/be_results.txt`, `backend/test_output.txt`) | ⬜ |
| B4 | Clear intake profile/draft from `localStorage` on logout | ⬜ |
| B5 | Fail loudly in production on the Postgres → SQLite fallback | ⬜ |
| B6 | Fix `requirements.txt` (`ddgs`, `google-genai`, `PyYAML`) and the missing `Any` import in `nodes.py` (crashes on Python 3.11–3.13) | ✅ (pins still open: unpinned `google-cloud-aiplatform` 1.165.1 fails to import on 3.13/3.14) |
| B7 | Make `make ingest` (CLI path) idempotent: file-hash check and deterministic IDs | ✅ (resumable ingestion) |
| B8 | Remove frontend mock replies when the backend is down (`services/api.js`) | ⬜ |
| B9 | Ground the final treatment report (`recommendation_node` gets no retrieved context) | ⬜ |
| B10 | Embedding task types (`RETRIEVAL_DOCUMENT` / `RETRIEVAL_QUERY`); requires full re-embed | ⬜ |
| B11 | Paragraph/sentence-aware PDF chunking; strip headers and footers; requires re-ingest | ⬜ |
| B12 | Clean context formatting (separate numbering for books vs. web, drop JSON indentation) | ⬜ |
| B13 | Payload index on `source` (needed for Qdrant Cloud strict mode or large collections) | ✅ (`source` + `file_hash`, created automatically) |
| B14 | Adopt Alembic with a baseline migration | ⬜ |
| B15 | Add CI (GitHub Actions: pytest, guardrail evals, Jest, lint) | ⬜ |
| B16 | Fix the flaky `test_e2e_treatment_mode_full_practitioner_lifecycle` | ⬜ |

## Completed
| Task | Notes |
|------|-------|
| ✅ Resumable document ingestion | `document_ingestions` table; resume from last stored chunk; restart; replace keeps the old version live until the new one completes; background job + admin UI status/progress; ingest endpoint requires admin. Tests: 46 + 14 + Jest 50 passing. |
| ✅ Stop logging user health data | Query and LLM-output logs, `print`s in delete-case, email addresses in mailer logs, and the DB URL with password. Tests: 30 + 14 passing. |
