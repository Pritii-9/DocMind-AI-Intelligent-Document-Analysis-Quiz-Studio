import os
from datetime import timedelta

from dotenv import load_dotenv
from flask import Flask, jsonify
from flask_cors import CORS
from pymongo import MongoClient

from extensions import jwt, mail
from routes.auth import auth_bp
from routes.pdf import pdf_bp

load_dotenv()


def _get_cors_origins() -> list[str]:
    raw_origins = os.getenv("CORS_ORIGINS", "http://localhost:5173")
    return [origin.strip() for origin in raw_origins.split(",") if origin.strip()]


def create_app():
    app = Flask(__name__)

    CORS(
        app,
        resources={r"/*": {"origins": _get_cors_origins()}},
        supports_credentials=True,
        allow_headers=["Content-Type", "Authorization", "Range"],
        methods=["GET", "POST", "OPTIONS", "PUT", "DELETE"],
    )

    app.config["JWT_SECRET_KEY"] = os.getenv("JWT_SECRET", "dev-secret-change-me")
    app.config["JWT_ACCESS_TOKEN_EXPIRES"] = timedelta(
        minutes=int(os.getenv("JWT_ACCESS_MINUTES", "120"))
    )

    app.config.update(
        MAIL_SERVER=os.getenv("MAIL_SERVER"),
        MAIL_PORT=int(os.getenv("MAIL_PORT", 587)),
        MAIL_USE_TLS=os.getenv("MAIL_USE_TLS", "true").lower() == "true",
        MAIL_USERNAME=os.getenv("MAIL_USERNAME"),
        MAIL_PASSWORD=os.getenv("MAIL_PASSWORD"),
        MAIL_DEFAULT_SENDER=os.getenv("MAIL_USERNAME"),
    )

    mail.init_app(app)
    jwt.init_app(app)

    app.config["AWS_REGION"] = os.getenv("AWS_REGION")
    app.config["AWS_ACCESS_KEY"] = os.getenv("AWS_ACCESS_KEY")
    app.config["AWS_SECRET_KEY"] = os.getenv("AWS_SECRET_KEY")
    app.config["S3_BUCKET_NAME"] = os.getenv("S3_BUCKET_NAME")

    mongo = MongoClient(os.getenv("MONGO_URI", "mongodb://localhost:27017/"))
    app.db = mongo[os.getenv("MONGO_DB_NAME", "pdf_stream")]

    app.register_blueprint(auth_bp, url_prefix="/auth")
    app.register_blueprint(pdf_bp, url_prefix="/pdf")

    @app.get("/health")
    def health():
        return jsonify({"status": "ok"}), 200

    @jwt.unauthorized_loader
    def unauthorized_callback(err):
        return jsonify({"msg": "Missing or invalid authorization header", "error": err}), 401

    @jwt.invalid_token_loader
    def invalid_token_callback(err):
        return jsonify({"msg": "Invalid access token", "error": err}), 401

    @jwt.expired_token_loader
    def expired_token_callback(_, __):
        return jsonify({"msg": "Session expired. Please login again."}), 401

    return app


app = create_app()

if __name__ == "__main__":
    app.run(debug=True, host="0.0.0.0", port=5000)
