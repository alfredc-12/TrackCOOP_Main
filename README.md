# TrackCOOP

TrackCOOP is a cooperative management system for NFFAC with a Next.js web
application and an Express TypeScript API. The current implementation includes
public landing pages, Chairman and Bookkeeper portals, authentication/RBAC,
membership workflows, payments/share capital/finance, POS/inventory/rentals,
documents, reports, announcements, requests, notifications, and landing content
administration.

## Quick Start

```bash
npm install
npm run typecheck
npm run dev
```

Open [http://localhost:3000](http://localhost:3000). The Express API defaults to
[http://localhost:5000](http://localhost:5000).

## Checks

```bash
npm run typecheck
npm run lint
npm run test:api
npm run test:e2e
npm run build
```

Run `npx playwright install chromium` once on a machine before
`npm run test:e2e`.

## Documentation

- [Setup](docs/setup.md)
- [API](docs/api.md)
- [Authentication and roles](docs/authentication.md)
- [Database](docs/database.md)
- [Operations, deployment, uploads, reporting, backups, and security](docs/operations.md)

## Safety Notes

Never commit `.env`, database credentials, raw session tokens, password reset
tokens, payment proofs, or protected uploads. Schema import and reference seeds
are manual operator actions; the app never migrates or seeds the database on
startup.
