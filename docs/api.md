# API Contract

The browser calls API paths through `src/lib/api.ts`. `buildApiUrl()` prefixes paths with `NEXT_PUBLIC_IBADGE_API_BASE_URL` or the browser runtime `apiBaseUrl`.

## Kiosk Scans and Sync

- `POST /api/scans` records a single attendance scan.
- `POST /api/scans/sync-batch` records a batch of queued scans.
- `GET /api/scans/review` returns scans for the review UI.
- `POST /api/sync/refresh` refreshes employees, events, and current device state.
- `POST /api/sync/retry` retries queued/pending scans for a device.

Important fields:

- `DeviceScanGuid` is the idempotency key.
- `ScanStatus` is `MATCHED`, `UNKNOWN`, or `INACTIVE`.
- `SyncStatus` is `PENDING`, `SYNCED`, `FAILED`, or `SUPPRESSED`.
- `IsOfflineCaptured` marks scans captured without immediate connectivity.

## Events and Devices

- `GET /api/events` lists events.
- `POST /api/events` creates an event.
- `PUT /api/events` updates event name and active state.
- `GET /api/devices/current` returns the current device by `deviceId` or `deviceGuid`.
- `POST /api/devices/register` registers or ensures a kiosk device.
- `PUT /api/devices/current` updates device metadata.
- `PUT /api/devices/current/event` sets the active event assignment for a device.

## Admin Access

- `POST /api/admin/pin/verify` verifies the four-digit admin PIN.

The default PIN initialization is handled in database code when no admin config row exists. Do not expose PIN hashes or salts through frontend responses.

## Review Exports

- `GET /api/reports/export/csv`
- `GET /api/reports/export/excel`
- `GET /api/reports/export/pdf`

Export routes accept the same review query filters used by `/api/scans/review`.

## Attendee Lists and QR Credentials

- `GET /api/attendee-lists`
- `POST /api/attendee-lists`
- `GET /api/attendee-lists/template.csv`
- `PATCH /api/attendee-lists/{attendeeListId}`
- `POST /api/attendee-lists/{attendeeListId}/activate`
- `POST /api/attendee-lists/{attendeeListId}/deactivate`
- `GET /api/attendee-lists/{attendeeListId}/attendees`
- `POST /api/attendee-lists/{attendeeListId}/attendees`
- `POST /api/attendee-lists/{attendeeListId}/upload`
- `POST /api/attendee-lists/{attendeeListId}/send-qr`
- `PATCH /api/attendees/{attendeeId}`
- `DELETE /api/attendees/{attendeeId}`
- `POST /api/attendees/{attendeeId}/send-qr`
- `POST /api/attendees/{attendeeId}/resend-qr`
- `POST /api/attendees/{attendeeId}/regenerate-qr`
- `POST /api/attendees/{attendeeId}/revoke-qr`
- `POST /api/kiosk/check-in/qr`
- `POST /api/kiosk/check-in/email`

See `attendees-module.md` for QR token and CSV behavior.

## Event Attendance Settings

- `GET /api/events/{eventId}/attendee-lists`
- `POST /api/events/{eventId}/attendee-lists`
- `GET /api/events/{eventId}/attendance-settings`
- `PUT /api/events/{eventId}/attendance-settings`

Attendance source modes include `ACCESS_CONTROL_ONLY`, `ATTENDEE_LIST_ONLY`, and `COMBINED`.
