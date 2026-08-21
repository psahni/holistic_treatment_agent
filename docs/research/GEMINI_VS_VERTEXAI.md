# Gemini API Key vs Vertex AI — A Practical Comparison

> **Context:** This project uses two different ways to access Google's Gemini models:
> - **Vertex AI** for LLM chat (`ChatVertexAI` in `nodes.py`)
> - **Gemini API Key** for embeddings (`genai.Client` in `qdrant_store.py`)
>
> This document explains why they differ, when to use each, and the recommended path forward.

---

## Two Doors to the Same Model

Both approaches give you access to the **same Gemini model weights** — the difference is in infrastructure, authentication, billing, and guarantees.

```
Gemini API Key  ──┐
                  ├──► Same Gemini model (e.g. gemini-2.0-flash)
Vertex AI       ──┘
```

---

## Side-by-Side Comparison

| | 🔑 Gemini API Key (AI Studio) | ☁️ Vertex AI (GCP) |
|---|---|---|
| **Who is it for?** | Developers, hobbyists, prototyping | Enterprises, production systems |
| **Authentication** | Plain API key in `.env` | GCP service account / `gcloud auth` — no plain key |
| **Free Tier** | ✅ Generous (e.g. 15 RPM, 1500 req/day for Gemini Flash) | ⚠️ Only $300 one-time GCP trial credits |
| **Billing Account** | Only required for paid/higher usage | **Always required** (even for trial) |
| **Rate Limits** | Stricter, lower quotas | Higher quotas, configurable |
| **Data Privacy** | Your data **may** be used to improve Google models | Your data is **NOT** used for training |
| **Enterprise SLA** | ❌ None | ✅ 99.9%+ uptime SLA |
| **Region Control** | ❌ Google decides | ✅ Full — you pick `us-central1`, `asia-south1`, etc. |
| **Setup Complexity** | 🟢 Easy — grab key from [aistudio.google.com](https://aistudio.google.com) | 🟡 Moderate — GCP project + IAM roles + enable API |

---

## How Each Is Used in This Project

### LLM Chat → Vertex AI ✅

```python
# backend/naturopathy/nodes.py
def get_llm():
    return ChatVertexAI(
        model_name=settings.GEMINI_MODEL,
        project=settings.GCP_PROJECT,    # GCP Project ID
        temperature=settings.TEMPERATURE,
        max_tokens=settings.MAX_TOKENS,
        max_retries=5
    )
```

- Auth via **Application Default Credentials (ADC)**
- No API key needed — uses GCP service account or `gcloud auth login`

---

### Embeddings → Gemini API Key ⚠️ (inconsistency)

```python
# backend/rag/qdrant_store.py
def get_genai_client() -> genai.Client:
    _genai_client = genai.Client(api_key=settings.GEMINI_API_KEY)
    return _genai_client
```

- Uses `google-genai` SDK with a plain API key from Google AI Studio
- This is the **only place** `GEMINI_API_KEY` is consumed in the project
- Calls `models/gemini-embedding-001` to convert user queries → 3072-dim vectors

---

## Call Chain for Embeddings

When a user asks a question, the embedding flow is:

```
qdrant_query_node (nodes.py)
    └── retrieve_hybrid_context(query)        # hybrid_retriever.py
            └── search_vector_store(query)    # qdrant_store.py
                    └── get_embeddings([query])
                            └── genai.Client(api_key=...).models.embed_content(
                                    model="models/gemini-embedding-001"
                                )            # ⚡ vectorization happens here
```

---

## Free Credits & Billing

### GCP $300 Trial Credits

- New GCP accounts receive **$300 in free credits**
- Valid for **90 days** from account creation
- Applies to **all GCP services** including Vertex AI
- Once exhausted (or expired), billing account charges begin

```
GCP Free Trial Credits ($300)
    └── Vertex AI API calls  ✅  (LLM chat via ChatVertexAI)
    └── Cloud Storage, etc.  ✅

Gemini API Key (AI Studio)
    └── Embeddings           ✅  (separate free tier, no GCP billing)
```

### Monitoring Your Credits

> Go to **GCP Console → Billing → Credits** to check remaining balance and expiry date.

---

## Recommended Fix: Unify Under Vertex AI

For production consistency — single auth mechanism, single billing, no free tier limits — move embeddings to Vertex AI:

```python
# Replace this:
_genai_client = genai.Client(api_key=settings.GEMINI_API_KEY)

# With this:
_genai_client = genai.Client(
    vertexai=True,
    project=settings.GCP_PROJECT,
    location=settings.GCP_REGION      # e.g. "us-central1"
)
```

**Benefits:**
- Removes `GEMINI_API_KEY` dependency entirely
- Unified auth under GCP IAM
- No unexpected free-tier rate limit failures in production
- All costs visible in one GCP billing dashboard

---

## When to Use Which

| Stage | Recommended Approach |
|---|---|
| 🧪 Local development / prototyping | Gemini API Key (free, zero setup) |
| 🚀 Production / enterprise | Vertex AI (consistent, secure, SLA-backed) |
| 💰 Budget-conscious staging | Gemini API Key (free tier) + Vertex AI for LLM |
