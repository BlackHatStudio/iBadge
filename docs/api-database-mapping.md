# API to Database Table Mapping

This document maps the app's local Next.js API endpoints to the SQL Server tables they read or write.

> Most API routes in `src/app/api/**` may forward to an upstream backend when configured. The table mappings below apply to the local SQL Server data access paths.

## Kiosk sync and device endpoints

| Endpoint | Method | Primary DB tables | Notes |
|---|---|---|---|
| `/api/employees` | POST | `dbo.Employee` | Inserts or updates employee badge/cardholder data. |
| `/api/devices/register` | POST | `dbo.Device`, `dbo.DeviceAssignment` | Ensures device exists and assigns it to an event if needed. |
| `/api/devices/current` | GET | `dbo.Device`, `dbo.DeviceAssignment` | Reads current device record and assignment status. |
| `/api/devices/current` | PUT | `dbo.Device`, `dbo.DeviceAssignment` | Updates device metadata; may create device row if missing. |
| `/api/devices/current/event` | PUT | `dbo.DeviceAssignment`, `dbo.Device` | Updates the device's active event assignment. |
| `/api/sync/refresh` | POST | `dbo.Employee`, `dbo.Event`, `dbo.Device` | Refresh payload for kiosk sync; updates device last-seen timestamps. |
| `/api/sync/retry` | POST | `dbo.BadgeScan` | Marks pending/failed scans as synced for retry. |
| `/api/scans` | POST | `dbo.BadgeScan`, `dbo.Employee`, `dbo.Event`, `dbo.Device` | Inserts a scan record, resolves employee/event/device references, and suppresses duplicates. |
| `/api/scans/sync-batch` | POST | `dbo.SyncBatch`, `dbo.BadgeScan`, `dbo.Device` | Creates a sync batch and inserts multiple scan records. |
| `/api/scans/review` | GET | `dbo.BadgeScan`, `dbo.Employee`, `dbo.Event`, `dbo.Device`, `dbo.DeviceAssignment` | Reads reviewed scan records with related device, event, and employee metadata. |
| `/api/reports/export/[format]` | GET | `dbo.BadgeScan`, `dbo.Employee`, `dbo.Event`, `dbo.Device` | Exports review scan data to CSV/Excel/PDF. |

## Event management

| Endpoint | Method | Primary DB tables | Notes |
|---|---|---|---|
| `/api/events` | GET | `dbo.Event` | Lists events. |
| `/api/events` | POST | `dbo.Event` | Creates an event. |
| `/api/events` | PUT | `dbo.Event` | Updates an event. |
| `/api/events/[eventId]/attendee-lists` | GET | `dbo.EventAttendeeList`, `dbo.AttendeeList` | Reads lists assigned to an event. |
| `/api/events/[eventId]/attendee-lists` | POST | `dbo.EventAttendeeList` | Replaces attendee-list assignments for an event. |
| `/api/events/[eventId]/attendance-settings` | GET | `dbo.EventAttendanceSetting` | Reads event attendance mode/config. |
| `/api/events/[eventId]/attendance-settings` | PATCH | `dbo.EventAttendanceSetting` | Inserts or updates event attendance settings. |

## Attendee lists and attendee management

| Endpoint | Method | Primary DB tables | Notes |
|---|---|---|---|
| `/api/attendee-lists` | GET | `dbo.AttendeeList`, `dbo.Attendee`, `dbo.AttendeeListUploadBatch` | Lists attendee lists and counts. |
| `/api/attendee-lists` | POST | `dbo.AttendeeList`, `dbo.AttendeeListAuditLog` | Creates a new attendee list and audit log entry. |
| `/api/attendee-lists/[attendeeListId]` | GET | `dbo.AttendeeList`, `dbo.Attendee`, `dbo.AttendeeListUploadBatch` | Reads one attendee list and summary info. |
| `/api/attendee-lists/[attendeeListId]` | PATCH | `dbo.AttendeeList`, `dbo.AttendeeListAuditLog` | Updates list metadata. |
| `/api/attendee-lists/[attendeeListId]/attendees` | GET | `dbo.Attendee`, `dbo.AttendeeQrToken`, `dbo.AttendeeList` | Lists attendees with latest token state. |
| `/api/attendee-lists/[attendeeListId]/attendees` | POST | `dbo.Attendee`, `dbo.AttendeeListAuditLog` | Creates an attendee record. |
| `/api/attendee-lists/[attendeeListId]/upload` | POST | `dbo.AttendeeListUploadBatch`, `dbo.Attendee`, `dbo.AttendeeListAuditLog` | Uploads CSV attendee data and records import batches. |
| `/api/attendee-lists/[attendeeListId]/activate` | POST | `dbo.AttendeeList`, `dbo.AttendeeListAuditLog` | Activates a list. |
| `/api/attendee-lists/[attendeeListId]/deactivate` | POST | `dbo.AttendeeList`, `dbo.AttendeeListAuditLog` | Deactivates a list. |
| `/api/attendee-lists/[attendeeListId]/send-qr` | POST | `dbo.AttendeeList`, `dbo.Attendee`, `dbo.AttendeeQrToken`, `dbo.AttendeeListAuditLog` | Sends QR codes for list attendees and updates token send state. |
| `/api/attendee-lists/template.csv` | GET | none | Generates a client-side CSV template; does not access DB. |

