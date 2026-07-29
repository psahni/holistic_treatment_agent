"""Test script for Qdrant vector search."""
import os
import sys

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))

from rag.qdrant_store import search_vector_store

def test_search():
    query = "fungal infection skin remedies neem turmeric"
    print(f"Testing Qdrant vector search for: '{query}'...")
    results = search_vector_store(query, limit=3)
    print(f"Found {len(results)} relevant results:")
    for idx, r in enumerate(results, start=1):
        print(f"\n--- Result #{idx} (Score: {r.get('score')}) ---")
        print(f"Source: {r.get('source')} | Title: {r.get('title')}")
        print(f"Text snippet: {r.get('text')[:200]}...")

if __name__ == "__main__":
    test_search()
