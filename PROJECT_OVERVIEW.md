# PDF Streaming Platform — Resume Project Overview

## Project Description
Designed and developed a full-stack, secure PDF streaming and workspace management platform enabling multi-user collaboration with real-time activity feeds, role-based access control, and AWS S3-backed document storage.

---

## Full-Stack Development
- Architected an end-to-end web application using **Flask** (Python) backend and **React 19 + TypeScript** frontend, deployed via **Docker Compose** with containerized services for scalable development and production environments.
- Designed and implemented **RESTful APIs** with standardized JSON responses, HTTP range request support for efficient PDF byte-streaming, and workspace-scoped data endpoints for multi-tenant isolation.
- Integrated **WebSocket / Server-Sent Events (SSE)** for real-time workspace activity notifications (file uploads, member joins), enabling live dashboard updates without page refresh or manual polling.
- Built a **MongoDB**-backed document metadata store with upsert logic, indexed OTP/reset-code fields, and workspace-scoped queries for secure multi-user collaboration.

## Authentication & Security
- Implemented **JWT-based authentication** using `Flask-JWT-Extended` with configurable token expiration, custom claims (role, workspace_owner, name), and centralized unauthorized/invalid/expired token error handlers.
- Engineered a multi-step **email verification flow** with time-bound 6-digit OTPs, invite-code activation for workspace members, and password reset with expiration windows, all delivered via **Flask-Mail** SMTP integration.
- Configured **CORS** with dynamic origin loading from environment variables, credential support (`supports_credentials=True`), and explicit allow-listing of `Range`, `Authorization`, and `Content-Type` headers for cross-origin PDF streaming.

## Frontend Development
- Built a component-based **React** UI with **TypeScript**, **Tailwind CSS v4**, and **Vite** for fast HMR, featuring a login/signup flow, workspace dashboard, PDF viewer (`react-pdf`), uploader, sidebar navigation, and theme toggle.
- Implemented a **Context API**-driven `AuthContext` for centralized state management of JWT tokens, user roles, and session lifecycle, with `localStorage` persistence and reactive `useMemo`-optimized context values.
- Integrated **Socket.IO client** / **EventSource** for real-time workspace event subscriptions, enabling live activity feed updates and collaborative workspace awareness without manual refresh.
- Developed **route guards** using conditional rendering based on `isAuthenticated` state and role-based checks, redirecting unauthenticated users to login while protecting workspace routes and admin-only features.

## Backend Development
- Applied the **Flask Application Factory Pattern** (`create_app()`) with centralized configuration loading, extension initialization (`JWT`, `Mail`, `MongoClient`), and blueprint registration (`auth_bp`, `pdf_bp`) for modular, testable code architecture.
- Built **predictive analytics** endpoints for workspace overview including document storage metrics, active member tracking, upload frequency analysis, and activity timeline aggregation for data-driven workspace insights.
- Implemented a **team management system** with admin role enforcement via `@jwt_required()` + JWT claim checks, user invite generation (6-character alphanumeric codes), member activation/deactivation toggling, and workspace-scoped data filtering.

## DevOps & Deployment
- Containerized backend and frontend with **Docker** multi-stage builds, using **Poetry** for deterministic Python dependency resolution and **Node 19+** for frontend builds, orchestrated via `docker-compose.yml` for single-command environment spin-up.
- Configured production-ready WSGI/ASGI serving with **Gunicorn** and **Eventlet** for async worker support, enabling concurrent SSE connections and long-lived HTTP streams without blocking the Flask request cycle.
- Integrated **MongoDB Atlas** cloud database with server selection timeout tuning (`MONGO_SERVER_SELECTION_TIMEOUT_MS`), connection string via environment variables, and health-check endpoint (`/health`) with graceful degradation on connection failure.

## Code Quality
- Enforced **TypeScript strict mode** across the frontend codebase with `tsconfig` project references (`tsconfig.app.json`, `tsconfig.node.json`), ensuring type-safe component props, API response shapes, and context value contracts.
- Configured **ESLint** with `typescript-eslint`, `eslint-plugin-react-hooks`, and `eslint-plugin-react-refresh` rules, integrated into the `npm run lint` CI gate to catch unused variables, hook dependency array errors, and stale closure references.
- Structured backend with **Flask Blueprints** (`auth_bp`, `pdf_bp`) for clear route separation, centralized helper functions (`_workspace_owner()`, `_validate_pdf_filename()`, `_serialize_document()`), and consistent error response formatting across all endpoints.

---

## Tech Stack Summary
| Layer        | Technologies |
|--------------|-------------|
| **Frontend** | React 19, TypeScript, Vite, Tailwind CSS v4, Axios, react-pdf, Lucide Icons |
| **Backend**  | Python 3.9+, Flask, Flask-JWT-Extended, Flask-CORS, Flask-Mail, PyMongo, Boto3 |
| **Database** | MongoDB (Atlas), BSON ObjectId |
| **Storage**  | AWS S3 (multipart upload, presigned range requests) |
| **DevOps**   | Docker, Docker Compose, Poetry, Gunicorn, Eventlet |
| **Security** | JWT, OTP email verification, CORS, password hashing (Werkzeug) |