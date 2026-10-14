# 🚀 HireMind AI — Autonomous Tech Hiring Agent for Startups

> **AI-Powered Technical Candidate Screening, GitHub Activity Verification, and Dynamic Interview Question Generation.**
> Eliminates 80% of recruiter screening time by automating resume ingestion, technical scoring, Google Sheets CRM logging, and instant executive briefing alerts.

---

## 💡 Why HireMind?

Traditional Applicant Tracking Systems (ATS) rely on dumb keyword matching. Candidates who keyword-stuff "Python" get through, while exceptional builders get filtered out. Meanwhile, startup founders and hiring managers spend 15+ hours a week manually reviewing resumes, browsing GitHub profiles, and guessing what technical questions to ask.

**HireMind solves this end-to-end:**
1. **Multi-Job Ingestion:** Candidates apply via a shareable public careers portal (`/apply`) or recruiters drop resumes in bulk into Google Drive.
2. **Multi-Modal Evaluation:** In under 2 seconds, HireMind extracts the resume text in-memory, queries the candidate's GitHub API profile for real commit activity and language distribution, and scores them 0–100 against the exact role requirements using Groq LPU inference.
3. **Cheat-Proof Technical Questions:** Generates 3 custom technical interview questions tied to the candidate's *actual projects*—giving interviewers a ready-made interview cheat-sheet.
4. **Autonomous CRM Logging & Executive Alerts:** Logs every candidate into Google Sheets via Google Cloud Service Accounts and dispatches real-time briefing emails to the engineering lead for shortlisted talent (Score ≥ 70).

---

## 🛠️ Tech Stack & Infrastructure

- **Backend:** FastAPI (Python 3.11/3.13), Pydantic v2, `pypdf`, `httpx`
- **AI / LLM Inference:** Groq LPU Hardware (`openai/gpt-oss-120b`, `llama-3.3-70b-versatile`) with automatic multi-model fallback cascade
- **Developer Verification:** GitHub REST API (evaluates repo depth, language breakdown, commit activity)
- **Database / Vector Search:** PostgreSQL + `pgvector` (Neon Serverless)
- **Cloud CRM & Storage:** Google Cloud Service Account (OAuth2 Drive & Sheets API via `gspread`), AWS S3
- **Automation Orchestration:** Make.com (24/7 Cloud Event Trigger) & n8n (`n8n/hiremind_workflow.json`)
- **Notifications:** Gmail SMTP / Twilio WhatsApp API
- **Frontend:** React 19, TypeScript, Tailwind CSS, Vite, Lucide Icons

---

## ⚡ What HireMind Offers

| Feature | Description |
| :--- | :--- |
| **Candidate Pipeline (ATS)** | Unified recruiter dashboard displaying candidate match scores (0–100), shortlisted status, GitHub breakdown, and expandable technical questions. |
| **Job Openings Manager** | Pre-loaded startup role requisitions (Backend, Full-Stack, AI/LLM, DevOps). Create and manage custom roles with 1-click apply links. |
| **1-Click Quick Screen** | Recruiter tool to evaluate ad-hoc resumes received via email or referral. Select any open role from a dropdown to auto-fill the JD. |
| **Public Apply Portal (`/apply`)** | Clean, shareable public link for candidates to view open positions, upload resume PDFs, and submit GitHub links without needing a login. |
| **GitHub Deep Verification** | Checks public repo count, follower validation, top languages, and commit timestamps to weed out fake resumes. |
| **Dynamic Question Generator** | Synthesizes 3 project-specific technical questions (with difficulty tags & topics) tailored specifically to the candidate's resume claims. |
| **Autonomous Google Sheets CRM** | Auto-appends every candidate record (timestamp, score, GitHub link, questions) directly into a shared Google Sheet. |
| **Cloud Event-Driven Ingestion** | Connects to Google Drive folders via Make.com or n8n to ingest and process dozens of resumes automatically. |

---

## 🏗️ System Architecture

```
[Candidate via /apply Link]      [Bulk Drops in Google Drive]
           │                                 │
           │                                 ▼
           │                      [Make.com / n8n Trigger]
           │                                 │
           └────────────────►┬───────────────┘
                             ▼
              [FastAPI Backend (/api/hire)]
                             │
       ┌─────────────────────┼─────────────────────┐
       ▼                     ▼                     ▼
[In-Memory PDF]       [GitHub REST API]     [Groq LPU LLM]
Extracts raw text      Fetches repos &       Evaluates candidate &
without S3 delay      language breakdown    generates questions
       │                     │                     │
       └─────────────────────┼─────────────────────┘
                             ▼
                 [Score & Decision Engine]
                             │
           ┌─────────────────┴─────────────────┐
           ▼                                   ▼
[Google Sheets CRM Sync]            [Score ≥ 70 Shortlist Filter]
(OAuth2 Service Account)                       │
                                               ▼
                                    [Executive Briefing Email]
                                    Dispatched to Hiring Manager
```

---

## 🚀 Quickstart Guide

### 1. Backend Setup

