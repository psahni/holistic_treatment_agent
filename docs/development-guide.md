# Running and testing the project

This guide is for someone setting up the app on their own computer. Read [how the app works](architecture.md) first if the project is new to you. For the AI details, see [how the AI finds information](ai-rag-pipeline.md).

Commands and file paths were checked against the code on 2026-10-28. They were not run during this documentation review, so this guide does not claim that a particular computer or online service is ready.

## 1. What you need

- **Python:** runs the server. README asks for version 3.11 or later.
- **Node.js and npm:** run the website. README asks for Node.js 18 or later.
- **Docker Compose, optionally:** starts local database services.
- **Service settings:** connect the app to its database, AI provider, and other services.

The installed packages may have their own version requirements. Compatibility across every Python and Node version above has not been tested. The package lists are `backend/requirements.txt` and `frontend/package.json`.

The **project root** means the main folder containing `README.md`, `backend`, and `frontend`. Run commands in that folder unless a step says otherwise.

## 2. First-time package setup

Skip this section if the project already has its packages installed.

Create a separate Python package area, called a virtual environment:

```text
python -m venv backend/.venv
```

Activate it using the command for your operating system. On Windows PowerShell:

```powershell
.\backend\.venv\Scripts\Activate.ps1
```

On macOS or Linux:

```sh
source backend/.venv/bin/activate
```

Then install the server and website packages from the project root:

```text
python -m pip install -r backend/requirements.txt
npm install --prefix frontend
```

These installation commands download packages and change local files. The Python package versions are not fully fixed, so installs on different dates can differ.

## 3. Set up the connections

Use `backend/.env.example` as the starting point for a local `backend/.env` file. Keep an existing file if it is already configured. These files hold settings such as service addresses and credentials; do not share their contents.

`backend/config.py` reads the backend settings. Run backend commands from `backend`, or use the startup script below, so it finds the correct settings file. The website needs its own server address setting.

Only setting names are listed here:

| Purpose | Setting names |
|---|---|
| Required server settings | `DATABASE_URL`, `APP_ENV`, `SECRET_KEY` |
| Google AI connection and answer controls | `USE_VERTEX_AI`, `GEMINI_API_KEY`, `GEMINI_MODEL`, `GCP_PROJECT`, `GCP_LOCATION`, `TEMPERATURE`, `MAX_TOKENS` |
| Searchable reference store and web search | `QDRANT_URL`, `QDRANT_API_KEY`, `QDRANT_COLLECTION`, `DISABLE_WEB_SEARCH` |
| Temporary conversations and reused answers | `REDIS_URL`, `CACHE_LLM`, `CACHE_TTL_SECONDS` |
| Sign-in and allowed website connections | `ADMIN_USERNAME`, `ADMIN_PASSWORD`, `ALGORITHM`, `ACCESS_TOKEN_EXPIRE_MINUTES`, `CORS_ORIGINS` |
| Email | `SMTP_HOST`, `SMTP_PORT`, `SMTP_USERNAME`, `SMTP_PASSWORD`, `SMTP_FROM_EMAIL` |
| Website's server connection | `NEXT_PUBLIC_API_URL` |
| Tests and hosting | `REAL_LLM`, `CI`, `PORT` |
| Docker database setup | `POSTGRES_DB`, `POSTGRES_USER`, `POSTGRES_PASSWORD` |

The AI can write answers through the Gemini API or Vertex AI. The step that turns reference text into searchable numbers still uses the API-key connection in current code.

Email settings are read directly from the running program's environment. Merely putting them in the backend settings file may not make them available to the email sender. See `backend/utils/mailer.py`.

## 4. Start the app

If you want the database services from `docker-compose.yml`, run:

```text
docker compose up -d
```

This starts PostgreSQL on port 5433 and Redis on 6379. A **port** is an address number that lets several programs share the same computer. Compose does not start the app itself or Qdrant, the reference search store.

From the project root:

```text
python scripts/dev.py start
```

The script starts the website and server in the background. It uses an existing Python virtual environment when it finds one. On systems where the Python command is named `python3`, use that name instead.

Open:

- **Website:** `http://localhost:5001`
- **Server API guide:** `http://localhost:5000/docs`
- **Basic server check:** `http://localhost:5000/health`

The basic check only says the server can reply. It does not prove that search, AI, email, or the database works.

Starting the server can also create database tables, add missing fields, and save starter templates. It is not a read-only action.

### See status, read logs, or stop

Logs are the messages a running program writes to explain what it is doing.

```text
python scripts/dev.py status
python scripts/dev.py logs backend -f
python scripts/dev.py logs frontend -f
python scripts/dev.py stop
python scripts/dev.py restart
```

