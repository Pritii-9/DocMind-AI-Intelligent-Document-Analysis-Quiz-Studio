import io
import math
import os
import re
import threading
from datetime import datetime, timedelta
from typing import Any

import requests
from bson import ObjectId
from botocore.exceptions import ClientError
from flask import current_app
from pypdf import PdfReader
from pymongo.errors import OperationFailure

from extensions import get_s3_client

DEFAULT_CHUNK_SIZE = 500
DEFAULT_RAG_MATCH_LIMIT = 3

# Lazy-loaded sentence-transformers model (loaded once, reused)
_embedding_model = None
_EMBEDDING_MODEL_NAME = os.getenv("SENTENCE_TRANSFORMERS_MODEL", "all-MiniLM-L6-v2")

# Allow overriding the cache dir via env var so Render can persist the model
# between deploys using a Render Disk mounted at e.g. /opt/render/project/src/.model_cache
_MODEL_CACHE_DIR = os.getenv("SENTENCE_TRANSFORMERS_HOME", None)

def _get_embedding_model():
    global _embedding_model
    if _embedding_model is None:
        from sentence_transformers import SentenceTransformer
        _embedding_model = SentenceTransformer(
            _EMBEDDING_MODEL_NAME,
            cache_folder=_MODEL_CACHE_DIR,
        )
    return _embedding_model


def ensure_ai_indexes() -> None:
    current_app.db.embeddings.create_index(
        [("workspace_owner", 1), ("document_key", 1), ("chunk_index", 1)],
        unique=True,
    )
    current_app.db.embeddings.create_index([("workspace_owner", 1), ("document_id", 1)])
    current_app.db.embeddings.create_index([("workspace_owner", 1), ("document_key", 1)])
    current_app.db.pdfs.create_index([("workspace_owner", 1), ("key", 1)])


def get_document_collection():
    return current_app.db.pdfs


def get_embedding_collection():
    return current_app.db.embeddings


def resolve_document(workspace_owner: str, document_ref: str) -> dict[str, Any] | None:
    if not document_ref:
        return None

    queries: list[dict[str, Any]] = []
    if ObjectId.is_valid(document_ref):
        queries.append({"_id": ObjectId(document_ref)})

    queries.extend(
        [
            {"key": document_ref},
            {"filename": document_ref},
        ]
    )

    return get_document_collection().find_one(
        {
            "workspace_owner": workspace_owner,
            "$or": queries,
        }
    )


def _bucket() -> str | None:
    return current_app.config.get("S3_BUCKET_NAME")


def _groq_api_key() -> str:
    value = current_app.config.get("GROQ_API_KEY") or os.getenv("GROQ_API_KEY")
    if not value:
        raise RuntimeError("GROQ_API_KEY is not configured")
    return value


def _groq_embedding_model() -> str:
    value = current_app.config.get("GROQ_EMBEDDING_MODEL") or os.getenv("GROQ_EMBEDDING_MODEL")
    if not value:
        raise RuntimeError("GROQ_EMBEDDING_MODEL is not configured")
    return value


def _groq_chat_model() -> str:
    return (
        current_app.config.get("GROQ_CHAT_MODEL")
        or os.getenv("GROQ_CHAT_MODEL")
        or "llama-3.3-70b-versatile"
    )


def _groq_base_url() -> str:
    return (
        current_app.config.get("GROQ_API_BASE_URL")
        or os.getenv("GROQ_API_BASE_URL")
        or "https://api.groq.com/openai/v1"
    ).rstrip("/")


def _groq_timeout_seconds() -> int:
    return int(current_app.config.get("GROQ_TIMEOUT_SECONDS") or os.getenv("GROQ_TIMEOUT_SECONDS", "90"))


def _download_pdf_bytes(document_key: str) -> bytes:
    s3_client = get_s3_client()
    response = s3_client.get_object(Bucket=_bucket(), Key=document_key)
    return response["Body"].read()


def extract_pdf_text(document_key: str) -> str:
    pdf_bytes = _download_pdf_bytes(document_key)
    reader = PdfReader(io.BytesIO(pdf_bytes))
    page_text: list[str] = []

    for page in reader.pages:
        raw = page.extract_text() or ""
        normalized = re.sub(r"\s+", " ", raw).strip()
        if normalized:
            page_text.append(normalized)

    return "\n\n".join(page_text).strip()


