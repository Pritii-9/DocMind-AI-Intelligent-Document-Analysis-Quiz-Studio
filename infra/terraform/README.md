# DocStream — AWS S3 Terraform Infrastructure

This directory contains production-ready Infrastructure as Code (IaC) written in **Terraform** for provisioning and managing AWS S3 storage for PDF documents and byte-range streaming.

---

## 🏗️ Architecture & Features

1. **S3 Bucket Provisioning**: Automatically provisions a dedicated S3 bucket with environment tagging.
2. **Public Access Block**: Strict `block_public_acls`, `block_public_policy`, `ignore_public_acls`, and `restrict_public_buckets` enabled by default.
3. **Server-Side Encryption (SSE)**: Enforces default `AES256` encryption at rest with bucket key optimization.
4. **CORS Configuration**: Configured specifically for PDF byte-range requests (`Accept-Ranges`, `Content-Range`, `Content-Length`) and multipart uploads.
5. **Lifecycle Management**:
   - Automatically aborts incomplete multipart uploads after 7 days to eliminate storage waste.
   - Transitions noncurrent PDF versions to `STANDARD_IA` after 30 days and expires them after 90 days.

---

## 🚀 Usage

### 1. Initialize Terraform
```bash
cd infra/terraform
terraform init
```

### 2. Preview Changes
```bash
terraform plan -var-file="terraform.tfvars.example"
```

### 3. Apply Infrastructure
```bash
terraform apply -var-file="terraform.tfvars.example"
```

---

## 📄 File Overview

| File | Purpose |
|---|---|
| `providers.tf` | AWS Provider configuration & optional S3 remote state setup |
| `main.tf` | S3 bucket, encryption, CORS, public access block & lifecycle rules |
| `variables.tf` | Configurable input parameters |
| `outputs.tf` | S3 Bucket Name, ARN, Region, and Domain Name outputs |
| `terraform.tfvars.example` | Template values for environment deployment |
