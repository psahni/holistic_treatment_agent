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
        
        # Run the graph — intake_node will generate the first question
        # and should_continue will route back to 'intake' since step is still 'intake'
        # But we DON'T want it to loop — we just want one pass.
        # Use the graph to run just the intake node once.
        try:
            result_state = await self.graph.ainvoke(state)
            return result_state
        except Exception as e:
            logger.error(f"start_session graph error: {e}", exc_info=True)
            # Return state with error so the user gets a message
            state['current_question'] = (
                "Welcome to NatureCure AI! I'm here to help you explore natural healing. "
                "Could you please tell me about the main health concern you're experiencing today?"
            )
            state['conversation_history'].append({
                "role": "agent", 
                "content": state['current_question']
            })
            state['error'] = str(e)
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
