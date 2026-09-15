AYUSH_DISCLAIMER = """
⚕️ AYUSH Disclaimer: This information is provided for educational purposes under AYUSH Naturopathy principles. It does not constitute medical diagnosis or treatment. Always consult a licensed AYUSH Naturopathy practitioner before starting any health protocol. In case of emergency, call 112 immediately.
"""

ALLOPATHIC_KEYWORDS = [
    "antibiotic", "steroid", "metformin", "aspirin", "ibuprofen", "prescription", "dosage mg"
]

def _to_string(text) -> str:
    if isinstance(text, str):
        return text
    if isinstance(text, list):
        parts = []
        for item in text:
            if isinstance(item, str):
                parts.append(item)
            elif isinstance(item, dict):
                parts.append(str(item.get("text", item)))
            else:
                parts.append(str(item))
        return " ".join(parts).strip()
    return str(text) if text is not None else ""

def inject_disclaimer(text: str) -> str:
    text_str = _to_string(text)
    if AYUSH_DISCLAIMER.strip() not in text_str:
        return text_str + "\n\n" + AYUSH_DISCLAIMER.strip()
    return text_str

def check_allopathic_leakage(text: str) -> bool:
    text_lower = _to_string(text).lower()
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
    clean_text = _to_string(text)
    allopathic_blocked = check_allopathic_leakage(clean_text)
    safe_output = clean_text
    
    if allopathic_blocked:
        safe_output = "I apologize, but I cannot provide recommendations involving allopathic medications. Please consult a medical doctor for such concerns."
        
    safe_output = inject_disclaimer(safe_output)
    
    need_practitioner = route_to_practitioner(state)
    
    return {
        "safe_output": safe_output,
        "allopathic_blocked": allopathic_blocked,
        "need_practitioner": need_practitioner
    }
