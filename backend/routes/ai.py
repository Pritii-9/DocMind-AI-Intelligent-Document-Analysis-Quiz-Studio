from flask import Blueprint, jsonify, request
from flask_jwt_extended import get_jwt, get_jwt_identity, jwt_required

from services.ai_service import (
    build_rag_answer,
    embed_texts,
    maybe_ingest_document,
    resolve_document,
    run_workspace_command_agent,
    search_similar_chunks,
    extract_data_from_documents,
)

ai_bp = Blueprint("ai", __name__)


def _workspace_owner() -> str:
    claims = get_jwt()
    return claims.get("workspace_owner") or get_jwt_identity()


def _json_body():
    return request.get_json(silent=True) or {}


@ai_bp.route("/ingest/<path:document_ref>", methods=["POST"])
@jwt_required()
def ingest_document_route(document_ref: str):
    try:
        result = maybe_ingest_document(_workspace_owner(), document_ref)
        return (
            jsonify(
                {
                    "msg": "Document indexed successfully",
                    **result,
                }
            ),
            200,
        )
    except ValueError as err:
        return jsonify({"msg": str(err)}), 404
    except Exception as err:
        return jsonify({"msg": "Document ingestion failed", "error": str(err)}), 500


@ai_bp.route("/chat", methods=["POST"])
@jwt_required()
def chat_route():
    data = _json_body()
    message = (data.get("message") or "").strip()
    document_ref = (data.get("doc_key") or data.get("doc_id") or "").strip()

    if not message:
        return jsonify({"msg": "message is required"}), 400

    workspace_owner = _workspace_owner()
    # If a specific document is referenced, ensure it's indexed
    document = None
    if document_ref:
        document = resolve_document(workspace_owner, document_ref)
        if not document:
            return jsonify({"msg": "Document not found"}), 404
        maybe_ingest_document(workspace_owner, str(document["_id"]))
        document_key = document.get("key")
    else:
        document_key = None

    # Embed the user query
    query_vector = embed_texts([message])[0]
    matches = search_similar_chunks(
        workspace_owner=workspace_owner,
        query_vector=query_vector,
        limit=3,
        document_key=document_key,
    )
    answer = build_rag_answer(message, matches)
    return jsonify({"answer": answer, "matches": [
        {
            "chunk_index": m.get("chunk_index"),
            "score": round(float(m.get("score", 0)), 4),
            "text_preview": (m.get("text") or "")[:220],
        }
        for m in matches
    ]}), 200

@ai_bp.route("/query", methods=["POST"])
@jwt_required()
def query_document():
    data = _json_body()
    question = (data.get("question") or "").strip()
    document_ref = (data.get("doc_key") or data.get("doc_id") or "").strip()

    if not question:
        return jsonify({"msg": "question is required"}), 400
    if not document_ref:
        return jsonify({"msg": "doc_key or doc_id is required"}), 400

    workspace_owner = _workspace_owner()
    document = resolve_document(workspace_owner, document_ref)
    if not document:
        return jsonify({"msg": "Document not found"}), 404

    try:
        maybe_ingest_document(workspace_owner, str(document["_id"]))
        question_vector = embed_texts([question])[0]
        matches = search_similar_chunks(
            workspace_owner=workspace_owner,
            query_vector=question_vector,
            limit=3,
            document_key=document["key"],
        )
        answer = build_rag_answer(question, matches)

        return (
            jsonify(
                {
                    "answer": answer,
                    "matches": [
                        {
                            "chunk_index": match.get("chunk_index"),
                            "score": round(float(match.get("score", 0)), 4),
                            "text_preview": (match.get("text") or "")[:220],
                        }
                        for match in matches
                    ],
                }
            ),
            200,
        )
    except Exception as err:
        return jsonify({"msg": "RAG query failed", "error": str(err)}), 500


@ai_bp.route("/command", methods=["POST"])
@jwt_required()
def command():
    data = _json_body()
    user_query = (data.get("query") or "").strip()
    thread_id = data.get("thread_id", "default")
    if not user_query:
        return jsonify({"msg": "query is required"}), 400

    try:
        response = run_workspace_command_agent(_workspace_owner(), user_query, thread_id)
        return jsonify({"response": response}), 200
    except Exception as err:
        return jsonify({"msg": "Agent command failed", "error": str(err)}), 500


@ai_bp.route("/chat/stream", methods=["POST"])
@jwt_required()
def chat_stream():
    from flask import Response
    from services.ai_service import stream_workspace_command_agent
    
    data = _json_body()
    user_query = (data.get("query") or "").strip()
    thread_id = data.get("thread_id", "default")
    
    if not user_query:
        return jsonify({"msg": "query is required"}), 400

    try:
        generator = stream_workspace_command_agent(_workspace_owner(), user_query, thread_id)
        return Response(
            generator, 
            mimetype="text/event-stream",
            headers={
                "Cache-Control": "no-cache",
                "X-Accel-Buffering": "no",
                "Connection": "keep-alive"
            }
        )
    except Exception as err:
        return jsonify({"msg": "Agent stream failed", "error": str(err)}), 500


@ai_bp.route("/extract", methods=["POST"])
@jwt_required()
def extract_data():
    data = _json_body()
    document_keys = data.get("document_keys", [])
    schema_prompt = (data.get("schema_prompt") or "").strip()
    
    if not document_keys or not isinstance(document_keys, list):
        return jsonify({"msg": "document_keys must be a non-empty list"}), 400
    if not schema_prompt:
        return jsonify({"msg": "schema_prompt is required"}), 400
        
    try:
        results = extract_data_from_documents(_workspace_owner(), document_keys, schema_prompt)
        return jsonify({"data": results}), 200
    except Exception as err:
        return jsonify({"msg": "Extraction failed", "error": str(err)}), 500
