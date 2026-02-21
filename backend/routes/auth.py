import random
from flask import Blueprint, request, current_app, jsonify
from flask_mail import Message
from flask_jwt_extended import create_access_token, jwt_required, get_jwt_identity
from werkzeug.security import generate_password_hash, check_password_hash
from extensions import mail

auth_bp = Blueprint("auth", __name__)

@auth_bp.route("/register", methods=["POST"])
def register():
    data = request.json
    users = current_app.db.users
    
    if users.find_one({"email": data["email"]}):
        return jsonify({"msg": "User already exists"}), 400

    otp = str(random.randint(100000, 999999))
    
    # Store user with verified: False
    users.insert_one({
        "email": data["email"],
        "password": generate_password_hash(data["password"]),
        "otp": otp,
        "verified": False
    })

    # Wrap mail sending in a try-except to prevent 500 crashes
    try:
        msg = Message("Verify Your Account", recipients=[data["email"]])
        msg.body = f"Your OTP is: {otp}"
        mail.send(msg)
        return jsonify({"msg": "OTP sent"}), 201
    except Exception as e:
        # Log the error for the developer to see in the terminal
        print(f"SMTP Error: {e}") 
        return jsonify({"msg": "User created, but failed to send OTP. Check server logs."}), 500

@auth_bp.route("/verify-otp", methods=["POST"])
def verify_otp():
    data = request.json
    users = current_app.db.users
    user = users.find_one({"email": data["email"], "otp": data["otp"]})
    
    if not user:
        return jsonify({"msg": "Invalid OTP"}), 400

    users.update_one({"email": data["email"]}, {"$set": {"verified": True}, "$unset": {"otp": ""}})
    return jsonify({"msg": "Verified"}), 200

@auth_bp.route("/login", methods=["POST"])
def login():
    data = request.json
    user = current_app.db.users.find_one({"email": data["email"]})
    
    if not user or not check_password_hash(user["password"], data["password"]):
        return jsonify({"msg": "Invalid credentials"}), 401
        
    if not user.get("verified"):
        return jsonify({"msg": "Email not verified"}), 403

    token = create_access_token(identity=user["email"])
    return jsonify({"access_token": token}), 200

@auth_bp.route("/me", methods=["GET"])
@jwt_required()
def get_me():
    email = get_jwt_identity()
    user = current_app.db.users.find_one({"email": email}, {"password": 0, "otp": 0})
    user["_id"] = str(user["_id"])
    return jsonify(user), 200