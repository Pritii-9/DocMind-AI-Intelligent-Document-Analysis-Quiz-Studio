import json
from datetime import datetime, timedelta

from flask import current_app
from langchain_core.tools import tool

from services.ai_service import embed_texts, search_similar_chunks


def _json(data):
    return json.dumps(data, default=str)


def build_agent_tools(workspace_owner: str):
    @tool
    def get_workspace_analytics() -> str:
        """Return document totals, storage usage, active members, verified members, and the latest upload time."""
        users = list(
            current_app.db.users.find(
                {"$or": [{"email": workspace_owner}, {"workspace_owner": workspace_owner}]}
            )
        )
        documents = list(current_app.db.pdfs.find({"workspace_owner": workspace_owner}))
        latest_upload = max(
            (document.get("uploaded_at") for document in documents if document.get("uploaded_at")),
            default=None,
        )

        return _json(
            {
                "workspace_owner": workspace_owner,
                "total_documents": len(documents),
                "total_storage_bytes": sum(int(document.get("size_bytes") or 0) for document in documents),
                "active_members": sum(1 for user in users if user.get("is_active", True)),
                "verified_members": sum(1 for user in users if user.get("verified")),
                "latest_upload_at": latest_upload.isoformat() if latest_upload else None,
            }
        )

    @tool
    def get_recent_uploads(days: int = 7) -> str:
        """Return uploads from the last N days with filenames, uploaders, sizes, and timestamps."""
        cutoff = datetime.utcnow() - timedelta(days=max(days, 1))
        documents = list(
            current_app.db.pdfs.find(
                {
                    "workspace_owner": workspace_owner,
                    "uploaded_at": {"$gte": cutoff},
                }
            ).sort("uploaded_at", -1)
        )
        return _json(
            [
                {
                    "filename": document.get("filename"),
                    "document_key": document.get("key"),
                    "uploaded_by": document.get("uploaded_by_name") or document.get("uploaded_by"),
                    "size_bytes": int(document.get("size_bytes") or 0),
                    "uploaded_at": document.get("uploaded_at").isoformat()
                    if document.get("uploaded_at")
                    else None,
                    "ai_index_status": document.get("ai_index_status", "pending"),
                }
                for document in documents
            ]
        )

    @tool
    def search_documents_by_name(query: str, limit: int = 5) -> str:
        """Find documents whose filenames contain the provided text."""
        documents = list(
            current_app.db.pdfs.find(
                {
                    "workspace_owner": workspace_owner,
                    "filename": {"$regex": query, "$options": "i"},
                }
            )
            .sort("uploaded_at", -1)
            .limit(max(limit, 1))
        )
        return _json(
            [
                {
                    "filename": document.get("filename"),
                    "document_key": document.get("key"),
                    "uploaded_at": document.get("uploaded_at").isoformat()
                    if document.get("uploaded_at")
                    else None,
                    "uploaded_by": document.get("uploaded_by_name") or document.get("uploaded_by"),
                    "ai_index_status": document.get("ai_index_status", "pending"),
                }
                for document in documents
            ]
        )

    @tool
    def semantic_search_workspace(question: str, limit: int = 4) -> str:
        """Search indexed chunks across the whole workspace to answer content questions spanning multiple PDFs. Always mention the source filename in your answer."""
        query_vector = embed_texts([question])[0]
        matches = search_similar_chunks(
            workspace_owner=workspace_owner,
            query_vector=query_vector,
            limit=max(limit, 1),
            document_key=None,
        )
        
        results = []
        for match in matches:
            filename = None
            if match.get("document_id"):
                doc = current_app.db.pdfs.find_one({"_id": match.get("document_id")}, {"filename": 1})
                if doc:
                    filename = doc.get("filename")
            
            results.append({
                "source_file": filename,
                "content": match.get("text"),
                "relevance_score": round(float(match.get("score", 0)), 4)
            })
            
        return _json(results)

    @tool
    def extract_structured_data(document_keys: list[str], schema_prompt: str) -> str:
        """Extract structured JSON data from a list of documents (provide document_keys) based on a schema prompt. Use this when the user asks to extract specific fields or structured information from documents."""
        from services.ai_service import extract_data_from_documents
        results = extract_data_from_documents(
            workspace_owner=workspace_owner,
            document_keys=document_keys,
            schema_prompt=schema_prompt,
        )
        return _json(results)

    return [
        get_workspace_analytics,
        get_recent_uploads,
        search_documents_by_name,
        semantic_search_workspace,
        extract_structured_data,
    ]
