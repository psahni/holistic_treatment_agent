# Skill: playwright-test-review

**Name**: `playwright-test-review`  
**Description**: Reviews Playwright test automation code for reliability, maintainability, and best practices. Use when reviewing E2E, integration, or component tests written with Playwright (TypeScript/Python).

## When to use

- User asks to “review these Playwright tests”, “check my E2E tests”, or “improve test reliability”.
- Explicitly invoked via `/playwright_review` or `/test_review`.

## Scope

- Playwright tests in:
  - JavaScript / TypeScript (e.g., `frontend/playwright/**/*.spec.js`, `frontend/playwright/**/*.spec.ts`)
  - Python (e.g., `tests/**/*.spec.py`, `e2e/**/*.py`)
- Focus on:
  - Test structure and naming
  - Locators and selectors
  - Assertions and expectations
  - Fixtures, setup/teardown, and data management
  - Flakiness and timing issues
  - Alignment with project conventions (from `ANTIGRAVITY.md`)

## Review checklist

### 1. Test design & naming

- [ ] Test names clearly describe the **user journey** or **business outcome**, not just implementation details.
- [ ] Each test has a **single focus** (one primary behavior/outcome).
- [ ] Tests are grouped logically (by feature, page, or user flow).
- [ ] No `test.only` / `describe.only` left in the codebase.

### 2. Locators & selectors

- [ ] Prefer **user-facing locators**:
  - `getByRole`, `getByLabel`, `getByText`, `getByTestId` (with agreed convention).
- [ ] Avoid brittle CSS/XPath selectors tied to layout or non-semantic attributes.
- [ ] Use **test IDs** consistently if the project uses them (e.g., `data-testid="..."`).
- [ ] No hardcoded indices (e.g., `nth(0)`) unless absolutely necessary and justified.

### 3. Assertions & expectations

- [ ] Assertions verify **user-visible** or **business-relevant** outcomes.
- [ ] Prefer Playwright’s built-in matchers (`expect(locator).toBeVisible()`, etc.).
- [ ] Avoid asserting on internal implementation details (e.g., specific class names) unless part of the contract.
- [ ] Use appropriate soft assertions only when needed; most tests should fail fast on critical issues.

### 4. Timing & flakiness

- [ ] No `page.waitForTimeout()` (hard waits) unless there’s a documented, exceptional reason.
- [ ] Use Playwright’s auto-waiting behavior and explicit waits on **state** (`waitForLoadState`, `waitForSelector`, `waitForResponse`).
- [ ] Network calls:
  - Use `page.route()` to **mock/stub** APIs when appropriate for determinism.
  - Avoid tests that depend on real external services unless they are true E2E smoke tests.
- [ ] Tests are **isolated**:
  - No shared mutable state between tests.
  - Each test can run independently and in any order.

### 5. Fixtures, setup, and data

- [ ] Setup/teardown is clear and minimal:
  - Use fixtures for reusable browser context, auth, and common pages.
  - Avoid overusing `beforeEach`/`beforeAll` for complex logic that hides test intent.
- [ ] Authentication:
  - Use `storageState` for logged-in contexts instead of repeated logins.
- [ ] Test data:
  - Tests create and clean up their own data or use isolated datasets.
  - No hidden dependencies on global DB state.

### 6. Code quality & maintainability

- [ ] Test code follows project style (from `ANTIGRAVITY.md` and language-specific conventions).
- [ ] No duplicated setup flows; common flows are extracted into helpers/fixtures/page objects.
- [ ] Page objects / helpers:
  - Encapsulate page behavior, not test-specific assertions.
  - Are small, focused, and easy to refactor.
- [ ] No dead code, commented-out tests, or unused imports.

### 7. Alignment with testing pyramid

- [ ] E2E tests focus on critical user journeys, not every permutation.
- [ ] Complex logic is covered at unit/integration level where possible.
- [ ] Smoke tests are tagged (e.g., `@smoke`) for fast PR gates if the project uses tags.

## Workflow

1. **Identify scope**
   - If invoked on a PR or diff: list changed test files and key non-test files (pages, helpers).
   - If invoked on a file/folder: focus on that set.

2. **Read context**
   - Check `ANTIGRAVITY.md` and any test guidelines in `docs/` or `README.md`.
   - Note framework details: TS vs Python, test runner config, base URLs, fixtures.

3. **Apply checklist**
   - Walk through each test file and apply the checklist above.
   - Pay special attention to:
     - Locator stability
     - Flakiness sources (hard waits, race conditions, external dependencies)
     - Overly complex or large tests

4. **Categorize findings**
   - Group issues by severity:
     - **Critical**: likely to cause flaky/broken tests or false positives/negatives.
     - **Major**: maintainability, clarity, or significant best-practice violations.
     - **Minor**: style, small improvements, optional enhancements.

5. **Provide feedback**
   - For each finding:
     - File + line range (or function/test name).
     - What’s wrong and why it matters.
     - Suggested fix with example code (Playwright API calls, fixture changes, etc.).
   - Optionally propose a **refactored version** of a problematic test.

## Output format

- Start with a short summary:
  - Number of tests reviewed
  - Top 3–5 key issues (by severity)
- Then list detailed findings under headings:
  - `## Critical`
  - `## Major`
  - `## Minor`
- For each issue:

  ````md
  ### [File: `tests/checkout.spec.ts`] Test: “user can complete checkout”

  - **Issue**: Uses `page.waitForTimeout(5000)` after clicking “Place order”.
  - **Why**: Hard waits cause flakiness and slow tests.
  - **Fix**: Wait on a visible success state instead, e.g.:
    ```ts
    await expect(page.getByText('Order confirmed')).toBeVisible();
    ```
  ````

  ```

  ```

- End with optional **refactor suggestions**:
  - Helpers/fixtures to introduce
  - Tests to split or merge
  - Tests that could be moved to integration/unit level

## Special notes for our stack

- For Next.js + FastAPI + LangGraph apps:
  - Prefer testing user flows that cross:
    - Next.js UI → API → Agent → Responses
  - For agent-driven flows, assert on **observable UI/API outcomes**, not internal agent steps.
- If the project uses Playwright with TypeScript:
  - Enforce strict typing for fixtures and page objects.
- If the project uses Playwright with Python:
  - Ensure `async`/`await` is used consistently for all Playwright calls.

## Example invocation

```text
/playwright_review
Review all E2E tests in `tests/e2e/**/*.spec.ts`.
Focus on locator quality, flakiness, and alignment with our LangGraph + Vertex AI flows.
```

or

```text
/test_review
Review `tests/checkout.spec.ts` and suggest concrete refactors to reduce flakiness and improve clarity.
```
