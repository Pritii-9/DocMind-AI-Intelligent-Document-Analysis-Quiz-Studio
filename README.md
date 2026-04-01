# SecureVault Pro

SecureVault Pro is a production-style document workspace built with Flask, React, MongoDB, and AWS S3. It supports secure PDF upload, role-based access control, invite-based onboarding, protected streaming, and an executive-friendly operations dashboard.

## What makes it resume-ready

- Multi-tenant workspace model with strict workspace isolation for documents and team members
- JWT-based authentication with admin and member access levels
- OTP verification for new admins and invite-code activation for workspace members
- Multipart PDF uploads to S3 for reliability on large files
- Protected PDF streaming endpoint with authenticated access and byte-range support
- Document metadata indexing in MongoDB for analytics, recent activity, and dashboard reporting
- Responsive React dashboard with smooth in-app navigation across overview, library, viewer, and team management

## Product highlights

### Executive Dashboard
- Total document count, storage footprint, active members, and recent upload visibility
- Recent activity feed for uploads and workspace onboarding events
- Quick access to recently uploaded documents

### Document Operations
- Chunked PDF upload with progress feedback
- Search and sort document library by name, size, and recency
- Live secure viewer with page navigation and zoom controls
- Metadata-backed document cards with upload and last-viewed information

### Team Management
- Invite teammates into a shared workspace
- Activate or deactivate member accounts
- Track pending, active, and inactive user states

### Authentication Flow
- Sign up for a new admin workspace or sign in with an existing account
- Verify new admin accounts with email OTP
- Reset forgotten passwords through email-based recovery codes

## Architecture

### Backend
- `backend/main.py`: Flask app factory, JWT/mail setup, CORS, MongoDB connection, and health endpoint with DB ping
- `backend/routes/auth.py`: registration, OTP verification, login, workspace user management, invite flows
- `backend/routes/pdf.py`: multipart upload, S3 sync, metadata indexing, analytics endpoints, secure streaming
- `backend/extensions.py`: JWT, mail, and S3 client setup

### Frontend
- `frontend/src/pages/Login.tsx`: polished auth and onboarding experience
- `frontend/src/pages/Workspace.tsx`: unified dashboard shell and section navigation
- `frontend/src/components/Uploader.tsx`: upload workflow with chunk progress
- `frontend/src/components/PdfViewer.tsx`: protected PDF viewer with controls
- `frontend/src/components/Sidebar.tsx`: responsive workspace navigation and user context

## API highlights

### Auth
- `POST /auth/register` -> create admin account and send OTP
- `POST /auth/verify-otp` -> verify admin email
- `POST /auth/login` -> receive JWT access token
- `POST /auth/forgot-password` -> send reset code by email
- `POST /auth/reset-password` -> update password with reset code
- `POST /auth/invite-member` -> create and invite workspace member
- `POST /auth/verify-invite` -> activate invited member account
- `GET /auth/users` -> list users in current workspace
- `POST /auth/users/<user_id>/status` -> activate or deactivate a member

### Documents
- `POST /pdf/init-upload` -> initialize multipart upload
- `POST /pdf/upload-part` -> upload a file chunk
- `POST /pdf/complete-upload` -> finalize upload and store metadata
- `GET /pdf/list` -> list document filenames
- `GET /pdf/library` -> return document metadata
- `GET /pdf/overview` -> return dashboard analytics and activity feed
- `GET /pdf/stream/<filename>` -> stream PDF securely

## Local setup

### Backend
```bash
cd backend
poetry install
copy ..\.env.example.txt .env
poetry run python main.py
```

### Frontend
```bash
cd frontend
npm install
set VITE_API_BASE_URL=http://localhost:5000
npm run dev
```

Frontend default: `http://localhost:5173`
Backend default: `http://localhost:5000`

## MongoDB Atlas setup

1. Create a MongoDB Atlas cluster.
2. Create a database user with read/write access.
3. In Atlas Network Access, allow your current IP address.
4. Copy the Atlas connection string and place it in `backend/.env` as `MONGO_URI`.
5. Keep `MONGO_DB_NAME` set to your application database, for example `pdf_stream`.
6. Restart the backend.
7. Open `http://localhost:5000/health` and confirm it returns `"database": "connected"`.

Example:
```env
MONGO_URI=mongodb+srv://<db_user>:<db_password>@<cluster-name>.mongodb.net/?retryWrites=true&w=majority&appName=securevault-pro
MONGO_DB_NAME=pdf_stream
MONGO_SERVER_SELECTION_TIMEOUT_MS=5000
```

## Environment variables

### Backend
- `JWT_SECRET`
- `JWT_ACCESS_MINUTES`
- `MONGO_URI`
- `MONGO_DB_NAME`
- `MONGO_SERVER_SELECTION_TIMEOUT_MS`
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

### Frontend
- `VITE_API_BASE_URL`

## Suggested resume bullets

- Built a secure enterprise document workspace using Flask, React, MongoDB, and AWS S3 with JWT authentication, role-based access control, and tenant-aware data isolation.
- Implemented multipart PDF uploads and authenticated streaming, improving large-file reliability and secure access for distributed teams.
- Designed a metadata-driven analytics dashboard for document operations, storage reporting, and recent workspace activity.
- Added invite-based onboarding, OTP verification, and admin-level team controls to support production-style user lifecycle management.

## How to explain it to a CEO

SecureVault Pro is a secure internal document platform for teams that need controlled access to sensitive PDFs. It lets administrators onboard team members, upload large documents safely, monitor workspace activity, and provide a clean viewing experience without exposing files publicly. The business value is stronger governance, better operational visibility, and a faster internal workflow for sharing protected documents.
