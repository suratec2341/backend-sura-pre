# Environment variables

This project uses a local `.env` file for development. The file is intentionally ignored by Git.

## Quick start

A local `.env` has been created with safe development defaults and blank placeholders for external keys.

After editing `.env`, restart Docker services:

```sh
docker compose -f infra/docker-compose.yml up -d --build
```

## Keys you need to collect

### Required for current local Docker smoke tests

None. Local Docker can run with the development defaults already in `.env`:

- Postgres: local container credentials
- Redis: local container
- MinIO: local container credentials

### Needed when implementing Auth

| Variable | Where to get it | Notes |
| --- | --- | --- |
| `JWT_ACCESS_SECRET` | Generate yourself | Use a strong random value, e.g. `openssl rand -base64 48`. |
| `JWT_REFRESH_SECRET` | Generate yourself | Must be different from access secret. |
| `GOOGLE_CLIENT_ID` | Google Cloud Console | OAuth client for mobile/web. |
| `GOOGLE_CLIENT_SECRET` | Google Cloud Console | Required for backend OAuth code exchange if using web/server flow. |
| `FACEBOOK_APP_ID` | Meta for Developers | App ID for Facebook login. |
| `FACEBOOK_APP_SECRET` | Meta for Developers | App secret for token validation/code exchange. |
| `APPLE_CLIENT_ID` | Apple Developer | Optional unless adding Sign in with Apple. |
| `APPLE_TEAM_ID` | Apple Developer | Optional. |
| `APPLE_KEY_ID` | Apple Developer | Optional. |
| `APPLE_PRIVATE_KEY` | Apple Developer | Optional. Store with escaped newlines if kept in `.env`. |

### Needed when implementing AI / RAG

| Variable | Where to get it | Notes |
| --- | --- | --- |
| `LLM_PROVIDER` | Internal decision | Default: `openai`. |
| `LLM_API_KEY` | LLM provider dashboard | Current Python worker reads this. |
| `OPENAI_API_KEY` | OpenAI dashboard | Set to the same value as `LLM_API_KEY` if using OpenAI SDK defaults. |
| `LLM_MODEL` | LLM provider model name | Default in `.env`: `gpt-4o-mini`. |
| `EMBEDDING_MODEL` | LLM provider model name | Default in `.env`: `text-embedding-3-small`. |

### Needed when implementing content library / link checker

| Variable | Where to get it | Notes |
| --- | --- | --- |
| `YOUTUBE_API_KEY` | Google Cloud Console | Optional for YouTube Data API. YouTube oEmbed does not normally need a key. |
| `YOUTUBE_CHANNEL_ID` | YouTube Studio/channel URL | Useful if recommendations must only use your own channel. |

### Needed when implementing push notifications

| Variable | Where to get it | Notes |
| --- | --- | --- |
| `FCM_PROJECT_ID` | Firebase Console | For Android/FCM push. |
| `FCM_CLIENT_EMAIL` | Firebase service account JSON | Service account email. |
| `FCM_PRIVATE_KEY` | Firebase service account JSON | Keep escaped newlines: `-----BEGIN...-----\n...\n-----END...-----\n`. |
| `APNS_TEAM_ID` | Apple Developer | For iOS APNs. |
| `APNS_KEY_ID` | Apple Developer | APNs auth key ID. |
| `APNS_BUNDLE_ID` | Apple Developer | iOS app bundle ID. |
| `APNS_PRIVATE_KEY` | Apple Developer | APNs `.p8` key content. |
| `APNS_ENV` | Internal decision | `sandbox` for dev, `production` for prod. |

### Needed before Hostinger staging/production

The first deployment target is Hostinger, not AWS. Use a Hostinger VPS/KVM plan that supports Docker. Hostinger shared hosting is not enough for this backend because it needs long-running Node/Python workers, Postgres, Redis, and MinIO.

| Variable | Where to get it | Notes |
| --- | --- | --- |
| `APP_BASE_URL` | Your domain | Example: `https://api.yourdomain.com`. |
| `API_PUBLIC_URL` | Your domain | Example: `https://api.yourdomain.com/api/v1`. |
| `PUBLIC_API_HOST` | DNS/Hostinger panel | Example: `api.yourdomain.com`. |
| `SSL_EMAIL` | Your email | Used later if we automate Let's Encrypt. |
| `DATABASE_URL` | Hostinger VPS compose env | If containers run together, this stays container-network URL. |
| `DOCKER_DATABASE_URL` | Hostinger VPS compose env | Example: `postgresql://USER:PASSWORD@postgres:5432/DB`. |
| `REDIS_URL` | Hostinger VPS compose env | Example: `redis://redis:6379`. |
| `DOCKER_REDIS_URL` | Hostinger VPS compose env | Example: `redis://redis:6379`. |
| `S3_ENDPOINT` | Self-host MinIO endpoint | Example: `https://minio.yourdomain.com` or internal MinIO endpoint. |
| `S3_REGION` | MinIO/S3-compatible setting | Can remain `us-east-1` for MinIO. |
| `S3_BUCKET` | MinIO bucket | Bucket for pressure maps/routes/files. |
| `S3_ACCESS_KEY` | MinIO user/access key | Do not commit real values. |
| `S3_SECRET_KEY` | MinIO secret key | Do not commit real values. |
| `S3_FORCE_PATH_STYLE` | Storage provider | Keep `true` for MinIO. |
| `MINIO_ROOT_USER` | Generate yourself | Change from local default before Hostinger. |
| `MINIO_ROOT_PASSWORD` | Generate yourself | Strong secret; change from local default. |
| `ADMIN_EMAIL` | Internal | Initial admin bootstrap account. |
| `ADMIN_INITIAL_PASSWORD` | Internal | Use only for first bootstrap, then rotate/remove. |

## Local development defaults

The `.env` file includes local defaults for:

- `API_PORT=3000`
- `NGINX_HTTP_PORT=8081`
- `POSTGRES_HOST_PORT=5432`
- `REDIS_HOST_PORT=6379`
- `MINIO_API_PORT=9000`
- `MINIO_CONSOLE_PORT=9001`

If a port is already used on your machine, change it in `.env` and restart Docker.

## Security notes

- Never commit `.env`.
- Replace all `CHANGE_ME` values before staging/production.
- Use different JWT access/refresh secrets.
- Use separate OAuth apps for dev/staging/prod.
- Keep Firebase/APNs private keys out of source control.
