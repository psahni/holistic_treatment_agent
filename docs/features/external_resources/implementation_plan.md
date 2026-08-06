# Feature: Configurable External Resources

Following the spec-driven approach (Brainstorm -> Define -> Design -> Tasks -> Build), this document outlines the plan to extract hardcoded trusted domains into an external, easily modifiable YAML file.

## 1. Brainstorm
- The user wants a way to see and easily add new external resources (URLs/domains) that the agent uses to construct responses.
- Currently, the `backend/rag/web_search.py` module uses a hardcoded Python list called `TRUSTED_DOMAINS`.
- A `.yaml` file is the perfect solution because it's human-readable, widely used for configuration, and allows comments.

## 2. Define
- Create `backend/resources.yaml`.
- This file will act as the single source of truth for the RAG (Retrieval-Augmented Generation) live web search filter.
- Update `backend/rag/web_search.py` to dynamically load domains from this YAML file.

## 3. Design
**`backend/resources.yaml`**
```yaml
# Add new domains here to expand the AI's search resources.
trusted_domains:
  - "ayush.gov.in"
  - "ninpune.ayush.gov.in"
  - "ccrn.res.in"
  - "ncbi.nlm.nih.gov"
```

**`backend/rag/web_search.py`**
- Will be refactored to use the `yaml` library to load `resources.yaml` on startup.
- Fallback safely to a default list if the file is ever accidentally deleted.

## 4. Tasks
- `[ ]` Add `PyYAML` to `backend/requirements.txt`.
- `[ ]` Install `PyYAML` via `pip`.
- `[ ]` Create `backend/resources.yaml` with the current default domains.
- `[ ]` Refactor `backend/rag/web_search.py` to parse the YAML file and populate `TRUSTED_DOMAINS`.
