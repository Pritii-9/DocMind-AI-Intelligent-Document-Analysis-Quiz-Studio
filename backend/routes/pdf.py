"""PDF router — upload (multipart), list, stream, delete, overview."""
import os
import re
import time
from datetime import datetime, timezone
from urllib.parse import unquote

from botocore.exceptions import ClientError
from fastapi import APIRouter, Depends, Form, HTTPException, Request, UploadFile, File
from fastapi.responses import Response, StreamingResponse
from pydantic import BaseModel

from auth_utils import get_current_user, workspace_owner as get_ws
from config import settings
from database import get_db, get_s3

router = APIRouter(prefix="/pdf", tags=["pdf"])


# ── Helpers ────────────────────────────────────────────────────────────────────

def _bucket() -> str:
    if not settings.S3_BUCKET_NAME:
        raise HTTPException(500, "S3_BUCKET_NAME not configured")
    return settings.S3_BUCKET_NAME


def _workspace_slug(email: str) -> str:
    return email.replace("@", "_at_").replace(".", "_")


def _workspace_prefix(owner: str) -> str:
    return f"workspaces/{_workspace_slug(owner)}/"


def _full_key(owner: str, filename: str) -> str:
    return f"{_workspace_prefix(owner)}{filename}"


def _validate_filename(filename: str) -> tuple[bool, str]:
    clean = os.path.basename((filename or "").strip())
    if not clean:
        return False, "Filename is required"
    if not clean.lower().endswith(".pdf"):
        return False, "Only PDF files are allowed"
    if len(clean) > 140:
        return False, "Filename too long"
    if not re.fullmatch(r"[A-Za-z0-9._ -]+", clean):
        return False, "Filename contains invalid characters"
    return True, clean


def _serialize_doc(doc: dict) -> dict:
    def _iso(v):
        if v is None:
            return None
        if hasattr(v, "isoformat"):
            return v.isoformat()
        return str(v)

    return {
        "id": str(doc["_id"]),
        "filename": doc.get("filename"),
        "key": doc.get("key"),
        "size_bytes": int(doc.get("size_bytes") or 0),
        "uploaded_at": _iso(doc.get("uploaded_at")),
        "last_accessed_at": _iso(doc.get("last_accessed_at")),
        "uploaded_by": doc.get("uploaded_by"),
        "uploaded_by_name": doc.get("uploaded_by_name"),
        "ai_index_status": doc.get("ai_index_status", "pending"),
        "ai_chunk_count": int(doc.get("ai_chunk_count") or 0),
    }


# ── Schemas ────────────────────────────────────────────────────────────────────

class InitUploadIn(BaseModel):
    filename: str


class UploadPartIn(BaseModel):
    partNumber: int
    uploadId: str
    key: str


class CompleteUploadIn(BaseModel):
    key: str
    uploadId: str
    parts: list[dict]


# ── Routes ────────────────────────────────────────────────────────────────────

@router.post("/init-upload")
def init_upload(body: InitUploadIn, user: dict = Depends(get_current_user)):
    ok, result = _validate_filename(body.filename)
    if not ok:
        raise HTTPException(400, result)

    unique = f"{int(time.time())}-{result}"
    key = _full_key(get_ws(user), unique)
    try:
        res = get_s3().create_multipart_upload(Bucket=_bucket(), Key=key, ContentType="application/pdf")
        return {"uploadId": res["UploadId"], "key": key, "fileName": unique}
    except ClientError as e:
        raise HTTPException(500, str(e))


@router.post("/upload-part")
async def upload_part(
    partNumber: int = Form(...),
    uploadId: str = Form(...),
    key: str = Form(...),
    file: UploadFile = File(...),
    user: dict = Depends(get_current_user),
):
    if not key.startswith(_workspace_prefix(get_ws(user))):
        raise HTTPException(403, "Invalid upload key")
    try:
        data = await file.read()
        res = get_s3().upload_part(Bucket=_bucket(), Key=key, PartNumber=partNumber, UploadId=uploadId, Body=data)
        return {"partNumber": partNumber, "etag": res["ETag"]}
    except ClientError as e:
        raise HTTPException(500, str(e))


@router.post("/complete-upload")
def complete_upload(body: CompleteUploadIn, user: dict = Depends(get_current_user)):
    if not key_in_workspace(body.key, get_ws(user)):
        raise HTTPException(403, "Invalid key")
    try:
        get_s3().complete_multipart_upload(
            Bucket=_bucket(), Key=body.key, UploadId=body.uploadId,
            MultipartUpload={"Parts": body.parts},
        )
        head = get_s3().head_object(Bucket=_bucket(), Key=body.key)
        filename = body.key.replace(_workspace_prefix(get_ws(user)), "", 1)
        now = datetime.now(timezone.utc)
        db = get_db()
        db.pdfs.update_one(
            {"workspace_owner": get_ws(user), "key": body.key},
            {"$set": {
                "workspace_owner": get_ws(user), "filename": filename, "key": body.key,
                "size_bytes": int(head.get("ContentLength", 0)), "uploaded_at": now,
                "last_accessed_at": None, "uploaded_by": user["sub"],
                "uploaded_by_name": user.get("name", ""), "ai_index_status": "pending",
                "ai_chunk_count": 0,
            }},
            upsert=True,
        )
        # Background AI ingest
        if settings.AI_AUTO_INGEST_UPLOADS:
            import threading
            doc = db.pdfs.find_one({"workspace_owner": get_ws(user), "key": body.key})
            if doc:
                from services.ai_service import ingest_document_bg
                threading.Thread(
                    target=ingest_document_bg,
                    args=(get_ws(user), str(doc["_id"])),
                    daemon=True,
                ).start()
        return {"msg": "Upload successful"}
    except ClientError as e:
        raise HTTPException(500, str(e))


