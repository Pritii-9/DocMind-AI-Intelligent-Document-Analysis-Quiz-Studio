"""Auth router — register, OTP verify, login, invite, team management."""
import re
import secrets
import string
import smtplib
from datetime import datetime, timedelta, timezone
from email.mime.text import MIMEText

from bson import ObjectId
from fastapi import APIRouter, Depends, HTTPException
import bcrypt
from pydantic import BaseModel, EmailStr

from auth_utils import create_access_token, get_current_user, require_admin
from config import settings
from database import get_db

router = APIRouter(prefix="/auth", tags=["auth"])

def _hash_password(password: str) -> str:
    pwd_bytes = password.encode("utf-8")[:72]
    return bcrypt.hashpw(pwd_bytes, bcrypt.gensalt()).decode("utf-8")


def _verify_password(password: str, hashed: str) -> bool:
    if not hashed:
        return False
    pwd_bytes = password.encode("utf-8")[:72]
    try:
        return bcrypt.checkpw(pwd_bytes, hashed.encode("utf-8"))
    except Exception:
        return False


EMAIL_RE = re.compile(r"^[^@\s]+@[^@\s]+\.[^@\s]+$")


# ── Helpers ───────────────────────────────────────────────────────────────────

def _validate_email(email: str) -> bool:
    return bool(EMAIL_RE.match(email))


def _validate_password(pw: str) -> tuple[bool, str]:
    if len(pw) < 8:
        return False, "Password must be at least 8 characters"
    if not re.search(r"[A-Z]", pw):
        return False, "Password must contain an uppercase letter"
    if not re.search(r"[a-z]", pw):
        return False, "Password must contain a lowercase letter"
    if not re.search(r"\d", pw):
        return False, "Password must contain a number"
    return True, ""


def _gen_otp() -> str:
    return f"{secrets.randbelow(900000) + 100000}"


def _gen_invite_code() -> str:
    return "".join(secrets.choice(string.ascii_uppercase + string.digits) for _ in range(6))


def _send_email(to: str, subject: str, body: str):
    """Simple synchronous SMTP send — runs in a background thread from endpoint."""
    msg = MIMEText(body)
    msg["Subject"] = subject
    msg["From"] = settings.MAIL_USERNAME
    msg["To"] = to
    try:
        with smtplib.SMTP(settings.MAIL_SERVER, settings.MAIL_PORT) as smtp:
            if settings.MAIL_USE_TLS:
                smtp.starttls()
            smtp.login(settings.MAIL_USERNAME, settings.MAIL_PASSWORD)
            smtp.sendmail(settings.MAIL_USERNAME, [to], msg.as_string())
    except Exception as e:
        print(f"[MAIL ERROR] {e}")


def _send_email_bg(to: str, subject: str, body: str):
    import threading
    threading.Thread(target=_send_email, args=(to, subject, body), daemon=True).start()


# ── Schemas ────────────────────────────────────────────────────────────────────

class StartSignupIn(BaseModel):
    name: str
    email: str


class UpdateProfileIn(BaseModel):
    name: str


class CompleteSignupIn(BaseModel):
    name: str
    email: str
    otp: str
    password: str


class LoginIn(BaseModel):
    email: str
    password: str


class ForgotPasswordIn(BaseModel):
    email: str


class ResetPasswordIn(BaseModel):
    email: str
    reset_code: str
    password: str


class InviteMemberIn(BaseModel):
    name: str
    email: str


class VerifyInviteIn(BaseModel):
    email: str
    invite_code: str
    password: str


# ── Routes ────────────────────────────────────────────────────────────────────