def chunk_text(text: str, chunk_size: int = DEFAULT_CHUNK_SIZE) -> list[dict[str, Any]]:
    words = text.split()
    if not words:
        return []

    chunks: list[dict[str, Any]] = []
    for start in range(0, len(words), chunk_size):
        segment = words[start:start + chunk_size]
        chunks.append(
            {
                "chunk_index": len(chunks),
                "text": " ".join(segment).strip(),
                "word_count": len(segment),
                "start_word": start,
                "end_word": start + len(segment),
            }
        )
    return chunks


def embed_texts(texts: list[str]) -> list[list[float]]:
    """Embed texts using local sentence-transformers (all-MiniLM-L6-v2)."""
    if not texts:
        return []
    model = _get_embedding_model()
    embeddings = model.encode(texts, convert_to_numpy=True, show_progress_bar=False)
    return [emb.tolist() for emb in embeddings]


def generate_chat_completion(messages: list[dict[str, str]], temperature: float = 0.2) -> str:
    response = requests.post(
        f"{_groq_base_url()}/chat/completions",
        headers={
            "Authorization": f"Bearer {_groq_api_key()}",
            "Content-Type": "application/json",
        },
        json={
            "model": _groq_chat_model(),
            "messages": messages,
            "temperature": temperature,
        },
        timeout=_groq_timeout_seconds(),
    )
    response.raise_for_status()
    payload = response.json()
    return (
        payload.get("choices", [{}])[0]
        .get("message", {})
        .get("content", "")
        .strip()
    )


def _cosine_similarity(vector_a: list[float], vector_b: list[float]) -> float:
    if not vector_a or not vector_b or len(vector_a) != len(vector_b):
        return 0.0

    dot_product = sum(a * b for a, b in zip(vector_a, vector_b))
    norm_a = math.sqrt(sum(a * a for a in vector_a))
    norm_b = math.sqrt(sum(b * b for b in vector_b))
    if norm_a == 0 or norm_b == 0:
        return 0.0
    return dot_product / (norm_a * norm_b)


def _vector_search_pipeline(
    query_vector: list[float],
    workspace_owner: str,
    limit: int,
    document_key: str | None = None,
) -> list[dict[str, Any]]:
    vector_index_name = (
        current_app.config.get("MONGO_VECTOR_INDEX_NAME")
        or os.getenv("MONGO_VECTOR_INDEX_NAME")
        or "embeddings_vector_index"
    )
    vector_path = (
        current_app.config.get("MONGO_VECTOR_PATH")
        or os.getenv("MONGO_VECTOR_PATH")
        or "embedding"
    )

    filter_query: dict[str, Any] = {"workspace_owner": workspace_owner}
    if document_key:
        filter_query["document_key"] = document_key

    pipeline = [
        {
            "$vectorSearch": {
                "index": vector_index_name,
                "path": vector_path,
                "queryVector": query_vector,
                "numCandidates": max(limit * 15, 30),
                "limit": limit,
                "filter": filter_query,
            }
        },
        {
            "$project": {
                "text": 1,
                "chunk_index": 1,
                "document_key": 1,
                "document_id": 1,
                "word_count": 1,
                "score": {"$meta": "vectorSearchScore"},
            }
        },
    ]

    return list(get_embedding_collection().aggregate(pipeline))


def search_similar_chunks(
    workspace_owner: str,
    query_vector: list[float],
    limit: int = DEFAULT_RAG_MATCH_LIMIT,
    document_key: str | None = None,
) -> list[dict[str, Any]]:
    try:
        return _vector_search_pipeline(query_vector, workspace_owner, limit, document_key)
    except OperationFailure:
        pass
    except Exception:
        current_app.logger.exception("Vector search failed, falling back to local similarity")

    filter_query: dict[str, Any] = {"workspace_owner": workspace_owner}
    if document_key:
        filter_query["document_key"] = document_key

    candidates = list(
        get_embedding_collection().find(
            filter_query,
            {
                "text": 1,
                "embedding": 1,
                "chunk_index": 1,
                "document_key": 1,
                "document_id": 1,
                "word_count": 1,
            },
        )
    )

    scored: list[dict[str, Any]] = []
    for item in candidates:
        embedding = item.get("embedding") or []
        score = _cosine_similarity(query_vector, embedding)
        scored.append(
            {
                "text": item.get("text", ""),
                "chunk_index": item.get("chunk_index"),
                "document_key": item.get("document_key"),
                "document_id": item.get("document_id"),
                "word_count": item.get("word_count"),
                "score": score,
            }
        )

    scored.sort(key=lambda item: item.get("score", 0), reverse=True)
    return scored[:limit]


