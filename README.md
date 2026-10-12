# DocMind AI + HireMind

Two tools in one repo.

**DocMind** — upload a PDF, chat with it, generate a quiz from it.  
**HireMind** — paste a job description, upload a resume, get an AI screening score + GitHub stats + 3 custom interview questions.

---

## Stack

- **Backend** — FastAPI, Python 3.11
- **Database** — PostgreSQL + pgvector (Neon)
- **Storage** — AWS S3
- **Embeddings** — FastEmbed (`bge-small-en-v1.5`, runs on CPU, free)
- **LLM** — Groq (Llama 3)
- **Frontend** — React 19 + Tailwind CSS

---

## Running it

**Backend**
```bash
cd backend
pip install -r requirements.txt
cp .env.example .env   # fill in your keys
uvicorn main:app --reload --port 8000
```
API docs at `http://localhost:8000/docs`

**Frontend**
```bash
cd frontend
npm install
npm run dev
```
App at `http://localhost:5173`

**Tests**
```bash
cd backend
pytest -v
```

---

## Environment variables

```env
# Required
DATABASE_URL=
GROQ_API_KEY=
AWS_ACCESS_KEY=
AWS_SECRET_KEY=
S3_BUCKET_NAME=
JWT_SECRET=

# HireMind (all optional)
GITHUB_TOKEN=          # optional — raises GitHub API rate limit 60 → 5000/hr
SHEET_ID=              # Google Sheet ID — omit to use mock logging
GOOGLE_CRED_JSON=      # path to service account JSON, or the JSON string itself
```

---

## Project structure

```
backend/
  main.py
  config.py
  routes/
    auth.py      # JWT auth
    pdf.py       # S3 upload, streaming
    ai.py        # RAG chat
    quiz.py      # MCQ generation
  hire/
    routes.py          # /api/hire/* endpoints
    github_service.py  # GitHub API calls
    llm_service.py     # Groq screening + question generation
    sheets_service.py  # Google Sheets logging
  services/
    ai_service.py      # chunking, embeddings, vector search
  tests/

frontend/src/
  pages/
    Workspace.tsx
    Hire.tsx      # HireMind UI
  components/
    Sidebar.tsx

n8n/
  hiremind_workflow.json   # importable n8n automation
```

---

## HireMind

Startup hiring is messy — resumes come in over WhatsApp, there's no time to read them carefully, no one's writing custom interview questions. HireMind automates the first pass.

**What it does:**

1. Extracts text from the resume PDF
2. Calls GitHub API — gets public repos, languages, last active date
3. Sends everything to Groq Llama 3 — returns a score (0–100), reason, and shortlist flag
4. Generates 3 interview questions grounded in the candidate's actual projects, not generic ones
5. Logs the result to Google Sheets
6. Via n8n: alerts on WhatsApp if the candidate is shortlisted

**Endpoints:**

`POST /api/hire/screen` — multipart form: `job_description`, `resume_file` (PDF), `github_username`

`POST /api/hire/generate-questions` — JSON: `resume_text`, `jd`

`POST /api/hire/log-to-sheets` — JSON: `name`, `score`, `github_data`, `questions`

If `SHEET_ID` / `GOOGLE_CRED_JSON` aren't set, the log endpoint prints to console and returns `"status": "mocked"` — nothing breaks.

**n8n workflow** — import `n8n/hiremind_workflow.json`. Nodes: Google Drive Trigger → screen → generate questions → log to Sheets → WhatsApp alert (mock node, swap in Twilio or 360dialog).

**Frontend** — click **HireMind** in the sidebar. Fill in the JD, upload the resume, add a GitHub username. Hit Screen. You get a score card, GitHub stats, and the 3 questions on the same page.
