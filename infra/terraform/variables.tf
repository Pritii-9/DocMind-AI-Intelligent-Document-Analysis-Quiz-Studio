variable "aws_region" {
  type        = string
  description = "AWS region for S3 bucket deployment"
  default     = "ap-south-1"
}

variable "aws_access_key" {
  type        = string
  description = "AWS Access Key ID"
  default     = null
  sensitive   = true
}

variable "aws_secret_key" {
  type        = string
  description = "AWS Secret Access Key"
  default     = null
  sensitive   = true
}

variable "environment" {
  type        = string
  description = "Deployment environment (development, staging, production)"
  default     = "development"
}

variable "bucket_name" {
  type        = string
  description = "Globally unique name for the S3 PDF storage bucket"
  default     = "docmind-pdf-storage-dev"
}

variable "enable_versioning" {
  type        = bool
  description = "Enable S3 object versioning for file recovery and revision history"
  default     = true
}

variable "cors_allowed_origins" {
  type        = list(string)
  description = "List of allowed CORS origins for PDF byte-range streaming"
  default     = ["http://localhost:5173", "http://localhost:5174"]
}

variable "abort_incomplete_multipart_upload_days" {
  type        = number
  description = "Number of days after which incomplete multipart uploads are cleaned up"
  default     = 7
}