## Individual attendee actions

| Endpoint | Method | Primary DB tables | Notes |
|---|---|---|---|
| `/api/attendees/[attendeeId]` | PATCH | `dbo.Attendee`, `dbo.AttendeeListAuditLog` | Updates attendee fields. |
| `/api/attendees/[attendeeId]` | DELETE | `dbo.Attendee`, `dbo.AttendeeQrToken`, `dbo.AttendeeListAuditLog` | Soft-deletes an attendee and revokes active QR tokens. |
| `/api/attendees/[attendeeId]/send-qr` | POST | `dbo.AttendeeQrToken`, `dbo.AttendeeListAuditLog` | Generates/regenerates a QR token and records send status. |
| `/api/attendees/[attendeeId]/resend-qr` | POST | `dbo.AttendeeQrToken`, `dbo.AttendeeListAuditLog` | Alias of send-QR behavior; reuses the same token/send flow. |
| `/api/attendees/[attendeeId]/regenerate-qr` | POST | `dbo.AttendeeQrToken`, `dbo.AttendeeListAuditLog` | Revokes existing QR token and inserts a new one. |
| `/api/attendees/[attendeeId]/revoke-qr` | POST | `dbo.AttendeeQrToken`, `dbo.AttendeeListAuditLog` | Revokes the current QR token for the attendee. |

## Kiosk attendee check-in

| Endpoint | Method | Primary DB tables | Notes |
|---|---|---|---|
| `/api/kiosk/check-in/qr` | POST | `dbo.AttendeeQrToken`, `dbo.Attendee`, `dbo.AttendeeList`, `dbo.AttendanceCheckIn`, `dbo.EventAttendanceSetting`, `dbo.EventAttendeeList` | Validates QR, checks allowed event/list assignment, and records check-in. |
| `/api/kiosk/check-in/email` | POST | `dbo.Attendee`, `dbo.AttendeeList`, `dbo.AttendanceCheckIn`, `dbo.EventAttendanceSetting`, `dbo.EventAttendeeList` | Resolves attendee by email in allowed active lists and records check-in. |

## Admin / configuration

| Endpoint | Method | Primary DB tables | Notes |
|---|---|---|---|
| `/api/admin/pin/verify` | POST | `dbo.AdminConfig` | Verifies the admin PIN hash stored in config. |

## Notes on table usage

- `dbo.AttendeeList` stores attendee roster metadata.
- `dbo.Attendee` stores attendee profile records and references active attendee lists.
- `dbo.AttendeeQrToken` stores QR token hashes, expiration, send status, and revocation state.
- `dbo.AttendeeListUploadBatch` tracks CSV upload imports and validation status.
- `dbo.AttendeeListAuditLog` records audit events for attendee/list actions.
- `dbo.AttendanceCheckIn` stores kiosk check-ins for attendees by email or QR.
- `dbo.EventAttendanceSetting` controls allowed credential modes and duplicate-check policies per event.
- `dbo.EventAttendeeList` links events to attendee lists.
- `dbo.Event` stores kiosk events.
- `dbo.Device` and `dbo.DeviceAssignment` store kiosk device registration and active event assignment.
- `dbo.BadgeScan` stores kiosk badge scan records.
- `dbo.SyncBatch` stores scan sync batch metadata.
- `dbo.Employee` stores badge/cardholder records used by the kiosk review and sync flows.
- `dbo.AdminConfig` stores the hashed PIN and admin configuration.
