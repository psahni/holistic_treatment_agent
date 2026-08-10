"""
Seed Script: Index existing Naturopathy Knowledge Base JSONs into Qdrant Vector Store
"""

import os
import sys
import json
import logging

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))

from rag.qdrant_store import add_document_chunks

logging.basicConfig(level=logging.INFO, format="%(asctime)s - %(levelname)s - %(message)s")
logger = logging.getLogger("seed_qdrant")

KB_DIR = os.path.join(os.path.dirname(__file__), "knowledge_base")

def seed_qdrant_from_kb():
    """Converts structured knowledge base JSONs into vector chunks for Qdrant."""
    if not os.path.exists(KB_DIR):
        logger.error(f"Knowledge base directory {KB_DIR} not found.")
        return

    json_files = [f for f in os.listdir(KB_DIR) if f.endswith(".json")]
    logger.info(f"Seeding Qdrant from {len(json_files)} knowledge base files...")

    all_chunks = []

    for file_name in json_files:
        file_path = os.path.join(KB_DIR, file_name)
        try:
            with open(file_path, "r", encoding="utf-8") as f:
                data = json.load(f)

            title = file_name.replace(".json", "").replace("_", " ").title()

            if isinstance(data, dict):
                for key, val in data.items():
                    chunk_text = f"Condition / Subject: {key}\nContent: {json.dumps(val, indent=2)}"
                    all_chunks.append({
                        "text": chunk_text,
                        "source": file_name,
                        "page": 1,
                        "title": f"{title} - {key}",
                        "category": file_name.replace(".json", "")
                    })
            elif isinstance(data, list):
                for idx, item in enumerate(data, start=1):
                    chunk_text = f"Subject: {title} Item #{idx}\nContent: {json.dumps(item, indent=2)}"
                    all_chunks.append({
                        "text": chunk_text,
                        "source": file_name,
                        "page": idx,
                        "title": f"{title} #{idx}",
                        "category": file_name.replace(".json", "")
                    })

        except Exception as e:
            logger.error(f"Failed to process {file_name}: {e}")

    if all_chunks:
        logger.info(f"Upserting {len(all_chunks)} knowledge base chunks into Qdrant...")
        count = add_document_chunks(all_chunks)
        logger.info(f"✅ Seeding complete! {count} chunks indexed in Qdrant.")

if __name__ == "__main__":
    seed_qdrant_from_kb()
