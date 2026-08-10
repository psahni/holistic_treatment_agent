from fastapi import FastAPI, HTTPException, Depends, Request
from fastapi.responses import StreamingResponse
from fastapi.middleware.cors import CORSMiddleware
from contextlib import asynccontextmanager
import uuid
import logging
import traceback
from sqlalchemy.orm import Session

logger = logging.getLogger(__name__)

from config import get_settings
from naturopathy.schemas import SymptomInput, ChatRequest, AssessmentResponse
from naturopathy.agent import NaturopathyAgent
from guardrails.input_guardrails import run_input_guardrails
from guardrails.output_guardrails import run_output_guardrails
from memory.session_store import session_store
from database.models import init_db, get_db, save_completed_session, ConsultationSession, PatientProfile
from auth.utils import get_optional_current_user

@asynccontextmanager
async def lifespan(app: FastAPI):
    init_db()
    yield

app = FastAPI(title="Naturopathy Health Triage Agent", lifespan=lifespan)
settings = get_settings()

from auth.router import router as auth_router
from admin.router import router as admin_router
app.include_router(auth_router)
app.include_router(admin_router, prefix="/api/admin")

app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.CORS_ORIGINS,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

agent = NaturopathyAgent()

@app.post("/api/naturo/start", response_model=AssessmentResponse)
async def start_session(symptom_input: SymptomInput, request: Request, db: Session = Depends(get_db)):
    patient_info_dict = symptom_input.patient_info.model_dump() if symptom_input.patient_info else {}
    
    # Enforce auth for treatment mode
    current_user = get_optional_current_user(request, db)
    if symptom_input.mode == "treatment" and not current_user:
        raise HTTPException(status_code=401, detail="User must be logged in for treatment mode")
        
    age = patient_info_dict.get("age")
    guardrail_result = run_input_guardrails(symptom_input.message, age)
    
    if not guardrail_result["safe"]:
        raise HTTPException(status_code=400, detail=guardrail_result["message"])
        
    session_id = symptom_input.session_id or str(uuid.uuid4())
    
    # Initialize session state via agent
    out_state = await agent.start_session(patient_info_dict, session_id, mode=symptom_input.mode)
    if current_user:
        out_state["user_id"] = str(current_user.id)
    
    # Process initial message if provided
    if symptom_input.message.strip():
        out_state = await agent.process_message(session_id, symptom_input.message, out_state, mode=symptom_input.mode)
    
    # Apply output guardrails
    if out_state.get("current_question"):
        og_result = run_output_guardrails(out_state["current_question"], out_state)
        out_state["current_question"] = og_result["safe_output"]
        
    # Check if complete
    if out_state.get("assessment_complete") and out_state.get("mode") == "treatment" and current_user:
        save_completed_session(db, session_id, str(current_user.id), out_state)
        out_state["current_question"] = "Thank you! Your health intake is complete. Your details have been sent to our Naturopathy practitioner for review. We will email you the prescription once reviewed."
        
    session_store.save_session(session_id, out_state)
    
    return agent.get_session_response(out_state)

@app.post("/api/naturo/chat", response_model=AssessmentResponse)
async def chat(request: ChatRequest, req_raw: Request, db: Session = Depends(get_db)):
    state = session_store.get_session(request.session_id)
    if not state:
        raise HTTPException(status_code=404, detail="Session not found")
        
    # Enforce auth for treatment mode
    current_user = get_optional_current_user(req_raw, db)
    is_treatment = (request.mode == "treatment") or (state.get("mode") == "treatment")
    if is_treatment and not current_user:
        raise HTTPException(status_code=401, detail="User must be logged in for treatment mode")
        
    guardrail_result = run_input_guardrails(request.message)
    if not guardrail_result["safe"]:
        response = agent.get_session_response(state)
        response["message"] = guardrail_result["message"]
        response["safety_flags"] = guardrail_result.get("flags", [])
        return response
        
    out_state = await agent.process_message(request.session_id, request.message, state, mode=request.mode)
    if current_user:
        out_state["user_id"] = str(current_user.id)
        
    if out_state.get("current_question"):
        og_result = run_output_guardrails(out_state["current_question"], out_state)
        out_state["current_question"] = og_result["safe_output"]
        
    # Check if complete
    if out_state.get("assessment_complete") and out_state.get("mode") == "treatment" and current_user:
        save_completed_session(db, request.session_id, str(current_user.id), out_state)
        out_state["current_question"] = "Thank you! Your health intake is complete. Your details have been sent to our Naturopathy practitioner for review. We will email you the prescription once reviewed."
        
    session_store.save_session(request.session_id, out_state)
    return agent.get_session_response(out_state)

