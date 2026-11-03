import os
import asyncio
from pathlib import Path
import uuid
from typing import List, Optional
from fastapi import APIRouter, UploadFile, File, Depends, HTTPException, Response, Request
from pydantic import BaseModel
import jwt
from datetime import datetime, timedelta, timezone
from sqlalchemy.orm import Session

from config import get_settings
from database.models import get_db, ConsultationSession, User, PatientProfile, PrescriptionTemplate
import hashlib
from rag.qdrant_store import get_document_chunk_count, delete_document_by_source, search_vector_store, get_genai_client
import ingest_docs

router = APIRouter()
settings = get_settings()

class LoginRequest(BaseModel):
    username: str
    password: str

def create_access_token(data: dict):
    to_encode = data.copy()
    expire = datetime.now(timezone.utc) + timedelta(minutes=settings.ACCESS_TOKEN_EXPIRE_MINUTES)
    to_encode.update({"exp": expire})
    encoded_jwt = jwt.encode(to_encode, settings.SECRET_KEY, algorithm=settings.ALGORITHM)
    return encoded_jwt

def get_current_admin(request: Request):
    token = request.cookies.get("admin_token")
    if not token:
        raise HTTPException(status_code=401, detail="Not authenticated")
    try:
        payload = jwt.decode(token, settings.SECRET_KEY, algorithms=[settings.ALGORITHM])
        username: str = payload.get("sub")
        if username != settings.ADMIN_USERNAME:
            raise HTTPException(status_code=401, detail="Invalid token")
        return username
    except jwt.PyJWTError:
        raise HTTPException(status_code=401, detail="Invalid token")

@router.post("/login")
def login(req: LoginRequest, response: Response):
    if req.username == settings.ADMIN_USERNAME and req.password == settings.ADMIN_PASSWORD:
        token = create_access_token(data={"sub": req.username})
        # Set HTTPOnly cookie
        response.set_cookie(
            key="admin_token",
            value=token,
            httponly=True,
            secure=settings.APP_ENV == "production",
            samesite="lax",
            max_age=settings.ACCESS_TOKEN_EXPIRE_MINUTES * 60
        )
        return {"message": "Login successful"}
    raise HTTPException(status_code=401, detail="Invalid credentials")

@router.post("/logout")
def logout(response: Response):
    response.delete_cookie("admin_token")
    return {"message": "Logged out"}

@router.get("/check-auth")
def check_auth(admin: str = Depends(get_current_admin)):
    return {"authenticated": True, "user": admin}

def _pdf_files() -> List[str]:
    os.makedirs(ingest_docs.DOCS_DIR, exist_ok=True)
    return sorted(f for f in os.listdir(ingest_docs.DOCS_DIR) if f.lower().endswith(".pdf"))

def _describe_doc(file_name: str) -> dict:
    try:
        return ingest_docs.describe_document(file_name, get_document_chunk_count(file_name))
    except Exception as e:
        return {"filename": file_name, "status": "db_error", "chunks": 0, "total_chunks": 0,
                "embedded_chunks": 0, "last_error": f"{type(e).__name__}: {str(e)[:200]}", "replacing": False}

@router.get("/docs")
async def list_docs(admin: str = Depends(get_current_admin)):
    docs_info = []
    for file_name in _pdf_files():
        docs_info.append(await asyncio.to_thread(_describe_doc, file_name))
    return {"docs": docs_info}

def _save_file_sync(file_path: str, contents: bytes):
    # Write to a temp file first so a failed write never leaves a half-written PDF behind.
    tmp_path = file_path + ".uploading"
    with open(tmp_path, "wb") as buffer:
        buffer.write(contents)
    os.replace(tmp_path, file_path)

