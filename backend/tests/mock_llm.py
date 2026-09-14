import time
import json
from typing import Any, List, Optional
from langchain_core.language_models.chat_models import BaseChatModel
from langchain_core.messages import BaseMessage, AIMessage
from langchain_core.outputs import ChatResult, ChatGeneration
from langchain_core.callbacks.manager import CallbackManagerForLLMRun

class MockChatVertexAI(BaseChatModel):
    model_name: str = "mock-vertex-ai"
    temperature: float = 0.2
    
    @property
    def _llm_type(self) -> str:
        return "mock_chat_vertex_ai"
        
    def _generate(
        self,
        messages: List[BaseMessage],
        stop: Optional[List[str]] = None,
        run_manager: Optional[CallbackManagerForLLMRun] = None,
        **kwargs: Any,
    ) -> ChatResult:
        # Determine query from messages
        text = ""
        for m in reversed(messages):
            if hasattr(m, "content") and m.content:
                text = str(m.content).lower()
                break

        # Simulate small delay for cache comparison test
        time.sleep(0.04)

        if any(g in text for g in ["hello", "hi there", "greetings"]):
            content = "Hello! Welcome to NatureCure AI. How can I assist you with your health today?"
        elif "hashimoto" in text or "chronic" in text or "autoimmune" in text:
            content = "[MODE: treatment] For severe chronic conditions like Hashimoto's, I recommend our comprehensive Treatment Mode. Let's begin a full intake."
        elif any(p in text for p in ["sick", "pain", "don't feel good", "unwell"]):
            content = "Could you please clarify and describe your symptoms in more detail? Where is the pain located?"
        elif "hiccup" in text:
            content = "For occasional hiccups, natural remedies include sipping cold water slowly and holding your breath for 10 seconds. [MODE: question]"
        elif "patient data:" in text or "root cause" in text:
            content = json.dumps([
                {
                    "cause": "Impaired Digestion & Gut Flora Imbalance",
                    "category": "Digestive",
                    "severity": "Moderate",
                    "reasoning": "Reported chronic digestive distress and bloating."
                }
            ])
        elif "protocol" in text or "therap" in text:
            content = json.dumps([
                {
                    "type": "Hydrotherapy",
                    "name": "Cold Hip Bath",
                    "description": "15 minute cold hip bath daily to stimulate abdominal circulation.",
                    "duration": "15 minutes",
                    "frequency": "Once daily",
                    "contraindications": ["Acute abdominal inflammation", "Pregnancy"]
                }
            ])
        elif "prescription" in text or "clinical prompt" in text or "plan" in text:
            content = "1. Morning: Warm lemon water followed by 15 mins Pranayama.\n2. Diet: Steamed vegetables and khichdi.\n3. Hydrotherapy: Warm foot bath before bed."
        else:
            content = "Natural remedies and holistic care focus on addressing the root cause through diet and lifestyle adjustments. [MODE: question]"

        generation = ChatGeneration(message=AIMessage(content=content))
        return ChatResult(generations=[generation])
