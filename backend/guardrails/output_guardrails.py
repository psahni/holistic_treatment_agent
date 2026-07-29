AYUSH_DISCLAIMER = """
⚕️ AYUSH Disclaimer: This information is provided for educational purposes under AYUSH Naturopathy principles. It does not constitute medical diagnosis or treatment. Always consult a licensed AYUSH Naturopathy practitioner before starting any health protocol. In case of emergency, call 112 immediately.
"""

ALLOPATHIC_KEYWORDS = [
    "antibiotic", "steroid", "metformin", "aspirin", "ibuprofen", "prescription", "dosage mg"
]

def inject_disclaimer(text: str) -> str:
    if AYUSH_DISCLAIMER.strip() not in text:
        return text + "\n\n" + AYUSH_DISCLAIMER.strip()
    return text

def check_allopathic_leakage(text: str) -> bool:
    text_lower = text.lower()
    return any(kw in text_lower for kw in ALLOPATHIC_KEYWORDS)

def route_to_practitioner(state: dict) -> bool:
    severe_causes = [rc for rc in state.get("root_causes", []) if rc.get("severity", "").lower() == "severe"]
    if len(severe_causes) > 3:
        return True
    
    if state.get("emergency_detected"):
        return True
        
    flags = state.get("safety_flags", [])
    if "pediatric" in flags or "pregnancy" in flags:
        return True
        
    return False

def run_output_guardrails(text: str, state: dict) -> dict:
    allopathic_blocked = check_allopathic_leakage(text)
    safe_output = text
    
    if allopathic_blocked:
        safe_output = "I apologize, but I cannot provide recommendations involving allopathic medications. Please consult a medical doctor for such concerns."
        
    safe_output = inject_disclaimer(safe_output)
    
    need_practitioner = route_to_practitioner(state)
    
    return {
        "safe_output": safe_output,
        "allopathic_blocked": allopathic_blocked,
        "need_practitioner": need_practitioner
    }
