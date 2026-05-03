import json
import os
import queue
import re
import threading
import time
from datetime import datetime, timezone
from urllib.parse import unquote

from botocore.exceptions import ClientError
from flask import Blueprint, Response, current_app, jsonify, request
from flask_jwt_extended import get_jwt, get_jwt_identity, jwt_required

from extensions import get_s3_client

pdf_bp = Blueprint("pdf", __name__)

_sse_lock = threading.Lock()
_sse_subscribers: dict[str, list[queue.Queue]] = {}


def _emit_sse_event(workspace_owner: str, event: dict):
    with _sse_lock:
        listeners = list(_sse_subscribers.get(workspace_owner, []))
    for q in listeners:
        try:
            q.put_nowait(event)
        except Exception:
            continue


def _register_sse(workspace_owner: str):
    q = queue.Queue()
    with _sse_lock:
        _sse_subscribers.setdefault(workspace_owner, []).append(q)
    return q


def _unregister_sse(workspace_owner: str, q: queue.Queue):
    with _sse_lock:
        current = _sse_subscribers.get(workspace_owner, [])
        if q in current:
            current.remove(q)
        if not current:
            _sse_subscribers.pop(workspace_owner, None)


def _bucket():
    return current_app.config.get("S3_BUCKET_NAME")


def _workspace_owner():
    claims = get_jwt()
    return claims.get("workspace_owner") or get_jwt_identity()


def _workspace_owner_slug() -> str:
    return _workspace_owner().replace("@", "_at_").replace(".", "_")


def _workspace_prefix():
    return f"workspaces/{_workspace_owner_slug()}/"


def _workspace_query():
    return {"workspace_owner": _workspace_owner()}


def _document_collection():
    return current_app.db.pdfs


def _normalize_datetime_value(value):
    if value is None:
        return None
    if hasattr(value, "isoformat"):
        return value
    if isinstance(value, str):
        for parser in (datetime.fromisoformat,):
            try:
                return parser(value.replace("Z", "+00:00"))
            except ValueError:
                continue
    return None


def _datetime_sort_key(value) -> float:
    normalized = _normalize_datetime_value(value)
    if normalized is None:
        return float("-inf")
    if normalized.tzinfo is None:
        normalized = normalized.replace(tzinfo=timezone.utc)
    else:
        normalized = normalized.astimezone(timezone.utc)
    return normalized.timestamp()


def _safe_uploaded_sort_value(document: dict):
    return _datetime_sort_key(document.get("uploaded_at"))


def _sync_documents_from_s3():
    s3_client = get_s3_client()
    prefix = _workspace_prefix()
    response = s3_client.list_objects_v2(Bucket=_bucket(), Prefix=prefix)
    now = datetime.utcnow()

    for obj in response.get("Contents", []):
        key = obj.get("Key", "")
        if not key.endswith(".pdf"):
            continue

        filename = key.replace(prefix, "", 1)
        _document_collection().update_one(
            {"workspace_owner": _workspace_owner(), "key": key},
            {
                "$setOnInsert": {
                    "workspace_owner": _workspace_owner(),
                    "filename": filename,
                    "key": key,
                    "size_bytes": int(obj.get("Size", 0)),
                    "uploaded_at": obj.get("LastModified") or now,
                    "last_accessed_at": None,
                    "uploaded_by": _workspace_owner(),
                    "uploaded_by_name": "Workspace Owner",
                }
            },
            upsert=True,
        )


def _validate_pdf_filename(filename: str) -> tuple[bool, str]:
    clean = os.path.basename((filename or "").strip())
    if not clean:
        return False, "Filename is required"
    if not clean.lower().endswith(".pdf"):
        return False, "Only PDF files are allowed"
    if len(clean) > 140:
        return False, "Filename is too long"
    if not re.fullmatch(r"[A-Za-z0-9._ -]+", clean):
        return False, "Filename contains invalid characters"
    return True, clean


def _full_s3_key(filename: str) -> str:
    return f"{_workspace_prefix()}{filename}"


def _is_key_in_workspace(key: str) -> bool:
    return key.startswith(_workspace_prefix())


