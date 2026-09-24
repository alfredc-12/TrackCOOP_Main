# Deployment Readiness

TrackCOOP is provider-neutral:

```text
Next.js web
    -> Express API
    -> MySQL

Uploads
    -> StorageProvider
       -> local filesystem in development
       -> S3-compatible object storage in production
```

## Local Development

Use the normal local flow:

```bash
npm install
cp .env.example .env.local
cp server/.env.example server/.env
npm run dev
```

Local defaults:

```env
NEXT_PUBLIC_APP_URL=http://localhost:3000
NEXT_PUBLIC_API_URL=http://localhost:5000

API_PORT=5000
FRONTEND_URL=http://localhost:3000
CORS_ALLOWED_ORIGINS=http://localhost:3000
SESSION_COOKIE_DOMAIN=
SESSION_COOKIE_SAME_SITE=lax
SESSION_COOKIE_SECURE=false
TRUST_PROXY=false
STORAGE_DRIVER=local
LOCAL_STORAGE_ROOT=storage/uploads
```

Local public uploads are served from `/uploads/*`. Protected uploads are only returned through authorized Express routes.

## Same-Domain Deployment

If the frontend and API share one domain behind a reverse proxy, set:

```env
FRONTEND_URL=https://app.example.com
CORS_ALLOWED_ORIGINS=https://app.example.com
SESSION_COOKIE_DOMAIN=
SESSION_COOKIE_SAME_SITE=lax
SESSION_COOKIE_SECURE=true
TRUST_PROXY=true
```

## Sibling Subdomains

For deployments such as `https://app.example.com` and `https://api.example.com`:

```env
FRONTEND_URL=https://app.example.com
CORS_ALLOWED_ORIGINS=https://app.example.com
SESSION_COOKIE_DOMAIN=.example.com
SESSION_COOKIE_SAME_SITE=lax
SESSION_COOKIE_SECURE=true
TRUST_PROXY=true
```

Do not hardcode the parent domain in code. Configure it per deployment.

## Separate Frontend/API Hosts

If the browser-facing frontend and API are on unrelated provider domains, cookie behavior may depend on browser third-party-cookie rules. Prefer a same-origin reverse proxy/BFF for browser API calls, or move both services onto a shared parent domain. Keep `NEXT_PUBLIC_API_URL`, `FRONTEND_URL`, `CORS_ALLOWED_ORIGINS`, and cookie settings environment-driven.

## Storage

Development:

```env
STORAGE_DRIVER=local
LOCAL_STORAGE_ROOT=storage/uploads
```

Production with S3-compatible storage:

```env
STORAGE_DRIVER=s3
S3_ENDPOINT=https://object-storage.example.com
S3_REGION=auto
S3_BUCKET=trackcoop-uploads
S3_ACCESS_KEY_ID=
S3_SECRET_ACCESS_KEY=
S3_FORCE_PATH_STYLE=false
S3_PUBLIC_BASE_URL=
```

`S3_PUBLIC_BASE_URL` is optional. If set, public uploaded media can use that base URL. Protected files must still go through authorized Express routes or signed URLs after authorization.

## Ports

Local development uses `API_PORT=5000`. Hosted Node platforms often inject `PORT`; the API uses `PORT` when present and falls back to `API_PORT`.

## PayMongo

PayMongo webhook URLs should point to the deployed public HTTPS API:

```text
https://api.example.com/api/webhooks/paymongo
```

For local webhook testing, use an HTTPS tunnel to the local Express API. PayMongo does not need a dedicated domain.
