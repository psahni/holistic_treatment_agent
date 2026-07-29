import asyncio
import sys
import os

if sys.stdout.encoding != 'utf-8':
    sys.stdout.reconfigure(encoding='utf-8')

# Add the backend directory to the path so it can find 'naturopathy' module
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))

from naturopathy.agent import NaturopathyAgent
from naturopathy.state import InitialState

async def main():
    print("🌿 Welcome to the Naturopathy Agent CLI Tester 🌿")
    print("--------------------------------------------------")
    print("Select a mode to test:")
    print("1. Question Mode (Instant triage & protocol)")
    print("2. Treatment Mode (8-turn progressive intake)")
    
    choice = input("Enter 1 or 2: ").strip()
    mode = "question" if choice == "1" else "treatment"
    
    agent = NaturopathyAgent()
    state = InitialState()
    state["session_id"] = "cli_test_session"
    state["patient_info"] = {"name": "Test User", "age": 35}
    
    print(f"\n[Started {mode.upper()} mode. Type 'quit' to exit.]\n")
    
    while True:
        user_input = input("You: ")
        if user_input.lower() in ['quit', 'exit']:
            break
            
        print("\nAgent is thinking...\n")
        state = await agent.process_message(
            session_id=state["session_id"],
            message=user_input,
            state=state,
            mode=mode
        )
        
        print(f"Agent: {state.get('current_question', '')}\n")
        
        # If the graph has moved past the intake step (e.g., in treatment mode after 8 turns)
        if state.get("step") != "intake":
            print(f"\n[Graph has transitioned to step: {state.get('step')}]")
            if state.get("final_report"):
                 print(f"Final Report: {state.get('final_report')}")
                 
        # Check for mode recommendation
        recommended = state.get("recommended_mode")
        if recommended and recommended != mode:
            print(f"\n💡 [The Agent recommends switching to {recommended.upper()} mode for a better experience.]")
            switch = input(f"Would you like to switch to {recommended.upper()} mode? (y/n): ").strip().lower()
            if switch == 'y':
                mode = recommended
                print(f"[Switched to {mode.upper()} mode]")

if __name__ == "__main__":
    asyncio.run(main())
