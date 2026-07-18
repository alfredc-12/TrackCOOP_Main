# TrackCOOP Setup

## Requirements

- Node.js 20.9 or newer
- npm
- MySQL 8-compatible database access for backend database features

```bash
npm install
npm run typecheck
npm run dev
npm run build
```

`npm run dev` starts the Next.js web application on port 3000 and the Express
API on port 5000. Use `npm run dev:web` or `npm run dev:api` to start one process.

Copy `server/.env.example` to the ignored `server/.env` file before using live
database routes. Database import and reference seeding are manual operations;
see [`database.md`](database.md). Authentication and role portals are added in
the next implementation phase.
