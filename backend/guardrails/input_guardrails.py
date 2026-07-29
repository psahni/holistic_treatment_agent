EMERGENCY_KEYWORDS = [
    # Cardiac
    "chest pain", "heart attack", "cardiac arrest", "palpitation severe",
    # Neurological
    "stroke", "seizure", "convulsion", "unconscious", "unresponsive", "not responding",
    "face drooping", "face dropping", "sudden numbness",
    # Breathing
    "difficulty breathing", "can't breathe", "cannot breathe", "not breathing",
    "shortness of breath severe", "choking",
    # Bleeding / Trauma
    "severe bleeding", "heavy bleeding", "won't stop bleeding", "severe burns",
    # Poisoning
    "poisoning", "ingested poison", "accidentally swallowed", "overdose",
    "drug overdose", "ingested chemical",
    # Mental health emergencies
    "suicide", "suicidal", "end my life", "kill myself", "self harm",
    # Allergic
    "anaphylaxis", "severe allergic reaction",
]

PEDIATRIC_AGE_THRESHOLD = 5

SCOPE_TOPICS = ["weather", "politics", "sports", "finance"]

def check_emergency(text: str) -> tuple[bool, str]:
    text_lower = text.lower()
    for kw in EMERGENCY_KEYWORDS:
        if kw in text_lower:
            return True, "🚨 EMERGENCY DETECTED: Please call 112 immediately. This system is for naturopathic advice only and cannot handle medical emergencies."
    return False, ""

def check_scope(text: str) -> tuple[bool, str]:
    text_lower = text.lower()
    for topic in SCOPE_TOPICS:
        if topic in text_lower:
            return True, "I am a Naturopathy Health Advisor and can only discuss health and wellness topics."
    return False, ""

def check_pediatric(age: int) -> tuple[bool, str]:
    if age < PEDIATRIC_AGE_THRESHOLD:
        return True, "For children under 5, please consult a pediatric specialist directly."
    return False, ""

def check_pregnancy_keywords(text: str) -> bool:
    pregnancy_keywords = ["pregnant", "pregnancy", "trimester", "expecting"]
    text_lower = text.lower()
    return any(kw in text_lower for kw in pregnancy_keywords)

def run_input_guardrails(text: str, age: int | None = None) -> dict:
    is_emergency, msg = check_emergency(text)
    if is_emergency:
        return {"safe": False, "flags": ["emergency"], "message": msg}
        
    out_of_scope, msg = check_scope(text)
    if out_of_scope:
        return {"safe": False, "flags": ["out_of_scope"], "message": msg}
        
    if age is not None:
        needs_routing, msg = check_pediatric(age)
        if needs_routing:
            return {"safe": False, "flags": ["pediatric"], "message": msg}
            
    flags = []
    if check_pregnancy_keywords(text):
        flags.append("pregnancy")
        
    return {"safe": True, "flags": flags, "message": None}
