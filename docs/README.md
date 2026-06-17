# iBadge Documentation

This folder contains the working documentation for the iBadge attendance kiosk, admin console, SQL Server integration, and Windows deployment package.

## Documentation Map

- `architecture.md` - system overview, runtime boundaries, data flow, and module ownership.
- `development.md` - local setup, configuration, commands, and day-to-day development notes.
- `api.md` - frontend/backend HTTP contract used by the kiosk, admin, review, and attendee features.
- `data-model.md` - SQL Server table groups, ownership, migrations, and data rules.
- `deployment.md` - IIS, Windows Server, installer, service, runtime config, and packaging notes.
- `testing.md` - verification strategy and regression areas.
- `design.md` - preserved admin layout/design rules. Keep this file focused on visual conventions.
- `attendees-module.md` - attendee list, CSV upload, QR token, notification, and attendee check-in behavior.
- `attendance-kiosk-integration.md` - earlier kiosk/backend integration notes and endpoint expectations.
- `windows-server-2022-deployment-package-plan.md` - detailed Windows Server deployment package plan.
- `features/kiosk.md` - kiosk/PWA behavior.
- `features/admin-console.md` - admin console workflows.
- `features/review-and-exports.md` - review screen and export behavior.

## Source Ownership

- Next.js App Router lives in `src/app`.
- Page-level UI components live in `src/components`.
- Kiosk storage, types, utility, and API helpers live in `src/lib`.
- Attendee list persistence and workflows live in `src/lib/attendees`.
- SQL migrations live in `deployment/sql`.
- Windows/IIS deployment scripts live in `deployment/scripts`, templates in `deployment/config`, and installer definitions in `deployment/installer`.

## Documentation Rules

- Keep `design.md` intact as the admin visual style guide.
- Add new operational docs as separate Markdown files instead of mixing them into design guidance.
- Update `api.md`, `data-model.md`, and feature docs when route behavior, schema, or workflow behavior changes.
- Update `deployment.md` when installer, IIS, runtime config, SQL migration, service, or scheduled task behavior changes.