def key_in_workspace(key: str, owner: str) -> bool:
    return key.startswith(_workspace_prefix(owner))


@router.get("/library")
def library(user: dict = Depends(get_current_user)):
    db = get_db()
    docs = list(db.pdfs.find({"workspace_owner": get_ws(user)}))
    docs.sort(key=lambda d: d.get("uploaded_at") or datetime.min, reverse=True)
    return [_serialize_doc(d) for d in docs]


@router.get("/overview")
def overview(user: dict = Depends(get_current_user)):
    db = get_db()
    owner = get_ws(user)
    docs = list(db.pdfs.find({"workspace_owner": owner}))
    docs.sort(key=lambda d: d.get("uploaded_at") or datetime.min, reverse=True)
    members = list(db.users.find({"$or": [{"email": owner}, {"workspace_owner": owner}]}))

    total_bytes = sum(int(d.get("size_bytes") or 0) for d in docs)
    last_upload = max((d["uploaded_at"] for d in docs if d.get("uploaded_at")), default=None)

    # recent activity feed
    activity = []
    for d in docs[:5]:
        activity.append({
            "type": "upload", "title": f"{d.get('filename')} uploaded",
            "timestamp": d["uploaded_at"].isoformat() if d.get("uploaded_at") else None,
            "actor": d.get("uploaded_by_name") or d.get("uploaded_by"),
        })
    for m in sorted(members, key=lambda x: x.get("created_at") or datetime.min, reverse=True)[:5]:
        activity.append({
            "type": "member", "title": f"{m.get('name', 'Member')} joined",
            "timestamp": m["created_at"].isoformat() if m.get("created_at") else None,
            "actor": m.get("email"),
        })
    activity.sort(key=lambda x: x.get("timestamp") or "", reverse=True)

    return {
        "stats": {
            "total_documents": len(docs),
            "total_storage_bytes": total_bytes,
            "active_members": sum(1 for m in members if m.get("is_active", True)),
            "verified_members": sum(1 for m in members if m.get("verified")),
            "last_upload_at": last_upload.isoformat() if last_upload else None,
        },
        "documents": [_serialize_doc(d) for d in docs[:6]],
        "activity": activity[:8],
    }


@router.get("/stream/{key:path}")
def stream_pdf(key: str, user: dict = Depends(get_current_user), request: Request = None):
    decoded = unquote(key)
    ok, filename = _validate_filename(decoded)
    if not ok:
        raise HTTPException(400, filename)

    s3_key = _full_key(get_ws(user), filename)
    range_header = request.headers.get("range") if request else None
    s3 = get_s3()
    db = get_db()

    try:
        db.pdfs.update_one(
            {"workspace_owner": get_ws(user), "key": s3_key},
            {"$set": {"last_accessed_at": datetime.now(timezone.utc)}},
        )
        if not range_header:
            obj = s3.get_object(Bucket=_bucket(), Key=s3_key)
            return Response(content=obj["Body"].read(), media_type="application/pdf")

        parts = range_header.replace("bytes=", "").split("-")
        start = int(parts[0])
        s3_range = f"bytes={start}-{parts[1]}" if parts[1] else f"bytes={start}-"
        obj = s3.get_object(Bucket=_bucket(), Key=s3_key, Range=s3_range)
        return Response(
            content=obj["Body"].read(),
            status_code=206,
            media_type="application/pdf",
            headers={
                "Content-Range": obj.get("ContentRange", ""),
                "Accept-Ranges": "bytes",
                "Content-Length": str(obj.get("ContentLength", "")),
            },
        )
    except ClientError as e:
        code = e.response.get("Error", {}).get("Code", "")
        if code in {"NoSuchKey", "404"}:
            raise HTTPException(404, "File not found")
        raise HTTPException(500, str(e))


@router.delete("/delete/{doc_id}")
def delete_pdf(doc_id: str, user: dict = Depends(get_current_user)):
    from bson import ObjectId
    if not ObjectId.is_valid(doc_id):
        raise HTTPException(400, "Invalid document id")
    db = get_db()
    doc = db.pdfs.find_one({"_id": ObjectId(doc_id), "workspace_owner": get_ws(user)})
    if not doc:
        raise HTTPException(404, "Document not found")
    try:
        get_s3().delete_object(Bucket=_bucket(), Key=doc["key"])
    except ClientError:
        pass
    db.pdfs.delete_one({"_id": ObjectId(doc_id)})
    db.embeddings.delete_many({"document_id": ObjectId(doc_id)})
    return {"msg": "Document deleted"}
