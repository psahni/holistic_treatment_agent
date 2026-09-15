import os
import uuid
import logging
import json
import time
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
_genai_client: Optional[genai.Client] = None       # generation client
_embedding_client: Optional[genai.Client] = None   # embedding client (always Gemini API key)


def get_embedding_client() -> genai.Client:
    """Always uses Gemini API key — gemini-embedding-001 is not available on Vertex AI."""
    global _embedding_client
    if _embedding_client is None:
        logger.info("Initialising embedding client via Gemini API key (gemini-embedding-001)")
        _embedding_client = genai.Client(api_key=settings.GEMINI_API_KEY)
    return _embedding_client


def get_genai_client() -> genai.Client:
    """Generation client: Vertex AI (ADC) when USE_VERTEX_AI=true, else Gemini API key."""
    global _genai_client
    if _genai_client is None:
        if settings.USE_VERTEX_AI:
            logger.info(f"Initialising generation client via Vertex AI (project={settings.GCP_PROJECT}, location={settings.GCP_LOCATION})")
            _genai_client = genai.Client(
                vertexai=True,
                project=settings.GCP_PROJECT,
                location=settings.GCP_LOCATION,
            )
        else:
            logger.info("Initialising generation client via Gemini API key")
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
        if settings.APP_ENV == "test":
            logger.info("Using in-memory Qdrant storage for tests")
            _client = QdrantClient(location=":memory:")
        else:
            local_db_path = os.path.join(os.path.dirname(__file__), "..", "data", "qdrant_db")
            os.makedirs(local_db_path, exist_ok=True)
            logger.info(f"Using local embedded Qdrant storage at {local_db_path}")
            try:
                _client = QdrantClient(path=local_db_path)
            except Exception as e:
                if "lock" in str(e).lower() or "locked" in str(e).lower():
                    logger.warning(
                        "Local Qdrant Database is locked by another process (e.g. running FastAPI/Uvicorn server). "
                        "Falling back to in-memory Qdrant storage (:memory:) to ensure agent stability."
                    )
                    _client = QdrantClient(location=":memory:")
                else:
                    raise e

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


# In-memory LRU-style cache for interactive query embeddings
_query_embedding_cache: Dict[str, List[float]] = {}

def get_embeddings(texts: List[str], is_batch: bool = False) -> List[List[float]]:
    """Generates 3072-dim vector embeddings using gemini-embedding-001.
    
    - For single interactive queries: Uses in-memory cache, fast 1-2s retries, and no artificial delays.
    - For batch ingestion (is_batch=True): Throttles with 4.5s sleep to respect 15 RPM limits.
    """
    # Check cache for single query
    if len(texts) == 1 and not is_batch:
        single_query = texts[0].strip()
        if single_query in _query_embedding_cache:
            return [_query_embedding_cache[single_query]]

    max_retries = 6 if is_batch else 2
    for attempt in range(max_retries):
        try:
            eclient = get_embedding_client()
            res = eclient.models.embed_content(
                model="models/gemini-embedding-001",
                contents=texts
            )
            # Only sleep during heavy offline batch indexing
            if is_batch:
                time.sleep(4.5)
            
            embeddings = [e.values for e in res.embeddings]
            
            # Cache single query results
            if len(texts) == 1 and not is_batch and single_query:
                _query_embedding_cache[single_query] = embeddings[0]
                if len(_query_embedding_cache) > 500:
                    _query_embedding_cache.pop(next(iter(_query_embedding_cache)))
                    
            return embeddings
        except Exception as e:
            err_str = str(e)
            if "429" in err_str or "RESOURCE_EXHAUSTED" in err_str or "quota" in err_str.lower():
                if is_batch:
                    wait_time = min(300, (2 ** attempt) * 10)
                else:
                    wait_time = 1.0 + attempt * 1.5  # Fast 1.0s, 2.5s for interactive UI
                logger.warning(f"Gemini embedding rate-limited. Retrying in {wait_time:.1f}s (attempt {attempt+1}/{max_retries})...")
                time.sleep(wait_time)
            else:
                logger.error(f"Error generating embeddings: {e}")
                raise
    raise Exception("Max retries exceeded for Gemini embedding API")


def add_document_chunks(chunks: List[Dict[str, Any]], file_hash: str = "", doc_id: str = "") -> int:
    """Inserts text chunks with metadata into Qdrant."""
    client = get_qdrant_client()
    points = []

    # Filter valid text chunks first
    valid_chunks = [c for c in chunks if c.get("text", "").strip()]
    
    # Process in batches of 200 to avoid rate limits
    batch_size = 200
    for i in range(0, len(valid_chunks), batch_size):
        batch = valid_chunks[i:i + batch_size]
        texts = [c.get("text", "") for c in batch]
        
        vectors = get_embeddings(texts, is_batch=True)
        
        for chunk, vector in zip(batch, vectors):
            point_id = str(uuid.uuid4())
            payload = {
                "text": chunk.get("text", ""),
                "source": chunk.get("source", "unknown"),
                "page": chunk.get("page", 1),
                "title": chunk.get("title", "Naturopathy Guide"),
                "category": chunk.get("category", "general"),
                "file_hash": file_hash,
                "doc_id": doc_id
            }
            points.append(PointStruct(id=point_id, vector=vector, payload=payload))

    if points:
        client.upsert(collection_name=COLLECTION_NAME, points=points)
        logger.info(f"Successfully upserted {len(points)} chunks into Qdrant.")
        return len(points)
    return 0


def search_vector_store(query: str, limit: int = 4) -> List[Dict[str, Any]]:
    """Searches Qdrant for book chunks relevant to the query. Gracefully returns empty list if throttled."""
    start_time = time.time()
    try:
        client = get_qdrant_client()
        query_vector = get_embeddings([query], is_batch=False)[0]

        if hasattr(client, "query_points"):
            res = client.query_points(
                collection_name=COLLECTION_NAME,
                query=query_vector,
                limit=limit
            )
            hits = res.points
        else:
            hits = client.search(  # type: ignore
                collection_name=COLLECTION_NAME,
                query_vector=query_vector,
                limit=limit
            )

        results = []
        for hit in hits:
            payload = getattr(hit, "payload", {}) or {}
            score = getattr(hit, "score", 0.0)
            results.append({
                "text": payload.get("text", ""),
                "source": payload.get("source", ""),
                "page": payload.get("page", 1),
                "title": payload.get("title", ""),
                "category": payload.get("category", ""),
                "score": score
            })

        latency_ms = int((time.time() - start_time) * 1000)
        logger.info(json.dumps({
            "event": "qdrant_search",
            "collection": COLLECTION_NAME,
            "query": query,
            "k": limit,
            "hits": len(results),
            "latency_ms": latency_ms
        }))

        return results
    except Exception as e:
        logger.warning(f"Qdrant vector search skipped/fallback ({e}). Proceeding without book context.")
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
        return -1

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
