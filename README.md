<div align="center">

# 🧠 DocMind AI
### **Enterprise Neural Document Intelligence & Interactive Assessment Platform**

[![React](https://img.shields.io/badge/React_19-20232A?style=for-the-badge&logo=react&logoColor=61DAFB)](https://reactjs.org/)
[![FastAPI](https://img.shields.io/badge/FastAPI-009688?style=for-the-badge&logo=fastapi&logoColor=white)](https://fastapi.tiangolo.com/)
[![LangChain](https://img.shields.io/badge/LangChain_RAG-121212?style=for-the-badge&logo=chainlink&logoColor=white)](https://python.langchain.com/)
[![Groq LLM](https://img.shields.io/badge/Groq_Llama_3.3-f97316?style=for-the-badge)](https://groq.com/)
[![AWS S3](https://img.shields.io/badge/AWS_S3_Terraform-569A31?style=for-the-badge&logo=amazons3&logoColor=white)](https://aws.amazon.com/s3/)
[![MongoDB](https://img.shields.io/badge/MongoDB_Atlas-4EA94B?style=for-the-badge&logo=mongodb&logoColor=white)](https://www.mongodb.com/)

---

**DocMind AI** is a high-throughput, enterprise-grade Document Intelligence and Assessment platform. It integrates secure byte-range PDF streaming from AWS S3, real-time RAG (Retrieval-Augmented Generation) document query capabilities, and an AI-driven Quiz & Mock Test Studio with persistent study notes.

</div>

---

## ✨ Enterprise Capabilities

### 🧠 1. AI Quiz Studio & Mock Test Generation
- **Automated MCQ Generation**: Dynamically extracts semantic context from multi-page PDFs to synthesize structured, high-yield Multiple Choice Questions (MCQs).
- **Explanation Engine**: Instant, detailed rationale for correct vs. incorrect options to accelerate concept mastery.
- **Persistent Essential Notes**: Integrated rich notes module per question with debounced auto-saving to MongoDB.

### 🤖 2. LangChain RAG & Document Chat
- **RAG Architecture**: Vector-embedded semantic search against uploaded PDFs using LangChain and Groq Llama 3.3.
- **Streaming Responses**: Real-time response generation via Server-Sent Events (SSE).

### 🔒 3. AWS S3 Byte-Range Streaming & Infrastructure (IaC)
- **Zero-Copy Byte-Range Streaming**: Authenticated byte-range requests stream heavy PDFs directly from AWS S3 without loading full files into backend memory.
- **Terraform Infrastructure (IaC)**: Includes `infra/terraform/` modules for AWS S3 provisioning with SSE-AES256 encryption, strictly blocked public access, CORS rules, and 30-day lifecycle transitions.

### 🛡️ 4. Multi-Tenant Enterprise Security
- **Bcrypt Hashing**: Safe, enterprise password hashing with robust 72-byte truncation compatibility.
- **Role-Based Access Control (RBAC)**: Admin and User scopes with OTP email verification and invite token activation workflows.

---

## 🛠️ System Architecture

```mermaid
graph TD
    Client[React 19 Frontend] -->|JWT Auth / CORS| API[FastAPI Backend Server]
    API -->|Metadata / Users / Notes| DB[(MongoDB Atlas)]
    API -->|Byte-Range Streaming| S3[AWS S3 Storage]
    API -->|Text Extraction & Context| RAG[LangChain RAG Engine]
    RAG -->|Prompt Context| Groq[Groq Llama 3.3 LLM]
    Groq -->|Structured MCQs / Chat| API
```

---

## 🚀 Getting Started

### Prerequisites
- Python 3.11+ / Poetry
- Node.js 18+ / npm
- MongoDB Atlas Cluster
- AWS S3 Credentials & Groq API Key

### Backend Setup
```bash
cd backend
poetry install
poetry run uvicorn main.py:app --reload --port 8000
```

### Frontend Setup
```bash
cd frontend
npm install
npm run dev
```

### Terraform Infrastructure Deployment
```bash
cd infra/terraform
terraform init
terraform apply -var-file="terraform.tfvars.example"
```

---

<div align="center">
  <sub>Engineered by **Priti** • © 2026 DocMind AI Systems</sub>
</div>
