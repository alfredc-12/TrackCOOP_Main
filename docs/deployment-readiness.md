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

## Environment Ownership

Frontend / Next.js variables:

| Variable | Browser visible | Purpose |
| --- | --- | --- |
| `NEXT_PUBLIC_APP_URL` | Yes | Public URL of the Next.js frontend. |
| `NEXT_PUBLIC_API_URL` | Yes | Public URL of the Express API used by browser fetches and public assets. |
| `SESSION_COOKIE_NAME` | No | Optional server-side Next value used by proxy/server helpers only when the API cookie name is customized. Must match the API value. |

API / Express variables:

| Variable | Required locally | Required in production | Secret | Purpose |
| --- | --- | --- | --- | --- |
| `NODE_ENV` | No | Yes | No | Runtime mode: `development`, `test`, or `production`. |
| `PORT` | No | Host-dependent | No | Hosted platform port override. |
| `API_PORT` | No | Host-dependent | No | Local/default API port fallback. |
| `FRONTEND_URL` | No | Yes | No | Canonical frontend URL used for CORS, links, and redirects. |
| `CORS_ALLOWED_ORIGINS` | No | Yes | No | Comma-separated browser origins allowed to call the API. |
| `REQUEST_BODY_LIMIT` | No | No | No | Express JSON/form body size limit. |
| `TRUST_PROXY` | No | Yes behind proxy | No | Enables trusted proxy behavior for cookies/IPs/rate limits. |
| `SESSION_COOKIE_NAME` | No | No | No | Session cookie name. |
| `SESSION_COOKIE_DOMAIN` | No | Deployment-dependent | No | Shared cookie domain, such as `.example.com`; leave empty for localhost/same host. |
| `SESSION_COOKIE_SAME_SITE` | No | Yes | No | `lax`, `strict`, or `none`. |
| `SESSION_COOKIE_SECURE` | No | Yes | No | Must be `true` for HTTPS production and for `SameSite=None`. |
| `SESSION_TTL_HOURS` | No | No | No | Session lifetime. |
| `AUTH_MAX_FAILED_ATTEMPTS` | No | No | No | Account lockout failed-login threshold. |
| `AUTH_LOCKOUT_MINUTES` | No | No | No | Account lockout duration. |
| `AUTH_LOGIN_RATE_LIMIT` | No | No | No | Login attempts allowed per IP per window. |
| `AUTH_LOGIN_RATE_WINDOW_MINUTES` | No | No | No | Login rate-limit window length. |
| `BCRYPT_ROUNDS` | No | No | No | Password hashing cost. |
| `DB_HOST` | Yes | Yes | No | MySQL host. |
| `DB_PORT` | No | No | No | MySQL port. |
| `DB_NAME` | Yes | Yes | No | MySQL database name. |
| `DB_USER` | Yes | Yes | Sensitive | MySQL user. |
| `DB_PASSWORD` | Local may be empty | Yes | Yes | MySQL password. |
| `DB_SSL` | No | External DB dependent | No | Enables TLS for MySQL. |
| `DB_SSL_CA_PATH` | No | External DB dependent | Sensitive | CA certificate path when required. |
| `DB_CONNECTION_LIMIT` | No | No | No | MySQL pool size. |
| `STORAGE_DRIVER` | No | Yes | No | `local` or `s3`. |
| `LOCAL_STORAGE_ROOT` | No | Local/VPS only | No | Local upload root. |
| `S3_ENDPOINT` | No | S3 driver dependent | No | S3-compatible endpoint. |
| `S3_REGION` | No | Yes when `STORAGE_DRIVER=s3` | No | S3-compatible region. |
| `S3_BUCKET` | No | Yes when `STORAGE_DRIVER=s3` | No | Upload bucket name. |
| `S3_ACCESS_KEY_ID` | No | S3 driver dependent | Yes | S3-compatible access key. |
| `S3_SECRET_ACCESS_KEY` | No | S3 driver dependent | Yes | S3-compatible secret key. |
| `S3_FORCE_PATH_STYLE` | No | Provider-dependent | No | Enables path-style bucket URLs. |
| `S3_PUBLIC_BASE_URL` | No | No | No | Optional public CDN/base URL. |
| `PAYMONGO_ENABLED` | No | Payment-dependent | No | Enables PayMongo checkout/webhook flows. |
| `PAYMONGO_MODE` | No | Payment-dependent | No | Selects active PayMongo config: `test` or `live`. |
| `PAYMONGO_ALLOW_LIVE_LOCAL` | No | No | No | Required as `true` before live mode can run outside production. Leave `false` in production. |
| `PAYMONGO_API_BASE_URL` | No | No | No | PayMongo API base URL. |
| `PAYMONGO_TEST_SECRET_KEY` | No | Test mode only | Yes | PayMongo test secret key. |
| `PAYMONGO_TEST_WEBHOOK_SECRET` | No | Test mode only | Yes | PayMongo test webhook signing secret. |
| `PAYMONGO_TEST_PAYMENT_METHOD_TYPES` | No | Test mode only | No | Usually `card`. |
| `PAYMONGO_LIVE_SECRET_KEY` | No | Live mode only | Yes | PayMongo live secret key. |
| `PAYMONGO_LIVE_WEBHOOK_SECRET` | No | Live mode only | Yes | PayMongo live webhook signing secret. |
| `PAYMONGO_LIVE_PAYMENT_METHOD_TYPES` | No | Live mode only | No | Usually `qrph`. |
| `PAYMONGO_SECRET_KEY` | No | No | Yes | Legacy fallback only when the mode-specific active key is not set. |
| `PAYMONGO_WEBHOOK_SECRET` | No | No | Yes | Legacy fallback only when the mode-specific active webhook secret is not set. |
| `PAYMONGO_SYSTEM_ACTOR_USER_ID` | No | Yes when PayMongo enabled | Sensitive | Internal service user ID for automated settlement. |
| `PAYMONGO_WEBHOOK_TOLERANCE_SECONDS` | No | No | No | Webhook timestamp tolerance. |
| `PAYMONGO_CHECKOUT_REUSE_MINUTES` | No | No | No | Active checkout reuse window. |
| `PAYMONGO_PAYMENT_METHOD_TYPES` | No | No | No | Legacy fallback payment methods when the mode-specific active methods are not set. |
| `PAYMONGO_PASS_ON_FEES` | No | No | No | PayMongo fee handling flag. |
| `PAYMENT_SUCCESS_URL` | No | Yes when PayMongo enabled | No | Browser return URL after payment. |
| `PAYMENT_CANCEL_URL` | No | Yes when PayMongo enabled | No | Browser return URL after cancellation. |
| `RENTAL_STATUS_EMAIL_WEBHOOK_URL` | No | Optional | Sensitive | Optional rental email automation webhook. |
| `RENTAL_STATUS_EMAIL_WEBHOOK_TOKEN` | No | Optional | Yes | Optional bearer token for the rental email webhook. |