def _serialize_document(document: dict) -> dict:
    def _serialize_datetime(value):
        normalized = _normalize_datetime_value(value)
        if normalized is not None:
            return normalized.isoformat()
        if value is None:
            return None
        if isinstance(value, str):
            return value
        return str(value)

    return {
        "id": str(document.get("_id")),
        "filename": document.get("filename"),
        "key": document.get("key"),
        "size_bytes": int(document.get("size_bytes") or 0),
        "uploaded_at": _serialize_datetime(document.get("uploaded_at")),
        "last_accessed_at": _serialize_datetime(document.get("last_accessed_at")),
        "uploaded_by": document.get("uploaded_by"),
        "uploaded_by_name": document.get("uploaded_by_name"),
        "ai_index_status": document.get("ai_index_status", "pending"),
        "ai_indexed_at": _serialize_datetime(document.get("ai_indexed_at")),
        "ai_chunk_count": int(document.get("ai_chunk_count") or 0),
        "ai_error": document.get("ai_error"),
    }


def _recent_activity(limit: int = 6) -> list[dict]:
    activity = []

    docs = list(_document_collection().find(_workspace_query()).limit(limit * 3))
    docs.sort(key=_safe_uploaded_sort_value, reverse=True)
    docs = docs[:limit]
    for document in docs:
        uploaded_at = _serialize_document(document).get("uploaded_at")
        activity.append(
            {
                "type": "upload",
                "title": f"{document.get('filename')} uploaded",
                "timestamp": uploaded_at,
                "actor": document.get("uploaded_by_name") or document.get("uploaded_by"),
                "meta": {
                    "size_bytes": int(document.get("size_bytes") or 0),
                },
            }
        )

    members = list(
        current_app.db.users.find(
            {"$or": [{"email": _workspace_owner()}, {"workspace_owner": _workspace_owner()}]}
        )
        .limit(limit * 3)
    )
    members.sort(
        key=lambda item: _datetime_sort_key(item.get("created_at")),
        reverse=True,
    )
    members = members[:limit]
    for member in members:
        created_at = _normalize_datetime_value(member.get("created_at"))
        activity.append(
            {
                "type": "member",
                "title": f"{member.get('name', 'Team member')} joined workspace",
                "timestamp": created_at.isoformat() if created_at else None,
                "actor": member.get("email"),
                "meta": {
                    "role": member.get("role", "user"),
                    "is_active": bool(member.get("is_active", True)),
                },
            }
        )

    activity.sort(key=lambda item: item.get("timestamp") or "", reverse=True)
    return activity[:limit]


@pdf_bp.before_request
def check_s3_config():
    if request.method == "OPTIONS":
        return
    if not _bucket():
        return jsonify({"msg": "S3_BUCKET_NAME missing from environment"}), 500


