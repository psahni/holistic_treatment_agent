"""
Hybrid Context Retriever for Naturopathy Triage

Combines:
1. Qdrant Vector Store Search (Book Chunks & Protocols)
2. Live Web Search (AYUSH / PubMed References)

Synthesizes both into a structured context block for Gemini LLM.
"""

import logging
from typing import Dict, Any, List
from functools import lru_cache

from rag.qdrant_store import search_vector_store
from rag.web_search import search_authentic_web

logger = logging.getLogger(__name__)

@lru_cache(maxsize=128)
def retrieve_hybrid_context(user_query: str) -> Dict[str, Any]:
    """Retrieves context from both Qdrant Vector Store and Live Authentic Web Search."""
    logger.info(f"Retrieving hybrid context for query: '{user_query}'...")

    # 1. Vector Search in Qdrant (Book & KB chunks)
    vector_results = search_vector_store(user_query, limit=3)

    # 2. Live Web Search (AYUSH / PubMed references)
    web_results = search_authentic_web(user_query, max_results=2)

    # Format into a clean context string for LLM injection
    formatted_context_parts = []

    if vector_results:
        formatted_context_parts.append("=== REFERENCE BOOKS & PROTOCOLS (Qdrant Vector DB) ===")
        for idx, item in enumerate(vector_results, start=1):
            source = item.get("title") or item.get("source") or "Naturopathy Manual"
            formatted_context_parts.append(f"[{idx}] Source: {source}\nExcerpt: {item.get('text')}\n")

    if web_results:
        formatted_context_parts.append("=== AUTHENTIC LIVE WEB REFERENCES (AYUSH / PubMed) ===")
        for idx, item in enumerate(web_results, start=1):
            formatted_context_parts.append(
                f"[{idx}] Title: {item.get('title')}\n"
                f"URL: {item.get('url')}\n"
                f"Snippet: {item.get('snippet')}\n"
            )

    combined_text = "\n".join(formatted_context_parts) if formatted_context_parts else "No specific context found."

    return {
        "context_text": combined_text,
        "vector_results": vector_results,
        "web_results": web_results
    }
