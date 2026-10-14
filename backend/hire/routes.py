"""
HireMind - API Router
Provides endpoints for tech candidate screening automation.

Endpoints:
  POST /api/hire/screen              - Screen a candidate (resume PDF + JD + GitHub)
  POST /api/hire/generate-questions  - Generate custom technical screening questions
  POST /api/hire/log-to-sheets       - Log candidate result to Google Sheets

All responses are n8n-compatible JSON.
"""
import io
import json
import re
import secrets
from datetime import datetime, timedelta, timezone

from fastapi import APIRouter, File, Form, HTTPException, UploadFile
from pydantic import BaseModel
from pypdf import PdfReader

from hire.github_service import fetch_github_data
from hire.llm_service import screen_candidate, generate_screening_questions
from hire.sheets_service import log_candidate_to_sheets

router = APIRouter(prefix="/api/hire", tags=["HireMind"])


# ── Helper: Extract text from an in-memory PDF upload ─────────────────────────

def _extract_text_from_upload(file_bytes: bytes) -> str:
    """
    Extract text from PDF bytes using pypdf.
    Reuses the same approach as the existing ai_service._extract_text().
    """
    try:
        reader = PdfReader(io.BytesIO(file_bytes))
        pages = []
        for page in reader.pages:
            raw = page.extract_text() or ""
            normalized = re.sub(r"\s+", " ", raw).strip()
            if normalized:
                pages.append(normalized)
        return "\n\n".join(pages).strip()
    except Exception as e:
        raise ValueError(f"Failed to parse PDF: {e}")


# ── Schemas ────────────────────────────────────────────────────────────────────

class GenerateQuestionsIn(BaseModel):
    resume_text: str
    jd: str


from typing import Any


class LogToSheetsIn(BaseModel):
    name: str
    score: int
    github_data: dict = {}
    questions: list[Any] = []


# ── 1. POST /api/hire/screen ──────────────────────────────────────────────────

@router.post(
    "/screen",
    summary="Screen a tech candidate",
    description=(
        "Accepts a resume PDF, job description text, and optional GitHub username. "
        "Returns an AI-generated screening score (0-100), shortlist flag, "
        "skills found, and GitHub activity summary. n8n-compatible JSON output."
    ),
)
async def screen_endpoint(
    job_description: str = Form(..., description="Full job description text"),
    resume_file: UploadFile = File(..., description="Candidate's resume as PDF"),
    github_username: str = Form("", description="GitHub username (optional)"),
):
    """
    Screen a candidate against a job description.

    Steps:
    1. Extract text from uploaded resume PDF (reuses existing pypdf parser)
    2. Fetch GitHub profile + repo stats via GitHub API
    3. Call Groq llama-3.1-70b via LangChain to score the candidate
    4. Return structured JSON for use in n8n or frontend
    """
    # ── Validate inputs ────────────────────────────────────────────────────
    if not job_description or not job_description.strip():
        raise HTTPException(400, "job_description is required")

    if not resume_file.filename or not resume_file.filename.lower().endswith(".pdf"):
        raise HTTPException(400, "resume_file must be a PDF")

    # ── Step 1: Extract resume text ────────────────────────────────────────
    try:
        pdf_bytes = await resume_file.read()
        resume_text = _extract_text_from_upload(pdf_bytes)
    except ValueError as e:
        raise HTTPException(400, str(e))

    if not resume_text.strip():
        raise HTTPException(400, "Could not extract text from the resume PDF. Ensure it contains selectable text.")

    # ── Step 2: Fetch GitHub data ──────────────────────────────────────────
    github_data = {}
    if github_username and github_username.strip():
        github_data = fetch_github_data(github_username.strip())
        # Don't fail the whole request if GitHub is unavailable
        if github_data.get("error"):
            print(f"[HireMind] GitHub warning: {github_data['error']}")

    # ── Step 3: AI screening via Groq ────────────────────────────────────
    try:
        screening_result = screen_candidate(
            jd=job_description.strip(),
            resume_text=resume_text,
            github_data=github_data,
        )
    except Exception as e:
        raise HTTPException(500, f"AI screening failed: {e}")

    # ── Step 4: Return n8n-compatible JSON ───────────────────────────────
    return {
        "status": "success",
        "candidate": {
            "resume_file": resume_file.filename,
            "github_username": github_username or None,
        },
        "screening": {
            "score": screening_result.get("score", 0),
            "reason": screening_result.get("reason", ""),
            "shortlist": screening_result.get("shortlist", False),
            "skills_found": screening_result.get("skills_found", []),
            "github_highlights": screening_result.get("github_highlights", ""),
            "recommendation": screening_result.get("recommendation", ""),
        },
        "github_data": github_data,
        # Pass-through for n8n chaining
        "resume_text_preview": resume_text[:500],
    }


