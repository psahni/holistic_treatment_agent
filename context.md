# Holistic Treatment Agent - Application Context

## Application Overview
Holistic Treatment Agent (also known as NatureCure AI) is an AI-powered Naturopathy health triage system. It leverages large language models (via LangGraph) to conduct an automated patient intake process, determine root causes of ailments, and generate a draft prescription/treatment plan. The drafted plan is then placed in a queue for a human Naturopathy practitioner (Admin) to review, modify, approve, and send to the patient.

## Core Flows

### 1. Patient Flow (User Interface)
- **Intake Form**: The user signs up/logs in and fills out a basic patient profile (age, gender, vitals, medical history, current medications, investigations).
- **Consultation Session**: The user enters the chat interface and starts a session.
- **Question Mode**: The AI agent operates in "question mode", interactively asking the patient questions to gather symptoms and understand their chief complaint.
- **Treatment Mode**: Once enough information is gathered (or the user requests a treatment), the AI switches to "treatment mode". It finalizes the assessment, determines potential root causes, and generates a preliminary report.
- **Completion**: The session is marked as complete and sent to the practitioner's queue. The user is informed that a doctor will review their case and email the official prescription.

### 2. Practitioner Flow (Admin Console)
- **Pending Cases Queue**: The Admin logs into the dashboard and views a list of pending patient cases.
- **Reviewing a Case**: The Admin selects a case to view the patient's vitals, chief complaint, chat history, medical history, and investigations.
- **AI Prescription Generator**: The Admin provides a short clinical prompt (e.g., "Generate 5 days prescription focusing on gut health"). The backend AI generates a structured official prescription based on the prompt and the patient's entire chat history/context.
- **Drafting & Templates**: The Admin can manually edit the AI-generated prescription, load pre-saved clinical templates (e.g., Arthritis Protocol), and save their work as a draft.
- **Approval & Dispatch**: Once satisfied, the Admin clicks "Preview & Submit". The final prescription is saved to the database and an email is dispatched to the patient.

## LLM Modes (LangGraph Agent)
The backend AI agent (`NaturopathyAgent`) utilizes LangGraph to manage state transitions:
- **Question Mode**: The LLM acts as an empathetic intake assistant. It evaluates the current conversation history to decide if it has enough information. If not, it asks a relevant follow-up question.
- **Treatment Mode**: The LLM stops asking questions. It analyzes the gathered symptoms, outputs an internal JSON payload detailing root causes, dietary guidelines, and red flags, and flags the assessment as `assessment_complete: true`.

## File Structure & Architecture

### Backend (FastAPI / Python)
The backend is a FastAPI application that serves the frontend, manages the SQLite database (SQLAlchemy), and orchestrates the LLM using LangChain/LangGraph.

```text
backend/
├── main.py                  # FastAPI application entrypoint, CORS setup, router inclusion
├── config.py                # Environment variables and app configuration
├── requirements.txt         # Python dependencies
├── admin/                   # Admin functionality
│   ├── router.py            # API routes for fetching cases, saving drafts, generating AI prescriptions
│   └── schemas.py           # Pydantic schemas for admin requests
├── auth/                    # Authentication system
│   ├── router.py            # Login, Signup, Logout endpoints
│   ├── security.py          # Password hashing and JWT generation
│   └── utils.py             # Dependency injection for current user auth
├── database/
│   └── models.py            # SQLAlchemy models (User, PatientProfile, ConsultationSession, PrescriptionTemplate)
├── guardrails/              # LLM security
│   ├── input_guardrails.py  # Validates user input before sending to LLM
│   └── output_guardrails.py # Ensures LLM output is safe and structured
├── memory/
│   └── session_store.py     # In-memory dictionary mapping session_ids to their active LangGraph state
├── naturopathy/             # AI Agent Core
│   ├── agent.py             # NaturopathyAgent class (handles start_session, process_message)
│   ├── graph.py             # LangGraph state machine definition (nodes and edges)
│   ├── prompts.py           # System prompts for Question and Treatment modes
│   ├── router.py            # API routes for the chat interface (start, chat, end)
│   └── state.py             # TypedDict defining the state passed through the graph
└── scripts/
    └── seed_fake_cases.py   # Utility script to populate database with mock patient cases for admin testing
```

### Frontend (Next.js / React)
The frontend is a React application built with Next.js (App Router) and plain CSS.

```text
frontend/
├── package.json             # Node dependencies and build scripts
├── next.config.mjs          # Next.js configuration (SWC compiler enabled)
├── jest.config.js           # Jest configuration using next/jest
├── src/
│   ├── app/                 # Next.js App Router pages
│   │   ├── layout.jsx       # Root HTML layout and global providers
│   │   ├── page.jsx         # Landing page / Home
│   │   ├── globals.css      # Global CSS variables (colors, typography)
│   │   ├── admin/           # Admin Dashboard Route (/admin)
│   │   │   ├── page.jsx     
│   │   │   └── admin.css    # Admin-specific styling
│   │   └── chat/            # Patient Chat Interface Route (/chat)
│   │       ├── page.jsx
│   │       └── chat.css     # Chat-specific styling
│   ├── components/          # Reusable React Components
│   │   ├── AuthModal.jsx    # Login/Signup popup
│   │   ├── PatientFormModal.jsx # Intake form for medical history, vitals, etc.
│   │   └── admin/
│   │       └── AdminDashboard.jsx # Massive split-pane component for the Practitioner Console
│   └── services/
│       └── api.js           # Fetch wrappers for communicating with the FastAPI backend
```

## Technology Stack
- **Frontend**: Next.js 14/15, React, Vanilla CSS, Lucide Icons.
- **Backend**: FastAPI, SQLAlchemy, SQLite, Uvicorn.
- **AI/LLM**: LangChain, LangGraph (for stateful conversational agents).
- **Authentication**: JWT stored in HTTP-Only cookies.
