# iBadge Claude Guide

This repository is the iBadge attendance kiosk and admin console. Treat the existing documentation in `docs/` as the source of truth before changing code.

## Start Here

1. Read `docs/README.md` for the documentation map.
2. Read `docs/architecture.md` before changing app structure, API boundaries, storage, or deployment behavior.
3. Preserve `docs/design.md`; it defines the admin layout language and must not be replaced.
4. Read the feature doc that matches the work area:
   - Kiosk: `docs/features/kiosk.md`
   - Admin console: `docs/features/admin-console.md`
   - Attendee lists and QR check-in: `docs/attendees-module.md`
   - Review and exports: `docs/features/review-and-exports.md`
   - Deployment: `docs/deployment.md`

## Project Rules

- Keep kiosk operation resilient when offline. Badge scans must not be lost if the network or API is unavailable.
- Frontend API calls should go through `src/lib/api.ts` and `src/lib/app-config.ts`.
- Backend SQL Server access should remain isolated behind `src/lib/ibadge-db.ts` and the attendee repository/service modules.
- Do not hard-code production URLs, SQL credentials, or install paths. Use runtime config, `.env` templates, and deployment settings.
- Do not overwrite generated installer or deployment output unless the task is explicitly about release packaging.
- Keep `docs/design.md` focused on visual/admin layout rules. Put operational or architecture details in separate docs.

## Verification

Use the narrowest verification that proves the change:

- `npm run test` for unit tests.
- `npm run build` for app build checks.
- `npm run build:server` for Express server TypeScript checks.
- Deployment script changes should be reviewed against `docs/deployment.md` and `docs/windows-server-2022-deployment-package-plan.md`.

Record any new operational decisions in `docs/` when behavior, setup, database shape, or deployment steps change.