The `-f` option keeps showing new log messages. Press Ctrl+C to leave the log view. The script keeps logs and process details under `.dev/` and stops the programs it launched.

To keep each program visible in its own terminal, use these in separate terminals:

```text
python scripts/dev.py run backend
python scripts/dev.py run frontend
```

The Makefile offers shortcuts such as `make start`, `make stop`, `make status`, and `make logs`. Older PowerShell launch scripts and older port examples do not describe the current setup.

## 5. Run tests

Tests check parts of the app automatically. Some replace online services with pretend responses, called mocks. Passing those tests does not prove that a real Google, database, or email connection works.

Tests can write temporary databases, reports, saved emails, and other files. Some can contact online services or create cases. They should not be treated as read-only checks.

### Server behavior

Open a terminal in `backend`:

```text
python -m pytest tests -q
```

To check a smaller area:

```text
python -m pytest tests/test_question_mode.py -q
python -m pytest tests/test_document_ingestion.py -q
```

These cover sign-in, questions, forms, case handling, practitioner review, templates, and document loading. Setup is in `backend/tests/conftest.py`: it uses a local SQLite test database and normally substitutes pretend AI/search results. Document-loading tests also use fake PDFs, embeddings, and Qdrant behavior.

The setup does not block every possible outside connection. Check it before promising an offline run. An older report describes an occasional failure in the full practitioner journey; that has not been reproduced in this review.

### Safety checks and AI answer quality

From the project root:

```text
make test
```

Without make, run this from `backend`:

```text
python -m pytest evals/test_naturopathy_evals.py -k "not Quality" -v
```

This checks word-based safety rules and reference-file structure. It does not run the full server test folder.

For the broader AI evaluation, from the project root:

```text
make eval
```

Or from `backend`:

```text
python -m pytest evals/ -v
```

The broader checks can call online AI services and use another AI to judge answers. That judge uses Vertex AI in `backend/evals/gemini_evaluator.py`. The dynamic evaluation currently selects two examples from its data file. Configuration may be required even before some checks can start.

### Website screens and browser journeys

Open a terminal in `frontend`:

```text
npm test
```

This uses Jest to check screens and website logic. It writes a coverage report: coverage measures how much code the tests exercised. Its 75% target applies only to selected files, not the whole website. `npm test -- --runInBand` runs tests one at a time.

For tests that operate a real browser:

```text
npx playwright test
npx playwright test playwright/treatment-mode.spec.js
```

Playwright starts the website, but the backend must be running separately. The setup expects an installed Google Chrome browser. These journeys may create users and cases, call AI, and trigger email handling. Configuration is in `frontend/playwright.config.js`.

No test pass counts are claimed here. No automatic test workflow on code changes was found. Real search quality, online login cookies, conversation ownership, piece-by-piece answers, and multiple-server document loading need more checks.

## 6. Add reference PDFs

Put PDFs in `backend/data/docs/`, then run from the project root:

```text
make ingest
```

Without make, run `python ingest_docs.py` from `backend`. A signed-in admin can also upload and load documents through the website. Loading can resume after a failure. It calls the embedding service and writes to SQL and Qdrant, so it changes stored information. Do not load the same file through the command line and admin screen at the same time.

The separate `make seed` command for JSON reference files is currently broken. Both its script location and the script's reference-folder path need correction. See `backend/scripts/seed_kb_to_qdrant.py`.

Other scripts under `backend/scripts/` can create sample cases, search live references, or move data to Qdrant Cloud. Read them before running; a filename beginning with `test` does not guarantee an isolated test.

## 7. Common confusing behavior

| What you notice | What the code may be doing |
|---|---|
| Chat replies even during a server failure | The website substitutes an example reply |
| An answer has no book support | Search failed or found nothing, but AI answered anyway |
| Saved information seems missing | The app switched to local or temporary storage |
| Reference search suddenly looks empty | Local Qdrant could not open and temporary storage was used |
| The patient receives no email | The app saved a local HTML file instead |
| Login works locally but fails online | Browser cookie rules differ across website/server domains |
| The health check says OK during a problem | It does not test connected services |

The main files to inspect are `frontend/src/services/api.js`, `backend/database/models.py`, `backend/memory/session_store.py`, `backend/rag/qdrant_store.py`, and `backend/utils/mailer.py`.

For production website builds, run `npm run build` and then `npm run start` from `frontend`. The declared `npm run lint` checks coding style through `next lint`; whether that command works with the installed version has not been tested. Online hosting status, costs, model support, and credentials remain unverified.
