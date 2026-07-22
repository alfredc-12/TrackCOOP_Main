# TrackCOOP Setup

## Requirements

- Node.js 20.9 or newer
- npm
- MySQL 8-compatible database access for backend database features

```bash
npm install
npm run typecheck
npm run lint
npm run test:api
npx playwright install chromium
npm run test:e2e
npm run dev
npm run build
```

`npm run dev` starts the Next.js web application on port 3000 and the Express
API on port 5000. Use `npm run dev:web` or `npm run dev:api` to start one process.

Copy `server/.env.example` to the ignored `server/.env` file before using live
database routes. Database import and reference seeding are manual operations;
see [`database.md`](database.md).

After importing the schema and reference seed, create the first portal accounts
from an interactive terminal. The password is prompted without terminal echo
and is never accepted as a command-line argument:

```bash
npm run user:create -- --email chair@example.com --name "Chair Person" --role chairman
npm run user:create -- --email books@example.com --name "Book Keeper" --role bookkeeper
```

The root `SESSION_COOKIE_NAME` and `server/.env` value must match if the default
cookie name is changed. See [`authentication.md`](authentication.md) for the
session and lockout model.

## Environment Files

The Next.js app reads public browser configuration from the root `.env` file.
Keep values public-safe:

```bash
NEXT_PUBLIC_APP_URL=http://localhost:3000
NEXT_PUBLIC_API_URL=http://localhost:5000
```

The Express API reads private configuration from `server/.env`. Start from
`server/.env.example` and never commit real database credentials, upload paths,
or production cookie settings.

## Local Verification Order

Use this order before committing a phase:

```bash
npm run typecheck
npm run lint
npm run test:api
npm run test:e2e
npm run build
```

`npm run test:e2e` starts the Next.js web app with Playwright. It currently
covers public landing access and protected Chairman/Bookkeeper route redirects.
