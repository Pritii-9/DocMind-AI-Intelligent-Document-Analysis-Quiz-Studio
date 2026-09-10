"""
test_auth_utils.py — unit tests for JWT creation, decoding, and role guards.
No HTTP calls — pure function-level tests.
"""
import pytest
import time
from jose import jwt
from unittest.mock import MagicMock, patch

from auth_utils import (
    create_access_token,
    decode_token,
    get_current_user,
    require_admin,
    workspace_owner,
)
from config import settings


# ── Token creation ─────────────────────────────────────────────────────────────

class TestCreateAccessToken:
    def test_returns_string(self):
        token = create_access_token("user@test.com")
        assert isinstance(token, str)
        assert len(token) > 10

    def test_sub_claim_present(self):
        token = create_access_token("user@test.com")
        payload = jwt.decode(token, settings.JWT_SECRET, algorithms=["HS256"])
        assert payload["sub"] == "user@test.com"

    def test_exp_claim_present(self):
        token = create_access_token("user@test.com")
        payload = jwt.decode(token, settings.JWT_SECRET, algorithms=["HS256"])
        assert "exp" in payload

    def test_extra_claims_merged(self):
        token = create_access_token("admin@test.com", {"role": "admin", "name": "Alice"})
        payload = jwt.decode(token, settings.JWT_SECRET, algorithms=["HS256"])
        assert payload["role"] == "admin"
        assert payload["name"] == "Alice"

    def test_different_subjects_produce_different_tokens(self):
        t1 = create_access_token("a@test.com")
        t2 = create_access_token("b@test.com")
        assert t1 != t2


# ── Token decoding ─────────────────────────────────────────────────────────────

class TestDecodeToken:
    def test_valid_token_decoded(self):
        token = create_access_token("decode@test.com")
        payload = decode_token(token)
        assert payload["sub"] == "decode@test.com"

    def test_invalid_token_raises_401(self):
        from fastapi import HTTPException
        with pytest.raises(HTTPException) as exc:
            decode_token("not.a.valid.token")
        assert exc.value.status_code == 401

    def test_tampered_token_raises_401(self):
        from fastapi import HTTPException
        token = create_access_token("x@test.com")
        tampered = token[:-5] + "XXXXX"  # corrupt signature
        with pytest.raises(HTTPException):
            decode_token(tampered)


# ── Role guards ────────────────────────────────────────────────────────────────

class TestRequireAdmin:
    def test_admin_role_passes(self):
        admin_payload = {"sub": "a@test.com", "role": "admin"}
        result = require_admin(admin_payload)
        assert result["role"] == "admin"

    def test_user_role_raises_403(self):
        from fastapi import HTTPException
        user_payload = {"sub": "u@test.com", "role": "user"}
        with pytest.raises(HTTPException) as exc:
            require_admin(user_payload)
        assert exc.value.status_code == 403

    def test_missing_role_raises_403(self):
        from fastapi import HTTPException
        with pytest.raises(HTTPException):
            require_admin({"sub": "x@test.com"})


# ── Workspace owner helper ─────────────────────────────────────────────────────

class TestWorkspaceOwner:
    def test_returns_workspace_owner_field(self):
        user = {"sub": "a@test.com", "workspace_owner": "owner@test.com"}
        assert workspace_owner(user) == "owner@test.com"

    def test_falls_back_to_sub(self):
        user = {"sub": "a@test.com"}
        assert workspace_owner(user) == "a@test.com"

    def test_empty_dict_returns_empty_string(self):
        assert workspace_owner({}) == ""
