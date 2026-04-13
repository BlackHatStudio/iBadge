# Attendance Kiosk Integration Notes

## Frontend Assumptions

- The Next.js app is exported statically and served by IIS.
- All backend communication goes through HTTP endpoints configured with `NEXT_PUBLIC_IBADGE_API_BASE_URL`.
- The frontend does not connect directly to SQL Server.
- The kiosk caches employees, events, device configuration, recent scans, pending scan queue, and sync metadata in IndexedDB.

## Expected Backend Endpoints

- `POST /api/scans`
  - Accepts a single attendance scan payload aligned to the client `AttendanceScan` shape.
  - Should enforce duplicate suppression for `badge + device + event` within 30 seconds in addition to the client check.
- `POST /api/scans/sync-batch`
  - Accepts `{ scans: AttendanceScan[] }`.
  - Expected response shape: `{ syncedIds?: string[]; failed?: [{ deviceScanGuid, error }] }`.
- `GET /api/events`
  - Returns centrally-managed event list.
- `POST /api/events`
  - Accepts `{ eventName }`.
  - Returns the created event record.
- `GET /api/devices/current`
  - Supports `deviceId` and/or `deviceGuid` query parameters.
  - Returns the current device assignment and display name.
- `POST /api/devices/register`
  - Registers a new kiosk device.
- `PUT /api/devices/current`
  - Updates device name or current device metadata.
- `PUT /api/devices/current/event`
  - Updates the active event for the current device.
- `GET /api/scans/review`
  - Supports filters for event, date range, employee, badge number, device, scan status, sync status, and device scope.
- `GET /api/reports/export/csv`
- `GET /api/reports/export/excel`
- `GET /api/reports/export/pdf`
  - Export endpoints should accept the same review query parameters.
- `POST /api/admin/pin/verify`
  - Accepts `{ pin, deviceId }`.
  - Expected response shape: `{ valid: boolean }` or `{ authorized: boolean }`.
- `POST /api/sync/refresh`
  - Accepts `{ deviceId, deviceGuid, lastRefreshUTC }`.
  - Expected to return employee roster data and may optionally include events/device state.
- `POST /api/sync/retry`
  - Manual retry endpoint for queued device scans.

## Refresh and Retry Rules

- Employee and event reference data refresh every 12 hours when online.
- Reference data refreshes again on reconnect.
- Each scan attempts immediate sync.
- If immediate sync fails, the client retries once immediately and then queues the scan.
- Queued scans retry on reconnect and on a recurring interval driven by `NEXT_PUBLIC_IBADGE_QUEUE_RETRY_MINUTES`.

## Migration Notes

- No SQL migrations are included in the frontend repo.
- Backend storage should persist `DeviceScanGuid` as the idempotency key and preserve per-device event context.
- Existing devices should be backfilled with a stable device id/guid if they do not already have one.

## Regression-Safe Test Focus

- Verify `/` works as the kiosk entry point in both browser mode and installed-PWA mode.
- Confirm the employee cache survives reloads and offline restarts.
- Confirm the queue drains after reconnect without dropping local recent history.
- Confirm admin and review are inaccessible without entering the PIN flow first.
- Confirm review exports only call backend endpoints and do not mutate data.
