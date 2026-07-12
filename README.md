# TrackCOOP Main

TrackCOOP is a cooperative management workspace for member services, announcements,
documents, dashboards, and future operational workflows for farmers and
fisherfolks cooperatives.

This repository is now a pnpm and Turborepo monorepo. It currently contains a
preserved Next.js web application, a new Expo React Native starter app, and
shared TypeScript packages. The backend is not implemented yet. The future
backend is expected to be a Node.js and Express API.

## Structure

```text
TrackCOOP_Main/
├── apps/
│   ├── web/       # Existing Next.js application
│   └── mobile/    # Expo Router React Native application
├── packages/
│   ├── shared-types/
│   ├── shared-utils/
│   └── validation/
├── package.json
├── pnpm-workspace.yaml
└── turbo.json
```

## Requirements

- Node.js 20.9 or newer
- pnpm
- Expo Go on a mobile device, or an Android emulator / iOS simulator

Install pnpm with Corepack:

```bash
corepack enable
corepack prepare pnpm@latest --activate
```

## Install

```bash
pnpm install
```

## Run

Run all development tasks through Turborepo:

```bash
pnpm dev
```

Run only the web application:

```bash
pnpm dev:web
```

Run only the Expo application:

```bash
pnpm dev:mobile
```

## Mobile Preview

After `pnpm dev:mobile`, Expo will show options for:

- Expo Go: scan the QR code from the terminal
- Android emulator: press `a`
- iOS simulator, where supported: press `i`
- Web preview: press `w` or run `pnpm --filter @trackcoop/mobile web`

## Validation

```bash
pnpm build
pnpm lint
pnpm typecheck
```

## Shared Packages

- `@trackcoop/shared-types` contains reusable TypeScript types such as users,
  roles, announcements, and services.
- `@trackcoop/shared-utils` contains small cross-platform helpers such as
  `formatFullName` and `formatRoleLabel`.
- `@trackcoop/validation` contains shared Zod schemas, including the starter
  login schema.

Only platform-neutral code belongs in shared packages. Web and mobile UI
components stay separate.

## Environment Files

Example-only environment files are provided:

- `apps/web/.env.example`
- `apps/mobile/.env.example`

They contain placeholder API URLs for the future backend and do not include
real secrets.
