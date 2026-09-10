"""
conftest.py — shared fixtures for all backend tests.
Uses FastAPI TestClient with MongoDB mocked via monkeypatch.
No real DB or SMTP connections are made during tests.
"""
import os
import sys
import pytest

# ── Make backend root importable ─────────────────────────────────────────────
sys.path.insert(0, os.path.dirname(os.path.dirname(__file__)))

# Patch env before importing app so Settings validation passes
os.environ.setdefault("JWT_SECRET",       "test-secret-key-32-chars-minimum!!")
os.environ.setdefault("MONGO_URI",        "mongodb://localhost:27017/test_docmind")
os.environ.setdefault("AWS_ACCESS_KEY",   "test")
os.environ.setdefault("AWS_SECRET_KEY",   "test")
os.environ.setdefault("AWS_BUCKET_NAME",  "test-bucket")
os.environ.setdefault("AWS_REGION",       "us-east-1")
os.environ.setdefault("GROQ_API_KEY",     "test-groq-key")
os.environ.setdefault("MAIL_SERVER",      "smtp.example.com")
os.environ.setdefault("MAIL_PORT",        "587")
os.environ.setdefault("MAIL_USERNAME",    "noreply@example.com")
os.environ.setdefault("MAIL_PASSWORD",    "mail-pass")
os.environ.setdefault("CORS_ORIGINS",     "http://localhost:5173")

from fastapi.testclient import TestClient
from unittest.mock import MagicMock


@pytest.fixture(scope="function")
def mock_db(monkeypatch):
    """In-memory fake MongoDB database backed by plain dicts."""
    db = MagicMock()
    import database
    monkeypatch.setattr(database, "get_db", lambda: db)
    monkeypatch.setattr("routes.auth.get_db", lambda: db)
    return db


@pytest.fixture(scope="function")
def client(mock_db):
    """TestClient with DB patched to mock_db — freshly created per test."""
    from main import app
    with TestClient(app, raise_server_exceptions=True) as c:
        yield c


@pytest.fixture()
def admin_token(client):
    """
    Returns a valid JWT for an admin user without hitting the DB.
    Generated directly via auth_utils.create_access_token.
    """
    from auth_utils import create_access_token
    return create_access_token(
        "admin@test.com",
        {"role": "admin", "name": "Test Admin", "workspace_owner": "admin@test.com"},
    )


@pytest.fixture()
def user_token():
    """JWT for a regular (non-admin) user."""
    from auth_utils import create_access_token
    return create_access_token(
        "user@test.com",
        {"role": "user", "name": "Test User", "workspace_owner": "admin@test.com"},
    )


@pytest.fixture()
def auth_headers(admin_token):
    return {"Authorization": f"Bearer {admin_token}"}


@pytest.fixture()
def user_headers(user_token):
    return {"Authorization": f"Bearer {user_token}"}
