"""AI router — ingest PDF, chat with PDF."""
from bson import ObjectId
from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel
from datetime import datetime, timezone

from auth_utils import get_current_user
from database import get_db
from services.ai_service import build_rag_answer, embed_texts, maybe_ingest, search_chunks

router = APIRouter(prefix="/ai", tags=["ai"])


def _workspace_owner(user: dict) -> str:
    return user.get("workspace_owner") or user["sub"]


class ChatIn(BaseModel):
    message: str | None = None
    question: str | None = None
    doc_id: str | None = None
    document_id: str | None = None

    @property
    def query_text(self) -> str:
        text = self.question or self.message
        return text.strip() if text else ""

    @property
    def target_doc_id(self) -> str | None:
        return self.doc_id or self.document_id


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
@router.post("/query")
def chat(body: ChatIn, user: dict = Depends(get_current_user)):
    q = body.query_text
    if not q:
        raise HTTPException(400, "question or message is required")

    owner = _workspace_owner(user)
    db = get_db()

    # Resolve document if provided
    document_key = None
    target_id = body.target_doc_id
    if target_id:
        if not ObjectId.is_valid(target_id):
            raise HTTPException(400, "Invalid document ID")
        doc = db.pdfs.find_one({"_id": ObjectId(target_id), "workspace_owner": owner})
        if not doc:
            raise HTTPException(404, "Document not found")
        # Auto-ingest if needed
        maybe_ingest(owner, target_id)
        document_key = doc.get("key")

    query_vector = embed_texts([q])[0]
    matches = search_chunks(owner, query_vector, limit=3, document_key=document_key)
    answer = build_rag_answer(q, matches)

    db.chat_history.insert_one({
        "workspace_owner": owner,
        "message": q,
        "answer": answer,
        "document_id": target_id,
        "created_at": datetime.now(timezone.utc),
    })

    return {
        "answer": answer,
        "sources": [
            {
                "chunk_index": m.get("chunk_index"),
                "score": round(float(m.get("score", 0)), 4),
                "preview": (m.get("text") or "")[:200],
            }
            for m in matches
        ],
    }


@router.get("/history")
def chat_history(user: dict = Depends(get_current_user)):
    owner = _workspace_owner(user)
    records = list(
        get_db().chat_history.find(
            {"workspace_owner": owner},
            {"message": 1, "answer": 1, "document_id": 1, "created_at": 1},
        ).sort("created_at", 1).limit(100)
    )
    return [
        {
            "id": str(record["_id"]),
            "message": record.get("message", ""),
            "answer": record.get("answer", ""),
            "document_id": record.get("document_id"),
            "created_at": record.get("created_at").isoformat() if record.get("created_at") else None,
        }
        for record in records
    ]
