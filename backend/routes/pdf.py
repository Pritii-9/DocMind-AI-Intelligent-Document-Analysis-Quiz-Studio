from flask import Blueprint, request, Response, jsonify
from flask_jwt_extended import jwt_required, get_jwt_identity
from extensions import s3_client
from botocore.exceptions import ClientError
import os

pdf_bp = Blueprint("pdf", __name__)
S3_BUCKET = os.getenv("S3_BUCKET_NAME")

@pdf_bp.before_request
def check_s3_config():
    if not S3_BUCKET:
        return jsonify({"msg": "S3_BUCKET_NAME missing from .env"}), 500

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
        
        # Standard full-file stream
        if not range_header:
            obj = s3_client.get_object(Bucket=S3_BUCKET, Key=key)
            return Response(obj['Body'].read(), mimetype='application/pdf')

        # Byte-Range Logic (Resume-Strong Optimization)
        byte_range = range_header.replace('bytes=', '').split('-')
        start = int(byte_range[0])
        end = int(byte_range[1]) if byte_range[1] else None
        s3_range = f"bytes={start}-{end}" if end is not None else f"bytes={start}-"
        
        resp = s3_client.get_object(Bucket=S3_BUCKET, Key=key, Range=s3_range)

        return Response(
            resp['Body'].read(),
            status=206,
            headers={
                'Content-Range': resp.get('ContentRange'),
                'Accept-Ranges': 'bytes',
                'Content-Type': 'application/pdf',
                'Content-Length': resp.get('ContentLength')
            }
        )
    except ClientError as e:
        if e.response['Error']['Code'] == "NoSuchKey":
            return jsonify({"msg": "File not found in S3 bucket"}), 404
        return jsonify({"msg": "S3 Client Error", "error": str(e)}), 500