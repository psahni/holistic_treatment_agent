"""
Dynamic Naturopathy Evaluation Suite using DeepEval
Loads test cases from JSON and runs LLM-as-a-judge metrics.
"""

import os
import sys
import json
import asyncio
import pytest
from typing import Dict, Any

sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from deepeval.metrics import GEval
from deepeval.test_case import LLMTestCase, LLMTestCaseParams

from naturopathy.agent import NaturopathyAgent
from naturopathy.state import InitialState
from evals.gemini_evaluator import GeminiEvaluator

# ─────────────────────────────────────────────
# LOAD TEST CASES
# ─────────────────────────────────────────────

CASES_PATH = os.path.join(os.path.dirname(__file__), "test_cases", "naturopathy_cases.json")

def load_cases():
    if not os.path.exists(CASES_PATH):
        return []
    with open(CASES_PATH, "r", encoding="utf-8") as f:
        cases = json.load(f)
    
    # BARE MINIMUM SET: 
    # 1. Standard Clinical Case (naturo_001)
    # 2. Emergency Escalation Case (naturo_003)
    bare_minimum_cases = [c for c in cases if c.get("id") in ["naturo_001", "naturo_003"]]
    return bare_minimum_cases

CASES = load_cases()

@pytest.fixture(scope="module")
def agent():
    return NaturopathyAgent()

def get_agent_response(agent: NaturopathyAgent, case: Dict[str, Any]) -> str:
    """Helper to synchronously run the async LangGraph agent."""
    state = InitialState()
    state["session_id"] = f"eval_{case['id']}"
    state["patient_info"] = case.get("patient_profile", {})
    
    async def run():
        return await agent.process_message(
            session_id=state["session_id"],
            message=case["symptoms"],
            state=state,
            mode="question"
        )
        
    result_state = asyncio.run(run())
    return result_state.get("current_question", "")

import time

# ─────────────────────────────────────────────
# DYNAMIC TESTS
# ─────────────────────────────────────────────

@pytest.mark.parametrize("case", CASES, ids=[c.get("id", f"case_{i}") for i, c in enumerate(CASES)])
@pytest.mark.skipif(not os.getenv("GEMINI_API_KEY") or os.getenv("GEMINI_API_KEY") == "your_gemini_api_key_here", reason="Requires GEMINI_API_KEY")
def test_dynamic_eval(agent: NaturopathyAgent, case: Dict[str, Any]):
    """Dynamically evaluate test cases based on their configuration"""
    
    # Throttle requests to avoid Free Tier Rate Limits (15 RPM)
    # This prevents the 429 RESOURCE_EXHAUSTED / Prepayment error
    print("\n[Sleeping 8 seconds to respect Gemini API rate limits...]")
    time.sleep(8)
    
    print(f"\n--- Running Eval for {case['id']} ---")
    
    # Run Agent
    actual_output = get_agent_response(agent, case)
    print(f"Agent Output snippet: {actual_output[:150]}...")
    
    # 1. Routing & Safety Checks (Deterministic)
    if case.get("should_trigger_emergency"):
        assert "112" in actual_output or "emergency" in actual_output.lower(), \
            f"Failed to trigger emergency response for case {case['id']}"
            
    if case.get("should_block_allopathic"):
        assert "metformin" not in actual_output.lower() or "cannot" in actual_output.lower(), \
            f"Failed to block allopathic prescription for case {case['id']}"
            
    # 2. Quality Evals (DeepEval GEval)
    eval_target = case.get("eval_target", {})
    test_case = LLMTestCase(
        input=case["symptoms"],
        actual_output=actual_output,
        expected_output=" | ".join(case.get("expected_protocols", []))
    )
    
    metrics = []
    
    eval_model = GeminiEvaluator()

    # Evaluate Root Cause Accuracy
    if "root_cause_accuracy" in eval_target and case.get("expected_root_causes"):
        expected_causes = ", ".join(case["expected_root_causes"])
        root_cause_metric = GEval(
            name="Root Cause Accuracy",
            criteria=f"Determine if the actual output successfully identifies these root causes based on symptoms: {expected_causes}",
            evaluation_params=[LLMTestCaseParams.INPUT, LLMTestCaseParams.ACTUAL_OUTPUT],
            threshold=eval_target["root_cause_accuracy"],
            model=eval_model
        )
        metrics.append(root_cause_metric)
        
    # Evaluate Protocol Relevance
    if "protocol_relevance" in eval_target and case.get("expected_protocols"):
        expected_protocols = ", ".join(case["expected_protocols"])
        protocol_metric = GEval(
            name="Protocol Relevance",
            criteria=f"Determine if the actual output recommends or mentions these naturopathy protocols: {expected_protocols}",
            evaluation_params=[LLMTestCaseParams.INPUT, LLMTestCaseParams.ACTUAL_OUTPUT],
            threshold=eval_target["protocol_relevance"],
            model=eval_model
        )
        metrics.append(protocol_metric)
        
    # Execute metrics
    for metric in metrics:
        metric.measure(test_case)
        print(f"Metric [{metric.name}] Score: {metric.score} (Threshold: {metric.threshold})")
        print(f"Reason: {metric.reason}")
        assert metric.score >= metric.threshold, \
            f"Metric {metric.name} failed. Score: {metric.score} < {metric.threshold}. Reason: {metric.reason}"

if __name__ == "__main__":
    pytest.main([__file__, "-v", "-s"])
