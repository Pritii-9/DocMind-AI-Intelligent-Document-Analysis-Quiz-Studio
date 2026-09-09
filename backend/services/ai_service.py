"""AI service — LangChain RAG (no LangGraph). Simple: embed → store → retrieve → answer."""
import io
import math
import re
import threading
from datetime import datetime, timezone
from typing import Any

from bson import ObjectId
from pypdf import PdfReader

from config import settings
from database import get_db, get_s3

DEFAULT_CHUNK_SIZE = 500
DEFAULT_MATCH_LIMIT = 3

# ── Embedding (fastembed local — zero cost) ───────────────────────────────────

_embed_model = None


def _get_embed_model():
    global _embed_model
    if _embed_model is None:
        from fastembed import TextEmbedding
        _embed_model = TextEmbedding("BAAI/bge-small-en-v1.5")
    return _embed_model


def embed_texts(texts: list[str]) -> list[list[float]]:
    if not texts:
        return []
    model = _get_embed_model()
    return [e.tolist() for e in model.embed(texts)]


def _chat(messages: list[dict], temperature: float = 0.1) -> str:
    from langchain_groq import ChatGroq
    from langchain_core.messages import HumanMessage, SystemMessage, AIMessage

    candidate_models = [
        settings.GROQ_CHAT_MODEL,
        "groq/compound",
        "groq/compound-mini",
        "openai/gpt-oss-120b",
        "openai/gpt-oss-20b",
        "allam-2-7b",
    ]
    # Remove duplicates while preserving order
    models_to_try = list(dict.fromkeys(candidate_models))

    lc_msgs = []
    for m in messages:
        role, content = m["role"], m["content"]
        if role == "system":
            lc_msgs.append(SystemMessage(content=content))
        elif role == "user":
            lc_msgs.append(HumanMessage(content=content))
        else:
            lc_msgs.append(AIMessage(content=content))

    last_error = None
    for model_name in models_to_try:
        try:
            llm = ChatGroq(
                api_key=settings.GROQ_API_KEY,
                model_name=model_name,
                temperature=temperature,
                timeout=settings.GROQ_TIMEOUT_SECONDS,
            )
            return llm.invoke(lc_msgs).content.strip()
        except Exception as e:
            err_str = str(e)
            if "NotFoundError" in err_str or "model_not_found" in err_str or "404" in err_str:
                last_error = e
                continue
            raise e

    if last_error:
        raise last_error
    raise RuntimeError("Failed to invoke Groq LLM")


# ── PDF extraction + chunking ─────────────────────────────────────────────────

def _download_pdf(key: str) -> bytes:
    return get_s3().get_object(Bucket=settings.S3_BUCKET_NAME, Key=key)["Body"].read()


def _extract_text(key: str) -> str:
    reader = PdfReader(io.BytesIO(_download_pdf(key)))
    pages = []
    for page in reader.pages:
        raw = page.extract_text() or ""
        normalized = re.sub(r"\s+", " ", raw).strip()
        if normalized:
            pages.append(normalized)
    return "\n\n".join(pages).strip()


def _chunk_text(text: str) -> list[dict]:
    words = text.split()
    chunks = []
    for i in range(0, len(words), DEFAULT_CHUNK_SIZE):
        seg = words[i: i + DEFAULT_CHUNK_SIZE]
        chunks.append({"chunk_index": len(chunks), "text": " ".join(seg), "word_count": len(seg)})
    return chunks


# ── Vector search (cosine fallback) ──────────────────────────────────────────

def _cosine(a: list[float], b: list[float]) -> float:
    if not a or not b or len(a) != len(b):
        return 0.0
    dot = sum(x * y for x, y in zip(a, b))
    na = math.sqrt(sum(x * x for x in a))
    nb = math.sqrt(sum(x * x for x in b))
    return dot / (na * nb) if na and nb else 0.0


