# DocStream AI — Enterprise Document Intelligence & Assessment Platform (v2)

## Project Description
A full-stack, enterprise-grade document intelligence and interactive assessment platform. Upload PDFs to AWS S3, stream them with zero-copy byte-range requests, generate AI Mock Test Quizzes via Groq LLMs, chat with documents using LangChain RAG, and manage team access control with JWT authentication.

---

## Tech Stack

| Layer        | Technologies |
|--------------|-------------|
| **Frontend** | React 19, TypeScript, Vite, Vanilla CSS, Axios, Lucide Icons |
| **Backend**  | Python 3.10+, **FastAPI**, Uvicorn, python-jose (JWT), passlib (bcrypt) |
| **Database** | MongoDB Atlas (documents, users, embeddings) |
| **Storage**  | AWS S3 (multipart upload, byte-range streaming) |
| **AI / RAG** | LangChain + LangChain-Groq + fastembed (`BAAI/bge-small-en-v1.5`) |
| **DevOps**   | Docker, Docker Compose, Poetry |

---

## Simple Workflow

```
1. Register / Login  →  JWT issued
2. Upload PDF        →  Multipart → AWS S3 → auto-indexed by LangChain
3. View PDF          →  Byte-range streamed from S3 via authenticated endpoint
4. Chat with PDF     →  fastembed query → cosine search → Groq LLM answer
5. Team management   →  Admin invites members via 6-char code + email
```

---

## API Endpoints

| Method | Path | Description |
|--------|------|-------------|
| POST | `/auth/start-signup` | Send OTP to email |
| POST | `/auth/complete-signup` | Verify OTP, set password |
| POST | `/auth/login` | Returns JWT |
| POST | `/auth/forgot-password` | Send reset code |
| POST | `/auth/reset-password` | Update password |
| GET  | `/auth/me` | Current user info |
| PATCH| `/auth/update-profile` | Update user display name |
| GET  | `/auth/users` | List workspace members (admin) |
| POST | `/auth/invite-member` | Invite via email (admin) |
| POST | `/auth/verify-invite` | Activate invited account |
| POST | `/auth/users/{id}/status` | Toggle active/inactive (admin) |
| POST | `/pdf/init-upload` | Start S3 multipart |
| POST | `/pdf/upload-part` | Upload a file chunk |
| POST | `/pdf/complete-upload` | Finalize upload + trigger AI ingest |
| GET  | `/pdf/library` | List all workspace PDFs |
| GET  | `/pdf/overview` | Dashboard stats + activity |
| GET  | `/pdf/stream/{filename}` | Byte-range stream from S3 |
| DELETE | `/pdf/delete/{id}` | Delete PDF from S3 + DB |
| POST | `/ai/ingest/{doc_id}` | Index PDF for RAG |
| POST | `/ai/chat` | LangChain RAG Q&A |
| POST | `/quiz/generate` | Generate MCQs with pre-computed explanations |
| GET  | `/quiz/list` | List practice quiz sets |
| POST | `/quiz/{id}/score` | Save quiz score attempt |
| PATCH| `/quiz/{id}/note` | Save question study note |
| GET  | `/health` | Health check |

---

## What Was Removed (v2 Simplification)

| Removed | Why |
|---------|-----|
| **Flask** → FastAPI | Cleaner async, native Pydantic, auto Swagger docs |
| **LangGraph** agent | Too complex for a fresher portfolio; no clear benefit over simple RAG |
| **SSE / real-time events** | Complexity without value at this scale |
| **gunicorn + eventlet** | Uvicorn handles async natively |
| **agent_tools.py** | LangGraph dependency |
| **flask-jwt-extended** | Replaced with python-jose + FastAPI Depends |

---

## Running Locally

```bash
# Backend
cd backend
poetry install
uvicorn main:app --reload --port 8000

# Frontend
cd frontend
npm install
npm run dev
```