from deepeval.models import DeepEvalBaseLLM
from langchain_google_vertexai import ChatVertexAI
import os
import sys

sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
from config import get_settings

class GeminiEvaluator(DeepEvalBaseLLM):
    def __init__(self):
        settings = get_settings()
        self.model = ChatVertexAI(
            model_name=settings.GEMINI_MODEL, 
            project=settings.GCP_PROJECT,
            temperature=0.0
        )

    def load_model(self):
        return self.model

    def generate(self, prompt: str, **kwargs) -> str:
        res = self.model.invoke(prompt)
        return res.content

    async def a_generate(self, prompt: str, **kwargs) -> str:
        res = await self.model.ainvoke(prompt)
        return res.content

    def get_model_name(self):
        settings = get_settings()
        return settings.GEMINI_MODEL
