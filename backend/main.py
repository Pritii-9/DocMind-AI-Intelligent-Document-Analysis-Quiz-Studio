"""FastAPI application entry point."""
import os
from dotenv import load_dotenv

load_dotenv()
os.environ["HF_HUB_DISABLE_SYMLINKS_WARNING"] = "1"

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from config import settings
from database import get_db
from routes.auth import router as auth_router
from routes.pdf import router as pdf_router
from routes.ai import router as ai_router
from routes.quiz import router as quiz_router
from hire.routes import router as hire_router  # HireMind - Tech Hiring Agent

app = FastAPI(
    title="HireMind AI API",
    version="3.0.0",
    description="HireMind AI — Autonomous Tech Hiring Agent & ATS Intelligence",
)

# ── CORS ──────────────────────────────────────────────────────────────────────
allowed_origins = [o.strip() for o in settings.CORS_ORIGINS.split(",") if o.strip()]
allowed_origins += [
    "http://localhost:5173",
    "http://localhost:3000",
    "https://hiremind-ai-gules.vercel.app",
    "https://pdf-streaming.vercel.app",
]

app.add_middleware(
    CORSMiddleware,
    allow_origins=list(set(allowed_origins)),
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
    expose_headers=["Content-Range", "Accept-Ranges"],
)

# ── Routers ────────────────────────────────────────────────────────────────────
app.include_router(auth_router)
app.include_router(pdf_router)
app.include_router(ai_router)
app.include_router(quiz_router)
app.include_router(hire_router)  # HireMind - Tech Hiring Agent


@app.get("/health", tags=["health"])
def health():
    try:
        get_db().ping()
        db_status = "connected"
    except Exception as e:
        db_status = f"unavailable: {e.__class__.__name__}"
    return {"status": "ok", "database": db_status, "version": "2.0.0"}


if __name__ == "__main__":
    import uvicorn
    uvicorn.run("main:app", host="0.0.0.0", port=int(os.getenv("PORT", 8000)), reload=True)
