import logging
import os

from celery import Celery

redis_url = os.environ.get("REDIS_URL", "redis://localhost:6379")

# Celery app configuration
app = Celery("blansole_ai_worker", broker=redis_url, backend=redis_url)


@app.task(name="ai:summary")
def generate_session_summary(session_id: str):
    logging.info("Generating AI summary for session %s", session_id)
    # TODO: Fetch session metrics from DB, compose context, call LLM


@app.task(name="ai:chat")
def process_chat_message(thread_id: str, message: str):
    logging.info("Processing chat message for thread %s", thread_id)
    # TODO: Memory Orchestrator + RAG + LLM call
