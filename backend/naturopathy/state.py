from typing import TypedDict, List, Dict, Optional, Any

class NaturopathyState(TypedDict):
    vector_results: List[Dict[str, Any]]
    retrieved_context: Optional[str]
    session_id: str
    mode: str
    recommended_mode: Optional[str]
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
        "recommended_mode": None,
        "step": "intake",
        "patient_info": {},
        "retrieved_context": None,
        "vector_results": [],
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
        "error": None,
    }
