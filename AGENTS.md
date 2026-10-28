# Codex project guidance

NatureCure AI is an existing naturopathy triage application. Preserve existing user work and follow the current task's scope. Code is the authority for implemented behavior; product intentions below are requirements, not proof that the code enforces them.

## Start here

1. Read `docs/CODEX_CONTEXT.md` for the implementation map and commands.
2. Read `docs/CODEX_MEMORY.md` for decisions, known gaps, and the latest handoff.
3. Inspect `git status --short` before editing. The onboarding baseline contains substantial uncommitted changes; never reset, overwrite, stage, or commit unrelated work.
4. Read the relevant source before making a change. `CLAUDE.md` is a restored historical handover; several technical details are stale (listed in the context file).

## Product and safety boundaries

- Intended behavior: Question Mode provides mild-condition education grounded in authenticated references. Severe cases receive no remedies from the agent and proceed to authenticated Treatment Mode and practitioner consultation. Current code does not fully enforce this.
- Treat emergency/severity routing, pediatric and scope checks, pregnancy handling, treatment login gating, `[MODE: treatment]` parsing, and practitioner referral as safety-critical. Do not weaken, bypass, or reorder them. Changes to their behavior require explicit user authorization; a task explicitly requesting that change supplies authorization.
- Remedies must be grounded in Qdrant reference content or web results from `backend/resources.yaml`. Do not introduce general-knowledge or off-allowlist remedy fallbacks. Existing violations are bugs, not patterns to copy.
- Adding trusted domains requires explicit user authorization.
- Citations are deferred. Do not add source-response fields or citation UI unless requested.

## Changes requiring explicit scope

- Do not change generation models/fallbacks, temperature, token limits, cache semantics, retrieval k-values, chunking, or routing tags unless the user authorizes that scope.
- SQL models/migrations and Qdrant collection names, vector dimensions, or payload schema require explicit authorization. Do not run migrations, ingestion, seeding, or cloud writes merely to validate an unrelated change.
- The documented migration direction is Alembic with a baseline matching existing models. Until that work is requested, retain the existing startup migration path.
- Do not install dependencies, deploy, publish, push, or contact external services without authorization supplied by the current or continuing task. Prefer local, mocked validation where sufficient.

## Privacy and working practices

- Never expose secret values or read credential files merely for orientation. Document environment-variable names only.
- Never log or persist real patient information, messages, transcripts, or prescriptions in agent notes or test fixtures. Use obviously synthetic fixtures.
- Follow existing Python and JavaScript/JSX conventions. The frontend is not TypeScript/Tailwind; do not migrate stacks incidentally.
- Keep fixes focused and preserve API compatibility unless a change is explicitly requested.
- Before editing, briefly explain what changes and why. Report tests actually run and material limitations. Do not present documentation claims or old pass counts as fresh verification.
- Do not invoke `.agents/rules/commit.md` or `pr.md` workflows unless the user requests the corresponding operation.

## Validation

- Backend code changes: from `backend`, run `python -m pytest tests -q`; from root, run `make test`, or its equivalent in the context file.
- Frontend code changes: from `frontend`, run `npm test`, plus relevant browser checks when needed.
- Documentation-only changes need link/content/diff review, not application tests.
- Tests can create SQLite databases, reports, coverage, and email files. Backend test fixtures mock generation/retrieval by default but do not isolate every external integration. Inspect fixtures before claiming a suite is offline.
- Full evals and browser workflows can use external services. Do not run them during a read-only or no-network task.

## Maintaining context

- Update `docs/CODEX_CONTEXT.md` when architecture or commands change.
- Update `docs/CODEX_MEMORY.md` after meaningful work with outcomes, validation, remaining work, and decisions. Keep it short; replace stale state rather than appending a transcript.
- Label evidence: source-verified, runtime-verified (with date/check), historical report, or unverified hypothesis. Never store credentials or real health data.
