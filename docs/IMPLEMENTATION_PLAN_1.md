# 🌊 Phase 1 MVP — Naturopathy System

## Overview

Build the Naturopathy module of the Holistic Health Triage Agent as Phase 1 MVP.  
The Naturopathy system follows **Nature Cure principles**: identify root causes (lifestyle, diet, emotional, toxin), and recommend natural therapies — hydrotherapy, diet therapy, detox protocols, sun/mud therapy, and exercise prescriptions.

**Tech Stack (per plan):**
- **LLM**: Google Gemini via `google-generativeai`
- **Orchestration**: LangGraph (stateful multi-step case flow)
- **Backend**: FastAPI + Python
- **Frontend**: React (Vite)
- **Database**: PostgreSQL (patient profiles) + Redis (session cache)
- **Vector DB**: ChromaDB (local, for Phase 1 MVP — swap to Weaviate in Phase 2)
- **Guardrails**: Custom Python rules + Guardrails AI patterns
- **Evals**: DeepEval

---

## User Review Required

> [!IMPORTANT]
> **Naturopathy vs Ayurveda First**: The original plan listed Ayurveda Prakriti Chatbot as Phase 1 MVP, but you've chosen to start with Naturopathy instead. This plan is tailored specifically for the Naturopathy system.

> [!IMPORTANT]
> **LLM API Key**: The implementation will use Google Gemini (recommended per plan). You'll need to provide a `GEMINI_API_KEY`. Alternatively, this can be swapped to Claude/OpenAI via a config switch.

> [!WARNING]
> **Medical Disclaimer**: All outputs will include mandatory AYUSH disclaimers. The system is designed to support, not replace, AYUSH practitioners.

---

## Open Questions

> [!IMPORTANT]
> 1. **LLM Provider**: Should we use Google Gemini (as in the plan) or do you have a preference for Claude/OpenAI? Do you have an API key ready?
> 2. **Database**: Should we use a full PostgreSQL + Redis setup, or keep it simple with SQLite for Phase 1 (easier local dev)?
> 3. **Frontend**: Full React/Vite frontend, or a simpler CLI/API-first approach for Phase 1?
> 4. **Knowledge Base**: For Phase 1, should we embed curated naturopathy protocols as structured JSON (faster), or set up ChromaDB RAG with naturopathy text documents?

---

## Proposed Changes

### Project Structure

```
holistic-treatment-agent/
├── backend/
│   ├── main.py                          # FastAPI entrypoint
│   ├── config.py                        # Settings, env vars, LLM config
│   ├── requirements.txt
│   ├── .env.example
│   │
│   ├── naturopathy/
│   │   ├── __init__.py
│   │   ├── agent.py                     # LangGraph NaturopathyAgent
│   │   ├── graph.py                     # LangGraph state graph definition
│   │   ├── nodes.py                     # Individual node functions
│   │   ├── state.py                     # TypedDict state schema
│   │   ├── prompts.py                   # System & node-level prompts
│   │   └── schemas.py                   # Pydantic models for I/O
│   │
│   ├── knowledge_base/
│   │   ├── naturopathy_protocols.json   # Curated condition → protocol map
│   │   ├── diet_therapy.json            # Diet therapy guidelines
│   │   ├── hydrotherapy.json            # Hydrotherapy protocols
│   │   ├── detox_protocols.json         # Detox protocol definitions
│   │   └── herb_drug_interactions.json  # Safety data (Phase 1 subset)
│   │
│   ├── guardrails/
│   │   ├── __init__.py
│   │   ├── input_guardrails.py          # Emergency detection, scope filter
│   │   └── output_guardrails.py         # Disclaimer injector, safety checks
│   │
│   ├── memory/
│   │   ├── __init__.py
│   │   ├── session_store.py             # Redis/in-memory session management
│   │   └── patient_profile.py           # SQLite patient profile persistence
│   │
│   └── evals/
│       ├── __init__.py
│       ├── test_naturopathy_evals.py    # DeepEval test suite
│       └── test_cases/
│           └── naturopathy_cases.json   # Labelled test cases
│
└── frontend/
    ├── index.html
    ├── package.json
    ├── vite.config.js
    └── src/
        ├── main.jsx
        ├── App.jsx
        ├── index.css
        ├── components/
        │   ├── ChatInterface.jsx
        │   ├── AssessmentForm.jsx
        │   ├── RecommendationCard.jsx
        │   ├── ProtocolDisplay.jsx
        │   └── SafetyAlert.jsx
        └── services/
            └── api.js
```

---

### Backend Core

#### [NEW] `backend/config.py`
- Pydantic Settings with env var loading
- LLM provider config (Gemini/Claude toggle)
- Database connection strings

#### [NEW] `backend/main.py`
- FastAPI app with CORS
- Routes: `/api/naturo/assess`, `/api/naturo/chat`, `/api/session/{id}`
- Health check endpoint

---

### Naturopathy LangGraph Agent

The agent follows a **5-node stateful graph**:

```
[intake_node] → [root_cause_node] → [protocol_selection_node] → [recommendation_node] → [guardrail_output_node]
```

