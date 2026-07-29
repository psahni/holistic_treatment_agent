# 🌿 NatureCure AI 🩺 Holistic Naturopathy Health Triage Agent

> An AI-powered Naturopathy health advisor guided by Nature Cure principles, Hybrid RAG (Qdrant Vector DB), and Live Authentic Medical Search.

---

## 🛠️ Management Commands

You can control all server tasks using the root **Makefile** or PowerShell scripts:

### Start All Servers
```bash
make start
```
*Or via PowerShell:*
```powershell
.\scripts\start.ps1
```

### Stop All Servers
```bash
make stop
```
*Or via PowerShell:*
```powershell
.\scripts\stop.ps1
```

---

## 📋 Available Make Commands

| Command | Action |
|---|---|
| `make start` | Starts both Backend (FastAPI - Port 8000) and Frontend (Next.js - Port 3000) |
| `make stop` | Stops all running Backend and Frontend server processes |
| `make start-backend` | Starts FastAPI backend only (`http://localhost:8000`) |
| `make start-frontend` | Starts Next.js frontend only (`http://localhost:3000`) |
| `make ingest` | Parses & indexes PDF books from `backend/data/docs/` into Qdrant |
| `make seed` | Indexes initial Naturopathy Knowledge Base into Qdrant vector store |
| `make test` | Runs safety & quality test suite (`pytest`) |

---

## 📚 PDF Book Ingestion

1. Drop your PDF books into:
   ```
   backend/data/docs/
   ```
2. Run ingestion:
   ```bash
   make ingest
   ```

---

## 🏗️ Architecture

```
[Patient Query] ➡️ [Input Guardrails] ➡️ [Hybrid Context Retriever] ➡️ [Gemini LLM Synthesis] ➡️ [Output Guardrails]
                                            ⬇️⬆️ Qdrant Vector DB (PDFs & Books)
                                            ⬇️⬆️ Live Web Search (AYUSH & PubMed)
```

- **Backend API**: `http://localhost:8000` (Swagger Docs: `http://localhost:8000/docs`)
- **Frontend UI**: `http://localhost:3000`