Deployment matrix:

| Variable | Frontend host | API host |
| --- | --- | --- |
| `NEXT_PUBLIC_APP_URL` | Yes | No |
| `NEXT_PUBLIC_API_URL` | Yes | No |
| `SESSION_COOKIE_NAME` | Server-side only if customized | Yes |
| `SESSION_COOKIE_DOMAIN` | No | Yes |
| `SESSION_COOKIE_SAME_SITE` | No | Yes |
| `SESSION_COOKIE_SECURE` | No | Yes |
| `DB_HOST` | No | Yes |
| `DB_USER` | No | Yes |
| `DB_PASSWORD` | No | Yes |
| `PAYMONGO_TEST_SECRET_KEY` | No | API only, if test mode is used |
| `PAYMONGO_TEST_WEBHOOK_SECRET` | No | API only, if test mode is used |
| `PAYMONGO_LIVE_SECRET_KEY` | No | API only, if live mode is used |
| `PAYMONGO_LIVE_WEBHOOK_SECRET` | No | API only, if live mode is used |
| `PAYMONGO_SECRET_KEY` | No | API only, legacy fallback |
| `PAYMONGO_WEBHOOK_SECRET` | No | API only, legacy fallback |
| `S3_ACCESS_KEY_ID` | No | Yes |
| `S3_SECRET_ACCESS_KEY` | No | Yes |
| `RENTAL_STATUS_EMAIL_WEBHOOK_TOKEN` | No | Yes |

