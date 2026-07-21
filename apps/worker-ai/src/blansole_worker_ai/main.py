import logging
import secrets

from fastapi import FastAPI, Header, HTTPException, status
from pydantic_settings import BaseSettings


class Settings(BaseSettings):
    database_url: str = "postgresql://blansole:blansole@localhost:5432/blansole"
    redis_url: str = "redis://localhost:6379"
    llm_api_key: str = ""
    llm_model: str = "gpt-4o-mini"
    internal_api_key: str = ""

    class Config:
        env_file = ".env"
        extra = "ignore"


settings = Settings()
app = FastAPI(title="Blansole AI Worker API")


@app.get("/healthz")
async def health_check():
    return {"status": "ok"}


@app.post("/internal/process-summary")
async def process_summary(
    session_id: str,
    x_internal_key: str | None = Header(default=None),
):
    """
    Internal API for testing or synchronous invocation.
    In production, this should be triggered via Redis queue.
    """
    if not settings.internal_api_key:
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail="INTERNAL_API_KEY is not configured",
        )
    if not x_internal_key or not secrets.compare_digest(
        x_internal_key,
        settings.internal_api_key,
    ):
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid internal API key",
        )

    from .worker import app as celery_app

    logging.info("Queueing AI summary for session: %s", session_id)
    task = celery_app.send_task("ai:summary", args=[session_id])
    return {"status": "queued", "session_id": session_id, "task_id": task.id}
