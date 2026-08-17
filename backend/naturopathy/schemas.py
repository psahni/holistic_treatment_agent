from pydantic import BaseModel
from typing import Optional, List, Dict, Any

class PatientInfo(BaseModel):
    age: int
    gender: str
    region: str
    occupation: str
    investigations: Optional[str] = ""

class SymptomInput(BaseModel):
    session_id: Optional[str] = None
    message: str
    patient_info: Optional[PatientInfo] = None
    mode: str = "question"

class IntakeSubmitRequest(BaseModel):
    session_id: str
    user_responses: Dict[str, str]

class ChatRequest(BaseModel):
    session_id: str
    message: str
    mode: Optional[str] = None

class AssessmentResponse(BaseModel):
    session_id: str
    step: str
    message: str
    recommended_mode: Optional[str] = None
    is_complete: bool
    report: Optional[Dict[str, Any]] = None
    safety_flags: List[str] = []
    need_practitioner: bool = False

class RootCause(BaseModel):
    cause: str
    category: str
    severity: str
    reasoning: str

class Protocol(BaseModel):
    type: str
    name: str
    description: str
    duration: str
    frequency: str
    contraindications: List[str] = []

class NaturopathyReport(BaseModel):
    root_causes: List[RootCause]
    protocols: List[Protocol]
    daily_routine: str
    diet_guidelines: Dict[str, List[str]]
    red_flags: List[str]
    follow_up_timeline: str
    disclaimer: str