#### [NEW] `backend/naturopathy/state.py`
- `NaturopathyState` TypedDict:
  - `patient_info` (age, gender, region)
  - `chief_complaints` (list of symptoms)
  - `lifestyle_factors` (sleep, stress, diet, exercise, exposure)
  - `emotional_factors` (mood, anxiety, grief)
  - `root_causes` (identified root causes)
  - `recommended_protocols` (therapy list)
  - `safety_flags` (emergency, herb-drug warnings)
  - `conversation_history` (messages)
  - `session_id`

#### [NEW] `backend/naturopathy/nodes.py`

| Node | Responsibility |
|------|---------------|
| `intake_node` | Collect chief complaint + lifestyle history via structured questions |
| `root_cause_node` | LLM identifies root causes: diet/toxin/lifestyle/emotional |
| `protocol_selection_node` | Maps root causes → nature cure protocols (diet, hydro, detox, exercise) |
| `recommendation_node` | Generates structured, actionable recommendations |
| `guardrail_output_node` | Appends disclaimers, checks for safety flags, routes to practitioner if needed |

#### [NEW] `backend/naturopathy/graph.py`
- LangGraph `StateGraph` wiring all 5 nodes
- Conditional edges: emergency → exit early to ER routing
- Persistence via LangGraph checkpointer (SQLite)

#### [NEW] `backend/naturopathy/prompts.py`
- System prompt: "You are a Naturopathy health advisor trained in Nature Cure principles..."
- Node-specific prompts (intake interview, root cause analysis, protocol selection)
- Disclaimer templates

---

### Knowledge Base (Phase 1 — JSON)

#### [NEW] `backend/knowledge_base/naturopathy_protocols.json`
Structured map of conditions → recommended Nature Cure protocols:
- Chronic fatigue, digestive issues, skin conditions, respiratory, metabolic
- Each entry: condition, root causes, diet therapy, hydrotherapy, detox, exercise

#### [NEW] `backend/knowledge_base/diet_therapy.json`
- Raw food protocols
- Fasting guidelines (intermittent, water, juice)
- Elimination diets (dairy-free, gluten-free, Sattvic)
- Condition-specific diets

#### [NEW] `backend/knowledge_base/hydrotherapy.json`
- Cold/hot compress protocols by condition
- Sitz baths, foot baths, steam inhalation
- Water fasting protocols

---

### Guardrails

#### [NEW] `backend/guardrails/input_guardrails.py`
- `emergency_detector`: Chest pain, stroke, trauma → immediate ER routing
- `scope_limiter`: Non-health queries → polite decline
- `pediatric_router`: Age < 5 → mandatory practitioner routing
- `pregnancy_filter`: Pregnancy + unsafe protocols → filtered output

#### [NEW] `backend/guardrails/output_guardrails.py`
- `disclaimer_injector`: AYUSH disclaimer appended to every response
- `allopathic_block`: Detects if LLM tries to prescribe drugs → blocks output
- `practitioner_router`: Complex cases → recommend AYUSH practitioner visit

---

### Frontend (React/Vite)

#### [NEW] `frontend/src/App.jsx`
- Chat interface + intake form
- Session management
- Real-time streaming response display

#### [NEW] `frontend/src/components/ChatInterface.jsx`
- Chat bubble UI with streaming support
- Naturopathy-themed design (earthy tones, nature motifs)

#### [NEW] `frontend/src/components/RecommendationCard.jsx`
- Structured display of:
  - Root causes identified
  - Diet therapy recommendations
  - Hydrotherapy protocol
  - Exercise prescription
  - Detox suggestions

#### [NEW] `frontend/src/index.css`
- Premium design system: earthy greens, browns, cream
- Glassmorphism cards
- Smooth animations
- Google Fonts: Inter + Cormorant Garamond

---

### Evals

#### [NEW] `backend/evals/test_naturopathy_evals.py`
Using **DeepEval** framework:
- Root Cause Identification Rate (target: >82%)
- Protocol Recommendation Relevance (target: >88%)
- Lifestyle Advice Completeness (target: >85%)
- Emergency Detection Rate (target: >99.9%) — critical safety eval
- Allopathic Leakage Rate (target: 0%)

---

## Verification Plan

### Automated Tests
```bash
# Run eval suite
cd backend && python -m pytest evals/test_naturopathy_evals.py -v

# Run FastAPI with uvicorn
uvicorn main:app --reload --port 8000

# Run frontend dev server
cd frontend && npm run dev
```

### Manual Verification
1. Submit a symptom (e.g. "I have chronic fatigue and digestive issues")
2. Verify intake questions are asked (lifestyle, diet, sleep, stress)
3. Verify root cause identification (e.g. poor diet + sedentary lifestyle)
4. Verify structured recommendations appear (diet, exercise, hydrotherapy)
5. Test emergency guardrail: input "severe chest pain" → verify ER redirect
6. Test scope guardrail: input "what's the weather?" → verify polite decline
7. Verify AYUSH disclaimer appears on every output
