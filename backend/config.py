from pydantic_settings import BaseSettings


class Settings(BaseSettings):
    # JWT
    JWT_SECRET: str = "dev-secret-change-me"
    JWT_ACCESS_MINUTES: int = 120

    # PostgreSQL Database
    DATABASE_URL: str = ""  # Set in .env — never hardcode credentials here

    # AWS S3
    AWS_REGION: str = "ap-south-1"
    AWS_ACCESS_KEY: str = ""
    AWS_SECRET_KEY: str = ""
    S3_BUCKET_NAME: str = ""

    # Groq LLM
    GROQ_API_KEY: str = ""
    GROQ_API_BASE_URL: str = "https://api.groq.com/openai/v1"
    GROQ_CHAT_MODEL: str = "groq/compound"
    GROQ_TIMEOUT_SECONDS: int = 90

    # Email (SMTP)
    MAIL_SERVER: str = "smtp.gmail.com"
    MAIL_PORT: int = 587
    MAIL_USE_TLS: bool = True
    MAIL_USERNAME: str = ""
    MAIL_PASSWORD: str = ""

    # CORS
    CORS_ORIGINS: str = "http://localhost:5173"

    # AI
    AI_AUTO_INGEST_UPLOADS: bool = True

    # ── HireMind - Tech Hiring Agent ──────────────────────────────────────
    # GitHub API token (optional — raises rate limit from 60 to 5000 req/hr)
    GITHUB_TOKEN: str = ""

    # Google Sheets integration (set both for real logging; omit to use mock mode)
    SHEET_ID: str = ""
    # GOOGLE_CRED_JSON can be a file path OR an inline JSON string of service account creds
    GOOGLE_CRED_JSON: str = ""

    class Config:
        env_file = ".env"
        extra = "ignore"


settings = Settings()
