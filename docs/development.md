# Development

## Prerequisites

- Node.js 20.9 or newer.
- npm 10 or newer.
- SQL Server access for database-backed API routes.
- `sqlcmd` available on PATH for the current database helper implementation.

## Install

```powershell
npm install
cd server
npm install
cd ..
```

## Run Locally

```powershell
npm run dev
```

The Next.js app defaults to `http://localhost:3000`.

The Express server can be started separately when needed:

```powershell
npm run server:dev
```

## Configuration

Frontend/runtime configuration is read from `src/lib/app-config.ts`.

- `NEXT_PUBLIC_IBADGE_API_BASE_URL` defaults to `/api`.
- `NEXT_PUBLIC_IBADGE_REFERENCE_REFRESH_HOURS` defaults to `12`.
- `NEXT_PUBLIC_IBADGE_QUEUE_RETRY_MINUTES` defaults to `2`.
- `NEXT_PUBLIC_IBADGE_DUPLICATE_WINDOW_SECONDS` defaults to `30`.

Browser runtime values may be provided through `window.__IBADGE_CONFIG__` in `public/runtime-config.js`.

SQL Server connection settings are resolved by `src/lib/ibadge-db.ts` from environment variables or `server/.env`:

- `IBADGE_SQLCMD_SERVER`, `DB_SERVER`, or `SQLSERVER_HOST`
- `IBADGE_SQLCMD_DATABASE`, `DB_NAME`, or `SQLSERVER_DATABASE`
- `IBADGE_SQLCMD_USERNAME`, `DB_USER`, or `SQLSERVER_USER`
- `IBADGE_SQLCMD_PASSWORD`, `DB_PASSWORD`, or `SQLSERVER_PASSWORD`

If no SQL username/password are present, integrated authentication is used.

## Common Commands

```powershell
npm run test
npm run build
npm run build:server
npm run build:all
```

## Development Notes

- Keep shared request helpers in `src/lib/api.ts`.
- Keep kiosk data types in `src/lib/kiosk-types.ts`.
- Keep browser storage behavior in `src/lib/storage.ts`.
- Keep attendee-specific logic in `src/lib/attendees`.
- Keep admin visual rules aligned with `docs/design.md`.
