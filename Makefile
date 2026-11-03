# NatureCure AI - Makefile (Windows, macOS, Linux)
# Everything that starts or stops servers goes through scripts/dev.py, so it behaves the same everywhere.
# No `make`? Run the same commands directly, e.g.  python scripts/dev.py start

ifeq ($(OS),Windows_NT)
PYTHON ?= python
else
PYTHON ?= python3
endif

DEV = $(PYTHON) scripts/dev.py

.PHONY: help start stop restart status logs start-backend start-frontend ingest seed test eval

help:
	@echo "NatureCure AI Management Commands:"
	@echo "  make start          - Start Backend (FastAPI :5000) and Frontend (Next.js :5001) in the background"
	@echo "  make stop           - Stop the servers started by 'make start'"
	@echo "  make restart        - Stop, then start both"
	@echo "  make status         - Show which servers are running"
	@echo "  make logs           - Show recent backend and frontend logs"
	@echo "  make start-backend  - Run the backend in the foreground (Ctrl+C to quit)"
	@echo "  make start-frontend - Run the frontend in the foreground (Ctrl+C to quit)"
	@echo "  make ingest         - Parse and index PDF books from backend/data/docs into Qdrant"
	@echo "  make seed           - Seed initial Naturopathy KB into Qdrant vector store"
	@echo "  make test           - Run fast safety and guardrail test suite (<1s)"
	@echo "  make eval           - Run full DeepEval LLM quality and clinical benchmark"

start:
	@$(DEV) start

stop:
	@$(DEV) stop

restart:
	@$(DEV) restart

status:
	@$(DEV) status

logs:
	@$(DEV) logs

start-backend:
	@$(DEV) run backend

start-frontend:
	@$(DEV) run frontend

ingest:
	@echo "Ingesting PDF books into Qdrant..."
	cd backend && $(PYTHON) ingest_docs.py

seed:
	@echo "Seeding initial Naturopathy Knowledge Base into Qdrant..."
	cd backend && $(PYTHON) seed_kb_to_qdrant.py

test:
	@echo "Running Fast Safety and Guardrail Suite (<1s)..."
	cd backend && $(PYTHON) -m pytest evals/test_naturopathy_evals.py -k "not Quality" -v

eval:
	@echo "Running Full DeepEval Clinical Quality Eval Suite..."
	cd backend && $(PYTHON) -m pytest evals/ -v
