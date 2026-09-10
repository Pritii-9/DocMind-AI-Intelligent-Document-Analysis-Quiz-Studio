"""
test_auth_routes.py — integration tests for /auth/* HTTP routes.
MongoDB is mocked so no real DB connection is needed.
"""
import bcrypt
import pytest
from datetime import datetime, timedelta, timezone
from unittest.mock import MagicMock, patch


def _hash(pw: str) -> str:
    return bcrypt.hashpw(pw.encode()[:72], bcrypt.gensalt()).decode()


# ── POST /auth/login ───────────────────────────────────────────────────────────

class TestLogin:
    def test_login_success(self, client, mock_db):
        """Valid credentials → 200 + access_token."""
        mock_db.users.find_one.return_value = {
            "_id": "abc123",
            "email": "jane@test.com",
            "password": _hash("Password1"),
            "verified": True,
            "is_active": True,
            "role": "admin",
            "name": "Jane",
            "workspace_owner": "jane@test.com",
        }
        res = client.post("/auth/login", json={"email": "jane@test.com", "password": "Password1"})
        assert res.status_code == 200
        assert "access_token" in res.json()
        assert res.json()["role"] == "admin"

    def test_login_wrong_password(self, client, mock_db):
        """Wrong password → 401."""
        mock_db.users.find_one.return_value = {
            "_id": "abc123",
            "email": "jane@test.com",
            "password": _hash("CorrectPass1"),
            "verified": True,
            "is_active": True,
            "role": "user",
            "name": "Jane",
        }
        res = client.post("/auth/login", json={"email": "jane@test.com", "password": "WrongPass1"})
        assert res.status_code == 401

    def test_login_user_not_found(self, client, mock_db):
        """Non-existent user → 401."""
        mock_db.users.find_one.return_value = None
        res = client.post("/auth/login", json={"email": "ghost@test.com", "password": "Pass1234"})
        assert res.status_code == 401

    def test_login_unverified_user(self, client, mock_db):
        """Unverified email → 403."""
        mock_db.users.find_one.return_value = {
            "_id": "abc123",
            "email": "new@test.com",
            "password": _hash("Pass1234"),
            "verified": False,
            "is_active": True,
            "role": "user",
            "name": "New",
        }
        res = client.post("/auth/login", json={"email": "new@test.com", "password": "Pass1234"})
        assert res.status_code == 403

    def test_login_deactivated_user(self, client, mock_db):
        """Deactivated account → 403."""
        mock_db.users.find_one.return_value = {
            "_id": "abc123",
            "email": "off@test.com",
            "password": _hash("Pass1234"),
            "verified": True,
            "is_active": False,
            "role": "user",
            "name": "Deactivated",
        }
        res = client.post("/auth/login", json={"email": "off@test.com", "password": "Pass1234"})
        assert res.status_code == 403


# ── POST /auth/start-signup ────────────────────────────────────────────────────

class TestStartSignup:
    def test_start_signup_new_user(self, client, mock_db):
        """New email → 200 and verification code sent."""
        mock_db.users.find_one.return_value = None
        mock_db.users.insert_one.return_value = MagicMock()
        with patch("routes.auth._send_email_bg"):
            res = client.post("/auth/start-signup", json={"name": "Alice", "email": "alice@test.com"})
        assert res.status_code == 200
        assert "msg" in res.json()

    def test_start_signup_invalid_email(self, client, mock_db):
        """Malformed email → 400."""
        res = client.post("/auth/start-signup", json={"name": "Bob", "email": "not-an-email"})
        assert res.status_code == 400

    def test_start_signup_empty_name(self, client, mock_db):
        """Empty name → 400."""
        res = client.post("/auth/start-signup", json={"name": "  ", "email": "valid@test.com"})
        assert res.status_code == 400

    def test_start_signup_already_registered(self, client, mock_db):
        """Existing verified user → 409."""
        mock_db.users.find_one.return_value = {
            "_id": "abc123",
            "email": "exists@test.com",
            "verified": True,
            "password": _hash("Pass1"),
        }
        res = client.post("/auth/start-signup", json={"name": "Existing", "email": "exists@test.com"})
        assert res.status_code == 409


# ── POST /auth/complete-signup ─────────────────────────────────────────────────

