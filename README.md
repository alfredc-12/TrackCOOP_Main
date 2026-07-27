# TrackCOOP

TrackCOOP is a Next.js and Express TypeScript cooperative-management system with public membership applications, Chairman and Bookkeeper portals, Member access, payments, Share Capital, finance, records, POS, inventory, rentals, and protected documents.

## Start

```bash
npm install
cp server/.env.example server/.env
npm run typecheck
npm run dev
```

PayMongo is disabled and uses Test Mode by default. Keep all PayMongo keys in the ignored `server/.env`; never use `NEXT_PUBLIC_*` for secrets.

## Final checks

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

## Guides

- [Setup](docs/setup.md)
- [API](docs/api.md)
- [Database and migrations](docs/database.md)
- [Membership workflow](docs/membership-workflow.md)
- [Payment architecture](docs/payment-architecture.md)
- [PayMongo sandbox workflow](docs/paymongo-sandbox.md)
- [Testing](docs/testing.md)
- [Operations and security](docs/operations.md)
- [Troubleshooting](docs/troubleshooting.md)

Never commit `.env`, credentials, raw tokens, PayMongo keys, webhook secrets, payment proofs, protected uploads, or production database dumps.
