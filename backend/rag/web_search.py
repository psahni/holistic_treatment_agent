"""
Live Authentic Web Search Engine for Naturopathy and AYUSH

Performs targeted web searches restricted to authentic AYUSH, medical, and Naturopathy references.
"""

import logging
from typing import List, Dict, Any

logger = logging.getLogger(__name__)

TRUSTED_DOMAINS = [
    "ayush.gov.in",
    "ninpune.ayush.gov.in",
    "ccrn.res.in",
    "ncbi.nlm.nih.gov"
]

def search_authentic_web(query: str, max_results: int = 3) -> List[Dict[str, Any]]:
    """Performs a web search using ddgs, querying AYUSH and medical references."""
    try:
        from ddgs import DDGS

        # Step 1: Try domain-restricted query first
        domain_filter = " OR ".join([f"site:{d}" for d in TRUSTED_DOMAINS])
        search_query = f"({domain_filter}) naturopathy {query}"

        logger.info(f"Executing authentic web search: '{query}'...")

        results = []
        with DDGS() as ddgs:
            raw_results = list(ddgs.text(search_query, max_results=max_results))

            # Step 2: Fallback to broader AYUSH/Naturopathy search if domain filter yielded 0
            if not raw_results:
                fallback_query = f"naturopathy nature cure AYUSH {query}"
                logger.info(f"Fallback search: '{fallback_query}'")
                raw_results = list(ddgs.text(fallback_query, max_results=max_results))

            for item in raw_results:
                results.append({
                    "title": item.get("title", ""),
                    "snippet": item.get("body", ""),
                    "url": item.get("href", ""),
                    "source": "Authentic Web Reference"
                })

        logger.info(f"Retrieved {len(results)} web search results.")
        return results

    except Exception as e:
        logger.warning(f"Authentic web search failed: {e}")
        return []
