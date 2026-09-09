from pydantic_settings import BaseSettings


class Settings(BaseSettings):
    # JWT
    JWT_SECRET: str = "dev-secret-change-me"
    JWT_ACCESS_MINUTES: int = 120

    # MongoDB
    MONGO_URI: str = "mongodb://localhost:27017/"
    MONGO_DB_NAME: str = "pdf_stream"
    MONGO_SERVER_SELECTION_TIMEOUT_MS: int = 5000
    MONGO_VECTOR_INDEX_NAME: str = "embeddings_vector_index"
    MONGO_VECTOR_PATH: str = "embedding"

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

    class Config:
        env_file = ".env"
        extra = "ignore"


settings = Settings()
