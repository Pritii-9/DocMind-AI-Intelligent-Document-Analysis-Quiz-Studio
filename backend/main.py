"""FastAPI application entry point."""
import os
from dotenv import load_dotenv

load_dotenv()
os.environ["HF_HUB_DISABLE_SYMLINKS_WARNING"] = "1"

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from pymongo.errors import PyMongoError

from config import settings
from database import get_mongo_client
from routes.auth import router as auth_router
from routes.pdf import router as pdf_router
from routes.ai import router as ai_router
from routes.quiz import router as quiz_router

app = FastAPI(
    title="DocMind AI Enterprise API",
    version="2.0.0",
    description="Enterprise Neural Document Intelligence & Assessment Platform with LangChain RAG & Groq Quiz Studio",
)

# ── CORS ──────────────────────────────────────────────────────────────────────
allowed_origins = [o.strip() for o in settings.CORS_ORIGINS.split(",") if o.strip()]
allowed_origins += ["http://localhost:5173", "http://localhost:3000", "https://pdf-streaming.vercel.app"]

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


@app.get("/health", tags=["health"])
def health():
    try:
        get_mongo_client().admin.command("ping")
        db_status = "connected"
    except PyMongoError as e:
        db_status = f"unavailable: {e.__class__.__name__}"
    return {"status": "ok", "database": db_status, "version": "2.0.0"}


if __name__ == "__main__":
    import uvicorn
    uvicorn.run("main:app", host="0.0.0.0", port=int(os.getenv("PORT", 8000)), reload=True)
