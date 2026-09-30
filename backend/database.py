"""Shared singletons: PostgreSQL database client & AWS S3 client."""
import json
import re
import uuid
from datetime import datetime, timezone
from typing import Any, Dict, List, Optional, Union

import boto3
import psycopg2
from psycopg2.extras import RealDictCursor
from psycopg2.pool import ThreadedConnectionPool

from config import settings

# ── PostgreSQL Connection Pool & Abstraction ─────────────────────────────────
_db_instance: Optional["PostgresDatabase"] = None


def get_db() -> "PostgresDatabase":
    global _db_instance
    if _db_instance is None:
        _db_instance = PostgresDatabase(settings.DATABASE_URL)
        _db_instance.init_db()
    return _db_instance


class PostgresDatabase:
    def __init__(self, db_url: str):
        self.db_url = db_url
        self.pool = ThreadedConnectionPool(1, 20, db_url)
        self.users = PostgresCollection(self, "users")
        self.pdfs = PostgresCollection(self, "pdfs")
        self.embeddings = PostgresCollection(self, "embeddings")
        self.chat_history = PostgresCollection(self, "chat_history")
        self.quizzes = PostgresCollection(self, "quizzes")

    def get_conn(self):
        return self.pool.getconn()

    def put_conn(self, conn):
        self.pool.putconn(conn)

    def ping(self):
        conn = self.get_conn()
        try:
            with conn.cursor() as cur:
                cur.execute("SELECT 1;")
                cur.fetchone()
        finally:
            self.put_conn(conn)

    def init_db(self):
        conn = self.get_conn()
        try:
            with conn.cursor() as cur:
                cur.execute("CREATE EXTENSION IF NOT EXISTS vector;")
                cur.execute("""
                    CREATE TABLE IF NOT EXISTS users (
                        id VARCHAR(64) PRIMARY KEY,
                        name VARCHAR(255),
                        email VARCHAR(255) UNIQUE NOT NULL,
                        role VARCHAR(50) DEFAULT 'user',
                        password VARCHAR(255),
                        verified BOOLEAN DEFAULT FALSE,
                        is_active BOOLEAN DEFAULT TRUE,
                        workspace_owner VARCHAR(255),
                        otp VARCHAR(50),
                        otp_expires_at TIMESTAMPTZ,
                        reset_code VARCHAR(50),
                        reset_code_expires_at TIMESTAMPTZ,
                        invite_code VARCHAR(50),
                        invited_by VARCHAR(255),
                        created_at TIMESTAMPTZ
                    );
                """)
                cur.execute("""
                    CREATE TABLE IF NOT EXISTS pdfs (
                        id VARCHAR(64) PRIMARY KEY,
                        workspace_owner VARCHAR(255) NOT NULL,
                        filename VARCHAR(255) NOT NULL,
                        key VARCHAR(500) NOT NULL,
                        size_bytes BIGINT DEFAULT 0,
                        uploaded_at TIMESTAMPTZ,
                        last_accessed_at TIMESTAMPTZ,
                        uploaded_by VARCHAR(255),
                        uploaded_by_name VARCHAR(255),
                        ai_index_status VARCHAR(50) DEFAULT 'pending',
                        ai_chunk_count INT DEFAULT 0,
                        ai_category VARCHAR(100) DEFAULT 'General Document',
                        ai_tags JSONB DEFAULT '[]'::jsonb,
                        ai_indexed_at TIMESTAMPTZ,
                        ai_error TEXT
                    );
                """)
                cur.execute("""
                    CREATE TABLE IF NOT EXISTS embeddings (
                        id VARCHAR(64) PRIMARY KEY,
                        workspace_owner VARCHAR(255) NOT NULL,
                        document_id VARCHAR(64) REFERENCES pdfs(id) ON DELETE CASCADE,
                        document_key VARCHAR(500),
                        filename VARCHAR(255),
                        chunk_index INT,
                        text TEXT,
                        word_count INT,
                        embedding vector(384),
                        created_at TIMESTAMPTZ
                    );
                """)
                cur.execute("""
                    CREATE TABLE IF NOT EXISTS chat_history (
                        id VARCHAR(64) PRIMARY KEY,
                        workspace_owner VARCHAR(255) NOT NULL,
                        message TEXT,
                        answer TEXT,
                        document_id VARCHAR(64),
                        created_at TIMESTAMPTZ
                    );
                """)
                cur.execute("""
                    CREATE TABLE IF NOT EXISTS quizzes (
                        id VARCHAR(64) PRIMARY KEY,
                        workspace_owner VARCHAR(255) NOT NULL,
                        document_id VARCHAR(64),
                        document_name VARCHAR(255),
                        topic VARCHAR(255),
                        questions JSONB DEFAULT '[]'::jsonb,
                        attempts JSONB DEFAULT '[]'::jsonb,
                        last_score JSONB,
                        created_at TIMESTAMPTZ
                    );
                """)
                conn.commit()
        finally:
            self.put_conn(conn)


