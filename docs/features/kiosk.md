# Kiosk Feature

The kiosk is the root page at `/` and is rendered by `src/components/kiosk-page.tsx`.

## Responsibilities

- Register or resolve the current device.
- Load employee and event reference data.
- Track the active device event assignment.
- Accept badge scans.
- Match scans against cached employee data.
- Save recent local scan history.
- Queue scans that cannot sync immediately.
- Retry queued scans on reconnect and on the configured retry interval.

## Configuration

Kiosk timing and API base values come from `src/lib/app-config.ts`:

- `apiBaseUrl`
- `referenceRefreshHours`
- `queueRetryMinutes`
- `duplicateWindowSeconds`

Defaults are 12 hours for reference refresh, 2 minutes for queue retry, and 30 seconds for duplicate suppression.

## Storage

Browser-side kiosk state is stored through `src/lib/storage.ts`. The kiosk should keep enough local state to continue scanning during a network outage.

## Sync Rules

- Try immediate sync after a scan.
- If immediate sync fails, retry once and then queue.
- Retry queued scans on reconnect.
- Preserve local recent history even after queued scans sync.
- Treat the server response as authoritative for persisted status.

## Failure Behavior

- A network failure should not discard a scan.
- A backend validation failure should surface a useful message and preserve enough detail for review.
- Unknown and inactive badges are still meaningful scan results and should be visible in review.
