"""
Migrate local embedded Qdrant data (backend/data/qdrant_db) to Qdrant Cloud cluster.
Zero-cost: Copies existing vectors and payloads directly without calling any LLM or embedding APIs.
"""

import os
import sys
import argparse
import logging
from qdrant_client import QdrantClient
from qdrant_client.models import VectorParams, Distance, PointStruct

from dotenv import load_dotenv

backend_dir = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
sys.path.insert(0, backend_dir)
load_dotenv(os.path.join(backend_dir, ".env"))

from config import get_settings

logging.basicConfig(level=logging.INFO, format="%(asctime)s [%(levelname)s] %(message)s")
logger = logging.getLogger("migrate_qdrant")

def migrate(qdrant_url: str = None, qdrant_api_key: str = None, collection_name: str = None, batch_size: int = 100):
    settings = get_settings()
    url = qdrant_url or settings.QDRANT_URL
    api_key = qdrant_api_key or settings.QDRANT_API_KEY
    col_name = collection_name or settings.QDRANT_COLLECTION

    if not url:
        logger.error("Error: QDRANT_URL is not provided or set in .env")
        sys.exit(1)

    local_db_path = os.path.join(backend_dir, "data", "qdrant_db")
    if not os.path.exists(local_db_path):
        logger.error(f"Error: Local Qdrant database path not found: {local_db_path}")
        sys.exit(1)

    logger.info(f"1. Opening local embedded Qdrant database at {local_db_path}...")
    local_client = QdrantClient(path=local_db_path)

    try:
        local_info = local_client.get_collection(col_name)
        total_points = local_info.points_count
        logger.info(f"Found collection '{col_name}' locally with {total_points} points.")
    except Exception as e:
        logger.error(f"Collection '{col_name}' not found in local Qdrant: {e}")
        local_client.close()
        sys.exit(1)

    if total_points == 0:
        logger.warning("Local collection is empty! Nothing to migrate.")
        local_client.close()
        sys.exit(0)

    logger.info(f"2. Connecting to Qdrant Cloud at {url}...")
    cloud_client = QdrantClient(url=url, api_key=api_key if api_key else None, timeout=30)

    collections = [c.name for c in cloud_client.get_collections().collections]
    if col_name not in collections:
        logger.info(f"Creating collection '{col_name}' on Qdrant Cloud (vector size: 3072, Cosine)...")
        cloud_client.create_collection(
            collection_name=col_name,
            vectors_config=VectorParams(size=3072, distance=Distance.COSINE)
        )
    else:
        logger.info(f"Collection '{col_name}' already exists on Qdrant Cloud.")

    logger.info(f"3. Migrating {total_points} points in batches of {batch_size}...")
    offset = None
    transferred = 0

    while True:
        records, next_offset = local_client.scroll(
            collection_name=col_name,
            limit=batch_size,
            offset=offset,
            with_vectors=True,
            with_payload=True
        )

        if not records:
            break

        points_to_upload = [
            PointStruct(
                id=r.id,
                vector=r.vector,
                payload=r.payload
            )
            for r in records
        ]

        cloud_client.upsert(
            collection_name=col_name,
            points=points_to_upload
        )

        transferred += len(points_to_upload)
        logger.info(f"Uploaded {transferred}/{total_points} points to Qdrant Cloud...")

        if next_offset is None:
            break
        offset = next_offset

    local_client.close()

    cloud_info = cloud_client.get_collection(col_name)
    logger.info(f"Done! Migration complete. Qdrant Cloud collection '{col_name}' now has {cloud_info.points_count} points.")

if __name__ == "__main__":
    parser = argparse.ArgumentParser(description="Migrate local Qdrant embedded DB to Qdrant Cloud")
    parser.add_argument("--url", help="Qdrant Cloud cluster URL", default=None)
    parser.add_argument("--key", help="Qdrant Cloud API key", default=None)
    parser.add_argument("--collection", help="Collection name", default=None)
    args = parser.parse_args()

    migrate(qdrant_url=args.url, qdrant_api_key=args.key, collection_name=args.collection)
