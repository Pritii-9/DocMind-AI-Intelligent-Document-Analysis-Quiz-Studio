# ── AWS S3 Bucket for PDF Storage & Byte-Range Streaming ─────────────────────

resource "aws_s3_bucket" "pdf_storage" {
  bucket        = var.bucket_name
  force_destroy = var.environment == "development" ? true : false

  tags = {
    Name = var.bucket_name
  }
}

# ── Public Access Block (Strict Security Best Practice) ────────────────────────
resource "aws_s3_bucket_public_access_block" "pdf_storage_pab" {
  bucket = aws_s3_bucket.pdf_storage.id

  block_public_acls       = true
  block_public_policy     = true
  ignore_public_acls      = true
  restrict_public_buckets = true
}

# ── Server-Side Encryption (AES256 Default) ───────────────────────────────────
resource "aws_s3_bucket_server_side_encryption_configuration" "pdf_storage_sse" {
  bucket = aws_s3_bucket.pdf_storage.id

  rule {
    apply_server_side_encryption_by_default {
      sse_algorithm = "AES256"
    }
    bucket_key_enabled = true
  }
}

# ── Object Versioning ──────────────────────────────────────────────────────────
resource "aws_s3_bucket_versioning" "pdf_storage_versioning" {
  bucket = aws_s3_bucket.pdf_storage.id

  versioning_configuration {
    status = var.enable_versioning ? "Enabled" : "Disabled"
  }
}

# ── CORS Configuration for Multipart Upload & PDF Byte-Range Streaming ────────
resource "aws_s3_bucket_cors_configuration" "pdf_storage_cors" {
  bucket = aws_s3_bucket.pdf_storage.id

  cors_rule {
    allowed_headers = ["*"]
    allowed_methods = ["GET", "PUT", "POST", "DELETE", "HEAD"]
    allowed_origins = var.cors_allowed_origins
    expose_headers = [
      "ETag",
      "Accept-Ranges",
      "Content-Range",
      "Content-Length",
      "Content-Type"
    ]
    max_age_seconds = 3000
  }
}

# ── Lifecycle Rules (Cleanup Incomplete Uploads & Transition Infrequent Access) ─
resource "aws_s3_bucket_lifecycle_configuration" "pdf_storage_lifecycle" {
  bucket = aws_s3_bucket.pdf_storage.id

  rule {
    id     = "cleanup-incomplete-multipart-uploads"
    status = "Enabled"

    filter {}

    abort_incomplete_multipart_upload {
      days_after_initiation = var.abort_incomplete_multipart_upload_days
    }
  }

  rule {
    id     = "transition-old-versions"
    status = var.enable_versioning ? "Enabled" : "Disabled"

    filter {}

    noncurrent_version_transition {
      noncurrent_days = 30
      storage_class   = "STANDARD_IA"
    }

    noncurrent_version_expiration {
      noncurrent_days = 90
    }
  }
}
