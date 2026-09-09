"""Quiz router — generate MCQs from PDF, store, retrieve, save notes."""
import json
import uuid
from datetime import datetime, timezone

from bson import ObjectId
from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel

from auth_utils import get_current_user, workspace_owner as get_ws
from database import get_db
from services.ai_service import _chat, _extract_text

router = APIRouter(prefix="/quiz", tags=["quiz"])

QUIZ_PROMPT = """You are an expert quiz creator. Based on the text below, create exactly {n} high-quality multiple-choice questions (MCQs) for a student studying this topic.

Rules:
- Each question must test understanding, not just memorization
- 4 options per question (A, B, C, D)
- Only one correct answer
- Explanation must be 2-3 sentences explaining WHY the answer is correct
- Return ONLY valid JSON, no extra text

Return this exact JSON structure:
{{
  "topic": "<inferred topic title>",
  "questions": [
    {{
      "id": "<unique_id>",
      "question": "<question text>",
      "options": {{
        "A": "<option A>",
        "B": "<option B>",
        "C": "<option C>",
        "D": "<option D>"
      }},
      "correct": "<A|B|C|D>",
      "explanation": "<explanation of why the answer is correct>"
    }}
  ]
}}

PDF TEXT:
{text}
"""


def _generate_mcqs(text: str, count: int = 10) -> dict:
    """Call Groq to generate MCQs from text. Returns parsed dict."""
    # Use first 6000 chars to stay within context limits
    excerpt = text[:6000].strip()
    prompt = QUIZ_PROMPT.format(n=count, text=excerpt)

    raw = _chat(
        [
            {"role": "system", "content": "You are a quiz generator. Always respond with valid JSON only. No markdown code blocks."},
            {"role": "user", "content": prompt},
        ],
        temperature=0.4,
    )

    # Strip any accidental markdown fences
    raw = raw.strip()
    if raw.startswith("```"):
        raw = raw.split("```")[1]
        if raw.startswith("json"):
            raw = raw[4:]
    raw = raw.strip().rstrip("`").strip()

    return json.loads(raw)


# ── Schemas ────────────────────────────────────────────────────────────────────

class GenerateQuizIn(BaseModel):
    doc_id: str
    count: int = 10  # number of MCQs


class SaveNoteIn(BaseModel):
    question_id: str
    note: str


# ── Routes ────────────────────────────────────────────────────────────────────

@router.post("/generate")
def generate_quiz(body: GenerateQuizIn, user: dict = Depends(get_current_user)):
    if not ObjectId.is_valid(body.doc_id):
        raise HTTPException(400, "Invalid document id")
    if not (5 <= body.count <= 20):
        raise HTTPException(400, "count must be between 5 and 20")

    owner = get_ws(user)
    db = get_db()

    doc = db.pdfs.find_one({"_id": ObjectId(body.doc_id), "workspace_owner": owner})
    if not doc:
        raise HTTPException(404, "Document not found")

    # Extract text from S3 PDF
    try:
        text = _extract_text(doc["key"])
    except Exception as e:
        raise HTTPException(500, f"Could not read PDF: {e}")

    if not text.strip():
        raise HTTPException(400, "PDF has no extractable text")

    # Generate MCQs via Groq
    try:
        result = _generate_mcqs(text, count=body.count)
    except json.JSONDecodeError as e:
        raise HTTPException(500, f"LLM returned invalid JSON: {e}")
    except Exception as e:
        raise HTTPException(500, f"Quiz generation failed: {e}")

    # Add stable IDs and empty user_note to each question
    now = datetime.now(timezone.utc)
    questions = []
    for q in result.get("questions", []):
        questions.append({
            "id": q.get("id") or str(uuid.uuid4())[:8],
            "question": q["question"],
            "options": q["options"],
            "correct": q["correct"],
            "explanation": q["explanation"],
            "user_note": "",
        })

    quiz_doc = {
        "workspace_owner": owner,
        "document_id": ObjectId(body.doc_id),
        "document_name": doc.get("filename", ""),
        "topic": result.get("topic", doc.get("filename", "Quiz")),
        "questions": questions,
        "created_at": now,
    }

    insert = db.quizzes.insert_one(quiz_doc)
    quiz_doc["_id"] = str(insert.inserted_id)
    quiz_doc["document_id"] = str(quiz_doc["document_id"])
    quiz_doc["created_at"] = now.isoformat()
    return quiz_doc


@router.get("/list")
def list_quizzes(user: dict = Depends(get_current_user)):
    db = get_db()
    owner = get_ws(user)
    docs = list(
        db.quizzes.find({"workspace_owner": owner}, {"questions": 0})
        .sort("created_at", -1)
    )
    for d in docs:
        d["_id"] = str(d["_id"])
        d["document_id"] = str(d.get("document_id", ""))
        d["question_count"] = d.pop("question_count", 0)
        if d.get("created_at"):
            d["created_at"] = d["created_at"].isoformat()
    return docs


@router.get("/{quiz_id}")
def get_quiz(quiz_id: str, user: dict = Depends(get_current_user)):
    if not ObjectId.is_valid(quiz_id):
        raise HTTPException(400, "Invalid quiz id")
    db = get_db()
    doc = db.quizzes.find_one({"_id": ObjectId(quiz_id), "workspace_owner": get_ws(user)})
    if not doc:
        raise HTTPException(404, "Quiz not found")
    doc["_id"] = str(doc["_id"])
    doc["document_id"] = str(doc.get("document_id", ""))
    if doc.get("created_at"):
        doc["created_at"] = doc["created_at"].isoformat()
    return doc


@router.patch("/{quiz_id}/note")
def save_note(quiz_id: str, body: SaveNoteIn, user: dict = Depends(get_current_user)):
    if not ObjectId.is_valid(quiz_id):
        raise HTTPException(400, "Invalid quiz id")
    db = get_db()
    result = db.quizzes.update_one(
        {"_id": ObjectId(quiz_id), "workspace_owner": get_ws(user), "questions.id": body.question_id},
        {"$set": {"questions.$.user_note": body.note}},
    )
    if result.matched_count == 0:
        raise HTTPException(404, "Quiz or question not found")
    return {"msg": "Note saved"}


@router.delete("/{quiz_id}")
def delete_quiz(quiz_id: str, user: dict = Depends(get_current_user)):
    if not ObjectId.is_valid(quiz_id):
        raise HTTPException(400, "Invalid quiz id")
    db = get_db()
    db.quizzes.delete_one({"_id": ObjectId(quiz_id), "workspace_owner": get_ws(user)})
    return {"msg": "Quiz deleted"}