# ── 2. POST /api/hire/generate-questions ──────────────────────────────────────

@router.post(
    "/generate-questions",
    summary="Generate custom technical screening questions",
    description=(
        "Generates 3 highly specific technical screening questions grounded in the "
        "candidate's actual projects and the job requirements. Not generic — references "
        "real project names, tools, and decisions from the resume."
    ),
)
async def generate_questions_endpoint(body: GenerateQuestionsIn):
    """
    Generate 3 custom technical questions based on candidate resume + JD.

    Steps:
    1. Validate resume_text and jd are provided
    2. Call Groq llama-3.1-70b to generate project-specific questions
    3. Return JSON array of {question, topic, difficulty}
    """
    if not body.resume_text or not body.resume_text.strip():
        raise HTTPException(400, "resume_text is required")
    if not body.jd or not body.jd.strip():
        raise HTTPException(400, "jd (job description) is required")

    try:
        questions = generate_screening_questions(
            resume_text=body.resume_text.strip(),
            jd=body.jd.strip(),
        )
    except Exception as e:
        raise HTTPException(500, f"Question generation failed: {e}")

    return {
        "status": "success",
        "questions": questions,
        "count": len(questions),
    }


# ── 3. POST /api/hire/log-to-sheets ──────────────────────────────────────────

@router.post(
    "/log-to-sheets",
    summary="Log candidate result to Google Sheets",
    description=(
        "Appends a candidate screening row to a configured Google Sheet. "
        "If SHEET_ID or GOOGLE_CRED_JSON are not set in .env, performs a mock "
        "console log and returns status='mocked'. n8n-compatible."
    ),
)
async def log_to_sheets_endpoint(body: LogToSheetsIn):
    """
    Log candidate screening result to Google Sheets.

    Steps:
    1. Check for SHEET_ID + GOOGLE_CRED_JSON env vars
    2. If present: append real row via gspread
    3. If absent: mock log to console, return status='mocked'
    """
    if not body.name or not body.name.strip():
        raise HTTPException(400, "name is required")
    if not (0 <= body.score <= 100):
        raise HTTPException(400, "score must be between 0 and 100")

    result = log_candidate_to_sheets(
        name=body.name.strip(),
        score=body.score,
        github_data=body.github_data,
        questions=body.questions,
    )

    return {
        "status": result["status"],
        "message": result["message"],
        # Include row for n8n downstream nodes
        "logged_row": result.get("row", []),
    }


# ── 4. Shareable Time-Bound Candidate Evaluations ─────────────────────────────

SHARED_EVALS: dict[str, dict] = {}


class CreateShareEvalIn(BaseModel):
    candidate: dict
    duration_minutes: int = 30


@router.post(
    "/create-share-eval",
    summary="Create a secure, time-bound shareable candidate evaluation report",
)
def create_share_eval_endpoint(body: CreateShareEvalIn):
    """
    Creates a temporary shareable candidate assessment link that auto-expires
    (default: 30 minutes) for hiring managers and team members.
    """
    eval_id = secrets.token_urlsafe(12)
    duration = max(5, min(body.duration_minutes, 1440))  # between 5 min and 24 hours
    expires_at = datetime.now(timezone.utc) + timedelta(minutes=duration)

    doc = {
        "eval_id": eval_id,
        "candidate": body.candidate,
        "duration_minutes": duration,
        "created_at": datetime.now(timezone.utc).isoformat(),
        "expires_at": expires_at.isoformat(),
        "expires_at_epoch": int(expires_at.timestamp()),
    }
    SHARED_EVALS[eval_id] = doc

    return {
        "status": "success",
        "eval_id": eval_id,
        "duration_minutes": duration,
        "expires_at": expires_at.isoformat(),
        "expires_at_epoch": int(expires_at.timestamp()),
    }


@router.get(
    "/shared-eval/{eval_id}",
    summary="Retrieve shared candidate evaluation if not expired",
)
def get_shared_eval_endpoint(eval_id: str):
    """
    Retrieves the shared candidate evaluation if within the active window (e.g., 30 min).
    Returns expired status if the time window has passed.
    """
    doc = SHARED_EVALS.get(eval_id)
    if not doc:
        raise HTTPException(404, "Evaluation report not found or link has expired.")

    now_epoch = int(datetime.now(timezone.utc).timestamp())
    expires_at_epoch = doc.get("expires_at_epoch", 0)

    if now_epoch > expires_at_epoch:
        return {
            "expired": True,
            "message": f"This screening assessment expired after {doc.get('duration_minutes', 30)} minutes.",
        }

    return {
        "expired": False,
        "candidate": doc["candidate"],
        "duration_minutes": doc.get("duration_minutes", 30),
        "expires_at": doc["expires_at"],
        "seconds_remaining": max(0, expires_at_epoch - now_epoch),
    }