@router.post("/upload")
async def upload_doc(file: UploadFile = File(...), replace: bool = False, admin: str = Depends(get_current_admin)):
    """Uploads a PDF. Uploading a different file under an existing name needs replace=true."""
    if not file.filename.lower().endswith(".pdf"):
        raise HTTPException(status_code=400, detail="Only PDF files are allowed")

    # SECURITY: Prevent path traversal
    safe_filename = Path(file.filename).name
    file_path = ingest_docs.doc_path(safe_filename)
    os.makedirs(ingest_docs.DOCS_DIR, exist_ok=True)

    if ingest_docs.is_ingestion_running(safe_filename):
        raise HTTPException(status_code=409, detail=f"{safe_filename} is being ingested right now. Wait for it to finish before replacing it.")

    contents = await file.read()
    new_hash = hashlib.sha256(contents).hexdigest()
    exists = os.path.exists(file_path)

    if exists:
        existing_hash = await asyncio.to_thread(ingest_docs.file_sha256, file_path)
        if existing_hash == new_hash:
            return {"status": "unchanged", "filename": safe_filename,
                    "message": f"{safe_filename} is already uploaded with identical content. Nothing changed."}
        if not replace:
            raise HTTPException(status_code=409, detail={
                "code": "document_exists",
                "filename": safe_filename,
                "message": f"A different file named {safe_filename} already exists.",
            })
        # Record the current version (including documents ingested before status tracking) before overwriting it.
        try:
            await asyncio.to_thread(ingest_docs.ensure_status_row, safe_filename)
        except Exception as e:
            raise HTTPException(status_code=503, detail=f"Could not read the current version's status ({type(e).__name__}). Try again.")

    await asyncio.to_thread(_save_file_sync, file_path, contents)
    await asyncio.to_thread(ingest_docs.register_upload, safe_filename, new_hash)

    return {
        "status": "replaced" if exists else "uploaded",
        "filename": safe_filename,
        "message": f"Successfully {'replaced' if exists else 'uploaded'} {safe_filename}",
    }

@router.delete("/docs/{filename}")
async def delete_doc(filename: str, admin: str = Depends(get_current_admin)):
    # SECURITY: Prevent path traversal
    safe_filename = Path(filename).name
    file_path = ingest_docs.doc_path(safe_filename)

    if ingest_docs.is_ingestion_running(safe_filename):
        raise HTTPException(status_code=409, detail=f"{safe_filename} is being ingested right now. Wait for it to finish before deleting it.")

    # 1. Delete from Qdrant
    qdrant_deleted = await asyncio.to_thread(delete_document_by_source, safe_filename)
    
    # 2. Delete from filesystem
    fs_deleted = False
    if os.path.exists(file_path):
        os.remove(file_path)
        fs_deleted = True

    # 3. Forget its ingestion status (only once its chunks are gone, so a retry can still find them)
    if qdrant_deleted:
        await asyncio.to_thread(ingest_docs.delete_status_row, safe_filename)
        
    if not qdrant_deleted and not fs_deleted:
        raise HTTPException(status_code=404, detail="File not found in DB or filesystem")
        
    return {"message": f"Deleted {safe_filename}", "qdrant_deleted": qdrant_deleted, "fs_deleted": fs_deleted}

@router.post("/ingest/{filename}", status_code=202)
async def start_ingestion(filename: str, restart: bool = False, admin: str = Depends(get_current_admin)):
    """Starts (or resumes) ingestion in the background. Poll GET /docs for progress.

    restart=true discards this version's partially embedded chunks and starts from the first chunk.
    """
    safe_filename = Path(filename).name
    if not os.path.exists(ingest_docs.doc_path(safe_filename)):
        raise HTTPException(status_code=404, detail="File not found")

    if not ingest_docs.start_ingestion_thread(safe_filename, restart=restart):
        raise HTTPException(status_code=409, detail=f"{safe_filename} is already being ingested.")
    return {"status": "started", "filename": safe_filename, "restart": restart}

@router.get("/embeddings/search")
async def search_embeddings(q: str, limit: int = 5, admin: str = Depends(get_current_admin)):
    if not q:
        raise HTTPException(status_code=400, detail="Query parameter 'q' is required")
        
    results = await asyncio.to_thread(search_vector_store, q, limit)
    return {"results": results}