@router.post("/start-signup")
def start_signup(body: StartSignupIn):
    name = body.name.strip()
    email = body.email.strip().lower()
    if not name:
        raise HTTPException(400, "Name is required")
    if not _validate_email(email):
        raise HTTPException(400, "Invalid email address")

    db = get_db()
    existing = db.users.find_one({"email": email})
    if existing and (existing.get("verified") or existing.get("password")):
        raise HTTPException(409, "Email already registered. Please login.")

    otp = _gen_otp()
    now = datetime.now(timezone.utc)
    payload = {
        "name": name, "email": email, "role": "admin",
        "otp": otp, "otp_expires_at": now + timedelta(minutes=10),
        "verified": False, "is_active": True, "workspace_owner": email,
    }
    if existing:
        db.users.update_one({"email": email}, {"$set": payload})
    else:
        payload["created_at"] = now
        db.users.insert_one(payload)

    _send_email_bg(email, "Verify your account", f"Your OTP is: {otp}. It expires in 10 minutes.")
    return {"msg": "Verification code sent"}


@router.post("/complete-signup")
def complete_signup(body: CompleteSignupIn):
    email = body.email.strip().lower()
    if not _validate_email(email):
        raise HTTPException(400, "Invalid email")
    if len(body.otp) != 6 or not body.otp.isdigit():
        raise HTTPException(400, "OTP must be 6 digits")
    ok, err = _validate_password(body.password)
    if not ok:
        raise HTTPException(400, err)

    db = get_db()
    user = db.users.find_one({"email": email, "otp": body.otp})
    if not user:
        raise HTTPException(400, "Invalid email or OTP")
    
    expires_at = user.get("otp_expires_at")
    if not expires_at:
        raise HTTPException(400, "OTP expired or invalid")
    if expires_at.tzinfo is None:
        expires_at = expires_at.replace(tzinfo=timezone.utc)
    if datetime.now(timezone.utc) > expires_at:
        raise HTTPException(400, "OTP expired. Request a new one.")

    db.users.update_one(
        {"email": email},
        {"$set": {"name": body.name.strip(), "password": _hash_password(body.password), "verified": True},
         "$unset": {"otp": "", "otp_expires_at": ""}},
    )
    return {"msg": "Account created. You can sign in now."}


@router.post("/login")
def login(body: LoginIn):
    email = body.email.strip().lower()
    db = get_db()
    user = db.users.find_one({"email": email})
    if not user or not _verify_password(body.password, user.get("password", "")):
        raise HTTPException(401, "Invalid credentials")
    if not user.get("is_active", True):
        raise HTTPException(403, "Account deactivated. Contact your admin.")
    if not user.get("verified"):
        raise HTTPException(403, "Email not verified")

    workspace_owner = user.get("workspace_owner") or user.get("invited_by") or email
    token = create_access_token(
        email,
        {"role": user.get("role", "user"), "name": user.get("name", ""), "workspace_owner": workspace_owner},
    )
    return {"access_token": token, "role": user.get("role"), "name": user.get("name")}


@router.post("/forgot-password")
def forgot_password(body: ForgotPasswordIn):
    email = body.email.strip().lower()
    db = get_db()
    user = db.users.find_one({"email": email})
    if not user or not user.get("verified"):
        return {"msg": "If a verified account exists, a reset code has been sent."}
    if not user.get("is_active", True):
        raise HTTPException(403, "Account is deactivated. Please contact your admin.")

    code = _gen_otp()
    db.users.update_one(
        {"email": email},
        {"$set": {"reset_code": code, "reset_code_expires_at": datetime.now(timezone.utc) + timedelta(minutes=10)}},
    )
    _send_email_bg(email, "Reset your password",
                   f"Hello {user.get('name', '')}, your reset code is {code}. Expires in 10 minutes.")
    return {"msg": "If an account exists, a reset code has been sent."}


@router.post("/reset-password")
def reset_password(body: ResetPasswordIn):
    email = body.email.strip().lower()
    if len(body.reset_code) != 6 or not body.reset_code.isdigit():
        raise HTTPException(400, "Reset code must be 6 digits")
    ok, err = _validate_password(body.password)
    if not ok:
        raise HTTPException(400, err)

    db = get_db()
    user = db.users.find_one({"email": email, "reset_code": body.reset_code})
    if not user:
        raise HTTPException(400, "Invalid email or reset code")
    if datetime.now(timezone.utc) > user["reset_code_expires_at"].replace(tzinfo=timezone.utc):
        raise HTTPException(400, "Reset code expired")

    db.users.update_one(
        {"email": email},
        {"$set": {"password": _hash_password(body.password)}, "$unset": {"reset_code": "", "reset_code_expires_at": ""}},
    )
    return {"msg": "Password updated. You can sign in now."}


