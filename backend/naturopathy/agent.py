from .graph import naturopathy_graph
from .state import InitialState, NaturopathyState
import logging

logger = logging.getLogger(__name__)


class NaturopathyAgent:
    def __init__(self):
        self.graph = naturopathy_graph
    
    async def start_session(self, patient_info: dict, session_id: str, mode: str = "question") -> dict:
        """Initialize a new session and return the first intake question."""
        state = InitialState()
        state['session_id'] = session_id
        state['patient_info'] = patient_info
        state['mode'] = mode
        
        # Simply return the initial state with a welcome message without invoking the LLM graph
        state['current_question'] = (
            "Welcome to NatureCure AI! I'm here to help you explore natural healing. "
            "Could you please tell me about the main health concern you're experiencing today?"
        )
        state['conversation_history'].append({
            "role": "agent", 
            "content": state['current_question']
        })
        return state
    
    async def process_message(self, session_id: str, message: str, state: dict, mode: str = None) -> dict:
        """Process a user message and return updated state with the agent's response."""
        state['conversation_history'].append({"role": "user", "content": message})
        state['user_responses'][f"response_{len(state['user_responses'])}"] = message
        if mode:
            state['mode'] = mode
        
        try:
            result_state = await self.graph.ainvoke(state)
            return result_state
        except Exception as e:
            logger.error(f"process_message graph error: {e}", exc_info=True)
            state['current_question'] = (
                "I apologize, I encountered an issue processing your response. "
                "Could you please try rephrasing that? I want to make sure I understand you correctly."
            )
            state['conversation_history'].append({
                "role": "agent",
                "content": state['current_question']
            })
            state['error'] = str(e)
            return state
    
    def get_session_response(self, state: dict) -> dict:
        """Extract a clean AssessmentResponse-compatible dict from graph state."""
        return {
            "session_id": state.get("session_id", ""),
            "step": state.get("step", "intake"),
            "message": state.get("current_question", ""),
            "recommended_mode": state.get("recommended_mode"),
            "is_complete": state.get("assessment_complete", False),
            "report": state.get("final_report") if state.get("final_report") else None,
            "safety_flags": state.get("safety_flags", []),
            "need_practitioner": state.get("need_practitioner", False)
        }
        
    async def process_message_stream(self, session_id: str, message: str, state: dict, mode: str = None):
        """Process a user message and yield Server-Sent Events (SSE) chunks."""
        import json
        state['conversation_history'].append({"role": "user", "content": message})
        state['user_responses'][f"response_{len(state['user_responses'])}"] = message
        if mode:
            state['mode'] = mode
            
        final_state = None
        try:
            async for event in self.graph.astream_events(state, version="v2"):
                if event["event"] == "on_chat_model_stream":
                    chunk = event["data"]["chunk"].content
                    if chunk:
                        yield f"data: {json.dumps({'chunk': chunk})}\n\n"
                
                if event["event"] == "on_chain_end":
                    if "output" in event["data"] and isinstance(event["data"]["output"], dict):
                        out = event["data"]["output"]
                        # The outermost chain (StateGraph) output contains session_id and step
                        if "session_id" in out and "step" in out:
                            final_state = out
                            
            if final_state:
                from guardrails.output_guardrails import run_output_guardrails
                if final_state.get("current_question"):
                    og_result = run_output_guardrails(final_state["current_question"], final_state)
                    final_state["current_question"] = og_result["safe_output"]
                    
                from memory.session_store import session_store
                session_store.save_session(session_id, final_state)
                
                response_obj = self.get_session_response(final_state)
                yield f"data: {json.dumps({'done': True, 'state': response_obj})}\n\n"
                
        except Exception as e:
            logger.error(f"process_message_stream error: {e}", exc_info=True)
            yield f"data: {json.dumps({'error': str(e)})}\n\n"
