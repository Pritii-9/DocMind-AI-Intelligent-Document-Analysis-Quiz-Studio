import os
from typing import List, Dict, Any

from langchain.vectorstores import Chroma
from langchain.embeddings.sentence_transformer import SentenceTransformerEmbeddings

# Directory for persisted Chroma DB (relative to project root)
CHROMA_PERSIST_DIR = os.getenv("CHROMA_PERSIST_DIR", "./chroma_db")

def _get_embeddings():
    model_name = os.getenv("SENTENCE_TRANSFORMERS_MODEL", "all-MiniLM-L6-v2")
    cache_dir = os.getenv("SENTENCE_TRANSFORMERS_HOME", None)
    return SentenceTransformerEmbeddings(model_name=model_name, cache_folder=cache_dir)

def _get_vectorstore(embeddings=None):
    if embeddings is None:
        embeddings = _get_embeddings()
    return Chroma(persist_directory=CHROMA_PERSIST_DIR, embedding_function=embeddings)

def add_documents(documents: List[Dict[str, Any]], embeddings=None) -> bool:
    """Add a list of LangChain Document objects to the vector store and persist."""
    store = _get_vectorstore(embeddings)
    store.add_documents(documents)
    store.persist()
    return True

def similarity_search(query: str, k: int = 4, embeddings=None) -> List[Dict[str, Any]]:
    """Return top‑k similar chunks for a query string as simple dicts."""
    store = _get_vectorstore(embeddings)
    docs = store.similarity_search(query, k=k)
    return [{"page_content": d.page_content, "metadata": d.metadata} for d in docs]
