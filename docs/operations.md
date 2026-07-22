# Operations Guide

## Deployment

TrackCOOP has two runtime processes:

- Next.js web app: `npm run build:web`, then `npm run start:web`
- Express API: `npm run build:api`, then `npm run start:api`

Set the public web environment with `NEXT_PUBLIC_APP_URL` and
`NEXT_PUBLIC_API_URL`. Set private API values in `server/.env`, including
database credentials, `FRONTEND_URL`, `SESSION_COOKIE_NAME`, upload directory,
and production cookie/security settings. Keep `DB_SSL=true` for RDS-style
production databases.

Before deployment, run:

```bash
npm run typecheck
npm run lint
npm run test:api
npm run test:e2e
npm run build
npm run db:check
```

## Uploads

Protected uploads are stored outside `public/`, defaulting to `storage/uploads`.
Do not expose that directory through static hosting. Store document/report
metadata in the database and authorize every download or access-log event before
returning a file. Never log upload contents, payment proof images, or private
member documents.

## Reporting

Reports are metadata-backed records tied to generated files or exported data.
Staff report endpoints must filter by explicit date/type/status allowlists and
avoid exposing passwords, raw session tokens, full payment proof contents, or
private notes beyond the intended role. CSV/PDF exports should be generated from
server-calculated values, not browser-submitted totals.

## Backups

Back up the MySQL database and protected upload directory together so document
metadata and files remain consistent. Keep backups encrypted and outside the
repository. Test restores in a staging database, then verify:

- `npm run db:check`
- login and RBAC
- member records and status history
- payment/share-capital/ledger summaries
- POS/inventory/rental records
- documents, reports, announcements, requests, notifications
- published landing content and gallery media

## Security

- Use parameterized SQL and Zod validation for request bodies.
- Enforce `createAuthenticate` and `requireRoles(...)` on protected Express
  endpoints.
- Treat the Next.js proxy as a user-experience redirect only, not an
  authorization layer.
- Never commit `.env`, credentials, raw session tokens, reset tokens, payment
  proofs, protected uploads, or production database dumps.
- Keep CORS restricted to `FRONTEND_URL`; browser mutations must include the
  configured Origin and credentials.
- Rotate credentials after any suspected exposure and revoke active sessions
  through the session APIs when needed.