@router.get("/me")
def me(user: dict = Depends(get_current_user)):
    db = get_db()
    doc = db.users.find_one(
        {"email": user["sub"]},
        {"password": 0, "otp": 0, "otp_expires_at": 0, "reset_code": 0, "reset_code_expires_at": 0},
    )
    if not doc:
        raise HTTPException(404, "User not found")
    doc["_id"] = str(doc["_id"])
    return doc


@router.patch("/update-profile")
def update_profile(body: UpdateProfileIn, user: dict = Depends(get_current_user)):
    name = body.name.strip()
    if not name:
        raise HTTPException(400, "Name cannot be empty")
    db = get_db()
    db.users.update_one({"email": user["sub"]}, {"$set": {"name": name}})
    return {"msg": "Profile updated successfully", "name": name}


@router.get("/users")
def get_users(admin: dict = Depends(require_admin)):
    db = get_db()
    workspace = admin.get("workspace_owner") or admin["sub"]
    docs = list(db.users.find(
        {"$or": [{"email": workspace}, {"workspace_owner": workspace}]},
        {"password": 0, "otp": 0, "otp_expires_at": 0, "invite_code": 0, "reset_code": 0},
    ))
    for d in docs:
        d["_id"] = str(d["_id"])
    return docs


@router.post("/invite-member")
def invite_member(body: InviteMemberIn, admin: dict = Depends(require_admin)):
    email = body.email.strip().lower()
    admin_email = admin["sub"]
    workspace = admin.get("workspace_owner") or admin_email

    if not _validate_email(email):
        raise HTTPException(400, "Invalid email")
    if email == admin_email:
        raise HTTPException(400, "You cannot invite yourself")

    db = get_db()
    if db.users.find_one({"email": email}):
        raise HTTPException(409, "User already exists")

    code = _gen_invite_code()
    db.users.insert_one({
        "name": body.name.strip(), "email": email, "role": "user",
        "verified": False, "is_active": True, "invite_code": code,
        "invited_by": admin_email, "workspace_owner": workspace,
        "created_at": datetime.now(timezone.utc),
    })
    _send_email_bg(
        email, "You've been invited",
        f"Hello {body.name}, your invite code is: {code}\n\n"
        f"Join at: http://localhost:5173/?invite={code}&email={email}",
    )
    return {"msg": "Invitation sent!", "code": code}


@router.post("/verify-invite")
def verify_invite(body: VerifyInviteIn):
    email = body.email.strip().lower()
    code = body.invite_code.strip().upper()
    ok, err = _validate_password(body.password)
    if not ok:
        raise HTTPException(400, err)

    db = get_db()
    user = db.users.find_one({"email": email, "invite_code": code, "role": "user"})
    if not user:
        raise HTTPException(400, "Invalid email or invite code")

    db.users.update_one(
        {"email": email},
        {"$set": {"password": _hash_password(body.password), "verified": True}, "$unset": {"invite_code": ""}},
    )
    return {"msg": "Account activated. You can sign in now."}


@router.post("/users/{user_id}/status")
def toggle_user_status(user_id: str, admin: dict = Depends(require_admin)):
    if not ObjectId.is_valid(user_id):
        raise HTTPException(400, "Invalid user id")
    db = get_db()
    workspace = admin.get("workspace_owner") or admin["sub"]
    user = db.users.find_one({"_id": ObjectId(user_id), "workspace_owner": workspace})
    if not user:
        raise HTTPException(404, "User not found in your workspace")
    new_status = not user.get("is_active", True)
    db.users.update_one({"_id": ObjectId(user_id)}, {"$set": {"is_active": new_status}})
    return {"msg": f"User {'activated' if new_status else 'deactivated'}"}
