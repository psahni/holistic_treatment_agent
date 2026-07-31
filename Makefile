# 🌿 NatureCure AI — Makefile

.PHONY: start stop start-backend start-frontend ingest seed test help

help:
	@echo "NatureCure AI Management Commands:"
	@echo "  make start         - Start both Backend (FastAPI) and Frontend (Next.js)"
	@echo "  make stop          - Stop all running Backend and Frontend server processes"
	@echo "  make start-backend - Start FastAPI backend only (http://localhost:8000)"
	@echo "  make start-frontend- Start Next.js frontend only (http://localhost:3000)"
	@echo "  make ingest        - Parse & index PDF books from backend/data/docs into Qdrant"
	@echo "  make seed          - Seed initial Naturopathy KB into Qdrant vector store"
	@echo "  make test          - Run safety & quality test suite (pytest)"

start:
	@echo "🚀 Starting n NatureCure AI Servers..."
	powershell -ExecutionPolicy Bypass -File ./scripts/start.ps1

stop:
	@echo "🛑 Stopping NatureCure AI Servers..."
	powershell -ExecutionPolicy Bypass -File ./scripts/stop.ps1

start-backend:
	@echo "🐍 Starting FastAPI Backend on port 8000..."
	cd backend && python -m uvicorn main:app --reload --port 8000

start-frontend:
	@echo "⚛️ Starting Next.js Frontend on port 3000..."
	cd frontend && npm run dev

ingest:
	@echo "📚 Ingesting PDF books into Qdrant..."
	cd backend && python ingest_docs.py

seed:
	@echo "🌱 Seeding initial Naturopathy Knowledge Base into Qdrant..."
	cd backend && python seed_kb_to_qdrant.py

test:
	@echo "🧪 Running Safety & Quality Eval Suite..."
	cd backend && python -m pytest evals/ -v
