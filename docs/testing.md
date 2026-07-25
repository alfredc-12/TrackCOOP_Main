# Testing

Run checks from the repository root.

```bash
npm run typecheck
npm run lint
npm run test:api
npm run test:e2e
npm run build
npm run db:check
```

`npm run test:api` uses Node's test runner with injected database doubles. It
covers the health endpoints, auth/session behavior, RBAC denial, membership
application submission/tracking/uploads/review/approval, activation-link
behavior, member directory status changes, share-capital limits, and advisory
indicator recalculation.

`npm run test:e2e` uses Playwright. Install Chromium once on each machine with:

```bash
npx playwright install chromium
```

The Playwright suite covers public membership application/status pages,
Chairman membership review flows, user-account lifecycle screens, member
directory and indicator views, and role-based redirect/denial behavior.

`npm run db:check` is read-only. It checks connectivity and the 40 required
tables through `information_schema`; it does not run migrations or seed data.

Known baseline: `npm run lint` currently reports pre-existing warnings/errors
outside this membership workflow. Treat new lint findings in touched files as
defects to fix before committing.
