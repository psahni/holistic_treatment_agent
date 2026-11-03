# 🌿 NatureCure AI 🩺 Holistic Naturopathy Health Triage Agent

> An AI-powered Naturopathy health advisor guided by Nature Cure principles, Hybrid RAG (Qdrant Vector DB), and Live Authentic Medical Search.

---

## 🚀 Installation & Setup (For Multiple Machines)

Follow these steps to set up the project on a new machine.

### 1. Environment and Dependencies
Before starting, ensure your machine has the following prerequisites installed:
- **Python 3.11+** (for the FastAPI backend)
- **Node.js 18+ & npm** (for the Next.js frontend)
- **Git** (to clone the repository)
- **Docker / Docker Compose** (optional, if you plan to run local PostgreSQL, Redis, or Qdrant instances instead of cloud versions)

First, clone the repository:
```bash
git clone https://github.com/psahni/holistic_treatment_agent.git
cd holistic-treatment-agent
```

### 2. Setting up Backend
The backend application handles the AI logic, RAG, and API endpoints.

```bash
cd backend

# Create a virtual environment (recommended)
python -m venv venv

# Activate the virtual environment
# On Windows:
venv\Scripts\activate
# On macOS/Linux:
source venv/bin/activate

# Install Python dependencies
pip install -r requirements.txt

# Environment Setup
cp .env.example .env
```
*Note: Open `backend/.env` and provide your database credentials, Gemini API keys, Qdrant URL, and GCP Project ID. The application will not start without these configured.*

### 3. Setting up Frontend
The frontend is built with Next.js and interacts with the backend API.

```bash
cd frontend

# Install Node dependencies
npm install

# Environment Setup
cp .env.local.example .env.local 
```
*Note: Make sure the `NEXT_PUBLIC_API_URL` inside `frontend/.env.local` points to your backend's URL (default is `http://localhost:5000`).*

### 4. Setting up RAG (Knowledge Base)
To use the Hybrid RAG feature, you must ingest Naturopathy documents into your Qdrant Vector database.

1. Ensure your Qdrant instance is running (locally or in the cloud) and is configured in your `backend/.env` file.
2. Drop your Naturopathy PDF books/documents into this directory:
   ```
   backend/data/docs/
   ```
3. Run the ingestion process from the root folder:
   ```bash
   # From the project root
   make ingest
   ```

### 5. Start Server
One script, `scripts/dev.py`, starts and stops the servers on **Windows, macOS and Linux**. It needs only Python 3.8+ (no extra packages), and the backend and frontend packages from steps 2 and 3 installed. If `backend/.venv` exists, it is used automatically.

**Start both backend and frontend (in the background):**
```bash
python scripts/dev.py start      # use `python3` on macOS/Linux if `python` isn't found
# or, if you have make:
make start
```
It waits until both servers answer, then prints their addresses. Logs go to `.dev/logs/`.

**Which port should we open in the browser?**
- **Frontend UI:** Open your browser to **`http://localhost:5001`** to interact with the web application.
- **Backend API:** The FastAPI server runs on **`http://localhost:5000`**. You can access the Swagger API documentation at `http://localhost:5000/docs`.

**Other commands:**
```bash
python scripts/dev.py status           # what is running
python scripts/dev.py logs backend -f  # follow a log (Ctrl+C to quit)
python scripts/dev.py stop             # stop the servers that `start` launched
python scripts/dev.py restart
python scripts/dev.py run backend      # run one server in the foreground
```
`stop` only stops servers started by `start`. Another program using port 5000 or 5001 is never touched. If a port is busy, `start` tells you and does not start that server.

**Installing `make` (optional):** macOS `xcode-select --install`, Debian/Ubuntu `sudo apt install make`, Windows `winget install ezwinports.make` (then open a new terminal).

---

## 📋 Available Make Commands

| Command | Action |
|---|---|
| `make start` | Starts both Backend (Port 5000) and Frontend (Port 5001) in the background |
| `make stop` | Stops the servers started by `make start` |
| `make restart` / `make status` / `make logs` | Restart, show what is running, show recent logs |
| `make start-backend` | Runs the FastAPI backend in the foreground (`http://localhost:5000`) |
| `make start-frontend` | Runs the Next.js frontend in the foreground (`http://localhost:5001`) |
| `make ingest` | Parses & indexes PDF books from `backend/data/docs/` into Qdrant |
| `make seed` | Indexes initial Naturopathy Knowledge Base into Qdrant vector store |
| `make test` | Runs safety & quality test suite (`pytest`) |

---

## 🌐 Zero-Cost Cloud Deployment

Deploy both frontend and backend to production for **$0 / month** using free cloud services:
* **Frontend**: [Vercel](https://vercel.com) (Next.js Edge Hosting)
* **Backend**: [Render](https://render.com) (FastAPI Web Service)
* **Database**: [Neon](https://neon.tech) (Managed Serverless PostgreSQL)
* **Vector Store**: [Qdrant Cloud](https://cloud.qdrant.io) (1GB Free Cluster)
* **LLM & Embeddings**: [Google AI Studio](https://aistudio.google.com) (Gemini 2.0 Flash)

👉 **For the complete step-by-step guide, see [`docs/DEPLOYMENT.md`](docs/DEPLOYMENT.md)**

---

## 🏗️ Architecture

```
[Patient Query] ➡️ [Input Guardrails] ➡️ [Hybrid Context Retriever] ➡️ [Gemini LLM Synthesis] ➡️ [Output Guardrails]
                                            ⬇️⬆️ Qdrant Vector DB (PDFs & Books)
                                            ⬇️⬆️ Live Web Search (AYUSH & PubMed)
```

---

## Run Playwright tests

```bash
# 1. First, navigate into the frontend folder
cd frontend

# 2. Then run the tests (Headless mode)
npx playwright test playwright/treatment-mode.spec.js

# OR run with a visible browser so you can watch it (Interactive mode)
npx playwright test playwright/treatment-mode.spec.js --headed
```