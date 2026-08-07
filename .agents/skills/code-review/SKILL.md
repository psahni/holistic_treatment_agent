# Skill: code-review

**Name**: `code-review`  
**Description**: Reviews code changes for bugs, style issues, security problems, and best practices. Use when reviewing PRs or checking code quality.

## When to use
- User asks to “review this code”, “review this PR”, or “check for issues”.
- Explicitly invoked via `/code_review`.

## How to run
1. **Scope**: Identify changed files (from git diff or PR diff).
2. **Context**: Read relevant project docs (`ANTIGRAVITY.md`, `AGENTS.md`, `docs/` standards).
3. **Review checklist**:
   - Correctness: Does the code do what it’s supposed to?
   - Edge cases & error handling
   - Security & secrets
   - Style & project conventions (per `ANTIGRAVITY.md`)
   - Performance & obvious inefficiencies
   - Tests: coverage of new/changed logic
4. **Feedback format**:
   - Summarize findings by severity (Critical / Major / Minor).
   - For each issue:
     - File + line range
     - What’s wrong
     - Why it matters
     - Suggested fix (with code snippet if helpful)

## Output
- For local reviews: a structured markdown report in chat.
- For PR reviews: ready-to-post PR comments, optionally grouped by file or severity.
