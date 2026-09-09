"""AI router — ingest PDF, chat with PDF."""
from bson import ObjectId
from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel

from auth_utils import get_current_user
from database import get_db
from services.ai_service import build_rag_answer, embed_texts, maybe_ingest, search_chunks

router = APIRouter(prefix="/ai", tags=["ai"])


def _workspace_owner(user: dict) -> str:
    return user.get("workspace_owner") or user["sub"]


class ChatIn(BaseModel):
    message: str
    doc_id: str | None = None


@router.post("/ingest/{document_id}")
def ingest(document_id: str, user: dict = Depends(get_current_user)):
    if not ObjectId.is_valid(document_id):
        raise HTTPException(400, "Invalid document id")
    try:
        result = maybe_ingest(_workspace_owner(user), document_id)
        return {"msg": "Document indexed", **result}
    except ValueError as e:
        raise HTTPException(404, str(e))
    except Exception as e:
        raise HTTPException(500, str(e))


@router.post("/chat")
def chat(body: ChatIn, user: dict = Depends(get_current_user)):
    if not body.message.strip():
        raise HTTPException(400, "message is required")

    owner = _workspace_owner(user)
    db = get_db()

    # Resolve document if provided
    document_key = None
    if body.doc_id:
        if not ObjectId.is_valid(body.doc_id):
            raise HTTPException(400, "Invalid doc_id")
        doc = db.pdfs.find_one({"_id": ObjectId(body.doc_id), "workspace_owner": owner})
        if not doc:
            raise HTTPException(404, "Document not found")
        # Auto-ingest if needed
        maybe_ingest(owner, body.doc_id)
        document_key = doc.get("key")

    query_vector = embed_texts([body.message])[0]
    matches = search_chunks(owner, query_vector, limit=3, document_key=document_key)
    answer = build_rag_answer(body.message, matches)

    return {
        "answer": answer,
        "sources": [
            {"chunk_index": m.get("chunk_index"), "score": round(float(m.get("score", 0)), 4),
             "preview": (m.get("text") or "")[:200]}
            for m in matches
        ],
    }
