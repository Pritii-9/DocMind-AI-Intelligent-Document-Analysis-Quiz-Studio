import re
import secrets
import string
from datetime import datetime, timedelta

from bson import ObjectId
from flask import Blueprint, current_app, jsonify, request
from flask_jwt_extended import create_access_token, get_jwt, get_jwt_identity, jwt_required
from flask_mail import Message
from werkzeug.security import check_password_hash, generate_password_hash

from extensions import mail

auth_bp = Blueprint("auth", __name__)

EMAIL_PATTERN = re.compile(r"^[^@\s]+@[^@\s]+\.[^@\s]+$")


def _json_body():
    return request.get_json(silent=True) or {}


def _normalize_email(email: str) -> str:
    return (email or "").strip().lower()


def _validate_email(email: str) -> bool:
    return bool(EMAIL_PATTERN.match(email))


def _validate_password(password: str) -> tuple[bool, str]:
    if len(password) < 8:
        return False, "Password must be at least 8 characters"
    if not re.search(r"[A-Z]", password):
        return False, "Password must contain at least one uppercase letter"
    if not re.search(r"[a-z]", password):
        return False, "Password must contain at least one lowercase letter"
    if not re.search(r"\d", password):
        return False, "Password must contain at least one number"
    return True, ""


def _generate_short_code():
    return "".join(secrets.choice(string.ascii_uppercase + string.digits) for _ in range(6))


def _generate_numeric_code():
    return f"{secrets.randbelow(900000) + 100000}"


def _admin_scope_filter(admin_email: str):
    return {"$or": [{"email": admin_email}, {"invited_by": admin_email}]}


def _send_verification_email(email: str, otp: str):
    msg = Message("Verify your account", recipients=[email])
    msg.body = f"Your OTP is: {otp}. It expires in 10 minutes."
    mail.send(msg)


@auth_bp.route("/start-signup", methods=["POST"])
def start_signup():
    data = _json_body()
    name = (data.get("name") or "").strip()
    email = _normalize_email(data.get("email", ""))

    if not name:
        return jsonify({"msg": "Name is required"}), 400
    if not _validate_email(email):
        return jsonify({"msg": "Invalid email address"}), 400

    users = current_app.db.users
    existing_user = users.find_one({"email": email})

    if existing_user and (existing_user.get("verified") or existing_user.get("password")):
        return jsonify({"msg": "Email already registered. Please login with your existing account."}), 409

    otp = _generate_numeric_code()
    payload = {
        "name": name,
        "email": email,
        "role": "admin",
        "otp": otp,
        "otp_expires_at": datetime.utcnow() + timedelta(minutes=10),
        "verified": False,
        "is_active": True,
        "workspace_owner": email,
    }

    if existing_user:
        users.update_one(
            {"email": email},
            {
                "$set": payload,
                "$setOnInsert": {"created_at": datetime.utcnow()},
                "$unset": {"password": ""},
            },
            upsert=True,
        )
    else:
        payload["created_at"] = datetime.utcnow()
        users.insert_one(payload)

    try:
        _send_verification_email(email, otp)
    except Exception:
        return jsonify({"msg": "Unable to send verification email right now."}), 502

    return jsonify({"msg": "Verification code sent"}), 200


@auth_bp.route("/check-email", methods=["GET"])
def check_email():
    email = _normalize_email(request.args.get("email", ""))
    if not _validate_email(email):
        return jsonify({"msg": "Invalid email address"}), 400

    users = current_app.db.users
    exists = users.find_one({"email": email}) is not None
    return jsonify({"exists": exists}), 200


@auth_bp.route("/complete-signup", methods=["POST"])
def complete_signup():
    data = _json_body()
    name = (data.get("name") or "").strip()
    email = _normalize_email(data.get("email", ""))
    otp = (data.get("otp") or "").strip()
    password = data.get("password") or ""

    if not name:
        return jsonify({"msg": "Name is required"}), 400
    if not _validate_email(email):
        return jsonify({"msg": "Invalid email address"}), 400
    if len(otp) != 6 or not otp.isdigit():
        return jsonify({"msg": "OTP must be a 6-digit code"}), 400

    is_valid_password, password_error = _validate_password(password)
    if not is_valid_password:
        return jsonify({"msg": password_error}), 400

    users = current_app.db.users
    user = users.find_one({"email": email, "otp": otp, "role": "admin"})
    if not user:
        return jsonify({"msg": "Invalid email or verification code"}), 400

    expires_at = user.get("otp_expires_at")
    if expires_at and datetime.utcnow() > expires_at:
        return jsonify({"msg": "Verification code expired. Please request a new one."}), 400

    users.update_one(
        {"email": email},
        {
            "$set": {
                "name": name,
                "password": generate_password_hash(password),
                "verified": True,
            },
            "$unset": {"otp": "", "otp_expires_at": ""},
        },
    )
    return jsonify({"msg": "Account created successfully. You can sign in now."}), 200