@pdf_bp.route("/inject-sample", methods=["POST"])
@jwt_required()
def inject_sample():
    workspace_owner = _workspace_owner()
    now = datetime.utcnow()
    filename = "SafeUp_Sample_Confidential_Document.pdf"
    key = _full_s3_key(f"{int(time.time())}-{filename}")
    s3_client = get_s3_client()
    
    sample_pdf_bytes = b'''%PDF-1.4
1 0 obj <</Type /Catalog /Pages 2 0 R>> endobj
2 0 obj <</Type /Pages /Kids [3 0 R] /Count 1>> endobj
3 0 obj <</Type /Page /Parent 2 0 R /Resources 4 0 R /MediaBox [0 0 612 792] /Contents 5 0 R>> endobj
4 0 obj <</Font <</F1 6 0 R>>>> endobj
5 0 obj <</Length 165>> stream
BT
/F1 24 Tf
100 700 Td
(SafeUp Workspace Enterprise Demo) Tj
/F1 12 Tf
0 -40 Td
(This is a secure, dummy document generated automatically for your testing.) Tj
0 -20 Td
(It contains sample data about enterprise security, encryption keys, and SOC2 compliance.) Tj
0 -20 Td
(Total Invoice Amount: $1,450.00 USD) Tj
0 -20 Td
(Effective Date: October 1, 2026) Tj
ET
endstream endobj
6 0 obj <</Type /Font /Subtype /Type1 /BaseFont /Helvetica>> endobj
xref
0 7
0000000000 65535 f
0000000009 00000 n
0000000058 00000 n
0000000115 00000 n
0000000219 00000 n
0000000256 00000 n
0000000472 00000 n
trailer <</Size 7 /Root 1 0 R>>
startxref
560
%%EOF'''

    try:
        s3_client.put_object(
            Bucket=_bucket(),
            Key=key,
            Body=sample_pdf_bytes,
            ContentType="application/pdf"
        )
        
        claims = get_jwt()
        uploaded_by_name = claims.get("name", "Workspace Owner")
        
        doc_dict = {
            "workspace_owner": workspace_owner,
            "filename": filename,
            "key": key,
            "size_bytes": len(sample_pdf_bytes),
            "uploaded_at": now,
            "last_accessed_at": now,
            "uploaded_by": get_jwt_identity(),
            "uploaded_by_name": uploaded_by_name,
            "ai_index_status": "pending",
        }
        
        result = _document_collection().insert_one(doc_dict)
        doc_dict["_id"] = result.inserted_id
        
        from services.ai_service import maybe_ingest_document
        
        def background_ingest():
            try:
                maybe_ingest_document(workspace_owner, str(result.inserted_id))
                _emit_sse_event(workspace_owner, {"type": "ai_index_complete", "document_id": str(result.inserted_id)})
            except Exception as e:
                current_app.logger.error(f"Sample background ingest failed: {e}")
                _emit_sse_event(workspace_owner, {"type": "ai_index_error", "document_id": str(result.inserted_id)})

        threading.Thread(target=background_ingest, daemon=True).start()
        
        _emit_sse_event(
            workspace_owner,
            {
                "type": "document_uploaded",
                "document": _serialize_document(doc_dict),
            },
        )
        return jsonify({"msg": "Sample injected successfully", "document": _serialize_document(doc_dict)}), 200
    except Exception as e:
        return jsonify({"msg": "Failed to inject sample", "error": str(e)}), 500

@pdf_bp.route("/init-upload", methods=["POST"])
@jwt_required()
def init_multipart():
    data = request.get_json(silent=True) or {}
    is_valid, filename_or_error = _validate_pdf_filename(data.get("filename", ""))
    if not is_valid:
        return jsonify({"msg": filename_or_error}), 400

    filename = filename_or_error
    unique_filename = f"{int(time.time())}-{filename}"
    key = _full_s3_key(unique_filename)
    s3_client = get_s3_client()

    try:
        res = s3_client.create_multipart_upload(
            Bucket=_bucket(),
            Key=key,
            ContentType="application/pdf",
        )
        return jsonify({"uploadId": res["UploadId"], "key": key, "fileName": unique_filename}), 200
    except ClientError as err:
        return jsonify({"msg": "S3 init failed", "error": str(err)}), 500


@pdf_bp.route("/upload-part", methods=["POST"])
@jwt_required()
def upload_part():
    part_number_raw = request.form.get("partNumber")
    upload_id = request.form.get("uploadId")
    key = request.form.get("key", "")
    file_obj = request.files.get("file")

    if not part_number_raw or not upload_id or not key or file_obj is None:
        return jsonify({"msg": "partNumber, uploadId, key, and file are required"}), 400
    if not _is_key_in_workspace(key):
        return jsonify({"msg": "Invalid upload key for your workspace"}), 403

    try:
        part_number = int(part_number_raw)
    except ValueError:
        return jsonify({"msg": "partNumber must be an integer"}), 400

    s3_client = get_s3_client()
    try:
        res = s3_client.upload_part(
            Bucket=_bucket(),
            Key=key,
            PartNumber=part_number,
            UploadId=upload_id,
            Body=file_obj.read(),
        )
        return jsonify({"partNumber": part_number, "etag": res["ETag"]}), 200
    except ClientError as err:
        return jsonify({"msg": "Part upload failed", "error": str(err)}), 500


