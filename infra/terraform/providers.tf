terraform {
  required_version = ">= 1.5.0"

  required_providers {
    aws = {
      source  = "hashicorp/aws"
      version = "~> 5.0"
    }
  }

  # Uncomment to enable Remote S3 State storage & DynamoDB lock table
  # backend "s3" {
  #   bucket         = "my-tf-state-bucket"
  #   key            = "pdf-stream/terraform.tfstate"
  #   region         = "ap-south-1"
  #   dynamodb_table = "terraform-locks"
  #   encrypt        = true
  # }
}

provider "aws" {
  region     = var.aws_region
  access_key = var.aws_access_key
  secret_key = var.aws_secret_key

  default_tags {
    tags = {
      Project     = "DocMind AI"
      Environment = var.environment
      ManagedBy   = "Terraform"
    }
  }
}
