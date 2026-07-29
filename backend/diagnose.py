"""Quick diagnostic script for the Naturopathy agent."""
import os, sys
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))

from config import get_settings

s = get_settings()
key = s.GEMINI_API_KEY
has_real_key = bool(key) and key != "your_gemini_api_key_here"
print(f"[1] GEMINI_API_KEY configured: {has_real_key}")
if has_real_key:
    print(f"    Key prefix: {key[:12]}...")
else:
    print(f"    *** KEY IS MISSING OR PLACEHOLDER ***")
    print(f"    Current value: '{key}'")

print(f"[2] GEMINI_MODEL: {s.GEMINI_MODEL}")

# Test LLM call
if has_real_key:
    print("[3] Testing Gemini LLM call...")
    try:
        from langchain_google_genai import ChatGoogleGenerativeAI
        from langchain_core.messages import HumanMessage
        llm = ChatGoogleGenerativeAI(
            model=s.GEMINI_MODEL,
            google_api_key=s.GEMINI_API_KEY,
            temperature=0.3
        )
        resp = llm.invoke([HumanMessage(content="Say hello in one word")])
        print(f"    LLM OK: {resp.content[:80]}")
    except Exception as e:
        print(f"    LLM FAILED: {type(e).__name__}: {e}")
else:
    print("[3] Skipping LLM test (no API key)")

# Test graph invocation
print("[4] Testing LangGraph agent flow...")
try:
    from naturopathy.agent import NaturopathyAgent
    from naturopathy.state import InitialState
    import asyncio

    agent = NaturopathyAgent()
    state = InitialState()
    state["session_id"] = "diag-test-001"
    state["patient_info"] = {"age": 35, "gender": "male", "region": "India", "occupation": "Engineer"}

    async def test_flow():
        try:
            result = await agent.start_session(state["patient_info"], state["session_id"])
            print(f"    Graph start OK. Step: {result.get('step')}")
            print(f"    Current question: {str(result.get('current_question', ''))[:100]}")
            return result
        except Exception as e:
            print(f"    Graph start FAILED: {type(e).__name__}: {e}")
            import traceback
            traceback.print_exc()
            return None

    asyncio.run(test_flow())

except Exception as e:
    print(f"    Agent FAILED: {type(e).__name__}: {e}")
    import traceback
    traceback.print_exc()

print("\n[DONE] Diagnostic complete.")