@router.get("/embeddings/search-with-answer")
async def search_with_answer(q: str, limit: int = 5, admin: str = Depends(get_current_admin)):
    """Vector search + LLM synthesis. Returns chunks and a generated answer."""
    import time
    if not q:
        raise HTTPException(status_code=400, detail="Query parameter 'q' is required")

    # 1. Retrieve relevant chunks
    results = await asyncio.to_thread(search_vector_store, q, limit)

    if not results:
        return {"results": [], "answer": "No relevant information found in the knowledge base.", "llm_error": None}

    # 2. Build context from chunks
    context_parts = []
    for i, hit in enumerate(results, 1):
        context_parts.append(f"[{i}] (Source: {hit['source']}, Score: {hit['score']:.3f})\n{hit['text']}")
    context = "\n\n".join(context_parts)

    # 3. Call Gemini to synthesize answer (with 429 retry)
    prompt = f"""You are a knowledgeable naturopathy assistant. Using ONLY the context below, answer the user's question concisely and accurately.
If the context does not contain enough information, say so.

Context:
{context}

Question: {q}

Answer:"""

    def _generate_answer() -> str:
        max_retries = 3
        for attempt in range(max_retries):
            try:
                gclient = get_genai_client()
                model_name = settings.GEMINI_MODEL if settings.USE_VERTEX_AI else f"models/{settings.GEMINI_MODEL}"
                response = gclient.models.generate_content(
                    model=model_name,
                    contents=prompt,
                )
                return response.text
            except Exception as e:
                if "429" in str(e) or "RESOURCE_EXHAUSTED" in str(e):
                    wait_time = (2 ** attempt) * 5
                    import logging
                    logging.getLogger(__name__).warning(
                        f"Gemini generate_content rate-limited. Retrying in {wait_time}s (attempt {attempt+1}/{max_retries})..."
                    )
                    time.sleep(wait_time)
                else:
                    raise
        raise Exception("Rate limit: Gemini quota exceeded. Please wait a moment and try again.")

    try:
        answer = await asyncio.to_thread(_generate_answer)
        return {"results": results, "answer": answer, "llm_error": None}
    except Exception as e:
        err_str = str(e)
        # Return a clean user-facing error, not the raw 429 blob
        if "429" in err_str or "RESOURCE_EXHAUSTED" in err_str or "quota" in err_str.lower():
            user_msg = "Gemini quota limit reached. Please wait ~20 seconds and try again."
        else:
            user_msg = f"LLM error: {err_str[:200]}"
        return {"results": results, "answer": None, "llm_error": user_msg}


class ApproveCaseRequest(BaseModel):
    prescription_text: str
    safety_precautions: str = ""
    doctor_notes: str = ""

class GenerateAIPrescriptionRequest(BaseModel):
    doctor_prompt: str

class SaveDraftRequest(BaseModel):
    prescription_text: str
    safety_precautions: str = ""
    doctor_notes: str = ""


@router.get("/pending-cases")
def list_pending_cases(admin: str = Depends(get_current_admin), db: Session = Depends(get_db)):
    sessions = db.query(ConsultationSession).filter(ConsultationSession.status == "pending_review").all()
    cases = []
    for s in sessions:
        user = db.query(User).filter(User.id == s.user_id).first()
        profile = db.query(PatientProfile).filter(PatientProfile.id == s.patient_id).first()
        
        # Get chief complaints or symptoms from session_data
        symptoms = ""
        if s.session_data:
            # Find first user message
            for msg in s.session_data:
                if msg.get("role") == "user":
                    symptoms = msg.get("content", "")
                    break
                    
        cases.append({
            "session_id": str(s.id),
            "case_id": s.case_id,
            "patient_name": user.name if user else "Unknown",
            "patient_email": user.email if user else "",
            "age": profile.age if profile else (user.age if user else 30),
            "gender": profile.gender if profile else "other",
            "region": profile.region if profile else "India",
            "symptoms": symptoms,
            "created_at": s.created_at.strftime('%Y-%m-%d %H:%M:%S')
        })
    return {"cases": cases}


@router.get("/cases/{session_id}")
def get_case_details(session_id: str, admin: str = Depends(get_current_admin), db: Session = Depends(get_db)):
    import uuid
    try:
        session_uuid = uuid.UUID(session_id)
    except ValueError:
        raise HTTPException(status_code=400, detail="Invalid session ID")
        
    s = db.query(ConsultationSession).filter(ConsultationSession.id == session_uuid).first()
    if not s:
        raise HTTPException(status_code=404, detail="Case not found")
        
    user = db.query(User).filter(User.id == s.user_id).first()
    profile = db.query(PatientProfile).filter(PatientProfile.id == s.patient_id).first()
    
    return {
        "session_id": str(s.id),
        "case_id": s.case_id,
        "patient_name": user.name if user else "Unknown",
        "patient_email": user.email if user else "",
        "age": profile.age if profile else (user.age if user else 30),
        "gender": profile.gender if profile else "other",
        "region": profile.region if profile else "India",
        "conversation_history": s.session_data,
        "root_causes": s.root_causes,
        "protocols_recommended": s.protocols_recommended,
        "status": s.status,
        "doctor_prescription": s.doctor_prescription,
        "doctor_notes": s.doctor_notes,
        "vitals": s.vitals,
        "medical_history": s.medical_history,
        "current_medications": s.current_medications,
        "investigations": s.investigations
    }


