aws_region           = "eu-north-1"
aws_access_key       = "AKIAS625MQH5IMC24F5U"
aws_secret_key       = "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"
environment          = "production"
bucket_name          = "docmind-pdf-storage-prod-2026"
enable_versioning    = true
cors_allowed_origins = [
  "http://localhost:5173",
  "http://localhost:8000"
]
abort_incomplete_multipart_upload_days = 7
