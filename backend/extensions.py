from flask_mail import Mail
from flask_jwt_extended import JWTManager
import boto3
import os

mail = Mail()
jwt = JWTManager()

# S3 Client for Multipart Uploads
s3_client = boto3.client(
    's3',
    aws_access_key_id=os.getenv("AWS_ACCESS_KEY"),
    aws_secret_access_key=os.getenv("AWS_SECRET_KEY"),
    region_name=os.getenv("AWS_REGION")
)