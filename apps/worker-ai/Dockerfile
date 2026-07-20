FROM python:3.12-slim AS runtime
WORKDIR /app

ENV PYTHONDONTWRITEBYTECODE=1 \
    PYTHONUNBUFFERED=1

COPY libs/python ./libs/python
COPY apps/worker-ai ./apps/worker-ai

RUN pip install --no-cache-dir ./libs/python ./apps/worker-ai

RUN groupadd --system --gid 10001 blansole \
    && useradd --system --uid 10001 --gid blansole \
        --create-home --home-dir /home/blansole blansole

USER blansole

CMD ["celery", "-A", "blansole_worker_ai.worker", "worker", "--loglevel=INFO"]
