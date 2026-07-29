# Setup

Requirements: Node.js 20.9+, npm, MySQL 8-compatible access, and Chromium for Playwright.

```bash
npm install
cp server/.env.example server/.env
```

Browser-safe root environment:

```text
NEXT_PUBLIC_APP_URL=http://localhost:3000
NEXT_PUBLIC_API_URL=http://localhost:5000
```

Private `server/.env` configuration keeps PayMongo disabled and in Test Mode unless explicitly enabled. Configure `PAYMONGO_ENABLED`, `PAYMONGO_MODE=test`, the test secret key, webhook secret, supported payment methods, and `PAYMONGO_SYSTEM_ACTOR_USER_ID` only in that file. Live mode and live keys are rejected outside production.

For a clean database, import `TrackCOOP_MAIN_Database.sql`, then run `npm run db:check`. For an existing database, take a backup and apply only outstanding files from `server/database/migrations/` in dependency order; do not re-run the clean main schema over live data.

Start with `npm run dev`. Use an HTTPS development tunnel to API port 5000 only when receiving sandbox webhooks. Register `/api/webhooks/paymongo` as documented in the sandbox guide.
