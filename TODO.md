# RAG + LLM Agent Implementation TODO

Status: [9/18] Complete

## Backend Setup (1-6)
- [x] 1. Updated backend/pyproject.toml: Added deps. Ran poetry lock/install.
- [x] 2. Fixed pyproject.toml (removed literal \\n), ready for poetry install.
- [x] 3. Created backend/utils/ai_utils.py: Core functions (ingest_pdf, query_rag, agent_command, tools).
- [x] 4. Created backend/routes/ai.py: Endpoints /ingest, /query, /command with auth/filter.
- [x] 5. Updated backend/main.py: Registered ai_bp, added GROQ config.
- [x] 6. Updated backend/routes/pdf.py: Auto-ingest thread after upload upsert (full file).

## New Files & Hooks (7-9)
- [ ] 7. Create backend/models/embeddings.py: Pydantic models for embedding docs.
- [ ] 8. Update .env.example: Add GROQ_API_KEY.
- [ ] 9. Test backend: Upload PDF, verify embeddings collection has chunks/vectors, test curl /ai/query.

## Frontend Integration (10-14)
- [x] 10. Updated frontend/src/api/axios.ts: Added AI endpoints + types.
- [ ] 11. Create frontend/src/components/ChatAI.tsx: Simple chat interface (input, messages, stream).
- [x] 12. Updated frontend/src/pages/Workspace.tsx: Added ChatAI toggle in viewer.
- [ ] 13. Update frontend/src/types/pdf.ts: Add AI types (QueryResponse).
- [ ] 14. npm install, test chat.

## Polish & Deploy (15-18)
- [ ] 15. Update PROJECT_OVERVIEW.md: Document new features.
- [ ] 16. Update docker-compose.yml/Dockerfile: Ensure deps/volumes.
- [ ] 17. User setup: Mongo Atlas vector index, env vars.
- [ ] 18. Full test: Upload → auto-ingest → query/agent → docker run.

Next step: Manual (poetry add/install), then 1.
