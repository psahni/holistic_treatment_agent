# Codex project memory

Last updated: 2026-10-28. Store durable decisions and concise handoffs here, never secrets, patient data, or transcripts. Read with `../AGENTS.md` and `CODEX_CONTEXT.md`. Reverify source findings before fixing them.

## Durable decisions inherited from the restored handover

- Documentation language: use plain English for both nontechnical and technical readers. Explain the overall flow first, define technical terms when introduced, and retain source paths and practical details for deeper reading. Avoid medical-literature style.
- Intended severe-case behavior is practitioner consultation without agent remedies. Current prompt behavior conflicts with this; escalation changes must be explicitly in scope.
- Remedies require retrieved authenticated references. `backend/resources.yaml` is the web allowlist; adding domains requires explicit authorization.
- Citations are deferred, not an implicitly authorized feature.
- Migration direction is Alembic with a baseline for existing databases; no schema migration has been performed by Codex.
- Keep existing stack and API conventions. No incidental TypeScript/Tailwind or package-manager migration.
- Check user authorization already given before asking again. Do not introduce redundant approval steps for the requested work.

## Known gaps: source-reviewed 2026-10-28, not runtime-tested

1. Active-session GET/DELETE have no authentication; chat and intake lack ownership checks. Patient case history/details use user filtering.
2. Severe-case recommendation remains prompt/tag driven and can include remedies. Empty/failed retrieval still permits model answers.
3. Retrieval failures become empty results and can be cached; Qdrant lock fallback can use an empty memory store. Web search has an off-allowlist fallback. `/health` does not check dependencies.
4. `save_completed_session` swallows failures and returns `None`; callers can report success anyway. Existing records are not fully updated.
5. Patient case details can expose prescription drafts before review. Approval commits before delivery; simulated local email is treated as success.
6. Patient cookies use `secure=False`; SameSite=Lax in both authentication flows risks cross-site deployment failures. Default admin credentials remain permitted; CORS allows all Vercel subdomains.
7. Pregnancy flags and output referral results are not consistently propagated. `SafetyAlert` expects an object but receives a string list. Intake submission bypasses conversational input checks.
8. SSE emits model chunks before final output validation and listens across graph model events. Main UI currently does not use this endpoint.
9. Frontend API mock fallbacks conceal failures. Remedy-card parsing can supply default advice and truncate content. Browser health drafts persist across logout.
10. PostgreSQL/Redis fallbacks can hide failures and fragment state; memory sessions lack TTL. SQLite case numbering uses max+1. Ingestion locks/jobs are process-local.
11. KB seed command/path are broken; seed chunking/deduplication need repair. Recommendation synthesis lacks direct source excerpts.
12. No Alembic revision history, CI, retrieval-quality benchmark, or comprehensive production-auth/SSE/concurrency coverage was found. Requirements are broadly unpinned. Historical lifecycle-test flakiness needs reproduction.

These findings describe existing limitations, not permission to change behavior or infrastructure. `IMPROVEMENT_TASKS.md` remains the more detailed backlog; reconcile its older entries with source before using it.

## Evidence limits

- Initial onboarding used local read-only source/history inspection. No app/tests were run; no dependencies installed, migrations executed, network requests made, or secret files read.
- The backlog's October 15 invalid-key and 900-point collection statements are historical reports. Current credentials, collection contents, model availability, hosting status, dependency compatibility, and test pass counts remain unverified.
- Latest inspected commit: `d0f1cb6` (2026-09-15). Working tree contains substantial later uncommitted work, including resumable ingestion, tests, admin progress UI, logging/dependency cleanup, and `scripts/dev.py`. Do not attribute all current behavior to HEAD.

## Latest handoff

- Runtime-verified local test audit on 2026-10-28: backend 48 passed from `backend` with a fresh redirected SQLite test DB; measured application statement coverage 68%. Frontend 50 tests/9 suites passed, but npm exited with failure because all coverage measures were below the required 75% (lines 49.93%).
- Local evals: 14 passed, 4 credential-dependent evals deliberately skipped. Browser and real online integrations were not run. No packages installed or application/test files changed.
- Earlier faster backend run had a likely same-second phone-number collision; source uses identical phone generation in two tests. Email test depends on working directory. Final slower coverage run passed. Do not report the suite as reliably stable without addressing these.
- Review found a permissive out-of-scope eval assertion, hardcoded answers in two quality evals, and a two-case dynamic set that bypasses API guardrails. Details and run limits are in `docs/test-health.md`.
- Coverage files under tracked `frontend/coverage/` were restored after the audit so generated output is not part of the commits. Synthetic email/temporary test artifacts may exist outside version control. No application fix is in progress.
