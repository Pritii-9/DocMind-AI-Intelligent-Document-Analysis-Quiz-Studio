# RAG & LangGraph Agent Implementation Documentation

This document provides a comprehensive overview of the **RAG (Retrieval-Augmented Generation)** and **LangGraph Agent** implementation in our PDF Streaming Platform, including code snippets from the actual codebase.

---

## Table of Contents

1. [RAG Implementation](#1-rag-implementation-retrieval-augmented-generation)
2. [LangGraph Agent Implementation](#2-langgraph-agent-implementation)
3. [Frontend Integration](#3-frontend-integration)
4. [Architecture Flow Diagrams](#4-architecture-flow-diagrams)

---

## 1. RAG Implementation (Retrieval-Augmented Generation)

### Overview

Our RAG system enables semantic document Q&A by:

1. Extracting text from uploaded PDFs (using pypdf)
2. Chunking text into smaller segments (~500 words)
3. Generating embeddings using sentence-transformers (all-MiniLM-L6-v2)
4. Storing vectors in MongoDB for similarity search
5. Using Groq API (Llama 3.3 70B Versatile) to generate answers based on retrieved context

### 1.1 PDF Text Extraction

```python
# backend/services/ai_service.py
import io
import re
from pypdf import PdfReader

def extract_pdf_text(document_key: str) -> str:
    """Extract text content from a PDF stored in S3."""
    pdf_bytes = _download_pdf_bytes(document_key)
    reader = PdfReader(io.BytesIO(pdf_bytes))
    page_text: list[str] = []

    for page in reader.pages:
        raw = page.extract_text() or ""
        # Normalize whitespace
        normalized = re.sub(r"\s+", " ", raw).strip()
        if normalized:
            page_text.append(normalized)

    return "\n\n".join(page_text).strip()
```

### 1.2 Text Chunking

```python
# backend/services/ai_service.py
DEFAULT_CHUNK_SIZE = 500

def chunk_text(text: str, chunk_size: int = DEFAULT_CHUNK_SIZE) -> list[dict[str, Any]]:
    """Split text into overlapping chunks of ~500 words."""
    words = text.split()
    if not words:
        return []

    chunks: list[dict[str, Any]] = []
    for start in range(0, len(words), chunk_size):
        segment = words[start:start + chunk_size]
        chunks.append({
            "chunk_index": len(chunks),
            "text": " ".join(segment).strip(),
            "word_count": len(segment),
            "start_word": start,
            "end_word": start + len(segment),
        })
    return chunks
```

### 1.3 Embedding Generation

```python
# Using sentence-transformers (all-MiniLM-L6-v2)
def embed_texts(texts: list[str]) -> list[list[float]]:
    """Embed texts using local sentence-transformers."""
    if not texts:
        return []
    model = _get_embedding_model()  # Lazy-loaded singleton
    embeddings = model.encode(texts, convert_to_numpy=True, show_progress_bar=False)
    return [emb.tolist() for emb in embeddings]
```

### 1.4 Document Ingestion Pipeline

```python
# backend/services/ai_service.py
def ingest_document(workspace_owner: str, document_ref: str) -> dict[str, Any]:
    """Full pipeline: extract → chunk → embed → store in MongoDB."""
    ensure_ai_indexes()
    document = resolve_document(workspace_owner, document_ref)
    document_id = document["_id"]

    # Step 1: Extract text from PDF
    extracted_text = extract_pdf_text(document["key"])
    chunks = chunk_text(extracted_text)

    # Step 2: Generate embeddings
    vectors = embed_texts([chunk["text"] for chunk in chunks])

    # Step 3: Delete old embeddings and store new ones
    get_embedding_collection().delete_many({
        "workspace_owner": workspace_owner,
        "document_id": document_id,
    })

    records = []
    for chunk, vector in zip(chunks, vectors):
        records.append({
            "workspace_owner": workspace_owner,
            "document_id": document_id,
            "document_key": document["key"],
            "chunk_index": chunk["chunk_index"],
            "text": chunk["text"],
            "embedding": vector,
            "created_at": datetime.utcnow(),
        })

    if records:
        get_embedding_collection().insert_many(records)

    return {"chunk_count": len(records)}
```

### 1.5 Semantic Search (Vector Similarity)

```python
# backend/services/ai_service.py
def search_similar_chunks(
    workspace_owner: str, 
    query_vector: list[float], 
    limit: int = 3, 
    document_key: str = None
) -> list[dict[str, Any]]:
    """Search MongoDB vector store for similar chunks."""
    try:
        # Try MongoDB Atlas vector search first
        return _vector_search_pipeline(query_vector, workspace_owner, limit, document_key)
    except Exception:
        # Fallback: local cosine similarity
        candidates = list(get_embedding_collection().find(filter_query))
        
        scored = []
        for item in candidates:
            embedding = item.get("embedding") or []
            score = _cosine_similarity(query_vector, embedding)
            scored.append({"text": item.get("text"), "score": score, ...})
        
        scored.sort(key=lambda x: x.get("score", 0), reverse=True)
        return scored[:limit]
```

### 1.6 RAG Answer Generation

```python
# backend/services/ai_service.py
def build_rag_answer(question: str, matches: list[dict[str, Any]]) -> str:
    """Build answer using LLM with retrieved context."""
    if not matches:
        return "I could not find relevant indexed content."

    context = "\n\n".join(
        f"[Chunk {index + 1}]\n{match.get('text', '')}"
        for index, match in enumerate(matches)
    )

    return generate_chat_completion([
        {
            "role": "system",
            "content": "You answer questions about a PDF using only the supplied context."
        },
        {
            "role": "user",
            "content": f"Using only the following context:\n\n{context}\n\nAnswer: {question}"
        }
    ], temperature=0.1)
```

---

## 2. LangGraph Agent Implementation

### Overview

Our LangGraph agent is a stateful AI assistant that:

1. Uses Groq API with Llama 3.3 70B Versatile LLM
2. Has custom tools for workspace operations (workspace analytics, document search, semantic search)
3. Maintains conversation memory using MongoDB checkpointer (MongoDBSaver)
4. Streams responses via Server-Sent Events (SSE) for real-time output

### 2.1 Custom Agent Tools

```python
# backend/agent_tools.py
from langchain_core.tools import tool

def build_agent_tools(workspace_owner: str):
    @tool
    def get_workspace_analytics() -> str:
        """Return document totals, storage usage, active members."""
        # Query MongoDB for workspace stats
        ...

    @tool
    def get_recent_uploads(days: int = 7) -> str:
        """Return uploads from the last N days."""
        ...

    @tool
    def search_documents_by_name(query: str, limit: int = 5) -> str:
        """Find documents by filename."""
        ...

    @tool
    def semantic_search_workspace(question: str, limit: int = 4) -> str:
        """Search indexed chunks across all PDFs in workspace."""
        ...
```

### 2.2 Creating the LangGraph Agent

```python
# backend/services/ai_service.py
from langgraph.prebuilt import create_react_agent
from langgraph.checkpoint.mongodb import MongoDBSaver
from langchain_groq import ChatGroq
from langchain_core.messages import SystemMessage

def _get_langgraph_agent(workspace_owner: str):
    """Create a LangGraph REACT agent with custom tools."""
    llm = ChatGroq(
        groq_api_key=_groq_api_key(),
        model_name=_groq_chat_model(),  # "llama-3.3-70b-versatile"
        temperature=0,
    )
    tools = build_agent_tools(workspace_owner)

    system_message = SystemMessage(content=(
        "You are the workspace AI agent. Use tools whenever the answer depends on "
        "workspace data or document content. Do not invent counts or files."
    ))

    # MongoDB checkpointer for conversation memory
    client = current_app.mongo_client
    checkpointer = MongoDBSaver(client, db_name=current_app.db.name)

    return create_react_agent(
        llm, 
        tools, 
        state_modifier=system_message, 
        checkpointer=checkpointer
    )
```

### 2.3 Running the Agent

```python
# backend/services/ai_service.py
def run_workspace_command_agent(
    workspace_owner: str, 
    user_query: str, 
    thread_id: str = "default"
) -> str:
    """Invoke the agent with a user query."""
    agent = _get_langgraph_agent(workspace_owner)
    config = {"configable": {"thread_id": thread_id}}
    result = agent.invoke({"messages": [("user", user_query)]}, config)
    return result["messages"][-1].content

# Streaming version for real-time output
def stream_workspace_command_agent(
    workspace_owner: str, 
    user_query: str, 
    thread_id: str
):
    """Stream agent responses via SSE."""
    agent = _get_langgraph_agent(workspace_owner)
    config = {"configable": {"thread_id": thread_id}}

    for event in agent.stream(
        {"messages": [("user", user_query)]}, 
        config, 
        stream_mode="messages"
    ):
        message, meta = event
        if message.content:
            yield f"data: {json.dumps({'content': message.content, 'type': message.type})}\n\n"

    yield "data: [DONE]\n\n"
```

### 2.4 API Route

```python
# backend/routes/ai.py
@ai_bp.route("/chat/stream", methods=["POST"])
@jwt_required()
def chat_stream():
    """Stream AI agent responses."""
    data = _json_body()
    user_query = data.get("query", "").strip()
    thread_id = data.get("thread_id", "default")

    generator = stream_workspace_command_agent(
        _workspace_owner(), 
        user_query, 
        thread_id
    )
    return Response(generator, mimetype="text/event-stream")
```

---

## 3. Frontend Integration

### ChatAI Component

```typescript
// frontend/src/components/ChatAI.tsx
function ChatAI({ docKey, title }) {
  const sendMessage = async () => {
    const token = localStorage.getItem("access_token");
    
    // Call streaming endpoint
    const response = await fetch(`${API_BASE_URL}/ai/chat/stream`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify({ 
        query: userMsg.content, 
        thread_id: threadIdRef.current 
      }),
    });

    const reader = response.body?.getReader();
    const decoder = new TextDecoder("utf-8");

    // Process streaming chunks
    while (reader) {
      const { value, done } = await reader.read();
      if (done) break;
      
      buffer += decoder.decode(value, { stream: true });
      const parts = buffer.split("\n\n");
      buffer = parts.pop() ?? "";

      for (const part of parts) {
        if (part.startsWith("data: ")) {
          const dataStr = part.slice(6).trim();
          if (dataStr === "[DONE]") break;
          
          const parsed = JSON.parse(dataStr);
          if (parsed.content) {
            currentContent += parsed.content;
            setMessages((prev) => prev.map(...));
          }
        }
      }
    }
  };
}
```

---

## 4. Architecture Flow Diagrams

### RAG Pipeline Flow

```
┌─────────────┐     ┌─────────────┐     ┌─────────────┐     ┌─────────────┐
│  PDF File   │────>│  pypdf     │────>│  Chunking  │────>│ Embedding  │
│  (S3)      │     │ Extraction │     │ (~500 words)│     │ (MiniLM)   │
└─────────────┘     └─────────────┘     └─────────────┘     └─────────────┘
                                                            │
                                                            ▼
┌─────────────┐     ┌─────────────┐     ┌─────────────��     ┌─────────────┐
│  User      │<────│  Groq API   │<────│  Build    │<────│  MongoDB   │
│  Query     │     │  Llama 3.3  │     │ Context   │     │ Vector    │
└─────────────┘     └─────────────┘     └─────────────┘     └─────────────┘
```

### LangGraph Agent Flow

```
┌─────────────┐
│  User      │
│  Query     │
└──────┬──────┘
       │
       ▼
┌────────────────────────────────────────────────────────────┐
│              LangGraph REACT Agent                         │
│  ┌──────────────┐    ┌──────────────┐                   │
│  │   Decide    │───>│  Use Tool   │                   │
│  │ (LLM Mode)  │    │  or Generate│                   │
│  └──────────────┘    └──────────────┘                   │
│         │                   │                            │
│         │             ┌─────┴─────┐                      │
│         │             │          │                            │
│         ▼             ▼          ▼                       │
│   ┌──────────┐ ┌──────────┐ ┌──────────┐              │
│   │  Query   │ │ Semantic │ │ Generate │              │
│   │MongoDB  │ │  Search  │ │  Response│              │
│   └──────────┘ └──────────┘ └──────────┘              │
└────────────────────────────────────────────────────────────┘
       │
       ▼
┌─────────────┐     ┌─────────────┐     ┌─────────────┐
│  Stream    │────>│  MongoDB   │────>│  Response  │
│  (SSE)     │     │ Checkpointer│     │  to User   │
└─────────────┘     │ (Memory)   │     └─────────────┘
                    └─────────────┘
```

---

## Tech Stack Summary

| Component | Technology |
|-----------|------------|
| **LLM** | Groq API (Llama 3.3 70B Versatile) |
| **Embeddings** | sentence-transformers (all-MiniLM-L6-v2) |
| **Vector Store** | MongoDB Atlas with $vectorSearch |
| **PDF Extraction** | pypdf |
| **Agent Framework** | LangGraph with create_react_agent |
| **Memory** | MongoDBSaver (MongoDB checkpointer) |
| **Frontend AI Chat** | React with SSE streaming |
| **Streaming** | Server-Sent Events (SSE) |

---

*This documentation includes code snippets from `backend/services/ai_service.py` and `backend/agent_tools.py` in our actual codebase.*
