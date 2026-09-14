# 🌐 Zero-Cost Cloud Deployment Guide

This guide explains how to deploy both the **Frontend** and **Backend** of NatureCure AI to the cloud for **$0 / month** using free-tier services.

---

## 🏛️ Deployment Architecture

| Layer | Service | Tier | Purpose |
| :--- | :--- | :--- | :--- |
| **Frontend** | [Vercel](https://vercel.com) | Free Hobby | Next.js app hosting, global edge CDN, automatic SSL |
| **Backend API** | [Render](https://render.com) | Free Web Service | FastAPI Python server (750 free hours/month) |
| **Relational DB** | [Neon](https://neon.tech) | Free Serverless | Managed PostgreSQL database (0.5 GB storage forever) |
| **Vector DB** | [Qdrant Cloud](https://cloud.qdrant.io) | Free Cluster | 1 GB managed vector cluster for RAG embeddings |
| **LLM & Embeddings** | [Google AI Studio](https://aistudio.google.com) | Free Tier | Gemini 2.0 Flash (`GEMINI_API_KEY`) & `gemini-embedding-001` |
| **Cache & Sessions** | In-Memory (Built-in) | $0 | Fallback in-memory session/cache (or optional [Upstash Redis](https://upstash.com)) |

---

## 🚀 Step 1: Set Up Cloud Prerequisites

### 1. Google AI Studio (LLM & Embeddings)
1. Go to [aistudio.google.com](https://aistudio.google.com) and sign in.
2. Click **Get API key** → **Create API key**.
3. Save your key. *(No credit card required).*

### 2. Neon PostgreSQL (Database)
1. Go to [neon.tech](https://neon.tech) and sign up with GitHub.
2. Click **Create Project** (choose a region close to your users).
3. Copy the provided connection string:
   ```text
   postgresql://<user>:<password>@<endpoint>.aws.neon.tech/neondb?sslmode=require
   ```

### 3. Qdrant Cloud (Vector Database)
1. Go to [cloud.qdrant.io](https://cloud.qdrant.io) and create an account.
2. Click **Create Cluster** → select the **Free Tier (1GB)**.
3. Once provisioned:
   * Copy the **Cluster URL** (e.g. `https://xxxx.cloud.qdrant.io:6333`).
   * Generate and copy an **API Key** under **Data Access Control**.
4. **Migrate existing local data** (no re-embedding or API cost needed):
   ```powershell
   python backend/scripts/migrate_to_qdrant_cloud.py --url "YOUR_CLUSTER_URL" --key "YOUR_API_KEY"
   ```

---

## ⚙️ Step 2: Deploy Backend on Render

1. Go to [dashboard.render.com](https://dashboard.render.com) and click **New +** → **Web Service**.
2. Connect your GitHub repository (`holistic_treatment_agent`).
3. Configure the service:

| Field | Value | Notes |
| :--- | :--- | :--- |
| **Name** | `holistic-treatment-backend` | Or any unique name |
| **Language** | `Python 3` | Ensure it is set to Python, not Node |
| **Branch** | `main` | Production branch |
| **Region** | Choose closest to your DB | e.g. Oregon, Singapore, Frankfurt |
| **Root Directory** | `backend` | Points to the backend folder |
| **Build Command** | `pip install -r requirements.txt` | Installs Python packages |
| **Start Command** | `uvicorn main:app --host 0.0.0.0 --port $PORT` | Starts FastAPI on dynamic port |
| **Instance Type** | `Free` | $0/month |

4. Add **Environment Variables** (under *Advanced* / *Environment*):

| Key | Value / Source |
| :--- | :--- |
| `USE_VERTEX_AI` | `false` |
| `GEMINI_API_KEY` | *(Your Google AI Studio API key)* |
| `DATABASE_URL` | *(Your Neon PostgreSQL connection string)* |
| `QDRANT_URL` | *(Your Qdrant Cloud cluster URL)* |
| `QDRANT_API_KEY` | *(Your Qdrant Cloud API key)* |
| `QDRANT_COLLECTION` | `naturopathy_books` |
| `APP_ENV` | `production` |
| `SECRET_KEY` | *(Any random 32+ character string)* |
| `ADMIN_USERNAME` | `admin` |
| `ADMIN_PASSWORD` | *(Secure password for practitioner admin)* |
| `DISABLE_WEB_SEARCH` | `true` *(or `false` if using live search)* |
| `GCP_PROJECT` | `holistic-agent-503906` *(optional identifier)* |

5. Click **Deploy Web Service**.
6. When deployment finishes, copy your live backend URL:
   `https://<your-backend-name>.onrender.com`

> ℹ️ **Render Free Tier Spin-Down**: Free instances spin down after 15 minutes of inactivity. When a new request arrives, it takes ~30–40 seconds to spin back up ("cold start").

---

## 🎨 Step 3: Deploy Frontend on Vercel

1. Go to [vercel.com](https://vercel.com) and click **Add New...** → **Project**.
2. Import your GitHub repository (`holistic_treatment_agent`).
3. Vercel will automatically read the repository's [`vercel.json`](../vercel.json) and [`package.json`](../package.json).
4. Configure the **Environment Variables**:

| Key | Value |
| :--- | :--- |
| `NEXT_PUBLIC_API_URL` | `https://<your-backend-name>.onrender.com` *(no trailing slash)* |

5. Click **Deploy**.
6. Once completed, your application is live at `https://<your-project>.vercel.app`!

---

## 🛠️ Key Architectural Configurations Included in Code

* **CORS Dynamic Support ([`backend/main.py`](../backend/main.py))**:
  The backend includes `allow_origin_regex=r"https://.*\.vercel\.app"`, permitting any Vercel production or preview URL to communicate with the API with credentials enabled.
* **Resilient API URL ([`frontend/src/services/api.js`](../frontend/src/services/api.js))**:
  `API_BASE` prioritizes `process.env.NEXT_PUBLIC_API_URL` before falling back to local development ports.
* **Monorepo Build Support ([`package.json`](../package.json) & [`vercel.json`](../vercel.json))**:
  The repository root contains workspace routing and framework declarations so builds succeed automatically from either the root or `frontend` directory.

---

## ❓ Troubleshooting

### 1. Backend: `Pydantic ValidationError: GCP_PROJECT Field required`
Ensure `GCP_PROJECT` is added to Render environment variables, or update [`backend/config.py`](../backend/config.py) where `GCP_PROJECT: str = ""` is defaulted.

### 2. Frontend: Vercel `404: NOT_FOUND`
Ensure that the latest deployment on Vercel has run `next build`. If an old deployment was created before the root settings were saved, go to **Deployments** → click **`...`** on the latest commit → click **Redeploy**.

### 3. API Network Error in Browser Console
* Verify `NEXT_PUBLIC_API_URL` in Vercel has **no trailing slash** (e.g. `https://xxx.onrender.com`).
* Check Render logs to ensure the backend is not asleep (wait 30s for spin-up).
* Verify CORS headers in backend logs.