@router.post("/cases/{session_id}/approve")
def approve_case(session_id: str, req: ApproveCaseRequest, admin: str = Depends(get_current_admin), db: Session = Depends(get_db)):
    import uuid
    try:
        session_uuid = uuid.UUID(session_id)
    except ValueError:
        raise HTTPException(status_code=400, detail="Invalid session ID")
        
    s = db.query(ConsultationSession).filter(ConsultationSession.id == session_uuid).first()
    if not s:
        raise HTTPException(status_code=404, detail="Case not found")
        
    user = db.query(User).filter(User.id == s.user_id).first()
    if not user:
        raise HTTPException(status_code=404, detail="User not found")
        
    # Update session in DB
    s.status = "reviewed"
    s.doctor_prescription = {
        "prescription_text": req.prescription_text,
        "safety_precautions": req.safety_precautions,
        "approved_at": datetime.now(timezone.utc).strftime('%Y-%m-%d %H:%M:%S')
    }
    s.doctor_notes = req.doctor_notes
    s.completed_at = datetime.now(timezone.utc)
    
    db.commit()
    
    # Send email
    from utils.mailer import send_prescription_email
    send_prescription_email(
        to_email=user.email,
        patient_name=user.name,
        prescription_data=s.doctor_prescription
    )
    
    # Update active session in session_store (Redis/memory)
    from memory.session_store import session_store
    state = session_store.get_session(session_id)
    if state:
        state["step"] = "complete"
        state["assessment_complete"] = True
        state["final_report"] = {
            "root_causes": s.root_causes,
            "protocols": [],
            "daily_routine": req.prescription_text,
            "diet_guidelines": {"recommended_foods": [], "foods_to_avoid": []},
            "red_flags": [req.safety_precautions] if req.safety_precautions else [],
            "follow_up_timeline": "14 days",
            "disclaimer": "Approved by Practitioner",
            "is_reviewed": True,
            "doctor_prescription": s.doctor_prescription
        }
        session_store.save_session(session_id, state)
        
    return {"message": "Case reviewed and prescription submitted successfully"}

@router.post("/cases/{session_id}/draft")
def save_draft(session_id: str, req: SaveDraftRequest, admin: str = Depends(get_current_admin), db: Session = Depends(get_db)):
    import uuid
    try:
        session_uuid = uuid.UUID(session_id)
    except ValueError:
        raise HTTPException(status_code=400, detail="Invalid session ID")
        
    s = db.query(ConsultationSession).filter(ConsultationSession.id == session_uuid).first()
    if not s:
        raise HTTPException(status_code=404, detail="Case not found")
        
    s.doctor_prescription = {
        "prescription_text": req.prescription_text,
        "safety_precautions": req.safety_precautions,
        "is_draft": True
    }
    s.doctor_notes = req.doctor_notes
    db.commit()
    
    return {"message": "Draft saved successfully"}


# Pydantic models
class TemplateCreateRequest(BaseModel):
    name: str
    category: str
    prescription_text: str
    safety_precautions: str = ''

class TemplateUpdateRequest(BaseModel):
    name: Optional[str] = None
    category: Optional[str] = None
    prescription_text: Optional[str] = None
    safety_precautions: Optional[str] = None

# GET /api/admin/templates
@router.get('/templates')
def get_templates(admin: str = Depends(get_current_admin), db: Session = Depends(get_db)):
    templates = db.query(PrescriptionTemplate).order_by(PrescriptionTemplate.category).all()
    return [{"id": t.id, "name": t.name, "category": t.category, 
             "prescription_text": t.prescription_text, "safety_precautions": t.safety_precautions,
             "created_at": t.created_at.strftime('%Y-%m-%d %H:%M') if t.created_at else None,
             "updated_at": t.updated_at.strftime('%Y-%m-%d %H:%M') if t.updated_at else None} 
            for t in templates]

# POST /api/admin/templates  
@router.post('/templates')
def create_template(req: TemplateCreateRequest, admin: str = Depends(get_current_admin), db: Session = Depends(get_db)):
    template = PrescriptionTemplate(name=req.name, category=req.category, 
                                     prescription_text=req.prescription_text,
                                     safety_precautions=req.safety_precautions)
    db.add(template)
    db.commit()
    db.refresh(template)
    return {"id": template.id, "message": "Template created successfully"}

# PUT /api/admin/templates/{id}
@router.put('/templates/{template_id}')
def update_template(template_id: int, req: TemplateUpdateRequest, admin: str = Depends(get_current_admin), db: Session = Depends(get_db)):
    template = db.query(PrescriptionTemplate).filter(PrescriptionTemplate.id == template_id).first()
    if not template:
        raise HTTPException(status_code=404, detail="Template not found")
    if req.name is not None: template.name = req.name
    if req.category is not None: template.category = req.category
    if req.prescription_text is not None: template.prescription_text = req.prescription_text
    if req.safety_precautions is not None: template.safety_precautions = req.safety_precautions
    db.commit()
    return {"message": "Template updated"}