@auth_bp.route("/register", methods=["POST"])
def register():
    data = _json_body()
    name = (data.get("name") or "").strip()
    email = _normalize_email(data.get("email", ""))
    password = data.get("password") or ""

    if not name:
        return jsonify({"msg": "Name is required"}), 400
    if not _validate_email(email):
        return jsonify({"msg": "Invalid email address"}), 400
    is_valid_password, password_error = _validate_password(password)
    if not is_valid_password:
        return jsonify({"msg": password_error}), 400

    users = current_app.db.users
    if users.find_one({"email": email}):
        return jsonify({"msg": "User already exists"}), 409

    otp = f"{secrets.randbelow(900000) + 100000}"
    users.insert_one(
        {
            "name": name,
            "email": email,
            "password": generate_password_hash(password),
            "role": "admin",
            "otp": otp,
            "otp_expires_at": datetime.utcnow() + timedelta(minutes=10),
            "verified": False,
            "is_active": True,
            "workspace_owner": email,
            "created_at": datetime.utcnow(),
        }
    )

    try:
        msg = Message("Verify your account", recipients=[email])
        msg.body = f"Your OTP is: {otp}. It expires in 10 minutes."
        mail.send(msg)
    except Exception:
        return jsonify({"msg": "User created, but failed to send OTP."}), 502

    return jsonify({"msg": "OTP sent"}), 201


@auth_bp.route("/login", methods=["POST"])
def login():
    data = _json_body()
    email = _normalize_email(data.get("email", ""))
    password = data.get("password") or ""
    if not email or not password:
        return jsonify({"msg": "Email and password are required"}), 400

    user = current_app.db.users.find_one({"email": email})
    if not user or not check_password_hash(user.get("password", ""), password):
        return jsonify({"msg": "Invalid credentials"}), 401

    if not user.get("is_active", True):
        return jsonify({"msg": "Your account has been deactivated. Contact admin."}), 403
    if not user.get("verified"):
        return jsonify({"msg": "Email not verified"}), 403

    workspace_owner = (
        user.get("workspace_owner")
        or user.get("invited_by")
        or user.get("email")
    )
    token = create_access_token(
        identity=user["email"],
        additional_claims={
            "role": user.get("role", "admin"),
            "name": user.get("name", "User"),
            "workspace_owner": workspace_owner,
        },
    )
    return (
        jsonify(
            {
                "access_token": token,
                "role": user.get("role", "admin"),
                "name": user.get("name", "User"),
            }
        ),
        200,
    )


@auth_bp.route("/forgot-password", methods=["POST"])
def forgot_password():
    data = _json_body()
    email = _normalize_email(data.get("email", ""))

    if not _validate_email(email):
        return jsonify({"msg": "Invalid email address"}), 400

    users = current_app.db.users
    user = users.find_one({"email": email})
    if not user:
        return jsonify({"msg": "If an account exists, a reset code has been sent."}), 200

    reset_code = _generate_numeric_code()
    users.update_one(
        {"email": email},
        {
            "$set": {
                "reset_code": reset_code,
                "reset_code_expires_at": datetime.utcnow() + timedelta(minutes=10),
            }
        },
    )

    try:
        msg = Message("Reset your SafeUp password", recipients=[email])
        msg.body = (
            f"Hello {user.get('name', 'there')}, your password reset code is {reset_code}. "
            "It expires in 10 minutes."
        )
        mail.send(msg)
    except Exception:
        return jsonify({"msg": "Unable to send reset email right now. Please try again."}), 502

    return jsonify({"msg": "If an account exists, a reset code has been sent."}), 200


@auth_bp.route("/reset-password", methods=["POST"])
def reset_password():
    data = _json_body()
    email = _normalize_email(data.get("email", ""))
    reset_code = (data.get("reset_code") or "").strip()
    password = data.get("password") or ""

    if not _validate_email(email):
        return jsonify({"msg": "Invalid email address"}), 400
    if len(reset_code) != 6 or not reset_code.isdigit():
        return jsonify({"msg": "Reset code must be a 6-digit code"}), 400

    is_valid_password, password_error = _validate_password(password)
    if not is_valid_password:
        return jsonify({"msg": password_error}), 400

    users = current_app.db.users
    user = users.find_one({"email": email, "reset_code": reset_code})
    if not user:
        return jsonify({"msg": "Invalid email or reset code"}), 400

    expires_at = user.get("reset_code_expires_at")
    if expires_at and datetime.utcnow() > expires_at:
        return jsonify({"msg": "Reset code expired. Please request a new one."}), 400

    users.update_one(
        {"email": email},
        {
            "$set": {"password": generate_password_hash(password)},
            "$unset": {"reset_code": "", "reset_code_expires_at": ""},
        },
    )
    return jsonify({"msg": "Password updated successfully. You can sign in now."}), 200


@auth_bp.route("/users", methods=["GET"])
@jwt_required()
def get_all_users():
    claims = get_jwt()
    if claims.get("role") != "admin":
        return jsonify({"msg": "Admin access required"}), 403

    admin_email = get_jwt_identity()
    users_collection = current_app.db.users
    query = _admin_scope_filter(admin_email)
    all_users = list(
        users_collection.find(
            query,
            {
                "password": 0,
                "otp": 0,
                "otp_expires_at": 0,
                "invite_code": 0,
                "reset_code": 0,
                "reset_code_expires_at": 0,
            },
        )
    )
    for user in all_users:
        user["_id"] = str(user["_id"])
    return jsonify(all_users), 200


