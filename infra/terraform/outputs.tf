output "s3_bucket_name" {
  description = "The name of the created S3 bucket"
  value       = aws_s3_bucket.pdf_storage.id
}

output "s3_bucket_arn" {
  description = "The ARN of the S3 bucket"
  value       = aws_s3_bucket.pdf_storage.arn
}

output "s3_bucket_region" {
  description = "The AWS region where the bucket resides"
  value       = aws_s3_bucket.pdf_storage.region
}

output "s3_bucket_domain_name" {
  description = "The bucket domain name"
  value       = aws_s3_bucket.pdf_storage.bucket_domain_name
}
