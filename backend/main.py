from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from contextlib import asynccontextmanager
import uuid
import logging
import traceback

logger = logging.getLogger(__name__)

from config import get_settings
from naturopathy.schemas import SymptomInput, ChatRequest, AssessmentResponse
from naturopathy.agent import NaturopathyAgent
from guardrails.input_guardrails import run_input_guardrails
from guardrails.output_guardrails import run_output_guardrails
from memory.session_store import session_store
from database.models import init_db

@asynccontextmanager
async def lifespan(app: FastAPI):
    init_db()
    yield

app = FastAPI(title="Naturopathy Health Triage Agent", lifespan=lifespan)
settings = get_settings()

from auth.router import router as auth_router
app.include_router(auth_router)

app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.CORS_ORIGINS,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

agent = NaturopathyAgent()

@app.post("/api/naturo/start", response_model=AssessmentResponse)
async def start_session(symptom_input: SymptomInput):
    patient_info_dict = symptom_input.patient_info.model_dump() if symptom_input.patient_info else {}
    
    age = patient_info_dict.get("age")
    guardrail_result = run_input_guardrails(symptom_input.message, age)
    
    if not guardrail_result["safe"]:
        raise HTTPException(status_code=400, detail=guardrail_result["message"])
        
    session_id = symptom_input.session_id or str(uuid.uuid4())
    
    # Initialize session state via agent
    out_state = await agent.start_session(patient_info_dict, session_id, mode=symptom_input.mode)
    
    # Process initial message if provided
    if symptom_input.message.strip():
        out_state = await agent.process_message(session_id, symptom_input.message, out_state, mode=symptom_input.mode)
    
    # Apply output guardrails
    if out_state.get("current_question"):
        og_result = run_output_guardrails(out_state["current_question"], out_state)
        out_state["current_question"] = og_result["safe_output"]
        
    session_store.save_session(session_id, out_state)
    
    return agent.get_session_response(out_state)

@app.post("/api/naturo/chat", response_model=AssessmentResponse)
async def chat(request: ChatRequest):
    state = session_store.get_session(request.session_id)
    if not state:
        raise HTTPException(status_code=404, detail="Session not found")
        
    guardrail_result = run_input_guardrails(request.message)
    if not guardrail_result["safe"]:
        response = agent.get_session_response(state)
        response["message"] = guardrail_result["message"]
        response["safety_flags"] = guardrail_result.get("flags", [])
        return response
        
    out_state = await agent.process_message(request.session_id, request.message, state, mode=request.mode)
    
    if out_state.get("current_question"):
        og_result = run_output_guardrails(out_state["current_question"], out_state)
        out_state["current_question"] = og_result["safe_output"]
        
    session_store.save_session(request.session_id, out_state)
    return agent.get_session_response(out_state)

@app.get("/api/session/{id}", response_model=AssessmentResponse)
def get_session(id: str):
    state = session_store.get_session(id)
    if not state:
        raise HTTPException(status_code=404, detail="Session not found")
    return agent.get_session_response(state)

@app.delete("/api/session/{id}")
def delete_session(id: str):
    session_store.delete_session(id)
    return {"status": "deleted"}

@app.get("/health")
def health_check():
    return {"status": "ok"}
