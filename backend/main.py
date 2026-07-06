import os
from datetime import timedelta

from dotenv import load_dotenv
from flask import Flask, jsonify, request, make_response
from flask_cors import CORS
from pymongo import MongoClient
from pymongo.errors import PyMongoError

from extensions import jwt, mail
from routes.auth import auth_bp
from routes.pdf import pdf_bp
from routes.ai import ai_bp

load_dotenv()



def _create_mongo_client() -> MongoClient:
    timeout_ms = int(os.getenv("MONGO_SERVER_SELECTION_TIMEOUT_MS", "5000"))
    return MongoClient(
        os.getenv("MONGO_URI", "mongodb://localhost:27017/"),
        serverSelectionTimeoutMS=timeout_ms,
    )




def create_app():
    app = Flask(__name__)

    import re
    # Configure CORS properly using the flask-cors extension
    # We allow any vercel.app subdomain and localhost for development.
    # Note: When supports_credentials=True, we cannot use "*".
    
    # Origins can be a list of strings
    allowed_origins = [
        "https://pdf-streaming.vercel.app",
        "http://localhost:5173",
        "http://localhost:3000"
    ]
    
    # Also add any origins from environment variables
    env_origins = os.getenv("CORS_ORIGINS", "").split(",")
    for o in env_origins:
        if o.strip():
            allowed_origins.append(o.strip())

    CORS(
        app,
        origins=allowed_origins,
        supports_credentials=True,
        expose_headers=["Content-Range", "Range", "Accept-Ranges"],
        allow_headers=["Content-Type", "Authorization", "Range"],
        methods=["GET", "POST", "PUT", "DELETE", "OPTIONS"],
    )

    app.config["JWT_SECRET_KEY"] = os.getenv("JWT_SECRET", "dev-secret-change-me")
    app.config["JWT_ACCESS_TOKEN_EXPIRES"] = timedelta(
        minutes=int(os.getenv("JWT_ACCESS_MINUTES", "120"))
    )
    app.config["JWT_TOKEN_LOCATION"] = ["headers", "query_string"]
    app.config["JWT_QUERY_STRING_NAME"] = "token"

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
    app.config["GROQ_API_KEY"] = os.getenv("GROQ_API_KEY")
    app.config["GROQ_API_BASE_URL"] = os.getenv("GROQ_API_BASE_URL", "https://api.groq.com/openai/v1")
    app.config["GROQ_CHAT_MODEL"] = os.getenv("GROQ_CHAT_MODEL", "llama-3.3-70b-versatile")
    app.config["GROQ_EMBEDDING_MODEL"] = os.getenv("GROQ_EMBEDDING_MODEL")
    app.config["GROQ_TIMEOUT_SECONDS"] = int(os.getenv("GROQ_TIMEOUT_SECONDS", "90"))
    app.config["MONGO_VECTOR_INDEX_NAME"] = os.getenv("MONGO_VECTOR_INDEX_NAME", "embeddings_vector_index")
    app.config["MONGO_VECTOR_PATH"] = os.getenv("MONGO_VECTOR_PATH", "embedding")
    app.config["AI_AUTO_INGEST_UPLOADS"] = os.getenv("AI_AUTO_INGEST_UPLOADS", "true").lower() == "true"

    mongo = _create_mongo_client()
    app.mongo_client = mongo
    app.db = mongo[os.getenv("MONGO_DB_NAME", "pdf_stream")]

    app.register_blueprint(auth_bp, url_prefix="/auth")
    app.register_blueprint(pdf_bp, url_prefix="/pdf")
    app.register_blueprint(ai_bp, url_prefix="/ai")

    @app.get("/health")
    def health():
        try:
            app.mongo_client.admin.command("ping")
            database = "connected"
            status_code = 200
        except PyMongoError as err:
            database = f"unavailable: {err.__class__.__name__}"
            status_code = 503

        return jsonify({"status": "ok", "database": database}), status_code

    @jwt.unauthorized_loader
    def unauthorized_callback(err):
        return jsonify({"msg": "Missing or invalid authorization header", "error": err}), 401

    @jwt.invalid_token_loader
    def invalid_token_callback(err):
        return jsonify({"msg": "Invalid access token", "error": err}), 401

    @jwt.expired_token_loader
    def expired_token_loader(_, __):
        return jsonify({"msg": "Session expired. Please login again."}), 401

    @app.errorhandler(Exception)
    def handle_exception(e):
        # Pass through HTTP errors
        if hasattr(e, 'code'):
            return jsonify({"msg": str(e), "error": "HTTP Error"}), e.code
        
        # Log the actual error for debugging in Render
        app.logger.exception("Global error handler caught an exception")
        return jsonify({"msg": "An internal server error occurred", "error": str(e)}), 500

    return app


app = create_app()

if __name__ == "__main__":
    # For local dev, you can still use python main.py
    # But in production (Render/Docker), Gunicorn will call 'app' directly.
    port = int(os.getenv("PORT", 5000))
    app.run(debug=True, host="0.0.0.0", port=port)