@app.post("/api/naturo/chat_stream")
async def chat_stream(request: ChatRequest, req_raw: Request, db: Session = Depends(get_db)):
    state = session_store.get_session(request.session_id)
    if not state:
        raise HTTPException(status_code=404, detail="Session not found")
        
    # Enforce auth for treatment mode
    current_user = get_optional_current_user(req_raw, db)
    is_treatment = (request.mode == "treatment") or (state.get("mode") == "treatment")
    if is_treatment and not current_user:
        raise HTTPException(status_code=401, detail="User must be logged in for treatment mode")
        
    guardrail_result = run_input_guardrails(request.message)
    if not guardrail_result["safe"]:
        response = agent.get_session_response(state)
        response["message"] = guardrail_result["message"]
        response["safety_flags"] = guardrail_result.get("flags", [])
        import json
        
        async def mock_stream():
            yield f"data: {json.dumps({'chunk': guardrail_result['message']})}\n\n"
            yield f"data: {json.dumps({'done': True, 'state': response})}\n\n"
            
        return StreamingResponse(mock_stream(), media_type="text/event-stream")
        
    user_id_str = str(current_user.id) if current_user else None
    return StreamingResponse(
        agent.process_message_stream(
            request.session_id, 
            request.message, 
            state, 
            mode=request.mode, 
            user_id=user_id_str, 
            db=db
        ),
        media_type="text/event-stream"
    )

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

@app.get("/api/naturo/history")
def get_patient_history(
    request: Request,
    db: Session = Depends(get_db)
):
    current_user = get_optional_current_user(request, db)
    if not current_user:
        raise HTTPException(status_code=401, detail="Authentication required")
        
    sessions = db.query(ConsultationSession).filter(
        ConsultationSession.user_id == current_user.id
    ).order_by(ConsultationSession.created_at.desc()).all()
    
    cases = []
    for s in sessions:
        cases.append({
            "session_id": str(s.id),
            "case_id": s.case_id,
            "status": s.status,
            "created_at": s.created_at.strftime('%Y-%m-%d %H:%M:%S') if s.created_at else None,
            "completed_at": s.completed_at.strftime('%Y-%m-%d %H:%M:%S') if s.completed_at else None,
            "has_prescription": s.doctor_prescription is not None
        })
    return {"cases": cases}

@app.get("/api/naturo/cases/{case_id}")
def get_patient_case_details(
    case_id: int,
    request: Request,
    db: Session = Depends(get_db)
):
    current_user = get_optional_current_user(request, db)
    if not current_user:
        raise HTTPException(status_code=401, detail="Authentication required")
        
    s = db.query(ConsultationSession).filter(
        ConsultationSession.case_id == case_id,
        ConsultationSession.user_id == current_user.id
    ).first()
    
    if not s:
        raise HTTPException(status_code=404, detail="Case not found")
        
    return {
        "session_id": str(s.id),
        "case_id": s.case_id,
        "status": s.status,
        "created_at": s.created_at.strftime('%Y-%m-%d %H:%M:%S') if s.created_at else None,
        "completed_at": s.completed_at.strftime('%Y-%m-%d %H:%M:%S') if s.completed_at else None,
        "conversation_history": s.session_data,
        "root_causes": s.root_causes,
        "protocols_recommended": s.protocols_recommended,
        "doctor_prescription": s.doctor_prescription,
        "doctor_notes": s.doctor_notes
    }