class TestCompleteSignup:
    def test_complete_signup_success(self, client, mock_db):
        """Valid OTP + strong password → 200."""
        mock_db.users.find_one.return_value = {
            "_id": "abc123",
            "email": "verify@test.com",
            "otp": "123456",
            "otp_expires_at": datetime.now(timezone.utc) + timedelta(minutes=5),
        }
        mock_db.users.update_one.return_value = MagicMock()
        res = client.post("/auth/complete-signup", json={
            "name": "Verify User",
            "email": "verify@test.com",
            "otp": "123456",
            "password": "Secure1pass",
        })
        assert res.status_code == 200

    def test_complete_signup_wrong_otp(self, client, mock_db):
        """Invalid OTP → 400."""
        mock_db.users.find_one.return_value = None  # OTP mismatch
        res = client.post("/auth/complete-signup", json={
            "name": "X", "email": "x@test.com", "otp": "000000", "password": "Secure1pass",
        })
        assert res.status_code == 400

    def test_complete_signup_weak_password(self, client, mock_db):
        """Weak password (no uppercase) → 400."""
        res = client.post("/auth/complete-signup", json={
            "name": "X", "email": "x@test.com", "otp": "123456", "password": "weakpass1",
        })
        assert res.status_code == 400

    def test_complete_signup_otp_not_6_digits(self, client, mock_db):
        """OTP too short → 400."""
        res = client.post("/auth/complete-signup", json={
            "name": "X", "email": "x@test.com", "otp": "12", "password": "Secure1pass",
        })
        assert res.status_code == 400

    def test_complete_signup_expired_otp(self, client, mock_db):
        """Expired OTP → 400."""
        mock_db.users.find_one.return_value = {
            "_id": "abc123",
            "email": "expire@test.com",
            "otp": "654321",
            "otp_expires_at": datetime.now(timezone.utc) - timedelta(minutes=15),
        }
        res = client.post("/auth/complete-signup", json={
            "name": "Expire", "email": "expire@test.com", "otp": "654321", "password": "Secure1pass",
        })
        assert res.status_code == 400


# ── GET /auth/me ───────────────────────────────────────────────────────────────

class TestGetMe:
    def test_me_authenticated(self, client, mock_db, auth_headers):
        """Valid JWT → 200 + user doc."""
        mock_db.users.find_one.return_value = {
            "_id": "abc123",
            "email": "admin@test.com",
            "name": "Admin",
            "role": "admin",
        }
        res = client.get("/auth/me", headers=auth_headers)
        assert res.status_code == 200

    def test_me_no_token(self, client):
        """No Authorization header → 401."""
        res = client.get("/auth/me")
        assert res.status_code == 401

    def test_me_invalid_token(self, client):
        """Bad token → 401."""
        res = client.get("/auth/me", headers={"Authorization": "Bearer garbage.token.here"})
        assert res.status_code == 401


# ── GET /auth/users — admin only ───────────────────────────────────────────────

class TestGetUsers:
    def test_get_users_admin(self, client, mock_db, auth_headers):
        """Admin JWT → 200."""
        mock_db.users.find.return_value = []
        res = client.get("/auth/users", headers=auth_headers)
        assert res.status_code == 200

    def test_get_users_non_admin_forbidden(self, client, mock_db, user_headers):
        """Non-admin JWT → 403."""
        res = client.get("/auth/users", headers=user_headers)
        assert res.status_code == 403

    def test_get_users_no_auth(self, client):
        """No auth → 401."""
        res = client.get("/auth/users")
        assert res.status_code == 401


# ── Password validation helper ─────────────────────────────────────────────────

class TestPasswordValidation:
    """Test _validate_password directly — edge cases."""

    def setup_method(self):
        from routes.auth import _validate_password
        self.validate = _validate_password

    def test_valid_password(self):
        ok, err = self.validate("StrongPass1")
        assert ok is True
        assert err == ""

    def test_too_short(self):
        ok, _ = self.validate("Sh0rt")
        assert ok is False

    def test_no_uppercase(self):
        ok, _ = self.validate("alllower1")
        assert ok is False

    def test_no_lowercase(self):
        ok, _ = self.validate("ALLUPPER1")
        assert ok is False

    def test_no_digit(self):
        ok, _ = self.validate("NoDigitPass")
        assert ok is False

    def test_exactly_8_chars_valid(self):
        ok, _ = self.validate("Passw0rd")
        assert ok is True