def search_chunks(
    workspace_owner: str,
    query_vector: list[float],
    limit: int = DEFAULT_MATCH_LIMIT,
    document_key: str | None = None,
) -> list[dict]:
    db = get_db()
    q: dict[str, Any] = {"workspace_owner": workspace_owner}
    if document_key:
        q["document_key"] = document_key

    # Try MongoDB Atlas vector search first
    try:
        pipeline = [
            {"$vectorSearch": {
                "index": settings.MONGO_VECTOR_INDEX_NAME,
                "path": settings.MONGO_VECTOR_PATH,
                "queryVector": query_vector,
                "numCandidates": max(limit * 15, 30),
                "limit": limit,
                "filter": q,
            }},
            {"$project": {"text": 1, "chunk_index": 1, "document_key": 1, "score": {"$meta": "vectorSearchScore"}}},
        ]
        results = list(db.embeddings.aggregate(pipeline))
        if results:
            return results
    except Exception:
        pass

    # Local cosine fallback
    candidates = list(db.embeddings.find(q, {"text": 1, "embedding": 1, "chunk_index": 1, "document_key": 1}))
    scored = sorted(candidates, key=lambda c: _cosine(query_vector, c.get("embedding") or []), reverse=True)
    return [{"text": c["text"], "chunk_index": c["chunk_index"], "document_key": c.get("document_key"), "score": _cosine(query_vector, c.get("embedding") or [])} for c in scored[:limit]]


# ── Ingest ────────────────────────────────────────────────────────────────────

def ingest_document(workspace_owner: str, document_id: str) -> dict:
    db = get_db()
    doc = db.pdfs.find_one({"_id": ObjectId(document_id), "workspace_owner": workspace_owner})
    if not doc:
        raise ValueError("Document not found")

    db.pdfs.update_one({"_id": doc["_id"]}, {"$set": {"ai_index_status": "processing", "ai_error": None}})
    try:
        text = _extract_text(doc["key"])
        if not text:
            raise ValueError("No extractable text found in PDF")

        chunks = _chunk_text(text)
        vectors = embed_texts([c["text"] for c in chunks])

        db.embeddings.delete_many({"workspace_owner": workspace_owner, "document_id": doc["_id"]})
        now = datetime.now(timezone.utc)
        records = [
            {
                "workspace_owner": workspace_owner,
                "document_id": doc["_id"],
                "document_key": doc["key"],
                "filename": doc.get("filename"),
                "chunk_index": c["chunk_index"],
                "text": c["text"],
                "word_count": c["word_count"],
                "embedding": v,
                "created_at": now,
            }
            for c, v in zip(chunks, vectors)
        ]
        if records:
            db.embeddings.insert_many(records)

        db.pdfs.update_one(
            {"_id": doc["_id"]},
            {"$set": {"ai_index_status": "ready", "ai_chunk_count": len(records), "ai_indexed_at": now}},
        )
        return {"document_id": document_id, "chunk_count": len(records)}
    except Exception as e:
        db.pdfs.update_one({"_id": doc["_id"]}, {"$set": {"ai_index_status": "failed", "ai_error": str(e)}})
        raise


def ingest_document_bg(workspace_owner: str, document_id: str):
    """Fire-and-forget background ingest."""
    try:
        ingest_document(workspace_owner, document_id)
    except Exception as e:
        print(f"[AI INGEST ERROR] {e}")


def maybe_ingest(workspace_owner: str, document_id: str) -> dict:
    db = get_db()
    doc = db.pdfs.find_one({"_id": ObjectId(document_id), "workspace_owner": workspace_owner})
    if not doc:
        raise ValueError("Document not found")
    if doc.get("ai_index_status") == "ready" and db.embeddings.count_documents({"document_id": doc["_id"]}) > 0:
        return {"document_id": document_id, "chunk_count": doc.get("ai_chunk_count", 0)}
    return ingest_document(workspace_owner, document_id)


# ── RAG answer ────────────────────────────────────────────────────────────────

def build_rag_answer(question: str, matches: list[dict]) -> str:
    if not matches:
        return "I could not find relevant content in this document. Please make sure it has been indexed."

    context = "\n\n".join(
        f"[Chunk {i + 1}]\n{m.get('text', '')}" for i, m in enumerate(matches)
    )
    return _chat(
        [
            {"role": "system", "content": (
                "You are a helpful AI assistant answering questions about a PDF document. "
                "Use only the provided context. If the answer isn't in the context, say so clearly."
            )},
            {"role": "user", "content": f"Context:\n{context}\n\nQuestion: {question}"},
        ]
    )