# DELETE /api/admin/templates/{id}
@router.delete('/templates/{template_id}')
def delete_template(template_id: int, admin: str = Depends(get_current_admin), db: Session = Depends(get_db)):
    template = db.query(PrescriptionTemplate).filter(PrescriptionTemplate.id == template_id).first()
    if not template:
        raise HTTPException(status_code=404, detail="Template not found")
    db.delete(template)
    db.commit()
    return {"message": "Template deleted"}

# POST /api/admin/cases/{session_id}/generate-ai-prescription
@router.post('/cases/{session_id}/generate-ai-prescription')
async def generate_ai_prescription(session_id: str, req: GenerateAIPrescriptionRequest, admin: str = Depends(get_current_admin), db: Session = Depends(get_db)):
    """On-demand AI prescription generation using a doctor's prompt."""
    
    if not req.doctor_prompt or len(req.doctor_prompt.strip()) < 5:
        raise HTTPException(status_code=400, detail="A valid clinical prompt is required.")
        
    # Simple context engineering / validation: Ensure prompt is clinically oriented
    lower_prompt = req.doctor_prompt.lower()
    clinical_keywords = ['day', 'days', 'prescription', 'subscription', 'diet', 'focus', 'treat', 'patient', 'medication', 'investigation', 'generate', 'create', 'make', 'plan', 'notes', 'health', 'wellness']
    if not any(k in lower_prompt for k in clinical_keywords):
        raise HTTPException(status_code=400, detail="Prompt does not appear to be clinically relevant. Please provide specific instructions for the prescription.")

    from naturopathy.agent import naturopathy_agent_instance as agent
    from memory.session_store import session_store
    import uuid
    
    state = session_store.get_session(session_id)
    if not state:
        # Try loading from DB
        try:
            session_uuid = uuid.UUID(session_id)
            session = db.query(ConsultationSession).filter(ConsultationSession.id == session_uuid).first()
        except ValueError:
            session = None
        if not session:
            raise HTTPException(status_code=404, detail="Session not found")
        # Reconstruct minimal state from DB
        state = {
            "conversation_history": session.session_data or [],
            "user_responses": {},
            "patient_info": {},
            "step": "root_cause",
            "mode": "treatment"
        }
    else:
        state["step"] = "root_cause"
        state["mode"] = "treatment"
    
    # Inject doctor's prompt into the context by adding a system message or user message at the end
    doctor_instruction = f"Dr. Note for Prescription Generation: {req.doctor_prompt}. Please draft the official prescription accordingly."
    state["conversation_history"].append({"role": "user", "content": doctor_instruction})
    
    try:
        import logging
        logger = logging.getLogger(__name__)
        final_state = await agent.graph.ainvoke(state)
        
        # Remove the injected instruction so it doesn't stay in the history forever
        if state["conversation_history"] and state["conversation_history"][-1]["content"] == doctor_instruction:
            state["conversation_history"].pop()
            
        # Extract the generated prescription
        daily_routine = final_state.get("final_report", {}).get("daily_routine", "")
        root_causes = final_state.get("root_causes", [])
        diet = final_state.get("final_report", {}).get("diet_guidelines", {})
        red_flags = final_state.get("final_report", {}).get("red_flags", [])
        
        # Format into a readable prescription text
        prescription_parts = []
        if req.doctor_prompt:
            prescription_parts.append(f"AI Generation Prompt: {req.doctor_prompt}\n")
        
        if daily_routine:
            prescription_parts.append(f"DAILY ROUTINE:\n{daily_routine}")
        if diet:
            recommended = diet.get("recommended_foods", [])
            avoid = diet.get("foods_to_avoid", [])
            if recommended:
                prescription_parts.append(f"RECOMMENDED FOODS:\n" + "\n".join(f"- {f}" for f in recommended))
            if avoid:
                prescription_parts.append(f"FOODS TO AVOID:\n" + "\n".join(f"- {f}" for f in avoid))
        
        return {
            "prescription_text": "\n\n".join(prescription_parts) if prescription_parts else "AI was unable to generate a detailed prescription. Please write manually.",
            "safety_precautions": ", ".join(red_flags) if red_flags else "",
            "root_causes": root_causes
        }
    except Exception as e:
        import logging
        logger = logging.getLogger(__name__)
        logger.error(f"AI prescription generation failed: {e}", exc_info=True)
        raise HTTPException(status_code=500, detail=f"AI generation failed: {str(e)}")