def extract_data_from_documents(workspace_owner: str, document_keys: list[str], schema_prompt: str) -> list[dict]:
    """Extracts structured JSON data from a list of documents based on a prompt."""
    results = []
    for doc_key in document_keys:
        try:
            from flask import current_app
            chunks = list(current_app.db.embeddings.find({
                "workspace_owner": workspace_owner,
                "document_key": doc_key
            }).sort("chunk_index", 1).limit(10))
            
            text = "\n\n".join(chunk["text"] for chunk in chunks)
            source_file = doc_key.split("/")[-1]
            
            if not text:
                results.append({"_source_file": source_file, "_error": "No text found or document not indexed"})
                continue
                
            system_prompt = (
                "You are an expert data extraction AI. Extract the requested information from the provided document text.\n"
                "You MUST output exactly ONE valid JSON object, containing only the extracted data based on the schema prompt.\n"
                "Use the exact keys requested. If a piece of information is not found, use null.\n"
                "DO NOT wrap the output in markdown code blocks like ```json. Output ONLY raw parseable JSON."
            )
            
            user_prompt = f"Fields to extract:\n{schema_prompt}\n\nDocument text:\n{text[:15000]}"
            
            response_text = generate_chat_completion([
                {"role": "system", "content": system_prompt},
                {"role": "user", "content": user_prompt}
            ], temperature=0.0)
            
            cleaned = response_text.strip()
            if cleaned.startswith("```json"):
                cleaned = cleaned[7:]
            elif cleaned.startswith("```"):
                cleaned = cleaned[3:]
            if cleaned.endswith("```"):
                cleaned = cleaned[:-3]
                
            import json
            data = json.loads(cleaned.strip())
            data["_source_file"] = source_file
            results.append(data)
        except Exception as e:
            results.append({"_source_file": doc_key.split("/")[-1], "_error": str(e)})
            
    return results


def _update_document_status(document_id: ObjectId, **fields: Any) -> None:
    get_document_collection().update_one({"_id": document_id}, {"$set": fields})


def ingest_document(workspace_owner: str, document_ref: str) -> dict[str, Any]:
    ensure_ai_indexes()
    document = resolve_document(workspace_owner, document_ref)
    if not document:
        raise ValueError("Document not found")

    document_id = document["_id"]
    now = datetime.utcnow()
    _update_document_status(
        document_id,
        ai_index_status="processing",
        ai_error=None,
        ai_started_at=now,
    )

    try:
        extracted_text = extract_pdf_text(document["key"])
        if not extracted_text:
            raise ValueError("No extractable text found in PDF")

        chunks = chunk_text(extracted_text)
        if not chunks:
            raise ValueError("No text chunks could be created from the PDF")

        vectors = embed_texts([chunk["text"] for chunk in chunks])
        if len(vectors) != len(chunks):
            raise RuntimeError("Embedding provider returned an unexpected number of vectors")

        get_embedding_collection().delete_many(
            {
                "workspace_owner": workspace_owner,
                "document_id": document_id,
            }
        )

        records = []
        for chunk, vector in zip(chunks, vectors):
            records.append(
                {
                    "workspace_owner": workspace_owner,
                    "document_id": document_id,
                    "document_key": document["key"],
                    "filename": document.get("filename"),
                    "chunk_index": chunk["chunk_index"],
                    "text": chunk["text"],
                    "word_count": chunk["word_count"],
                    "start_word": chunk["start_word"],
                    "end_word": chunk["end_word"],
                    "embedding": vector,
                    "created_at": now,
                }
            )

        if records:
            get_embedding_collection().insert_many(records)

        _update_document_status(
            document_id,
            ai_index_status="ready",
            ai_indexed_at=datetime.utcnow(),
            ai_chunk_count=len(records),
            ai_error=None,
        )

        return {
            "document_id": str(document_id),
            "document_key": document["key"],
            "filename": document.get("filename"),
            "chunk_count": len(records),
        }
    except Exception as err:
        _update_document_status(
            document_id,
            ai_index_status="failed",
            ai_error=str(err),
        )
        raise


