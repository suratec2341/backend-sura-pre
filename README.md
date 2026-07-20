# Blansole Backend

Backend monorepo for the Blansole / Blan Sole Pre smart insole health app.
The current implementation is an MVP scaffold with NestJS API/workers, a Python AI worker, Prisma schema, and local Docker infrastructure.

## Structure

```text
apps/
  api/
  worker-session/
  worker-ai/
  worker-notification/
  worker-health-sync/
  worker-link-checker/
  worker-episode-summary/
libs/
  shared/        # shared Nest/Node utilities
  python/        # shared Python package
prisma/          # Prisma schema
infra/           # docker compose + nginx
```

## Environment

A local `.env` file is used for development defaults and secret placeholders.
See `docs/environment.md` for the full variable list and which external keys are needed.
The mobile/backend payload contract is documented in `docs/frontend-api-contract.md`.

## Local validation

```sh
npm ci
npm run lint
npm test -- --runInBand
DATABASE_URL=postgresql://blansole:blansole@localhost:5432/blansole npx prisma validate
npm run build
python -m compileall apps/worker-ai/src libs/python/src
docker compose --env-file .env -f infra/docker-compose.yml config
```

## Docker dev

The first deployment target is Hostinger VPS with Docker Compose. Local development uses the same service layout: API, workers, Postgres, Redis, MinIO, and nginx.

For Hostinger pull-based deployment, see `docs/hostinger-deployment.md`, `scripts/deploy-hostinger.sh`, and `scripts/deploy-remote-hostinger.sh` if the VPS is only reachable through VPN.

Build and start local infrastructure plus app services:

```sh
docker compose --env-file .env -f infra/docker-compose.yml up -d --build
```

Endpoints:

- API direct: `http://localhost:3000/api/v1`
- API via nginx: `http://localhost:8081/api/v1`
- Health check: `http://localhost:8081/healthz`
- MinIO console: `http://localhost:9001`

Stop services:

```sh
docker compose --env-file .env -f infra/docker-compose.yml down
```

## Notes

- Frontend-facing auth, profile/onboarding, device, session/history, risk, insight, and notification endpoints are implemented.
- An initial Prisma migration exists; run `npm run db:migrate:deploy` during deployment before serving traffic.
- BLE packet decoding and the final sensor-derived gait/pressure algorithms still require the insole protocol specification.
