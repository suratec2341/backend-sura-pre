import logging

from fastapi import FastAPI
from pydantic_settings import BaseSettings


class Settings(BaseSettings):
    database_url: str = "postgresql://blansole:blansole@localhost:5432/blansole"
    redis_url: str = "redis://localhost:6379"
    llm_api_key: str = ""
    llm_model: str = "gpt-4o-mini"

    class Config:
        env_file = ".env"
        extra = "ignore"


settings = Settings()
app = FastAPI(title="Blansole AI Worker API")


@app.get("/healthz")
async def health_check():
    return {"status": "ok"}


@app.post("/internal/process-summary")
async def process_summary(session_id: str):
    """
    Internal API for testing or synchronous invocation.
    In production, this should be triggered via Redis queue.
    """
    logging.info("Processing AI summary for session: %s", session_id)
    # TODO: Implement Memory Orchestrator (§5.5) and LLM call
    return {"status": "queued", "session_id": session_id}
