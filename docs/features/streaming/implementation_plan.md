# Goal Description
Implement a true Readable Stream on the frontend to display the LLM's response word-by-word (typewriter effect) as it is generated, and replace the basic "Loading..." text with a modern, Gemini-style animated loading indicator.

## User Review Required
> [!IMPORTANT]
> To support true HTTP streaming (Server-Sent Events) from Vertex AI, we need to bypass `with_structured_output` in the LangGraph `intake_node` because LangChain's structured JSON parser intercepts and buffers tokens. We will configure the LLM to return plain Markdown text. The `recommended_mode` will be extracted using a lightweight regex check on the raw text (e.g., instructing the LLM to append `[MODE: treatment]` if needed). 
> Please approve this approach.

## Open Questions
None at this time.

## Proposed Changes

### 1. Backend: Streaming Endpoint

#### [MODIFY] `backend/naturopathy/agent.py`
- Add `process_message_stream` to `NaturopathyAgent`.
- Use `self.graph.astream_events(state, version="v2")` to yield `on_chat_model_stream` tokens.
- Capture the final `state` from `on_chain_end` and save it to Redis `session_store` before closing the stream.

#### [MODIFY] `backend/main.py`
- Create a new endpoint `POST /api/naturo/chat_stream`.
- Return a FastAPI `StreamingResponse` (media_type="text/event-stream").
- Stream JSON chunks like `data: {"chunk": "Hello"}\n\n`.
- Send a final chunk like `data: {"done": true, "state": {...}}\n\n`.

#### [MODIFY] `backend/naturopathy/nodes.py`
- Remove `with_structured_output(AgentResponse)` from `intake_node`.
- Use standard `llm.invoke` (which supports streaming).
- Instruct the LLM in `QUESTION_MODE_PROMPT` to output `[MODE: treatment]` at the end of the text if it recommends switching modes.
- Parse this token directly in the stream consumer or graph to update the mode, and strip it from the user-facing text.

### 2. Frontend: ReadableStream Consumption

#### [MODIFY] `frontend/src/services/api.js`
- Add `streamMessage: async function*(sessionId, message)` that uses `fetch` and `response.body.getReader()`.
- Decode the stream using `TextDecoder` and parse the Server-Sent Events line by line.
- Yield text chunks as they arrive.
- Return the final state object when the stream completes.

#### [MODIFY] `frontend/src/components/ChatInterface.jsx`
- Replace `naturopathyAPI.sendMessage` with `naturopathyAPI.streamMessage`.
- Iterate over the async generator.
- Append incoming chunks directly to the active assistant message in the `messages` state array to create a real-time typewriter effect.
- Handle the final state update (flags, completeness) once the stream is done.

### 3. Frontend: UI / UX Polish

#### [NEW] `frontend/src/components/GeminiLoader.jsx`
- Create a sleek, animated CSS loading indicator (e.g., glowing/pulsing stars or shifting gradients) reminiscent of the Gemini/Vertex UI.

#### [MODIFY] `frontend/src/app/globals.css`
- Add `@keyframes` for the new loading indicator animations.

#### [MODIFY] `frontend/src/components/ChatInterface.jsx`
- Replace the static `"Loading..."` text with `<GeminiLoader />` when `isTyping` is true and the stream hasn't started yielding chunks yet.

---

## Verification Plan

### Automated Tests
- None required for this UI/UX refactor.

### Manual Verification
- Start a new session.
- Type a query.
- Observe the Gemini-style loader appear immediately.
- Observe the response stream in word-by-word/token-by-token.
- Verify that the chat history accurately reflects the final completed message.