Only `NEXT_PUBLIC_*` values are browser-visible. Never put database, PayMongo,
S3, session, or webhook secrets in a `NEXT_PUBLIC_*` variable.

## PayMongo Mode Setup

PayMongo is owned by the Express API. Keep all PayMongo secret keys and webhook
secrets on the API host only, such as Railway or local `server/.env`. Do not add
PayMongo secret keys to Vercel or any `NEXT_PUBLIC_*` value.

TrackCOOP resolves one active PayMongo config from `PAYMONGO_MODE`:

- `PAYMONGO_MODE=test` uses `PAYMONGO_TEST_SECRET_KEY`,
  `PAYMONGO_TEST_WEBHOOK_SECRET`, and `PAYMONGO_TEST_PAYMENT_METHOD_TYPES`.
- `PAYMONGO_MODE=live` uses `PAYMONGO_LIVE_SECRET_KEY`,
  `PAYMONGO_LIVE_WEBHOOK_SECRET`, and `PAYMONGO_LIVE_PAYMENT_METHOD_TYPES`.

The older `PAYMONGO_SECRET_KEY`, `PAYMONGO_WEBHOOK_SECRET`, and
`PAYMONGO_PAYMENT_METHOD_TYPES` variables are supported only as fallback values
when the active mode-specific variables are empty. New deployments should use
the mode-specific variables.

TEST MODE uses simulated/test money. LIVE MODE uses real money.

Recommended local structure:

```env
NODE_ENV=development
PAYMONGO_ENABLED=true
PAYMONGO_MODE=test
PAYMONGO_ALLOW_LIVE_LOCAL=false

PAYMONGO_TEST_SECRET_KEY=sk_test_REPLACE_ME
PAYMONGO_TEST_WEBHOOK_SECRET=REPLACE_TEST_WEBHOOK_SECRET
PAYMONGO_TEST_PAYMENT_METHOD_TYPES=card

PAYMONGO_LIVE_SECRET_KEY=sk_live_REPLACE_ME
PAYMONGO_LIVE_WEBHOOK_SECRET=REPLACE_LIVE_WEBHOOK_SECRET
PAYMONGO_LIVE_PAYMENT_METHOD_TYPES=qrph

PAYMONGO_SYSTEM_ACTOR_USER_ID=1
PAYMONGO_API_BASE_URL=https://api.paymongo.com
PAYMONGO_WEBHOOK_TOLERANCE_SECONDS=300
PAYMONGO_CHECKOUT_REUSE_MINUTES=30
PAYMONGO_PASS_ON_FEES=false
PAYMENT_SUCCESS_URL=http://localhost:3000/payment/success
PAYMENT_CANCEL_URL=http://localhost:3000/payment/cancelled
```

Normal local card testing should keep:

```env
PAYMONGO_MODE=test
PAYMONGO_ALLOW_LIVE_LOCAL=false
```

Controlled local live QR Ph testing must deliberately use both:

```env
PAYMONGO_MODE=live
PAYMONGO_ALLOW_LIVE_LOCAL=true
```

Production live QR Ph on Railway does not require the local override:

```env
NODE_ENV=production
PAYMONGO_ENABLED=true
PAYMONGO_MODE=live
PAYMONGO_ALLOW_LIVE_LOCAL=false

PAYMONGO_TEST_SECRET_KEY=
PAYMONGO_TEST_WEBHOOK_SECRET=
PAYMONGO_TEST_PAYMENT_METHOD_TYPES=card

PAYMONGO_LIVE_SECRET_KEY=sk_live_REPLACE_ME
PAYMONGO_LIVE_WEBHOOK_SECRET=REPLACE_LIVE_WEBHOOK_SECRET
PAYMONGO_LIVE_PAYMENT_METHOD_TYPES=qrph

PAYMONGO_SYSTEM_ACTOR_USER_ID=1
PAYMENT_SUCCESS_URL=https://nffac.trackcoop.online/payment/success
PAYMENT_CANCEL_URL=https://nffac.trackcoop.online/payment/cancelled
```