```bash
cd backend
python -m venv venv
# Windows:
venv\Scripts\activate
# Linux/Mac:
source venv/bin/activate

pip install -r requirements.txt
```

Create `backend/.env` with your API keys:

```env
# Server
PORT=8000

# Groq LLM (Required)
GROQ_API_KEY=gsk_your_groq_api_key

# GitHub Token (Optional - increases rate limit from 60 to 5000/hr)
GITHUB_TOKEN=ghp_your_github_token

# Google Sheets CRM (Service Account)
GOOGLE_CRED_JSON=secrets/google_creds.json
SHEET_ID=your_google_sheet_id_here

# Email Notifications (Gmail SMTP)
MAIL_SERVER=smtp.gmail.com
MAIL_PORT=587
MAIL_USE_TLS=True
MAIL_USERNAME=your_email@gmail.com
MAIL_PASSWORD=your_gmail_app_password

# Database (PostgreSQL with pgvector)
DATABASE_URL=postgresql://...

# CORS
CORS_ORIGINS=http://localhost:5173
```

Start the FastAPI backend:
```bash
python -m uvicorn main:app --reload --host 127.0.0.1 --port 8000
```
Swagger API Documentation: `http://127.0.0.1:8000/docs`

---

### 2. Frontend Setup

```bash
cd frontend
npm install
npm run dev
```

- **Recruiter Workspace:** Open `http://localhost:5173`
- **Candidate Public Apply Page:** Open `http://localhost:5173/apply`

---

### 3. Google Sheets CRM Integration Setup

1. Open [Google Sheets](https://sheets.new) and create a sheet named **HireMind Candidates**.
2. Add Row 1 headers:
   `Timestamp | Name | Score | GitHub | Languages | Questions`
3. In Google Cloud Console, create a Service Account, download the JSON key, save it at `backend/secrets/google_creds.json`.
4. Share the spreadsheet with your service account email (`...@...iam.gserviceaccount.com`) as **Editor**.
5. Copy the sheet ID from the URL (`https://docs.google.com/spreadsheets/d/SHEET_ID/edit`) and paste it as `SHEET_ID` in `backend/.env`.

---

### 4. Cloud Automation (Make.com & n8n)

#### Make.com (Recommended for Cloud):
1. Create a free scenario on [Make.com](https://make.com).
2. Set up the pipeline:
   - **Google Drive:** Watch Files in `Resumes` folder $\rightarrow$ Download File.
   - **HTTP POST:** Call `/api/hire/screen` (multipart/form-data).
   - **HTTP POST:** Call `/api/hire/generate-questions` (JSON).
   - **HTTP POST:** Call `/api/hire/log-to-sheets` (JSON).
   - **Router:** If `score >= 70` $\rightarrow$ **Gmail Send Email** (dispatches executive candidate briefing).

#### n8n (For Self-Hosters):
- Import `n8n/hiremind_workflow.json` via **Workflows → Import from File**.
- Connect your Google Drive trigger folder and point HTTP nodes to your backend domain.

---

## 📡 REST API Reference

All endpoints return n8n/Make.com-compatible JSON:

### `POST /api/hire/screen`
- **Type:** `multipart/form-data`
- **Params:** `job_description` (str), `resume_file` (PDF file), `github_username` (str, optional)
- **Response:**
```json
{
  "status": "success",
  "candidate": { "resume_file": "resume.pdf", "github_username": "octocat" },
  "screening": {
    "score": 85,
    "reason": "Strong experience with FastAPI and PostgreSQL.",
    "shortlist": true,
    "skills_found": ["Python", "FastAPI", "React", "Docker"],
    "recommendation": "Hire"
  },
  "github_data": {
    "public_repos": 34,
    "followers": 120,
    "top_languages": ["Python", "TypeScript"],
    "profile_url": "https://github.com/octocat"
  },
  "resume_text_preview": "..."
}
```

### `POST /api/hire/generate-questions`
- **Type:** `application/json`
- **Body:** `{ "resume_text": "...", "jd": "..." }`
- **Response:**
```json
{
  "status": "success",
  "count": 3,
  "questions": [
    {
      "question": "In your RAG system, how did you optimize cosine similarity search query performance with pgvector?",
      "topic": "Database Architecture",
      "difficulty": "Hard"
    }
  ]
}
```

### `POST /api/hire/log-to-sheets`
- **Type:** `application/json`
- **Body:** `{ "name": "Alex Morgan", "score": 85, "github_data": {...}, "questions": [...] }`
- **Response:**
```json
{
  "status": "logged",
  "message": "Candidate 'Alex Morgan' logged to Google Sheet.",
  "logged_row": ["2026-10-14 10:00:00 UTC", "Alex Morgan", 85, "https://github.com/alex", "Python, React", "..."]
}
```

---

## 🔒 Security & Privacy

- Resume parsing is handled in-memory (`pypdf`); files are not permanently stored on disk unless explicitly ingested into S3.
- Service account credentials in `backend/secrets/` and local `.env` files are strictly gitignored.
- Public candidate apply route operates without exposing administrative or recruiter authentication tokens.

---

## 📄 License

MIT License. Designed and engineered for high-velocity startup recruitment.
