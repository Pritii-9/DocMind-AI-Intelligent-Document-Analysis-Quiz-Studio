# SecureVault PDF Stream

Full-stack document platform built with Flask + React for secure PDF upload, workspace-based access control, and streaming from AWS S3.

## Why this is resume-ready

- JWT-authenticated platform with role-based access (`admin`, `user`) and workspace isolation.
- Multipart PDF upload pipeline to S3 for large file reliability.
- Protected PDF streaming endpoint with HTTP range support.
- Team invitation flow with email invite codes and OTP-based account verification.
- Production-style app configuration with environment-driven settings and health checks.

## Tech stack

- Backend: Flask, Flask-JWT-Extended, Flask-Mail, PyMongo, Boto3
- Frontend: React, TypeScript, Vite, Tailwind CSS
- Storage & infra: MongoDB, AWS S3

## Architecture

- `backend/main.py`: Flask app factory, CORS, JWT/mail setup, MongoDB connection, `/health`.
- `backend/routes/auth.py`: registration, login, OTP verification, team invite management.
- `backend/routes/pdf.py`: multipart upload and secure PDF listing/streaming.
- `frontend/src/pages`: login/auth flow + role dashboards.
- `frontend/src/components`: uploader, sidebar, PDF viewer, invite modal.

## Local setup

### 1) Backend

```bash
cd backend
poetry install
copy .env.example .env
poetry run python main.py
```

### 2) Frontend

```bash
cd frontend
npm install
copy .env.example .env
npm run dev
```

Frontend default: `http://localhost:5173`  
Backend default: `http://localhost:5000`

## Environment variables

### Backend (`backend/.env`)

- `JWT_SECRET`
- `JWT_ACCESS_MINUTES`
- `MONGO_URI`
- `MONGO_DB_NAME`
- `AWS_REGION`
- `AWS_ACCESS_KEY`
- `AWS_SECRET_KEY`
- `S3_BUCKET_NAME`
- `MAIL_SERVER`
- `MAIL_PORT`
- `MAIL_USE_TLS`
- `MAIL_USERNAME`
- `MAIL_PASSWORD`
- `CORS_ORIGINS`

### Frontend (`frontend/.env`)

- `VITE_API_BASE_URL`

## API highlights

- `POST /auth/register` -> create admin + send OTP
- `POST /auth/verify-otp` -> verify email
- `POST /auth/login` -> get JWT
- `POST /auth/invite-member` -> invite workspace member
- `POST /auth/verify-invite` -> activate invited account
- `GET /pdf/list` -> list workspace PDFs
- `POST /pdf/init-upload` -> start multipart upload
- `POST /pdf/upload-part` -> upload chunk
- `POST /pdf/complete-upload` -> finalize upload
- `GET /pdf/stream/<filename>` -> stream PDF

## Suggested resume bullets

- Built a secure document platform using Flask, React, MongoDB, and AWS S3 with JWT-based authentication and role-based access control.
- Implemented multipart upload + byte-range streaming for large PDFs, improving upload reliability and viewer responsiveness.
- Designed workspace-level data isolation for multi-user teams, preventing cross-tenant file access.
- Added invite-based onboarding with OTP verification and production-style environment-driven configuration.
