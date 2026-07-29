import json
import os
import logging
from langchain_core.messages import HumanMessage, SystemMessage, AIMessage
from langchain_google_vertexai import ChatVertexAI
from pydantic import BaseModel, Field
from typing import Optional

class AgentResponse(BaseModel):
    message: str = Field(description="The formatted response to the user.")
    recommended_mode: Optional[str] = Field(None, description="'question' or 'treatment' based on symptom complexity.")

from config import get_settings
from naturopathy.state import NaturopathyState
from naturopathy.prompts import (
    SYSTEM_PROMPT, QUESTION_MODE_PROMPT, FULL_TREATMENT_MODE_PROMPT, ROOT_CAUSE_PROMPT,
    PROTOCOL_SELECTION_PROMPT, RECOMMENDATION_PROMPT, DISCLAIMER
)
from guardrails.input_guardrails import check_emergency
from rag.hybrid_retriever import retrieve_hybrid_context

logger = logging.getLogger(__name__)
settings = get_settings()

def get_llm():
    return ChatVertexAI(
        model_name=settings.GEMINI_MODEL,
        temperature=settings.TEMPERATURE,
        max_tokens=settings.MAX_TOKENS,
        project=settings.GCP_PROJECT,
        max_retries=5
    )

def intake_node(state: NaturopathyState) -> NaturopathyState:
    llm = get_llm()
    history = state.get("conversation_history", [])
    responses = state.get("user_responses", {})
    patient_info = state.get("patient_info", {})
    mode = state.get("mode", "question")
    
    # Get latest user message or default topic
    latest_user_message = ""
    for msg in reversed(history):
        if msg.get("role") == "user":
            latest_user_message = msg.get("content", "")
            break
            
    if not latest_user_message:
        latest_user_message = "Naturopathy health consultation and remedies"
        
    if mode == "question":
        # Question Mode logic: instant triage
        hybrid = retrieve_hybrid_context(latest_user_message)
        retrieved_context = hybrid.get("context_text", "")
        
        system_instruction = (
            SYSTEM_PROMPT + "\n\n" + 
            QUESTION_MODE_PROMPT + "\n\n" +
            f"RETRIEVED AUTHENTIC REFERENCE CONTEXT:\n{retrieved_context}"
        )
        
        messages = [SystemMessage(content=system_instruction)]
        
        has_human_message = False
        for msg in history:
            if msg.get("role") == "user":
                messages.append(HumanMessage(content=msg["content"]))
                has_human_message = True
            else:
                messages.append(AIMessage(content=msg["content"]))
                
        if not has_human_message:
            intro = f"Patient Query: '{latest_user_message}'. Patient Info: {json.dumps(patient_info)}. Please provide immediate Naturopathic root cause analysis, actionable remedies, diet/hydrotherapy guidelines, red flags, and 1 follow-up question."
            messages.append(HumanMessage(content=intro))
            
        structured_llm = llm.with_structured_output(AgentResponse)
        response = structured_llm.invoke(messages)
        
        if response:
            state["current_question"] = response.message
            state["recommended_mode"] = response.recommended_mode
        else:
            state["current_question"] = "I apologize, I'm having trouble processing that query properly. Could you rephrase it?"
            state["recommended_mode"] = None
            
        state["conversation_history"].append({"role": "agent", "content": state["current_question"]})
        
    else:
        # Full Treatment Mode logic: 8-turn progressive intake
        system_instruction = SYSTEM_PROMPT + "\n\n" + FULL_TREATMENT_MODE_PROMPT
        messages = [SystemMessage(content=system_instruction)]
        
        has_human_message = False
        for msg in history:
            if msg.get("role") == "user":
                messages.append(HumanMessage(content=msg["content"]))
                has_human_message = True
            else:
                messages.append(AIMessage(content=msg["content"]))
                
        if not has_human_message:
            intro = f"Patient Info: {json.dumps(patient_info)}. Start the full treatment profile collection."
            messages.append(HumanMessage(content=intro))
            
        structured_llm = llm.with_structured_output(AgentResponse)
        response = structured_llm.invoke(messages)
        
        if len(responses) >= 8:
            state["step"] = "root_cause"
            state["current_question"] = "Thank you for providing all the details. I am now analyzing your complete profile for root causes..."
            state["recommended_mode"] = None
        else:
            if response:
                state["current_question"] = response.message
                state["recommended_mode"] = response.recommended_mode
            else:
                state["current_question"] = "Could you please elaborate on that?"
                state["recommended_mode"] = None
            
        state["conversation_history"].append({"role": "agent", "content": state["current_question"]})
        
    return state

