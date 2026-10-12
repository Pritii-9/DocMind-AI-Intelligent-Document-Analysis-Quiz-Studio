# HireMind — Tech Hiring Agent for Startups

Built on top of DocMind AI. Upload a resume, paste a job description, get an AI screening score, GitHub stats, and 3 custom interview questions — all automatable via n8n.

---

## What it does

1. You upload a resume PDF + paste a job description
2. It pulls the candidate's GitHub — repos, languages, last active
3. Groq Llama 3 scores them 0–100 against the JD, flags shortlist, lists skills found
4. Generates 3 interview questions tied to their *actual projects* (not generic ones)
5. Logs the result to Google Sheets
6. Sends a WhatsApp alert if shortlisted — via n8n

---

## Stack

- FastAPI + Python 3.11
- PostgreSQL + pgvector (Neon) — for DocMind RAG features
- AWS S3 — PDF storage
- FastEmbed (`bge-small-en-v1.5`) — local CPU embeddings, free
- Groq Llama 3 — screening + question generation
- React 19 + Tailwind CSS
- n8n — workflow automation (Google Drive → screen → Sheets → WhatsApp)

---

## Running it

**Backend**
```bash
cd backend
pip install -r requirements.txt
# copy .env.example to .env and fill in your keys
uvicorn main:app --reload --port 8000
```
API docs: `http://localhost:8000/docs`

**Frontend**
```bash
cd frontend
npm install
npm run dev
```
App: `http://localhost:5173` → click **HireMind** in the sidebar

---

## Environment variables

```env
# Database
DATABASE_URL=postgresql://...          # Neon or any Postgres with pgvector

# AWS S3 (for DocMind PDF storage)
AWS_ACCESS_KEY=
AWS_SECRET_KEY=
S3_BUCKET_NAME=
AWS_REGION=ap-south-1

# Groq
GROQ_API_KEY=

# Auth
JWT_SECRET=

# HireMind — GitHub
GITHUB_TOKEN=                          # optional — raises rate limit 60 → 5000/hr

# HireMind — Google Sheets
SHEET_ID=                              # Google Sheet ID from the URL
GOOGLE_CRED_JSON=                      # path to service account JSON, or the JSON string

# CORS
CORS_ORIGINS=http://localhost:5173
```

If `SHEET_ID` / `GOOGLE_CRED_JSON` are missing, `/api/hire/log-to-sheets` logs to console and returns `"status": "mocked"` — nothing crashes.

---

## API endpoints

All return JSON that n8n can consume directly.

**Screen a candidate**
```
POST /api/hire/screen
Content-Type: multipart/form-data

Fields: job_description, resume_file (PDF), github_username (optional)
```

**Generate screening questions**
```
POST /api/hire/generate-questions
Content-Type: application/json

{ "resume_text": "...", "jd": "..." }
```

**Log to Google Sheets**
```
POST /api/hire/log-to-sheets
Content-Type: application/json

{ "name": "Jane Doe", "score": 82, "github_data": {}, "questions": [] }
```

---

## n8n automation

The workflow file is at `n8n/hiremind_workflow.json`. Import it in n8n via **Workflows → Import from File**.

**Flow:**
```
Google Drive Trigger
  → POST /api/hire/screen        (score, shortlist, skills)
  → POST /api/hire/generate-questions
  → POST /api/hire/log-to-sheets
  → IF shortlisted?
      YES → WhatsApp alert
      NO  → log and stop
```

---

## Making it fully end-to-end (what you still need to set up)

### 1. Google Cloud — service account for Sheets

- Go to [console.cloud.google.com](https://console.cloud.google.com)
- Create a project → enable **Google Sheets API** and **Google Drive API**
- IAM & Admin → Service Accounts → Create → download the JSON key
- Open your Google Sheet → Share → paste the service account email → Editor
- In `.env`: set `SHEET_ID` (from the sheet URL) and `GOOGLE_CRED_JSON` (path to the JSON file)

### 2. GitHub personal access token (optional but recommended)

- [github.com/settings/tokens](https://github.com/settings/tokens) → Generate new token (classic)
- No scopes needed — public repo access is enough
- Set `GITHUB_TOKEN=ghp_xxx` in `.env`
- Without this: 60 API calls/hr. With it: 5000/hr.

### 3. n8n — self-host or cloud

- Self-host: `docker run -it --rm --name n8n -p 5678:5678 n8nio/n8n`
- Or use [n8n.cloud](https://n8n.cloud) (free tier available)
- Import `n8n/hiremind_workflow.json`
- In the **Google Drive Trigger** node: connect your Google account, set the folder you want to watch
- In **Screen Candidate** node: update the URL from `localhost:8000` to your deployed backend URL
- In the **WhatsApp** node: replace the mock Code node with a real Twilio or 360dialog node

### 4. WhatsApp — Twilio or 360dialog

**Twilio:**
- Sign up at [twilio.com](https://twilio.com) → Sandbox for WhatsApp
- In n8n: add HTTP Request node → `POST https://api.twilio.com/2010-04-01/Accounts/{SID}/Messages.json`
- Auth: Basic (Account SID + Auth Token)
- Body: `From=whatsapp:+14155238886`, `To=whatsapp:+91XXXXXXXXXX`, `Body=<message>`

**360dialog** (cheaper, direct WhatsApp Business API):
- [360dialog.com](https://360dialog.com) → get API key
- n8n has a built-in 360dialog node

### 5. Deploy the backend

Cheapest options:
- **Railway** — connect GitHub repo, set env vars, done. ~$5/mo
- **Render** — free tier available, cold starts on free
- **Fly.io** — good free tier for FastAPI

Once deployed, update the URLs in the n8n workflow nodes.

### 6. Google Drive folder

- Create a folder in Drive called `Resumes` (or whatever)
- In the n8n Google Drive Trigger: select that folder
- Tell candidates to drop their PDF there, or forward WhatsApp resumes there manually / via Zapier

---

## Project structure

```
backend/
  main.py
  config.py
  routes/
    auth.py
    pdf.py
    ai.py
    quiz.py
  hire/
    routes.py             ← /api/hire/* endpoints
    github_service.py     ← GitHub API
    llm_service.py        ← Groq screening + questions
    sheets_service.py     ← Google Sheets logging
  services/
    ai_service.py         ← DocMind RAG, embeddings

frontend/src/
  pages/
    Hire.tsx              ← HireMind UI
    Workspace.tsx
  components/
    Sidebar.tsx

n8n/
  hiremind_workflow.json  ← import this into n8n
```
