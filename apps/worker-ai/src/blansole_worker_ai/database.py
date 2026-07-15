import os
import uuid
from datetime import datetime

from sqlalchemy import create_engine, MetaData, Table, Column, String, DateTime, Text, insert, select
from sqlalchemy.orm import sessionmaker

DATABASE_URL = os.environ.get("DATABASE_URL", "postgresql://postgres:postgres@localhost:5432/blansole")

# Create engine
engine = create_engine(DATABASE_URL)
SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)
metadata = MetaData()

# Define tables for raw SQL insertion/selection
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

def get_db():
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()
