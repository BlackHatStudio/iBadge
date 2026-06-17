# Data Model

SQL migrations live under `deployment/sql`. The current application uses dbo tables for the live kiosk and attendee workflows, with older or planned kiosk-schema migration material also present.

## Core Kiosk Tables

The app data access layer in `src/lib/ibadge-db.ts` expects these dbo tables:

- `dbo.Employee` - badge/cardholder reference data.
- `dbo.Event` - events/classes available for attendance.
- `dbo.Device` - registered kiosk devices.
- `dbo.DeviceAssignment` - current and historical event assignment per device.
- `dbo.BadgeScan` - persisted scan records.
- `dbo.SyncBatch` - scan batch receipt and status.
- `dbo.AdminConfig` - admin PIN hash and sync/duplicate settings.

Optional employee columns are detected at runtime:

- `Email`
- `CompanyNum`
- `Floor`

When `CompanyNum` is missing but `Floor` exists, the app can use `Floor` as the displayed company value.

## Attendee Tables

Migration `deployment/sql/007_attendee_lists_qr_checkin.sql` adds:

- `dbo.AttendeeList`
- `dbo.Attendee`
- `dbo.AttendeeQrToken`
- `dbo.AttendeeListUploadBatch`
- `dbo.AttendeeListAuditLog`
- `dbo.EventAttendeeList`
- `dbo.EventAttendanceSetting`
- `dbo.AttendanceCheckIn`

Important attendee rules:

- Active attendee email is unique per list.
- Active attendee badge number is unique per list when present.
- QR token hashes are unique.
- Only one non-revoked QR token is active per attendee.
- Event/list assignment is unique per event and attendee list.

## Scan and Check-In Semantics

- Badge scans are stored in `dbo.BadgeScan`.
- Attendee QR and email check-ins are stored in `dbo.AttendanceCheckIn`.
- Duplicate suppression protects against repeated check-ins inside the configured window.
- `DeviceScanGuid` should be treated as the scan idempotency key.
- Attendee QR plaintext token values must never be persisted.

## Migration Guidance

- Add new migrations as numbered files in `deployment/sql`.
- Keep migrations idempotent with `IF NOT EXISTS` checks where possible.
- Do not rewrite already-deployed migrations unless explicitly coordinating a reset.
- Update this document and `api.md` when schema changes affect route behavior.
