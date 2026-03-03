import os
import re
import time
from urllib.parse import unquote

from botocore.exceptions import ClientError
from flask import Blueprint, current_app, jsonify, request, Response
from flask_jwt_extended import get_jwt, get_jwt_identity, jwt_required

from extensions import get_s3_client

pdf_bp = Blueprint("pdf", __name__)


def _bucket():
    return current_app.config.get("S3_BUCKET_NAME")


def _workspace_owner():
    claims = get_jwt()
    return claims.get("workspace_owner") or get_jwt_identity()


def _workspace_prefix():
    owner = _workspace_owner().replace("@", "_at_").replace(".", "_")
    return f"workspaces/{owner}/"


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


@pdf_bp.before_request
def check_s3_config():
    if not _bucket():
        return jsonify({"msg": "S3_BUCKET_NAME missing from environment"}), 500


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
        return jsonify({"msg": "Upload successful"}), 200
    except ClientError as err:
        return jsonify({"msg": "S3 completion failed", "error": str(err)}), 500


@pdf_bp.route("/list", methods=["GET"])
@jwt_required()
def list_pdfs():
    s3_client = get_s3_client()
    prefix = _workspace_prefix()

    try:
        response = s3_client.list_objects_v2(Bucket=_bucket(), Prefix=prefix)
        files = [
            obj["Key"].replace(prefix, "", 1)
            for obj in response.get("Contents", [])
            if obj["Key"].endswith(".pdf")
        ]
        return jsonify(sorted(files, reverse=True)), 200
    except ClientError as err:
        return jsonify({"msg": "S3 list failed", "error": str(err)}), 500


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
