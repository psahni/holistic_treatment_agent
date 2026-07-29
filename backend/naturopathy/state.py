from typing import TypedDict, List, Dict, Optional, Any

class NaturopathyState(TypedDict):
    session_id: str
    mode: str
    step: str
    patient_info: Dict[str, Any]
    chief_complaints: List[str]
    lifestyle_factors: Dict[str, Any]
    emotional_factors: Dict[str, Any]
    toxin_exposure: Dict[str, Any]
    root_causes: List[Dict[str, str]]
    recommended_protocols: List[Dict[str, str]]
    safety_flags: List[str]
    emergency_detected: bool
    need_practitioner: bool
    conversation_history: List[Dict[str, str]]
    current_question: str
    user_responses: Dict[str, str]
    assessment_complete: bool
    final_report: Dict[str, Any]
    error: Optional[str]

def InitialState() -> NaturopathyState:
    return {
        "session_id": "",
        "mode": "question",
        "step": "intake",
        "patient_info": {},
        "chief_complaints": [],
        "lifestyle_factors": {},
        "emotional_factors": {},
        "toxin_exposure": {},
        "root_causes": [],
        "recommended_protocols": [],
        "safety_flags": [],
        "emergency_detected": False,
        "need_practitioner": False,
        "conversation_history": [],
        "current_question": "",
        "user_responses": {},
        "assessment_complete": False,
        "final_report": {},
        "error": None
    }
