"""Shared singletons: MongoDB client, S3 client."""
import boto3
from pymongo import MongoClient
from pymongo.errors import PyMongoError

from config import settings

# ── MongoDB ──────────────────────────────────────────────────────────────────
_mongo_client: MongoClient | None = None


def get_mongo_client() -> MongoClient:
    global _mongo_client
    if _mongo_client is None:
        _mongo_client = MongoClient(
            settings.MONGO_URI,
            serverSelectionTimeoutMS=settings.MONGO_SERVER_SELECTION_TIMEOUT_MS,
        )
    return _mongo_client


def get_db():
    return get_mongo_client()[settings.MONGO_DB_NAME]


# ── AWS S3 ────────────────────────────────────────────────────────────────────
_s3_client = None


def get_s3():
    global _s3_client
    if _s3_client is None:
        _s3_client = boto3.client(
            "s3",
            region_name=settings.AWS_REGION,
            aws_access_key_id=settings.AWS_ACCESS_KEY,
            aws_secret_access_key=settings.AWS_SECRET_KEY,
        )
    return _s3_client
