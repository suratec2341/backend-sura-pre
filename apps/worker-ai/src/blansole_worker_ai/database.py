import os
import uuid
from datetime import datetime

from sqlalchemy import Boolean, Column, DateTime, Integer, MetaData, String, Table, Text, create_engine
from sqlalchemy.orm import sessionmaker
from pgvector.sqlalchemy import Vector

DATABASE_URL = os.environ.get("DATABASE_URL", "postgresql://postgres:postgres@localhost:5432/blansole")

# Create engine
engine = create_engine(DATABASE_URL)
SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)
metadata = MetaData()

# Define tables for raw SQL insertion/selection
activity_sessions = Table(
    "activity_sessions",
    metadata,
    Column("id", String, primary_key=True),
    Column("user_id", String, nullable=False),
)

ai_chat_threads = Table(
    "ai_chat_threads",
    metadata,
    Column("id", String, primary_key=True),
    Column("user_id", String, nullable=False),
    Column("archived_at", DateTime, nullable=True),
)

ai_chat_messages = Table(
    "ai_chat_messages",
    metadata,
    Column("id", String, primary_key=True, default=lambda: str(uuid.uuid4())),
    Column("thread_id", String, nullable=False),
    Column("role", String, nullable=False),
    Column("content", Text, nullable=False),
    Column("context_snapshot_ref", String, nullable=True),
    Column("model_version", String, nullable=True),
    Column("created_at", DateTime, default=datetime.utcnow),
)

ai_summaries = Table(
    "ai_summaries",
    metadata,
    Column("id", String, primary_key=True, default=lambda: str(uuid.uuid4())),
    Column("user_id", String, nullable=False),
    Column("session_id", String, nullable=False, unique=True),
    Column("summary_text", Text, nullable=False),
    Column("model_version", String, nullable=False),
    Column("prompt_version", String, nullable=False),
    Column("created_at", DateTime, default=datetime.utcnow),
)

rag_documents = Table(
    "rag_documents",
    metadata,
    Column("id", String, primary_key=True),
    Column("title", String, nullable=False),
    Column("category", String, nullable=False),
    Column("is_active", Boolean, nullable=False),
)

rag_chunks = Table(
    "rag_chunks",
    metadata,
    Column("id", String, primary_key=True),
    Column("document_id", String, nullable=False),
    Column("chunk_text", Text, nullable=False),
    Column("chunk_index", Integer, nullable=False),
)

rag_embeddings = Table(
    "rag_embeddings",
    metadata,
    Column("id", String, primary_key=True, default=lambda: str(uuid.uuid4())),
    Column("chunk_id", String, nullable=False, unique=True),
    Column("embedding", Vector(1536), nullable=False),
    Column("embedding_model_version", String, nullable=False),
)

def get_db():
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()
