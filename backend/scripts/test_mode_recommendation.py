import asyncio
import os
import sys

if sys.stdout.encoding != 'utf-8':
    sys.stdout.reconfigure(encoding='utf-8')

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from naturopathy.agent import NaturopathyAgent
from naturopathy.state import InitialState

async def test_recommendation():
    agent = NaturopathyAgent()
    state = InitialState()
    state["session_id"] = "test_session"
    state["patient_info"] = {"name": "Test User", "age": 45}
    
    print("Sending a chronic symptom to the agent in Question Mode...")
    chronic_symptom = "I've had severe joint pain and extreme fatigue for 4 months."
    
    state = await agent.process_message(
        session_id=state["session_id"],
        message=chronic_symptom,
        state=state,
        mode="question"
    )
    
    response = agent.get_session_response(state)
    print("\n--- Agent Response ---")
    print(response["message"])
    print("\n--- Recommended Mode ---")
    print(f"Recommended Mode: {response.get('recommended_mode')}")
    
    if response.get("recommended_mode") == "treatment":
        print("\n✅ SUCCESS: Agent successfully recommended switching to Treatment Mode.")
    else:
        print("\n❌ FAILED: Agent did not recommend Treatment Mode.")

if __name__ == "__main__":
    asyncio.run(test_recommendation())
