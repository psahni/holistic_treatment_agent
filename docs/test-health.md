# Test health check

Checked on 2026-10-28 using the existing installed packages. No application or test code was changed, and no packages were installed. This report covers local checks; it does not establish that real online AI, search, database hosting, or email services work.

## Results

| Area | Result | Meaning |
|---|---|---|
| Backend tests, including API workflows | 48 passed on the final run | Existing checks work from the documented backend folder with a fresh test database |
| Frontend tests | 50 passed across 9 suites | Existing website checks passed |
| Frontend coverage requirement | Failed | Tests exercise less code than the configured 75% minimum |
| Local safety/reference evals | 14 passed | Existing keyword checks and reference-file checks passed |
| Online AI evals | 4 skipped | Live credentials were deliberately excluded from this local audit |
| Browser journeys | Not run | They need running application servers and may create records or call real services |

Backend tests use FastAPI's in-process test client, SQLite, and mostly fake AI/search results. These are useful checks that application parts work together, but are not real cloud integration tests. Document-loading checks also use fake PDF extraction, embeddings, and Qdrant.

## How the tests were run

- Frontend, from `frontend`: `npm.cmd test -- --runInBand`. The `.cmd` entry point was needed because PowerShell blocked the `npm.ps1` launcher.
- Backend, from `backend`: the existing `pytest tests -q` suite with pytest-cov measurement across the application modules. A temporary runner redirected only the suite's hardcoded SQLite test database to a fresh temporary file, protecting existing databases. Assertions and application files were unchanged.
- Evals: both existing eval files were selected explicitly with pytest. Configuration excluded live credentials, disabled web search and LLM caching, and used test settings. The credential-dependent evals skipped themselves.
- Real SMTP was disabled. Workflow tests could save simulated emails locally. Coverage reports were generated, including updates under the already tracked `frontend/coverage/` directory.

The first audit attempt blocked Windows' internal socket communication and encountered pytest temporary-folder permissions; it was discarded as a runner failure. A directory-wide eval attempt also encountered a Windows path-capitalisation collection problem. Selecting the two eval files directly succeeded.

## Coverage: how much code the tests exercised

Backend statement coverage was **68%** for the measured application modules, excluding test files. This is not a branch-coverage measurement and does not measure answer quality.

| Backend area | Coverage |
|---|---|
| Qdrant integration | 17% |
| Web search | 33% |
| Combined reference retrieval | 35% |
| Agent/session/streaming logic | 39% |
| Live session store | 53% |
| Output safety checks | 64% |
| AI workflow nodes | 68% |
| Document ingestion | 76% |

Frontend coverage applies to the selected files in `frontend/jest.config.js`, not every frontend file:

| Measurement | Result | Required |
|---|---|---|
| Statements | 48.15% | 75% |
| Branches, or alternative paths | 47.55% | 75% |
| Functions | 40.18% | 75% |
| Lines | 49.93% | 75% |

The command therefore exits with failure even though all 50 assertions-based tests pass. `AdminDashboard.jsx`, `ChatInterface.jsx`, and `api.js` are major coverage gaps. Do not lower the target just to make the command pass.

## Test reliability and quality findings

1. **Some workflow tests can collide.** `backend/tests/test_e2e_workflows.py` creates two different users' phone numbers from the current second in separate tests. They share a database. The faster isolated run failed with signup returning 400; the final coverage run passed. The identical phone-number construction supports a timing-collision explanation, though the failed response body was not captured. Use genuinely unique synthetic identifiers and separate test records in future fixes.
2. **An email check depends on the starting folder.** `backend/tests/test_practitioner_workflow.py` checks `data/emails` relative to the current folder, while the mailer writes relative to its source location. It failed from a temporary working folder and passed from `backend`. The documented folder works, but the test is fragile.
3. **The out-of-scope safety assertion is too weak.** `backend/evals/test_naturopathy_evals.py` accepts `is_oos or result["safe"]`. It can pass when an unrelated question is allowed, so its green result does not establish rejection of those questions.
4. **Two quality evals judge fixed answers.** `TestNaturopathyRecommendationQuality` supplies hardcoded answer text. Even a successful live run would score those examples, not current app-generated answers.
5. **Dynamic quality evaluation is small.** `backend/evals/test_naturopathy_dynamic_evals.py` selects just two cases. It calls the agent directly rather than the API, so it does not exercise the same input/output checks as a user request. Its judge uses Vertex AI independently of the application's generation setting.
6. **The cache performance test does not prove real cache behavior by default.** Its model is mocked in the ordinary suite, so matching fast answers are not evidence that Redis or the model cache works.

Dependency warnings mention older Pydantic field examples and a deprecated DeepEval type. These did not fail the final checks. A short synthetic signing key in an early run also produced JWT warnings; a longer test-only key removed those in the final run.

## What passing results do not prove

There is still limited evidence for real reference-search accuracy, approved-domain filtering, behavior when search fails, production login cookies, conversation ownership, streaming safety, and multiple-server ingestion. The small emergency examples do not establish the percentage success targets stated in eval comments.

Suggested follow-up: first make test data unique and repair weak assertions, then cover the important missing failure/access paths and frontend workflows. A separate live-service evaluation should use an explicitly chosen test environment and synthetic records.
