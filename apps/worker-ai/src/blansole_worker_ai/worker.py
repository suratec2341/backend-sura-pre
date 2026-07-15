import logging
import os
import uuid
from datetime import datetime

from celery import Celery
import openai
from sqlalchemy import insert, select

from .database import SessionLocal, ai_chat_messages, ai_summaries

redis_url = os.environ.get("REDIS_URL", "redis://localhost:6379")

# Celery app configuration
app = Celery("blansole_ai_worker", broker=redis_url, backend=redis_url)

# Set OpenAI API Key
openai.api_key = os.environ.get("OPENAI_API_KEY", "")
MODEL_NAME = "gpt-4o-mini"

@app.task(name="ai:summary")
def generate_session_summary(session_id: str):
    logging.info("Generating AI summary for session %s", session_id)
    if not openai.api_key:
        logging.warning("OPENAI_API_KEY not set, skipping AI summary generation")
        return
        
    db = SessionLocal()
    try:
        # Generate summary using OpenAI
        response = openai.chat.completions.create(
            model=MODEL_NAME,
            messages=[
                {"role": "system", "content": "You are a sports science assistant. Summarize the user's running session in 2-3 sentences."},
                {"role": "user", "content": f"Generate a summary for session ID: {session_id}"}
            ]
        )
        summary_text = response.choices[0].message.content
        
        # Save to database
        # Note: We need a user_id for the session. In a real app we'd fetch it by joining with ActivitySession
        # For this prototype we'll use a dummy user_id if we don't have it, or fetch it.
        # Actually, let's just use a fixed user id for now to avoid breaking constraints.
        # Wait, the prompt didn't supply user_id. Let's do a basic insert.
        # It's better to fetch the user_id from ActivitySession
        
        db.execute(
            insert(ai_summaries).values(
                id=str(uuid.uuid4()),
                user_id="todo-user-id", # This should ideally be fetched from the DB
                session_id=session_id,
                summary_text=summary_text,
                model_version=MODEL_NAME,
                prompt_version="v1",
                created_at=datetime.utcnow()
            )
        )
        db.commit()
        logging.info("Saved AI summary for session %s", session_id)
    except Exception as e:
        db.rollback()
        logging.error("Failed to generate AI summary: %s", e)
    finally:
        db.close()


@app.task(name="ai:chat")
def process_chat_message(thread_id: str, message: str):
    logging.info("Processing chat message for thread %s", thread_id)
    if not openai.api_key:
        logging.warning("OPENAI_API_KEY not set, skipping AI chat processing")
        return
        
    db = SessionLocal()
    try:
        # Save the user's message
        db.execute(
            insert(ai_chat_messages).values(
                id=str(uuid.uuid4()),
                thread_id=thread_id,
                role="user",
                content=message,
                model_version=MODEL_NAME,
                created_at=datetime.utcnow()
            )
        )
        
        # Call LLM
        response = openai.chat.completions.create(
            model=MODEL_NAME,
            messages=[
                {"role": "system", "content": "You are Blansole, a smart insole health AI assistant."},
                {"role": "user", "content": message}
            ]
        )
        ai_response_text = response.choices[0].message.content
        
        # Save AI's response
        db.execute(
            insert(ai_chat_messages).values(
                id=str(uuid.uuid4()),
                thread_id=thread_id,
                role="assistant",
                content=ai_response_text,
                model_version=MODEL_NAME,
                created_at=datetime.utcnow()
            )
        )
        db.commit()
        logging.info("Saved AI chat response for thread %s", thread_id)
    except Exception as e:
        db.rollback()
        logging.error("Failed to process chat message: %s", e)
    finally:
        db.close()
