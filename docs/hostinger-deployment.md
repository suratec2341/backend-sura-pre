# Hostinger deployment plan

The first deployment target is Hostinger, not AWS. Use a Hostinger VPS/KVM plan with Docker support.

## Important note

Hostinger shared hosting is not suitable for this backend because the system needs:

- Long-running NestJS API container
- Multiple worker containers
- Python Celery worker
- PostgreSQL with pgvector
- Redis
- MinIO object storage
- Reverse proxy / TLS

Use Hostinger VPS/KVM instead.

## Recommended Hostinger setup for MVP

You said you will use the largest Hostinger VM plan, so running the full MVP stack on one VPS is acceptable for the first release/testing cycle.

Minimum practical VPS for early testing:

- 2 vCPU
- 4 GB RAM minimum; 8 GB preferred if running MinIO + Postgres + all workers
- 40+ GB SSD
- Ubuntu 22.04/24.04
- Docker + Docker Compose plugin

Largest Hostinger VM package is better because Postgres + MinIO + multiple workers can use memory during builds and AI workloads.

## DNS plan

Point DNS records to the VPS public IP:

```txt
api.yourdomain.com     A     <HOSTINGER_VPS_IP>
minio.yourdomain.com   A     <HOSTINGER_VPS_IP>   optional later
```

For early testing, one domain can be enough:

```txt
api.yourdomain.com
```

## Environment values to prepare

Before staging on Hostinger, update `.env` on the VPS:

```env
NODE_ENV=production
APP_BASE_URL=https://api.yourdomain.com
API_PUBLIC_URL=https://api.yourdomain.com/api/v1
PUBLIC_API_HOST=api.yourdomain.com
SSL_EMAIL=your-email@example.com

POSTGRES_USER=CHANGE_ME
POSTGRES_PASSWORD=CHANGE_ME_STRONG_PASSWORD
POSTGRES_DB=blansole
DOCKER_DATABASE_URL=postgresql://CHANGE_ME:CHANGE_ME_STRONG_PASSWORD@postgres:5432/blansole

MINIO_ROOT_USER=CHANGE_ME_MINIO_ADMIN
MINIO_ROOT_PASSWORD=CHANGE_ME_STRONG_MINIO_PASSWORD
S3_ENDPOINT=http://minio:9000
DOCKER_S3_ENDPOINT=http://minio:9000
S3_REGION=us-east-1
S3_BUCKET=blansole-prod
S3_ACCESS_KEY=CHANGE_ME_MINIO_ACCESS_KEY
S3_SECRET_KEY=CHANGE_ME_MINIO_SECRET_KEY
S3_FORCE_PATH_STYLE=true

JWT_ACCESS_SECRET=CHANGE_ME_STRONG_RANDOM
JWT_REFRESH_SECRET=CHANGE_ME_DIFFERENT_STRONG_RANDOM
CORS_ORIGINS=https://api.yourdomain.com
```

External keys can be added when each feature is implemented:

- Google OAuth: `GOOGLE_CLIENT_ID`, `GOOGLE_CLIENT_SECRET`
- Facebook OAuth: `FACEBOOK_APP_ID`, `FACEBOOK_APP_SECRET`
- AI: `LLM_API_KEY`, `OPENAI_API_KEY`
- YouTube: `YOUTUBE_API_KEY`, `YOUTUBE_CHANNEL_ID`
- Push: `FCM_*`, `APNS_*`

## Pull-based deployment flow

For now, deployment is pull-based:

1. Push code to GitHub.
2. Connect to the VPN that can reach the Hostinger VPS.
3. SSH into Hostinger VPS, or run the local SSH bridge script from your machine.
4. Pull latest code.
5. Rebuild/restart Docker Compose.

This is the safest option if the VM is only reachable through VPN and GitHub Actions cannot SSH to it directly.

### Initial VPS setup

On the Hostinger VPS:

```sh
sudo apt update
sudo apt install -y ca-certificates curl git
curl -fsSL https://get.docker.com | sudo sh
sudo usermod -aG docker $USER
```

Reconnect SSH so the Docker group takes effect.

### First clone

```sh
git clone <your-repo-url> blansole-backend
cd blansole-backend
cp .env.hostinger.example .env
nano .env
```

Fill all `CHANGE_ME` values in `.env` before starting services.

### Deploy/update while SSHed into the VPS

Use the provided script on the VPS:

```sh
sh scripts/deploy-hostinger.sh
```

Default branch is `main`. To deploy another branch:

```sh
DEPLOY_BRANCH=develop sh scripts/deploy-hostinger.sh
```

When Prisma migrations exist, run them during deploy:

```sh
RUN_MIGRATIONS=1 sh scripts/deploy-hostinger.sh
```

### Deploy/update from your local machine through VPN

If the VPS is only reachable after connecting your VPN, use your local machine as a deployment bridge:

```sh
HOSTINGER_HOST=10.8.0.10 \
HOSTINGER_USER=root \
HOSTINGER_APP_DIR=/opt/blansole-backend \
sh scripts/deploy-remote-hostinger.sh
```

Optional SSH key:

```sh
HOSTINGER_HOST=10.8.0.10 \
HOSTINGER_USER=root \
HOSTINGER_SSH_KEY=/path/to/key \
HOSTINGER_APP_DIR=/opt/blansole-backend \
sh scripts/deploy-remote-hostinger.sh
```

Deploy another branch:

```sh
HOSTINGER_HOST=10.8.0.10 \
HOSTINGER_USER=root \
HOSTINGER_APP_DIR=/opt/blansole-backend \
DEPLOY_BRANCH=develop \
sh scripts/deploy-remote-hostinger.sh
```

Until migrations are created, local/dev can still use `db push` manually for testing:

```sh
DATABASE_URL=postgresql://USER:PASSWORD@localhost:5432/blansole npx prisma db push --skip-generate
```

Do not use `db push` as the long-term production migration strategy.

## GitHub CI/CD note

Current GitHub Actions CI validates lint/build/Python packaging/Compose config. Deployment is intentionally pull-based for now.

If you later want GitHub Actions to deploy automatically via SSH, add these GitHub secrets:

- `HOSTINGER_HOST`
- `HOSTINGER_USER`
- `HOSTINGER_SSH_KEY`
- `HOSTINGER_APP_DIR`
- `HOSTINGER_DEPLOY_BRANCH`

Then Actions can SSH into the VPS and run `sh scripts/deploy-hostinger.sh`.

## What we still need before real Hostinger production

- Prisma initial migration
- pgvector extension migration
- Real auth/JWT/RBAC
- HTTPS automation, preferably Caddy or Traefik
- Backups for Postgres and MinIO volumes
- Non-root Python worker user
- Health checks for API/workers
- Log rotation / monitoring