class InsertResult:
    def __init__(self, inserted_id):
        self.inserted_id = inserted_id


class UpdateResult:
    def __init__(self, matched_count, modified_count):
        self.matched_count = matched_count
        self.modified_count = modified_count


class PostgresCollection:
    def __init__(self, db: PostgresDatabase, table_name: str):
        self.db = db
        self.table_name = table_name

    def _normalize_id_query(self, query: Dict[str, Any]) -> Dict[str, Any]:
        norm = {}
        for k, v in query.items():
            if k in {"_id", "id"}:
                norm["id"] = str(v)
            else:
                norm[k] = str(v) if k == "document_id" and v is not None else v
        return norm

    def _convert_row(self, row: Optional[Dict[str, Any]]) -> Optional[Dict[str, Any]]:
        if not row:
            return None
        d = dict(row)
        if "id" in d:
            d["_id"] = d["id"]
        # Parse JSONB fields
        for json_col in ["ai_tags", "questions", "attempts", "last_score"]:
            if json_col in d and isinstance(d[json_col], str):
                try:
                    d[json_col] = json.loads(d[json_col])
                except Exception:
                    pass
        # Convert vector string to float list if needed
        if "embedding" in d and isinstance(d["embedding"], str):
            try:
                emb_str = d["embedding"].strip("[]")
                d["embedding"] = [float(x) for x in emb_str.split(",") if x.strip()]
            except Exception:
                pass
        return d

    def _build_where(self, query: Dict[str, Any]) -> tuple[str, list[Any]]:
        query = self._normalize_id_query(query)
        where_clauses = []
        params = []

        if "$or" in query:
            or_conditions = query["$or"]
            or_clauses = []
            for cond in or_conditions:
                cond = self._normalize_id_query(cond)
                sub_clauses = []
                for k, v in cond.items():
                    sub_clauses.append(f"{k} = %s")
                    params.append(v)
                if sub_clauses:
                    or_clauses.append("(" + " AND ".join(sub_clauses) + ")")
            if or_clauses:
                where_clauses.append("(" + " OR ".join(or_clauses) + ")")

        for k, v in query.items():
            if k == "$or":
                continue
            if isinstance(v, dict) and "$in" in v:
                in_vals = v["$in"]
                if not in_vals:
                    where_clauses.append("1=0")
                else:
                    placeholders = ", ".join(["%s"] * len(in_vals))
                    where_clauses.append(f"{k} IN ({placeholders})")
                    params.extend(in_vals)
            else:
                where_clauses.append(f"{k} = %s")
                params.append(v)

        where_sql = (" WHERE " + " AND ".join(where_clauses)) if where_clauses else ""
        return where_sql, params

    def find_one(self, query: Dict[str, Any], projection: Optional[Dict[str, int]] = None) -> Optional[Dict[str, Any]]:
        where_sql, params = self._build_where(query)
        sql = f"SELECT * FROM {self.table_name}{where_sql} LIMIT 1;"
        conn = self.db.get_conn()
        try:
            with conn.cursor(cursor_factory=RealDictCursor) as cur:
                cur.execute(sql, params)
                row = cur.fetchone()
                return self._convert_row(row)
        finally:
            self.db.put_conn(conn)

    def find(self, query: Dict[str, Any] = None, projection: Optional[Dict[str, int]] = None) -> "PostgresCursor":
        query = query or {}
        where_sql, params = self._build_where(query)
        sql = f"SELECT * FROM {self.table_name}{where_sql};"
        conn = self.db.get_conn()
        try:
            with conn.cursor(cursor_factory=RealDictCursor) as cur:
                cur.execute(sql, params)
                rows = cur.fetchall()
                converted = [self._convert_row(r) for r in rows]
                return PostgresCursor(converted)
        finally:
            self.db.put_conn(conn)

    def insert_one(self, doc: Dict[str, Any]) -> InsertResult:
        doc = dict(doc)
        doc_id = str(doc.get("_id") or doc.get("id") or uuid.uuid4().hex[:24])
        doc["id"] = doc_id
        if "_id" in doc:
            del doc["_id"]

        cols = []
        vals = []
        placeholders = []
        for k, v in doc.items():
            cols.append(k)
            if isinstance(v, (dict, list)):
                vals.append(json.dumps(v))
                placeholders.append("%s::jsonb")
            elif k == "embedding" and isinstance(v, list):
                vals.append(str(v))
                placeholders.append("%s::vector")
            else:
                vals.append(v)
                placeholders.append("%s")

        cols_sql = ", ".join(cols)
        ph_sql = ", ".join(placeholders)
        sql = f"INSERT INTO {self.table_name} ({cols_sql}) VALUES ({ph_sql});"

        conn = self.db.get_conn()
        try:
            with conn.cursor() as cur:
                cur.execute(sql, vals)
                conn.commit()
            return InsertResult(doc_id)
        finally:
            self.db.put_conn(conn)

    def insert_many(self, docs: List[Dict[str, Any]]):
        for doc in docs:
            self.insert_one(doc)

    def update_one(self, filter_q: Dict[str, Any], update_ops: Dict[str, Any], upsert: bool = False) -> UpdateResult:
        where_sql, params = self._build_where(filter_q)
        existing = self.find_one(filter_q)

        if not existing:
            if upsert:
                # Perform insert
                new_doc = dict(filter_q)
                if "$set" in update_ops:
                    new_doc.update(update_ops["$set"])
                res = self.insert_one(new_doc)
                return UpdateResult(1, 1)
            return UpdateResult(0, 0)

        set_clauses = []
        update_params = []

        # Process $set
        if "$set" in update_ops:
            for k, v in update_ops["$set"].items():
                if k == "questions.$.user_note" and "questions" in filter_q:
                    pass
                cols = k.split(".")
                if len(cols) == 1:
                    if isinstance(v, (dict, list)):
                        set_clauses.append(f"{k} = %s::jsonb")
                        update_params.append(json.dumps(v))
                    else:
                        set_clauses.append(f"{k} = %s")
                        update_params.append(v)

        # Process $unset
        if "$unset" in update_ops:
            for k in update_ops["$unset"].keys():
                set_clauses.append(f"{k} = NULL")

        # Process $push
        if "$push" in update_ops:
            for k, v in update_ops["$push"].items():
                set_clauses.append(f"{k} = COALESCE({k}, '[]'::jsonb) || %s::jsonb")
                update_params.append(json.dumps([v]))

        # Special handling for question note patch: "questions.$.user_note"
        if any("questions." in k for k in update_ops.get("$set", {}).keys()):
            # Handle user_note update inside questions array
            note_val = update_ops["$set"].get("questions.$.user_note")
            target_qid = filter_q.get("questions.id")
            if note_val is not None and target_qid:
                questions = existing.get("questions") or []
                for q in questions:
                    if q.get("id") == target_qid:
                        q["user_note"] = note_val
                set_clauses = ["questions = %s::jsonb"]
                update_params = [json.dumps(questions)]

        if not set_clauses:
            return UpdateResult(1, 0)

        set_sql = ", ".join(set_clauses)
        sql = f"UPDATE {self.table_name} SET {set_sql}{where_sql};"
        all_params = update_params + params

        conn = self.db.get_conn()
        try:
            with conn.cursor() as cur:
                cur.execute(sql, all_params)
                conn.commit()
                return UpdateResult(cur.rowcount, cur.rowcount)
        finally:
            self.db.put_conn(conn)

    def delete_one(self, query: Dict[str, Any]):
        where_sql, params = self._build_where(query)
        sql = f"DELETE FROM {self.table_name} WHERE id IN (SELECT id FROM {self.table_name}{where_sql} LIMIT 1);"
        conn = self.db.get_conn()
        try:
            with conn.cursor() as cur:
                cur.execute(sql, params)
                conn.commit()
        finally:
            self.db.put_conn(conn)

    def delete_many(self, query: Dict[str, Any]):
        where_sql, params = self._build_where(query)
        sql = f"DELETE FROM {self.table_name}{where_sql};"
        conn = self.db.get_conn()
        try:
            with conn.cursor() as cur:
                cur.execute(sql, params)
                conn.commit()
        finally:
            self.db.put_conn(conn)

    def count_documents(self, query: Dict[str, Any]) -> int:
        where_sql, params = self._build_where(query)
        sql = f"SELECT COUNT(*) FROM {self.table_name}{where_sql};"
        conn = self.db.get_conn()
        try:
            with conn.cursor() as cur:
                cur.execute(sql, params)
                res = cur.fetchone()
                return res[0] if res else 0
        finally:
            self.db.put_conn(conn)

    def pgvector_search(
        self,
        workspace_owner: str,
        query_vector: list[float],
        limit: int = 3,
        document_key: str | None = None,
    ) -> list[dict]:
        """Perform native PostgreSQL pgvector cosine distance vector search (<=>)."""
        where_clauses = ["workspace_owner = %s"]
        params = [workspace_owner]
        if document_key:
            where_clauses.append("document_key = %s")
            params.append(document_key)

        where_sql = " WHERE " + " AND ".join(where_clauses)
        vector_str = str(query_vector)
        params.extend([vector_str, limit])

        # 1 - (embedding <=> query_vector) calculates cosine similarity score
        sql = f"""
            SELECT id, workspace_owner, document_id, document_key, filename, chunk_index, text, word_count,
                   1 - (embedding <=> %s::vector) AS score
            FROM {self.table_name}
            {where_sql}
            ORDER BY embedding <=> %s::vector ASC
            LIMIT %s;
        """
        # Duplicate vector parameter for ORDER BY
        params_final = params[:-2] + [vector_str, vector_str, limit]

        conn = self.db.get_conn()
        try:
            with conn.cursor(cursor_factory=RealDictCursor) as cur:
                cur.execute(sql, params_final)
                rows = cur.fetchall()
                return [self._convert_row(r) for r in rows]
        finally:
            self.db.put_conn(conn)


class PostgresCursor:
    def __init__(self, data: List[Dict[str, Any]]):
        self.data = data

    def sort(self, key_or_list, direction=1) -> "PostgresCursor":
        if isinstance(key_or_list, str):
            field = key_or_list
            reverse = direction == -1
        elif isinstance(key_or_list, list) and key_or_list:
            field = key_or_list[0][0]
            reverse = key_or_list[0][1] == -1
        else:
            return self

        self.data.sort(
            key=lambda d: d.get(field) or datetime.min,
            reverse=reverse,
        )
        return self

    def limit(self, n: int) -> "PostgresCursor":
        self.data = self.data[:n]
        return self

    def __iter__(self):
        return iter(self.data)

    def __len__(self):
        return len(self.data)

    def __getitem__(self, index):
        return self.data[index]


# ── AWS S3 Singleton ──────────────────────────────────────────────────────────
_s3_client = None


def get_s3():
    global _s3_client
    if _s3_client is None:
        _s3_client = boto3.client(
            "s3",
            region_name=settings.AWS_REGION,
            aws_access_key_id=settings.AWS_ACCESS_KEY,
            aws_secret_access_key=settings.AWS_SECRET_KEY,
        )
    return _s3_client
