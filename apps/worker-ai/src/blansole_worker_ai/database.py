import os
import uuid
from datetime import datetime

from sqlalchemy import Boolean, Column, DateTime, Float, Integer, MetaData, String, Table, Text, create_engine
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
    Column("activity_type", String, nullable=False),
    Column("started_at", DateTime, nullable=False),
    Column("duration_sec", Integer, nullable=True),
    Column("status", String, nullable=False),
)

session_metrics = Table(
    "session_metrics",
    metadata,
    Column("session_id", String, primary_key=True),
    Column("steps", Integer, nullable=True),
    Column("distance_km", Float, nullable=True),
    Column("calories", Float, nullable=True),
    Column("speed_kmh", Float, nullable=True),
    Column("cadence", Float, nullable=True),
    Column("walk_quality_score", Float, nullable=True),
    Column("balance_score", Float, nullable=True),
    Column("algorithm_version", String, nullable=False),
)

session_pressure_zones = Table(
    "session_pressure_zones",
    metadata,
    Column("id", String, primary_key=True),
    Column("session_id", String, nullable=False),
    Column("foot_side", String, nullable=False),
    Column("forefoot_percent", Float, nullable=False),
    Column("midfoot_percent", Float, nullable=False),
    Column("heel_percent", Float, nullable=False),
    Column("hotspot_area", String, nullable=True),
    Column("pressure_level", String, nullable=False),
    Column("algorithm_version", String, nullable=False),
)

session_gait_metrics = Table(
    "session_gait_metrics",
    metadata,
    Column("session_id", String, primary_key=True),
    Column("cadence", Float, nullable=True),
    Column("step_length", Float, nullable=True),
    Column("gait_speed", Float, nullable=True),
    Column("variability_cv", Float, nullable=True),
    Column("gait_score", Float, nullable=True),
    Column("algorithm_version", String, nullable=False),
)

risk_assessments = Table(
    "risk_assessments",
    metadata,
    Column("id", String, primary_key=True),
    Column("user_id", String, nullable=False),
    Column("assessment_type", String, nullable=False),
    Column("scope", String, nullable=False),
    Column("source_session_id", String, nullable=True),
    Column("score", Float, nullable=False),
    Column("risk_level", String, nullable=False),
    Column("algorithm_version", String, nullable=False),
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