def maybe_ingest_document(workspace_owner: str, document_ref: str) -> dict[str, Any]:
    document = resolve_document(workspace_owner, document_ref)
    if not document:
        raise ValueError("Document not found")

    if document.get("ai_index_status") == "ready":
        count = get_embedding_collection().count_documents(
            {
                "workspace_owner": workspace_owner,
                "document_id": document["_id"],
            }
        )
        if count > 0:
            return {
                "document_id": str(document["_id"]),
                "document_key": document["key"],
                "filename": document.get("filename"),
                "chunk_count": count,
            }

    return ingest_document(workspace_owner, str(document["_id"]))


def build_rag_answer(question: str, matches: list[dict[str, Any]]) -> str:
    if not matches:
        return "I could not find relevant indexed content in this PDF yet."

    context = "\n\n".join(
        f"[Chunk {index + 1} | source chunk #{match.get('chunk_index', 'n/a')}]\n{match.get('text', '')}"
        for index, match in enumerate(matches)
    )

    return generate_chat_completion(
        [
            {
                "role": "system",
                "content": (
                    "You answer questions about a PDF using only the supplied context. "
                    "If the answer is not clearly supported by the context, say so plainly."
                ),
            },
            {
                "role": "user",
                "content": (
                    f"Using only the following context from the document:\n\n{context}\n\n"
                    f"Answer the user's question:\n{question}"
                ),
            },
        ],
        temperature=0.1,
    )


def _get_langgraph_agent(workspace_owner: str):
    from agent_tools import build_agent_tools
    from langgraph.prebuilt import create_react_agent
    from langgraph.checkpoint.mongodb import MongoDBSaver
    from langchain_groq import ChatGroq
    from langchain_core.messages import SystemMessage

    llm = ChatGroq(
        groq_api_key=_groq_api_key(),
        model_name=_groq_chat_model(),
        temperature=0,
    )
    tools = build_agent_tools(workspace_owner)
    
    system_message = SystemMessage(content=(
        "You are the SafeUp workspace AI agent. Use tools whenever the answer depends on workspace "
        "data or document content. Do not invent counts, files, or activity. When a tool returns no "
        "results, say that clearly and suggest a narrower follow-up."
    ))
    
    client = current_app.mongo_client
    checkpointer = MongoDBSaver(client, db_name=current_app.db.name)
    
    return create_react_agent(llm, tools, state_modifier=system_message, checkpointer=checkpointer)

def run_workspace_command_agent(workspace_owner: str, user_query: str, thread_id: str = "default") -> str:
    agent = _get_langgraph_agent(workspace_owner)
    config = {"configurable": {"thread_id": thread_id}}
    result = agent.invoke({"messages": [("user", user_query)]}, config)
    return result["messages"][-1].content

def stream_workspace_command_agent(workspace_owner: str, user_query: str, thread_id: str):
    import json
    agent = _get_langgraph_agent(workspace_owner)
    config = {"configurable": {"thread_id": thread_id}}
    
    for event in agent.stream({"messages": [("user", user_query)]}, config, stream_mode="messages"):
        message, meta = event
        if message.type == "ai" and message.content and hasattr(message, "content"):
            # Ensure it's a string, sometimes content can be a list of dicts for multimodal
            content_str = message.content if isinstance(message.content, str) else ""
            if content_str:
                yield f"data: {json.dumps({'content': content_str, 'type': message.type})}\n\n"
    
    yield "data: [DONE]\n\n"


def trigger_background_ingest(app, workspace_owner: str, document_key: str) -> None:
    def _worker():
        with app.app_context():
            try:
                document = resolve_document(workspace_owner, document_key)
                if not document:
                    return

                uploaded_at = document.get("uploaded_at")
                if uploaded_at and uploaded_at < datetime.utcnow() - timedelta(minutes=15):
                    return

                ingest_document(workspace_owner, str(document["_id"]))
            except ClientError:
                app.logger.exception("S3 error during background ingestion")
            except Exception:
                app.logger.exception("Background ingestion failed")

    threading.Thread(target=_worker, daemon=True).start()
