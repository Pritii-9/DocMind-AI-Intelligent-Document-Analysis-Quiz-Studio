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
from typing import Any, Dict, List, Optional

from fastapi import APIRouter, File, Form, HTTPException, UploadFile
from pydantic import BaseModel
from pypdf import PdfReader

from config import settings
from database import get_db
from hire.email_service import notify_shortlisted_candidate, send_email_sync
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
    candidate_name: str = Form("", description="Candidate name (optional)"),
    candidate_email: str = Form("", description="Candidate email (optional)"),
    role_title: str = Form("", description="Role title (optional)"),
    send_email: bool = Form(True, description="Send automated shortlist emails if score >= 70"),
):
    """
    Screen a candidate against a job description.

    Steps:
    1. Extract text from uploaded resume PDF (reuses existing pypdf parser)
    2. Fetch GitHub profile + repo stats via GitHub API
    3. Call Groq llama-3.1-70b via LangChain to score the candidate
    4. Auto-detect candidate email and name if not supplied
    5. Trigger automated shortlist emails (to candidate & recruiter) if score >= 70
    6. Return structured JSON for use in n8n or frontend
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

    # ── Step 4: Extract Candidate Identity & Handle Shortlist Notification ──
    extracted_email = (candidate_email or "").strip()
    if not extracted_email:
        email_match = re.search(r"[a-zA-Z0-9_.+-]+@[a-zA-Z0-9-]+\.[a-zA-Z0-9-.]+", resume_text)
        if email_match:
            extracted_email = email_match.group(0).strip()

    extracted_name = (candidate_name or "").strip()
    if not extracted_name:
        lines = [line.strip() for line in resume_text.splitlines() if line.strip()]
        first_line = lines[0] if lines else ""
        if 2 <= len(first_line) <= 40 and not any(c in first_line for c in ["@", "http", "/", "\\", "{", "}"]):
            extracted_name = first_line.title()
        else:
            base = resume_file.filename.replace(".pdf", "").replace(".PDF", "")
            clean = re.sub(r"[-_]+", " ", base)
            extracted_name = clean.title()

    role_name = (role_title or "").strip() or "Software Engineer"
    is_shortlisted = bool(screening_result.get("shortlist", False) or screening_result.get("score", 0) >= 70)

    # Automatically generate 24h evaluation record
    eval_id = secrets.token_urlsafe(12)
    duration = 1440  # 24 hours
    expires_at = datetime.now(timezone.utc) + timedelta(minutes=duration)

    candidate_doc = {
        "name": extracted_name,
        "email": extracted_email,
        "role": role_name,
        "score": screening_result.get("score", 0),
        "shortlist": is_shortlisted,
        "recommendation": screening_result.get("recommendation", "Hire"),
        "reason": screening_result.get("reason", ""),
        "skills": screening_result.get("skills_found", []),
        "experience_check": screening_result.get("experience_check"),
        "what_they_want": screening_result.get("what_they_want"),
        "what_candidate_has": screening_result.get("what_candidate_has"),
        "requirements_breakdown": screening_result.get("requirements_breakdown"),
        "github_data": github_data,
        "appliedAt": datetime.now(timezone.utc).isoformat(),
    }

    SHARED_EVALS[eval_id] = {
        "eval_id": eval_id,
        "candidate": candidate_doc,
        "duration_minutes": duration,
        "created_at": datetime.now(timezone.utc).isoformat(),
        "expires_at": expires_at.isoformat(),
        "expires_at_epoch": int(expires_at.timestamp()),
    }

    try:
        db = get_db()
        db.shared_evals.insert_one({
            "id": eval_id,
            "candidate": candidate_doc,
            "duration_minutes": duration,
            "created_at": datetime.now(timezone.utc),
            "expires_at": expires_at,
            "expires_at_epoch": int(expires_at.timestamp()),
        })
    except Exception as db_err:
        print(f"[HireMind] DB save eval warning: {db_err}")

    share_url = f"https://hiremind-ai-gules.vercel.app/eval?id={eval_id}"

    email_notification = {"sent": False, "recipients": []}
    if send_email and is_shortlisted:
        notify_res = notify_shortlisted_candidate(
            candidate_name=extracted_name,
            candidate_email=extracted_email,
            role_title=role_name,
            score=screening_result.get("score", 0),
            recommendation=screening_result.get("recommendation", "Strong Fit"),
            share_url=share_url,
            what_candidate_has=screening_result.get("what_candidate_has") or screening_result.get("reason", ""),
            recruiter_email=settings.MAIL_USERNAME,
        )
        email_notification = {
            "sent": True,
            "candidate_email": extracted_email or None,
            "recruiter_email": settings.MAIL_USERNAME,
            "share_url": share_url,
        }

    # ── Step 5: Return n8n & frontend-compatible JSON ───────────────────
    return {
        "status": "success",
        "candidate": {
            "name": extracted_name,
            "email": extracted_email,
            "resume_file": resume_file.filename,
            "github_username": github_username or None,
        },
        "screening": {
            "score": screening_result.get("score", 0),
            "reason": screening_result.get("reason", ""),
            "shortlist": is_shortlisted,
            "skills_found": screening_result.get("skills_found", []),
            "github_highlights": screening_result.get("github_highlights", ""),
            "recommendation": screening_result.get("recommendation", ""),
            "experience_check": screening_result.get("experience_check"),
            "what_they_want": screening_result.get("what_they_want"),
            "what_candidate_has": screening_result.get("what_candidate_has"),
            "requirements_breakdown": screening_result.get("requirements_breakdown"),
            "short_circuited": screening_result.get("short_circuited", False),
            "fast_fail_reason": screening_result.get("fast_fail_reason"),
        },
        "github_data": github_data,
        "eval_id": eval_id,
        "share_url": share_url,
        "email_notification": email_notification,
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
    duration_minutes: int = 1440


@router.post(
    "/create-share-eval",
    summary="Create a secure, time-bound shareable candidate evaluation report",
)
def create_share_eval_endpoint(body: CreateShareEvalIn):
    """
    Creates a temporary shareable candidate assessment link that auto-expires
    (standard: 24 hours) for hiring managers and team members.
    Persists to both in-memory cache and PostgreSQL.
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

    try:
        db = get_db()
        db.shared_evals.insert_one({
            "id": eval_id,
            "candidate": body.candidate,
            "duration_minutes": duration,
            "created_at": datetime.now(timezone.utc),
            "expires_at": expires_at,
            "expires_at_epoch": int(expires_at.timestamp()),
        })
    except Exception as e:
        print(f"[HireMind] Warning: could not persist eval to DB: {e}")

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
    Retrieves the shared candidate evaluation if within the active window (24 hours).
    Checks in-memory cache first, falls back to PostgreSQL database.
    """
    doc = SHARED_EVALS.get(eval_id)
    if not doc:
        try:
            db = get_db()
            db_row = db.shared_evals.find_one({"id": eval_id})
            if db_row:
                doc = {
                    "eval_id": eval_id,
                    "candidate": db_row.get("candidate", {}),
                    "duration_minutes": db_row.get("duration_minutes", 1440),
                    "created_at": str(db_row.get("created_at", "")),
                    "expires_at": str(db_row.get("expires_at", "")),
                    "expires_at_epoch": int(db_row.get("expires_at_epoch", 0)),
                }
                SHARED_EVALS[eval_id] = doc
        except Exception as e:
            print(f"[HireMind] DB lookup error for eval {eval_id}: {e}")

    if not doc:
        raise HTTPException(404, "Evaluation report not found or link has expired.")

    now_epoch = int(datetime.now(timezone.utc).timestamp())
    expires_at_epoch = doc.get("expires_at_epoch", 0)

    if now_epoch > expires_at_epoch:
        return {
            "expired": True,
            "message": f"This screening assessment expired after {doc.get('duration_minutes', 1440)} minutes.",
        }

    return {
        "expired": False,
        "candidate": doc["candidate"],
        "duration_minutes": doc.get("duration_minutes", 1440),
        "expires_at": doc["expires_at"],
        "seconds_remaining": max(0, expires_at_epoch - now_epoch),
    }


# ── 5. Email Notification Endpoints ───────────────────────────────────────────

class SendShortlistEmailIn(BaseModel):
    candidate_name: str
    candidate_email: str
    role_title: str = "Software Engineer"
    score: int
    recommendation: str = "Strong Fit"
    share_url: str
    what_candidate_has: str = ""
    recruiter_email: Optional[str] = None


@router.post(
    "/send-shortlist-email",
    summary="Send or resend candidate shortlist email and hiring team notification",
)
def send_shortlist_email_endpoint(body: SendShortlistEmailIn):
    """
    Manually or programmatically triggers the shortlist email notification
    to the candidate and hiring team.
    """
    res = notify_shortlisted_candidate(
        candidate_name=body.candidate_name,
        candidate_email=body.candidate_email,
        role_title=body.role_title,
        score=body.score,
        recommendation=body.recommendation,
        share_url=body.share_url,
        what_candidate_has=body.what_candidate_has,
        recruiter_email=body.recruiter_email or settings.MAIL_USERNAME,
    )
    return {"status": "success", "detail": res}


class TestEmailIn(BaseModel):
    to_email: Optional[str] = None


@router.post(
    "/test-email",
    summary="Verify SMTP email delivery",
)
def test_email_endpoint(body: TestEmailIn):
    """
    Sends a test verification email to confirm that the SMTP server and credentials work.
    """
    target = body.to_email or settings.MAIL_USERNAME
    if not target:
        raise HTTPException(400, "No email address provided and MAIL_USERNAME is empty.")

    res = send_email_sync(
        to_emails=[target],
        subject="✅ HireMind AI - Mail System Verified",
        body_text="Your HireMind AI automated email notification system is working properly!",
        body_html="""
        <div style="font-family: -apple-system, BlinkMacSystemFont, sans-serif; padding: 24px; border: 1px solid #e2e8f0; border-radius: 10px; max-width: 500px; margin: 0 auto; background: #ffffff;">
            <div style="display: inline-block; background: #ecfdf5; border: 1px solid #a7f3d0; color: #047857; font-size: 12px; font-weight: 700; padding: 4px 10px; border-radius: 12px; margin-bottom: 12px;">
                ● LIVE SYSTEM CHECK
            </div>
            <h2 style="color: #0f172a; margin: 0 0 10px; font-size: 18px;">HireMind AI Mail System Operational</h2>
            <p style="color: #334155; font-size: 14px; line-height: 1.5;">Candidate shortlisting email notifications and recruiter alerts are fully configured and functioning.</p>
            <div style="background: #f8fafc; border: 1px solid #e2e8f0; padding: 10px 14px; border-radius: 6px; font-size: 12px; color: #64748b; margin-top: 16px;">
                SMTP Server: <strong>smtp.gmail.com:587 (TLS Active)</strong>
            </div>
        </div>
        """,
    )
    return {"status": res.get("status"), "message": res.get("message"), "target": target}