@pdf_bp.route("/complete-upload", methods=["POST"])
@jwt_required()
def complete_multipart():
    data = request.get_json(silent=True) or {}
    key = data.get("key", "")
    upload_id = data.get("uploadId")
    parts = data.get("parts")

    if not key or not upload_id or not isinstance(parts, list) or not parts:
        return jsonify({"msg": "key, uploadId, and parts are required"}), 400
    if not _is_key_in_workspace(key):
        return jsonify({"msg": "Invalid upload key for your workspace"}), 403

    s3_client = get_s3_client()
    try:
        s3_client.complete_multipart_upload(
            Bucket=_bucket(),
            Key=key,
            UploadId=upload_id,
            MultipartUpload={"Parts": parts},
        )

        head = s3_client.head_object(Bucket=_bucket(), Key=key)
        filename = key.replace(_workspace_prefix(), "", 1)
        now = datetime.utcnow()
        claims = get_jwt()

        _document_collection().update_one(
            {"workspace_owner": _workspace_owner(), "key": key},
            {
                "$set": {
                    "workspace_owner": _workspace_owner(),
                    "filename": filename,
                    "key": key,
                    "size_bytes": int(head.get("ContentLength", 0)),
                    "uploaded_at": now,
                    "last_accessed_at": None,
                    "uploaded_by": get_jwt_identity(),
                    "uploaded_by_name": claims.get("name", "User"),
                    "ai_index_status": "pending",
                    "ai_indexed_at": None,
                    "ai_chunk_count": 0,
                    "ai_error": None,
                }
            },
            upsert=True,
        )

        _emit_sse_event(_workspace_owner(), {
            "type": "upload",
            "title": f"{filename} uploaded",
            "actor": claims.get("name", "User"),
            "timestamp": now.isoformat(),
            "meta": {
                "filename": filename,
                "size_bytes": int(head.get("ContentLength", 0)),
            },
        })

        if current_app.config.get("AI_AUTO_INGEST_UPLOADS", True):
            from services.ai_service import trigger_background_ingest

            trigger_background_ingest(
                current_app._get_current_object(),
                _workspace_owner(),
                key,
            )

        return jsonify({"msg": "Upload successful"}), 200
    except ClientError as err:
        current_app.logger.exception("S3 completion failed")
        return jsonify({"msg": "S3 completion failed", "error": str(err)}), 500
    except Exception as err:
        current_app.logger.exception("complete-upload failed")
        return jsonify({"msg": "Upload completion failed", "error": str(err)}), 500


@pdf_bp.route("/list", methods=["GET"])
@jwt_required()
def list_pdfs():
    try:
        if _document_collection().count_documents(_workspace_query()) == 0:
            try:
                _sync_documents_from_s3()
            except ClientError as sync_err:
                current_app.logger.warning("S3 sync skipped (access error): %s", sync_err)
        documents = list(
            _document_collection().find(_workspace_query())
        )
        documents.sort(key=_safe_uploaded_sort_value, reverse=True)
        files = [document.get("filename") for document in documents if document.get("filename")]
        return jsonify(files), 200
    except Exception as err:
        current_app.logger.exception("PDF list failed")
        return jsonify({"msg": "PDF list failed", "error": str(err)}), 500


@pdf_bp.route("/library", methods=["GET"])
@jwt_required()
def library():
    try:
        if _document_collection().count_documents(_workspace_query()) == 0:
            try:
                _sync_documents_from_s3()
            except ClientError as sync_err:
                current_app.logger.warning("S3 sync skipped (access error): %s", sync_err)
        documents = list(
            _document_collection().find(_workspace_query())
        )
        documents.sort(key=_safe_uploaded_sort_value, reverse=True)
        return jsonify([_serialize_document(document) for document in documents]), 200
    except Exception as err:
        current_app.logger.exception("PDF library failed")
        return jsonify({"msg": "PDF library failed", "error": str(err)}), 500