@auth_bp.route("/invite-member", methods=["POST"])
@jwt_required()
def invite_member():
    claims = get_jwt()
    if claims.get("role") != "admin":
        return jsonify({"msg": "Admin access required"}), 403

    data = _json_body()
    name = (data.get("name") or "").strip()
    email = _normalize_email(data.get("email", ""))
    admin_email = get_jwt_identity()

    if not name:
        return jsonify({"msg": "Name is required"}), 400
    if not _validate_email(email):
        return jsonify({"msg": "Invalid email address"}), 400
    if email == admin_email:
        return jsonify({"msg": "You cannot invite yourself"}), 400

    users = current_app.db.users
    if users.find_one({"email": email}):
        return jsonify({"msg": "User already exists"}), 409

    invite_code = _generate_short_code()
    users.insert_one(
        {
            "name": name,
            "email": email,
            "role": "user",
            "verified": False,
            "is_active": True,
            "invite_code": invite_code,
            "invited_by": admin_email,
            "workspace_owner": admin_email,
            "created_at": datetime.utcnow(),
        }
    )

    try:
        msg = Message("Your invitation code", recipients=[email])
        msg.body = (
            f"Hello {name}, your SafeUp invite code is: {invite_code}. "
            "Use it in the app to activate your account."
        )
        mail.send(msg)
    except Exception:
        return jsonify({"msg": "Member added, but email failed.", "code": invite_code}), 201

    return jsonify({"msg": "Invitation sent successfully!", "code": invite_code}), 201


@auth_bp.route("/verify-invite", methods=["POST"])
def verify_invite():
    data = _json_body()
    email = _normalize_email(data.get("email", ""))
    invite_code = (data.get("invite_code") or "").strip().upper()
    password = data.get("password") or ""

    if not _validate_email(email):
        return jsonify({"msg": "Invalid email address"}), 400
    if len(invite_code) != 6:
        return jsonify({"msg": "Invite code must be 6 characters"}), 400
    is_valid_password, password_error = _validate_password(password)
    if not is_valid_password:
        return jsonify({"msg": password_error}), 400

    users = current_app.db.users
    user = users.find_one({"email": email, "invite_code": invite_code, "role": "user"})
    if not user:
        return jsonify({"msg": "Invalid email or invite code"}), 400

    users.update_one(
        {"email": email},
        {
            "$set": {"password": generate_password_hash(password), "verified": True},
            "$unset": {"invite_code": ""},
        },
    )
    return jsonify({"msg": "Account activated successfully"}), 200


@auth_bp.route("/users/<user_id>/status", methods=["POST"])
@jwt_required()
def toggle_user_status(user_id):
    claims = get_jwt()
    if claims.get("role") != "admin":
        return jsonify({"msg": "Admin access required"}), 403

    if not ObjectId.is_valid(user_id):
        return jsonify({"msg": "Invalid user id"}), 400

    admin_email = get_jwt_identity()
    users_collection = current_app.db.users
    user = users_collection.find_one({"_id": ObjectId(user_id), "invited_by": admin_email})
    if not user:
        return jsonify({"msg": "User not found in your workspace"}), 404

    new_status = not user.get("is_active", True)
    users_collection.update_one({"_id": ObjectId(user_id)}, {"$set": {"is_active": new_status}})
    action = "activated" if new_status else "deactivated"
    return jsonify({"msg": f"User {action} successfully"}), 200


@auth_bp.route("/verify-otp", methods=["POST"])
def verify_otp():
    data = _json_body()
    email = _normalize_email(data.get("email", ""))
    otp = (data.get("otp") or "").strip()

    if not _validate_email(email):
        return jsonify({"msg": "Invalid email address"}), 400
    if len(otp) != 6 or not otp.isdigit():
        return jsonify({"msg": "OTP must be a 6-digit code"}), 400

    users = current_app.db.users
    user = users.find_one({"email": email, "otp": otp})
    if not user:
        return jsonify({"msg": "Invalid OTP"}), 400

    expires_at = user.get("otp_expires_at")
    if expires_at and datetime.utcnow() > expires_at:
        return jsonify({"msg": "OTP expired. Please register again."}), 400

    users.update_one(
        {"email": email},
        {"$set": {"verified": True}, "$unset": {"otp": "", "otp_expires_at": ""}},
    )
    return jsonify({"msg": "Verified"}), 200


@auth_bp.route("/me", methods=["GET"])
@jwt_required()
def get_me():
    email = get_jwt_identity()
    user = current_app.db.users.find_one(
        {
            "email": email
        },
        {
            "password": 0,
            "otp": 0,
            "otp_expires_at": 0,
            "reset_code": 0,
            "reset_code_expires_at": 0,
        },
    )
    if not user:
        return jsonify({"msg": "User not found"}), 404
    user["_id"] = str(user["_id"])
    return jsonify(user), 200
