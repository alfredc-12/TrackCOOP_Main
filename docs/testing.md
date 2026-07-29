# Testing

Run from the repository root:

```bash
npm run typecheck:api
npm run build:api
npm run typecheck:web
npm run lint
npm run test:api
npm run test:paymongo-core
npm run test:e2e
npm run build
npm run db:check
npm run security:scan
git diff --check
```

`test:paymongo-core` covers PayMongo, payment references, membership applications/approval, Share Capital, finance/receipts, Bookkeeper controls, and public/Member payment UI safety. Database-backed checks require an explicit test database; they do not require or target production.

Report missing tools, unavailable services, and pre-existing failures separately. Do not claim a command passed unless it completed successfully.
