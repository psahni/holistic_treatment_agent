import os
import uuid
import logging
from typing import List, Dict, Any, Optional

from qdrant_client import QdrantClient
from qdrant_client.models import Distance, VectorParams, PointStruct, Filter, FieldCondition, MatchValue
from google import genai

from config import get_settings

logger = logging.getLogger(__name__)
settings = get_settings()

COLLECTION_NAME = settings.QDRANT_COLLECTION
VECTOR_SIZE = 3072  # gemini-embedding-001 vector dimension

_client: Optional[QdrantClient] = None
_genai_client: Optional[genai.Client] = None

def get_genai_client() -> genai.Client:
    global _genai_client
    if _genai_client is None:
        _genai_client = genai.Client(api_key=settings.GEMINI_API_KEY)
    return _genai_client


def get_qdrant_client() -> QdrantClient:
    """Returns a singleton QdrantClient instance.
    Uses Qdrant Cloud if QDRANT_URL is configured, else uses local disk storage in backend/data/qdrant_db.
    """
    global _client
    if _client is not None:
        return _client

    if settings.QDRANT_URL:
        logger.info(f"Connecting to remote Qdrant at {settings.QDRANT_URL}")
        _client = QdrantClient(
            url=settings.QDRANT_URL,
            api_key=settings.QDRANT_API_KEY if settings.QDRANT_API_KEY else None,
            timeout=10
        )
    else:
        local_db_path = os.path.join(os.path.dirname(__file__), "..", "data", "qdrant_db")
        os.makedirs(local_db_path, exist_ok=True)
        logger.info(f"Using local embedded Qdrant storage at {local_db_path}")
        _client = QdrantClient(path=local_db_path)

    ensure_collection_exists(_client)
    return _client


def ensure_collection_exists(client: QdrantClient):
    """Creates the naturopathy_books collection if it doesn't already exist."""
    try:
        collections = [c.name for c in client.get_collections().collections]
        if COLLECTION_NAME not in collections:
            logger.info(f"Creating Qdrant collection '{COLLECTION_NAME}' (dim={VECTOR_SIZE})...")
            client.create_collection(
                collection_name=COLLECTION_NAME,
                vectors_config=VectorParams(size=VECTOR_SIZE, distance=Distance.COSINE),
            )
    except Exception as e:
        logger.warning(f"Error checking/creating Qdrant collection: {e}")


def get_embedding(text: str) -> List[float]:
    """Generates 3072-dim vector embedding using Google's models/gemini-embedding-001 model with rate-limit retry."""
    import time
    max_retries = 3
    for attempt in range(max_retries):
        try:
            gclient = get_genai_client()
            res = gclient.models.embed_content(
                model="models/gemini-embedding-001",
                contents=text
            )
            time.sleep(0.2)  # Mild rate-limit throttle
            return res.embeddings[0].values
        except Exception as e:
            if "429" in str(e) or "RESOURCE_EXHAUSTED" in str(e):
                wait_time = (2 ** attempt) + 1
                logger.warning(f"Gemini embedding rate-limited. Retrying in {wait_time}s (attempt {attempt+1}/{max_retries})...")
                time.sleep(wait_time)
            else:
                logger.error(f"Error generating embedding: {e}")
                break
    return [0.0] * VECTOR_SIZE


def add_document_chunks(chunks: List[Dict[str, Any]], file_hash: str = "") -> int:
    """Inserts text chunks with metadata into Qdrant."""
    client = get_qdrant_client()
    points = []

    for chunk in chunks:
        text = chunk.get("text", "")
        if not text.strip():
            continue

        vector = get_embedding(text)
        point_id = str(uuid.uuid4())
        payload = {
            "text": text,
            "source": chunk.get("source", "unknown"),
            "page": chunk.get("page", 1),
            "title": chunk.get("title", "Naturopathy Guide"),
            "category": chunk.get("category", "general"),
            "file_hash": file_hash
        }

        points.append(PointStruct(id=point_id, vector=vector, payload=payload))

    if points:
        client.upsert(collection_name=COLLECTION_NAME, points=points)
        logger.info(f"Successfully upserted {len(points)} chunks into Qdrant.")
        return len(points)
    return 0


def search_vector_store(query: str, limit: int = 4) -> List[Dict[str, Any]]:
    """Searches Qdrant for book chunks relevant to the query."""
    try:
        client = get_qdrant_client()
        query_vector = get_embedding(query)

        if hasattr(client, "query_points"):
            res = client.query_points(
                collection_name=COLLECTION_NAME,
                query=query_vector,
                limit=limit
            )
            hits = res.points
        else:
            hits = client.search(
                collection_name=COLLECTION_NAME,
                query_vector=query_vector,
                limit=limit
            )

        results = []
        for hit in hits:
            payload = hit.payload if hasattr(hit, "payload") else hit
            score = getattr(hit, "score", 0.0)
            results.append({
                "text": payload.get("text", ""),
                "source": payload.get("source", ""),
                "page": payload.get("page", 1),
                "title": payload.get("title", ""),
                "score": round(score, 4)
            })
        return results
    except Exception as e:
        logger.warning(f"Qdrant vector search failed: {e}")
        return []

def get_document_chunk_count(filename: str) -> int:
    """Returns the number of chunks stored in Qdrant for a specific document."""
    try:
        client = get_qdrant_client()
        count_res = client.count(
            collection_name=COLLECTION_NAME,
            count_filter=Filter(
                must=[
                    FieldCondition(
                        key="source",
                        match=MatchValue(value=filename)
                    )
                ]
            )
        )
        return count_res.count
    except Exception as e:
        logger.error(f"Failed to count chunks for {filename}: {e}")
        return 0

def delete_document_by_source(filename: str) -> bool:
    """Deletes all chunks associated with a specific document from Qdrant."""
    try:
        client = get_qdrant_client()
        client.delete(
            collection_name=COLLECTION_NAME,
            points_selector=Filter(
                must=[
                    FieldCondition(
                        key="source",
                        match=MatchValue(value=filename)
                    )
                ]
            )
        )
        logger.info(f"Successfully deleted all chunks for {filename} from Qdrant.")
        return True
    except Exception as e:
        logger.error(f"Failed to delete document {filename} from Qdrant: {e}")
        return False

def get_document_hash(filename: str) -> Optional[str]:
    """Retrieves the file hash for a given document if it exists in Qdrant."""
    try:
        client = get_qdrant_client()
        res = client.scroll(
            collection_name=COLLECTION_NAME,
            scroll_filter=Filter(
                must=[
                    FieldCondition(
                        key="source",
                        match=MatchValue(value=filename)
                    )
                ]
            ),
            limit=1,
            with_payload=True
        )
        points, _ = res
        if points and hasattr(points[0], 'payload'):
            return points[0].payload.get("file_hash")
        return None
    except Exception as e:
        logger.warning(f"Could not retrieve hash for {filename}: {e}")
        return None
