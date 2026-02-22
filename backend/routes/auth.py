import random
import string
import secrets
from flask import Blueprint, request, current_app, jsonify
from flask_mail import Message
from flask_jwt_extended import create_access_token, jwt_required, get_jwt_identity, get_jwt
from werkzeug.security import generate_password_hash, check_password_hash
from extensions import mail
from bson import ObjectId

auth_bp = Blueprint("auth", __name__)

def generate_short_code():
    """Generates a professional 6-character invitation code."""
    return ''.join(secrets.choice(string.ascii_uppercase + string.digits) for _ in range(6))

# --- PUBLIC REGISTRATION (ADMIN) ---
@auth_bp.route("/register", methods=["POST"])
def register():
    data = request.json
    users = current_app.db.users
    
    if users.find_one({"email": data["email"]}):
        return jsonify({"msg": "User already exists"}), 400

    otp = str(random.randint(100000, 999999))
    
    # Unified Logic: Store 'name' and default 'role' to 'admin'
    users.insert_one({
        "name": data.get("name", "New User"),
        "email": data["email"],
        "password": generate_password_hash(data["password"]),
        "role": "admin",  # Every individual is the admin of their own workspace
        "otp": otp,
        "verified": False,
        "is_active": True
    })

    try:
        msg = Message("Verify Your Account", recipients=[data["email"]])
        msg.body = f"Your OTP is: {otp}"
        mail.send(msg)
        return jsonify({"msg": "OTP sent"}), 201
    except Exception as e:
        print(f"SMTP Error: {e}") 
        return jsonify({"msg": "User created, but failed to send OTP."}), 500

# --- LOGIN ---
@auth_bp.route("/login", methods=["POST"])
def login():
    data = request.json
    user = current_app.db.users.find_one({"email": data["email"]})
    
    if not user or not check_password_hash(user["password"], data["password"]):
        return jsonify({"msg": "Invalid credentials"}), 401
    
    # Check if the account has been deactivated by an admin
    if not user.get("is_active", True):
        return jsonify({"msg": "Your account has been deactivated. Contact Admin."}), 403
        
    if not user.get("verified"):
        return jsonify({"msg": "Email not verified"}), 403

    # Include role and name in the identity/claims
    token = create_access_token(
        identity=user["email"], 
        additional_claims={"role": user.get("role", "admin"), "name": user.get("name")}
    )
    
    return jsonify({
        "access_token": token,
        "role": user.get("role", "admin"),
        "name": user.get("name")
    }), 200

# --- ADMIN: FETCH TEAM MEMBERS ---
@auth_bp.route("/users", methods=["GET"])
@jwt_required()
def get_all_users():
    claims = get_jwt()
    if claims.get("role") != "admin":
        return jsonify({"msg": "Admin access required"}), 403

    users_collection = current_app.db.users
    # Fetch all users, excluding sensitive fields
    all_users = list(users_collection.find({}, {"password": 0, "otp": 0, "invite_code": 0}))
    
    for user in all_users:
        user["_id"] = str(user["_id"])
        
    return jsonify(all_users), 200

# --- ADMIN: INVITE MEMBER (SHORT CODE) ---
@auth_bp.route("/invite-member", methods=["POST"])
@jwt_required()
def invite_member():
    claims = get_jwt()
    if claims.get("role") != "admin":
        return jsonify({"msg": "Admin access required"}), 403

    data = request.json
    users = current_app.db.users
    
    if users.find_one({"email": data["email"]}):
        return jsonify({"msg": "User already exists"}), 400

    invite_code = generate_short_code()
    users.insert_one({
        "name": data.get("name"),
        "email": data["email"],
        "role": "user",  # Invited members are standard users
        "verified": False,
        "is_active": True,
        "invite_code": invite_code,
        "invited_by": get_jwt_identity()
    })

    try:
        msg = Message("Your Invitation Code", recipients=[data["email"]])
        msg.body = f"Hello {data.get('name')}, your SecureVault invite code is: {invite_code}"
        mail.send(msg)
        return jsonify({"msg": "Invitation sent successfully!", "code": invite_code}), 201
    except Exception as e:
        return jsonify({"msg": "Member added, but email failed.", "code": invite_code}), 201

# --- USER: ACTIVATE VIA INVITE CODE ---
@auth_bp.route("/verify-invite", methods=["POST"])
def verify_invite():
    data = request.json
    users = current_app.db.users
    
    user = users.find_one({"email": data["email"], "invite_code": data["invite_code"].upper()})
    
    if not user:
        return jsonify({"msg": "Invalid email or invite code"}), 400
    
    users.update_one(
        {"email": data["email"]}, 
        {
            "$set": {
                "password": generate_password_hash(data["password"]),
                "verified": True
            },
            "$unset": {"invite_code": ""} 
        }
    )
    return jsonify({"msg": "Account activated successfully"}), 200

# --- ADMIN: TOGGLE USER STATUS ---
@auth_bp.route("/users/<user_id>/status", methods=["POST"])
@jwt_required()
def toggle_user_status(user_id):
    claims = get_jwt()
    if claims.get("role") != "admin":
        return jsonify({"msg": "Admin access required"}), 403

    users_collection = current_app.db.users
    user = users_collection.find_one({"_id": ObjectId(user_id)})
    
    if not user:
        return jsonify({"msg": "User not found"}), 404

    # Toggle the current status (Activate/Deactivate)
    new_status = not user.get("is_active", True)
    users_collection.update_one(
        {"_id": ObjectId(user_id)},
        {"$set": {"is_active": new_status}}
    )
    
    action = "activated" if new_status else "deactivated"
    return jsonify({"msg": f"User {action} successfully"}), 200

# --- GENERAL: VERIFY OTP ---
@auth_bp.route("/verify-otp", methods=["POST"])
def verify_otp():
    data = request.json
    users = current_app.db.users
    user = users.find_one({"email": data["email"], "otp": data["otp"]})
    
    if not user:
        return jsonify({"msg": "Invalid OTP"}), 400

    users.update_one({"email": data["email"]}, {"$set": {"verified": True}, "$unset": {"otp": ""}})
    return jsonify({"msg": "Verified"}), 200

# --- GENERAL: GET ME ---
@auth_bp.route("/me", methods=["GET"])
@jwt_required()
def get_me():
    email = get_jwt_identity()
    user = current_app.db.users.find_one({"email": email}, {"password": 0, "otp": 0})
    user["_id"] = str(user["_id"])
    return jsonify(user), 200