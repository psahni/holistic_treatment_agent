# Dual-Mode Architecture Implementation Plan

This plan details the implementation of a Dual-Mode system for the Naturopathy Health Triage Agent, introducing a "Question Mode" for quick, targeted queries and a "Full Treatment Mode" for comprehensive health profiling.

## Mode Definitions

1. **Question Mode**: 
   - Geared towards users needing quick answers to specific health problems.
   - The agent will ask 1-2 basic questions progressively (e.g., age, duration of disease) if not provided.
   - It will immediately provide remedies, precautions, and lifestyle changes.
   - **Severity Override**: If the user is in Question Mode and their problem is severe (e.g., Liver disease, heart disease, kidney issue, severe stomach issue), the agent will **recommend they switch to Full Treatment Mode**, detailing its benefits. It will still provide the best possible answer for their immediate query with appropriate warnings.

2. **Full Treatment Mode**: 
   - A complete profile collection procedure gathering data on lifestyle, food habits, sleep cycle, etc. (the full 8-point intake process).
   - Designed for users wanting a personalized, holistic 30-day Naturopathy protocol.
   - Responses are persisted for future reference.

## Proposed Changes

### Backend Models and State

---

#### [MODIFY] schemas.py
- Add `mode: str = "question"` to `SymptomInput` and `ChatRequest` to allow API clients to explicitly dictate the mode.

#### [MODIFY] state.py
- Add `mode: str` to `NaturopathyState`. This will track whether the current session is operating in "question" or "full_treatment" mode.

### Backend Agent and Prompts

---

#### [MODIFY] prompts.py
- Update `INSTANT_TRIAGE_PROMPT` to become `QUESTION_MODE_PROMPT`. Instruct the LLM to ask basic profiling questions progressively (one by one) while providing remedies based on retrieved context. Instruct it to strongly recommend Full Treatment mode if the condition is severe.
- Define `FULL_TREATMENT_MODE_PROMPT` for the full 8-question intake process.

#### [MODIFY] nodes.py
- Refactor `intake_node` to branch based on `state["mode"]`:
  - **If `mode == "question"`**: Provide instant remedies. Ask basic missing questions (age, duration) progressively. If severe conditions are detected, inject a strongly worded recommendation to switch to Full Treatment Mode.
  - **If `mode == "full_treatment"`**: Execute the comprehensive 8-point profile collection logic.

#### [MODIFY] agent.py
- Update `start_session` and `process_message` to correctly initialize and preserve `mode`.

#### [MODIFY] main.py
- Ensure the `mode` parameter is extracted from the request models and passed to `agent.start_session`.

### Documentation

---

#### [MODIFY] docs/APPROACH.md
- Update the architecture documentation to reflect the Dual-Mode system and severity recommendation behavior.
