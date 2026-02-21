from flask import Flask, jsonify
from flask_cors import CORS
from pymongo import MongoClient
from dotenv import load_dotenv
import os
from extensions import mail, jwt
from routes.auth import auth_bp
from routes.pdf import pdf_bp

load_dotenv()

def create_app():
    app = Flask(__name__)
    
    # --- PRO-LEVEL CORS CONFIGURATION ---
    # Supports credentials and explicitly allows the Authorization & Range headers
    CORS(app, resources={r"/*": {"origins": "http://localhost:5173"}}, 
         supports_credentials=True,
         allow_headers=["Content-Type", "Authorization", "Range"],
         methods=["GET", "POST", "OPTIONS", "PUT", "DELETE"])

    # JWT Configuration
    app.config["JWT_SECRET_KEY"] = os.getenv("JWT_SECRET")

    # Flask-Mail Configuration
    app.config.update(
        MAIL_SERVER=os.getenv("MAIL_SERVER"),
        MAIL_PORT=int(os.getenv("MAIL_PORT", 587)),
        MAIL_USE_TLS=True,
        MAIL_USERNAME=os.getenv("MAIL_USERNAME"),
        MAIL_PASSWORD=os.getenv("MAIL_PASSWORD"),
        MAIL_DEFAULT_SENDER=os.getenv("MAIL_USERNAME") 
    )

    # Initialize Extensions
    mail.init_app(app)
    jwt.init_app(app)

    # MongoDB Connection
    mongo = MongoClient(os.getenv("MONGO_URI"))
    app.db = mongo["pdf_stream"]

    # Register Blueprints with correct prefixes
    app.register_blueprint(auth_bp, url_prefix="/auth")
    app.register_blueprint(pdf_bp, url_prefix="/pdf")

    @app.errorhandler(422)
    def handle_jwt_error(err):
        return jsonify({"msg": "Session expired or invalid token", "error": str(err)}), 422

    return app

app = create_app()

if __name__ == "__main__":
    app.run(debug=True, host="0.0.0.0", port=5000)