def root_cause_node(state: NaturopathyState) -> NaturopathyState:
    llm = get_llm()
    responses = state.get("user_responses", {})
    history = state.get("conversation_history", [])
    
    messages = [
        SystemMessage(content=SYSTEM_PROMPT + "\n\n" + ROOT_CAUSE_PROMPT),
        HumanMessage(content=f"Patient Data: {json.dumps(responses)}\nHistory: {json.dumps(history)}")
    ]
    
    response = llm.invoke(messages)
    try:
        content = response.content
        if "```json" in content:
            content = content.split("```json")[1].split("```")[0].strip()
        elif "```" in content:
            content = content.split("```")[1].split("```")[0].strip()
        root_causes = json.loads(content)
        state["root_causes"] = root_causes
    except Exception as e:
        logger.warning(f"Failed to parse root causes JSON: {e}")
        state["error"] = f"Failed to parse root causes: {str(e)}"
        state["root_causes"] = []
        
    state["step"] = "protocol_selection"
    return state

def protocol_selection_node(state: NaturopathyState) -> NaturopathyState:
    llm = get_llm()
    root_causes = state.get("root_causes", [])
    
    # Retrieve hybrid context for root causes
    query = " ".join([rc.get("cause", "") for rc in root_causes]) if root_causes else "naturopathy protocols"
    hybrid = retrieve_hybrid_context(query)
    
    messages = [
        SystemMessage(content=SYSTEM_PROMPT + "\n\n" + PROTOCOL_SELECTION_PROMPT),
        SystemMessage(content=f"Reference Context: {hybrid.get('context_text', '')}"),
        HumanMessage(content=f"Root Causes: {json.dumps(root_causes)}")
    ]
    
    response = llm.invoke(messages)
    try:
        content = response.content
        if "```json" in content:
            content = content.split("```json")[1].split("```")[0].strip()
        elif "```" in content:
            content = content.split("```")[1].split("```")[0].strip()
        protocols = json.loads(content)
        state["recommended_protocols"] = protocols
    except Exception as e:
        logger.warning(f"Failed to parse protocols JSON: {e}")
        state["error"] = f"Failed to parse protocols: {str(e)}"
        state["recommended_protocols"] = []
        
    state["step"] = "recommendation"
    return state

def recommendation_node(state: NaturopathyState) -> NaturopathyState:
    llm = get_llm()
    root_causes = state.get("root_causes", [])
    protocols = state.get("recommended_protocols", [])
    
    messages = [
        SystemMessage(content=SYSTEM_PROMPT + "\n\n" + RECOMMENDATION_PROMPT),
        HumanMessage(content=f"Root Causes: {json.dumps(root_causes)}\nProtocols: {json.dumps(protocols)}")
    ]
    
    response = llm.invoke(messages)
    try:
        content = response.content
        if "```json" in content:
            content = content.split("```json")[1].split("```")[0].strip()
        elif "```" in content:
            content = content.split("```")[1].split("```")[0].strip()
        report = json.loads(content)
        state["final_report"] = report
    except Exception as e:
        logger.warning(f"Failed to parse report JSON: {e}")
        state["error"] = f"Failed to parse report: {str(e)}"
        state["final_report"] = {}
        
    state["step"] = "complete"
    state["assessment_complete"] = True
    return state

def guardrail_output_node(state: NaturopathyState) -> NaturopathyState:
    responses = state.get("user_responses", {})
    all_text = " ".join(str(v) for v in responses.values())
    history_text = " ".join(msg.get("content", "") for msg in state.get("conversation_history", []))
    
    is_emergency, msg = check_emergency(all_text + " " + history_text)
    if is_emergency:
        state["emergency_detected"] = True
        state["final_report"] = {}
        state["recommended_protocols"] = []
        state["current_question"] = msg
    
    severe_causes = [rc for rc in state.get("root_causes", []) if rc.get("severity", "").lower() == "severe"]
    if len(severe_causes) > 3:
        state["need_practitioner"] = True
        
    if state.get("current_question") and DISCLAIMER not in state["current_question"]:
        state["current_question"] += f"\n\n{DISCLAIMER}"
    if state.get("final_report") and "disclaimer" not in state["final_report"]:
        state["final_report"]["disclaimer"] = DISCLAIMER
        
    return state