@pdf_bp.route("/events", methods=["GET"])
@jwt_required()
def events():
    workspace_owner = _workspace_owner()

    def stream():
        q = _register_sse(workspace_owner)
        try:
            while True:
                try:
                    payload = q.get(timeout=25)
                    event_text = json.dumps(payload)
                    yield f"event: workspace-event\ndata: {event_text}\n\n"
                except queue.Empty:
                    yield ": keep-alive\n\n"
        finally:
            _unregister_sse(workspace_owner, q)

    headers = {
        "Cache-Control": "no-cache",
        "Connection": "keep-alive",
    }
    return Response(stream(), mimetype="text/event-stream", headers=headers)


@pdf_bp.route("/overview", methods=["GET"])
@jwt_required()
def overview():
    workspace_owner = _workspace_owner()
    try:
        if _document_collection().count_documents(_workspace_query()) == 0:
            try:
                _sync_documents_from_s3()
            except ClientError as sync_err:
                current_app.logger.warning("S3 sync skipped (access error): %s", sync_err)

        users = list(
            current_app.db.users.find(
                {"$or": [{"email": workspace_owner}, {"workspace_owner": workspace_owner}]}
            )
        )
        documents = list(_document_collection().find(_workspace_query()))
        documents.sort(key=_safe_uploaded_sort_value, reverse=True)

        active_members = sum(1 for user in users if user.get("is_active", True))
        verified_members = sum(1 for user in users if user.get("verified"))
        total_storage_bytes = sum(int(document.get("size_bytes") or 0) for document in documents)
        last_upload_at = None
        if documents:
            timestamps = [
                _normalize_datetime_value(document.get("uploaded_at"))
                for document in documents
                if _normalize_datetime_value(document.get("uploaded_at"))
            ]
            if timestamps:
                last_upload_at = max(timestamps).isoformat()

        return (
            jsonify(
                {
                    "stats": {
                        "total_documents": len(documents),
                        "total_storage_bytes": total_storage_bytes,
                        "active_members": active_members,
                        "verified_members": verified_members,
                        "last_upload_at": last_upload_at,
                    },
                    "documents": [_serialize_document(document) for document in documents[:6]],
                    "activity": _recent_activity(),
                }
            ),
            200,
        )
    except ClientError as err:
        return jsonify({"msg": "S3 overview sync failed", "error": str(err)}), 500
    except Exception as err:
        current_app.logger.exception("PDF overview failed")
        return jsonify({"msg": "PDF overview failed", "error": str(err)}), 500


@pdf_bp.route("/stream/<path:key>", methods=["GET"])
@jwt_required()
def stream_pdf(key):
    decoded_key = unquote(key)
    is_valid, filename_or_error = _validate_pdf_filename(decoded_key)
    if not is_valid:
        return jsonify({"msg": filename_or_error}), 400

    s3_key = _full_s3_key(filename_or_error)
    range_header = request.headers.get("Range")
    s3_client = get_s3_client()

    try:
        _document_collection().update_one(
            {"workspace_owner": _workspace_owner(), "key": s3_key},
            {"$set": {"last_accessed_at": datetime.utcnow()}},
        )

        if not range_header:
            obj = s3_client.get_object(Bucket=_bucket(), Key=s3_key)
            return Response(obj["Body"].read(), mimetype="application/pdf")

        byte_range = range_header.replace("bytes=", "").split("-")
        start = int(byte_range[0])
        end = int(byte_range[1]) if byte_range[1] else None
        s3_range = f"bytes={start}-{end}" if end is not None else f"bytes={start}-"

        obj = s3_client.get_object(Bucket=_bucket(), Key=s3_key, Range=s3_range)
        return Response(
            obj["Body"].read(),
            status=206,
            headers={
                "Content-Range": obj.get("ContentRange"),
                "Accept-Ranges": "bytes",
                "Content-Type": "application/pdf",
                "Content-Length": str(obj.get("ContentLength", "")),
            },
        )
    except ClientError as err:
        code = err.response.get("Error", {}).get("Code")
        if code in {"NoSuchKey", "404"}:
            return jsonify({"msg": "File not found"}), 404
        return jsonify({"msg": "Stream failed", "error": str(err)}), 500