Configure the live PayMongo webhook URL to:

```text
https://api.nffac.trackcoop.online/api/webhooks/paymongo
```

Use the webhook secret generated by that live PayMongo webhook configuration.
Do not reuse the test webhook secret for live mode. The success page only polls
TrackCOOP status; the signed PayMongo webhook remains the source of truth for
marking payments as confirmed.

For local testing, success and cancel URLs may remain localhost because the
browser performing the test can reach `http://localhost:3000`. PayMongo webhook
delivery is different: PayMongo's server cannot normally reach
`http://localhost:5000`. To receive real webhook callbacks locally, use a
temporary public HTTPS address that forwards to:

```text
http://localhost:5000/api/webhooks/paymongo
```

Configure that public HTTPS webhook URL in the matching PayMongo test or live
webhook settings. TrackCOOP does not hardcode or configure a tunnel provider.

## External MySQL

TrackCOOP uses standard MySQL connection settings only:

```env
DB_HOST=
DB_PORT=3306
DB_NAME=
DB_USER=
DB_PASSWORD=
DB_SSL=true
DB_SSL_CA_PATH=
DB_CONNECTION_LIMIT=10
```

This stays compatible with Amazon RDS MySQL, Railway MySQL, Hostinger MySQL,
local MySQL, VPS-hosted MySQL, and other compatible external MySQL servers. No
AWS SDK or provider-specific database dependency is required.

## Login Rate Limiting

Login attempts are limited per IP with production-safe defaults:

```env
AUTH_LOGIN_RATE_LIMIT=10
AUTH_LOGIN_RATE_WINDOW_MINUTES=15
```

That means a maximum of 10 login attempts per IP per 15-minute window. When the
limit is exceeded, `/api/auth/login` returns HTTP `429` with standard
rate-limit headers and the safe `LOGIN_RATE_LIMITED` error code. This limiter
applies only to login attempts. Authenticated application traffic and normal API
routes remain under the separate global API limiter.

Keep account lockout enabled as well:

```env
AUTH_MAX_FAILED_ATTEMPTS=5
AUTH_LOCKOUT_MINUTES=15
```

The IP limiter slows repeated attempts from one source. Account lockout protects
individual accounts after repeated failed credentials.

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

Public upload URLs stay stable across storage drivers:

```text
/uploads/<key>
```

Development flow:

```text
Browser
  -> Express /uploads/<key>
  -> LocalStorageProvider
  -> storage/uploads/public/<key>
```

Production flow:

```text
Browser
  -> Express /uploads/<key>
  -> S3StorageProvider
  -> public/<key> in the configured S3-compatible bucket
```

This means public URLs such as `/uploads/announcements/example.jpg`,
`/uploads/gallery/example.jpg`, `/uploads/rentals/example.jpg`,
`/uploads/inventory/example.jpg`, and
`/uploads/partners-certifications/example.jpg` do not need to change when moving
from local storage to S3-compatible storage.

The public `/uploads/*` route only reads public storage objects. Protected files
such as membership documents, rental valid IDs, payment proofs, restricted
records, private receipts, and member files must continue to use their
authorized Express API routes.

## Ports

Local development uses `API_PORT=5000`. Hosted Node platforms often inject `PORT`; the API uses `PORT` when present and falls back to `API_PORT`.

## PayMongo

PayMongo webhook URLs should point to the deployed public HTTPS API:

```text
https://api.example.com/api/webhooks/paymongo
```

For local webhook testing, use an HTTPS tunnel to the local Express API. PayMongo does not need a dedicated domain.
