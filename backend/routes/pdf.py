from flask import Blueprint, request, Response, jsonify
from flask_jwt_extended import jwt_required
from extensions import s3_client
from botocore.exceptions import ClientError
import os

pdf_bp = Blueprint("pdf", __name__)
S3_BUCKET = os.getenv("S3_BUCKET_NAME")

@pdf_bp.before_request
def check_s3_config():
    if not S3_BUCKET:
        return jsonify({"msg": "S3_BUCKET_NAME missing from .env"}), 500

# --- NEW MULTIPART UPLOAD ROUTES ---

@pdf_bp.route("/init-upload", methods=["POST"])
@jwt_required()
def init_multipart():
    """Step 1: Start the multipart session in S3."""
    filename = request.json.get("filename")
    try:
        res = s3_client.create_multipart_upload(Bucket=S3_BUCKET, Key=filename)
        return jsonify({"uploadId": res['UploadId'], "key": filename}), 200
    except ClientError as e:
        return jsonify({"msg": "S3 Init Failed", "error": str(e)}), 500

@pdf_bp.route("/upload-part", methods=["POST"])
@jwt_required()
def upload_part():
    """Step 2: Receive one 5MB chunk and send to S3."""
    part_number = int(request.form['partNumber'])
    upload_id = request.form['uploadId']
    key = request.form['key']
    file_chunk = request.files['file'].read()

    try:
        res = s3_client.upload_part(
            Bucket=S3_BUCKET, Key=key, PartNumber=part_number,
            UploadId=upload_id, Body=file_chunk
        )
        return jsonify({"partNumber": part_number, "etag": res['ETag']}), 200
    except ClientError as e:
        return jsonify({"msg": "Part Upload Failed", "error": str(e)}), 500

@pdf_bp.route("/complete-upload", methods=["POST"])
@jwt_required()
def complete_multipart():
    """Step 3: Tell S3 to combine all parts into one PDF."""
    data = request.json
    try:
        s3_client.complete_multipart_upload(
            Bucket=S3_BUCKET, Key=data['key'], UploadId=data['uploadId'],
            MultipartUpload={'Parts': data['parts']}
        )
        return jsonify({"msg": "Upload Successful!"}), 200
    except ClientError as e:
        return jsonify({"msg": "S3 Completion Failed", "error": str(e)}), 500

# --- EXISTING ROUTES ---

@pdf_bp.route("/list", methods=["GET"])
@jwt_required()
def list_pdfs():
    try:
        response = s3_client.list_objects_v2(Bucket=S3_BUCKET)
        files = [obj['Key'] for obj in response.get('Contents', [])]
        return jsonify(files), 200
    except ClientError as e:
        return jsonify({"msg": "S3 Error", "error": str(e)}), 500

@pdf_bp.route("/stream/<key>", methods=["GET"])
@jwt_required()
def stream_pdf(key):
    try:
        range_header = request.headers.get('Range', None)
        if not range_header:
            obj = s3_client.get_object(Bucket=S3_BUCKET, Key=key)
            return Response(obj['Body'].read(), mimetype='application/pdf')

        byte_range = range_header.replace('bytes=', '').split('-')
        start = int(byte_range[0])
        end = int(byte_range[1]) if byte_range[1] else None
        s3_range = f"bytes={start}-{end}" if end is not None else f"bytes={start}-"
        
        resp = s3_client.get_object(Bucket=S3_BUCKET, Key=key, Range=s3_range)
        return Response(resp['Body'].read(), status=206, headers={
            'Content-Range': resp.get('ContentRange'),
            'Accept-Ranges': 'bytes',
            'Content-Type': 'application/pdf',
            'Content-Length': resp.get('ContentLength')
        })
    except ClientError as e:
        return jsonify({"msg": "Stream failed", "error": str(e)}), 500