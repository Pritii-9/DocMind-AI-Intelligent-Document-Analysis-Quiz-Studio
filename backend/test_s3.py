import boto3, os
from dotenv import load_dotenv
load_dotenv()
key = os.getenv('AWS_ACCESS_KEY')
secret = os.getenv('AWS_SECRET_KEY')
region = os.getenv('AWS_REGION')
bucket = os.getenv('S3_BUCKET_NAME')
print('Region:', repr(region))
print('Key:', repr(key))
print('Bucket:', repr(bucket))
print('Secret length:', len(secret) if secret else 0)
try:
    s3 = boto3.client('s3', aws_access_key_id=key, aws_secret_access_key=secret, region_name=region)
    r = s3.create_multipart_upload(Bucket=bucket, Key='test/test.pdf', ContentType='application/pdf')
    print('SUCCESS! UploadId:', r['UploadId'])
    s3.abort_multipart_upload(Bucket=bucket, Key='test/test.pdf', UploadId=r['UploadId'])
    print('Cleanup done.')
except Exception as e:
    print('ERROR:', repr(e))
