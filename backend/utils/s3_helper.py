import boto3
import os
from botocore.config import Config

# Configure for streaming (high timeout)
s3_config = Config(
    region_name = os.getenv("AWS_REGION"),
    signature_version = 's3v4',
    retries = {'max_attempts': 10, 'mode': 'standard'}
)

s3_client = boto3.client(
    's3',
    aws_access_key_id=os.getenv("AWS_ACCESS_KEY"),
    aws_secret_access_key=os.getenv("AWS_SECRET_KEY"),
    config=s3_config
)

def get_s3_range_stream(key, byte_range):
    """
    Fetches a specific chunk of a PDF from S3.
    """
    bucket = os.getenv("S3_BUCKET_NAME")
    return s3_client.get_object(Bucket=bucket, Key=key, Range=byte_range)

def generate_presigned_upload_url(key):
    """
    Generates a URL that allows the frontend to upload directly to S3 securely.
    """
    return s3_client.generate_presigned_url(
        'put_object',
        Params={'Bucket': os.getenv("S3_BUCKET_NAME"), 'Key': key},
        ExpiresIn=3600
    )