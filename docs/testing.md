# Testing

## Automated Checks

```powershell
npm run test
npm run build
npm run build:server
```

Use the narrowest command that proves the change, then broaden when the change crosses module boundaries.

## Current Test Areas

- `src/lib/admin-access.test.ts` - admin access behavior.
- `src/lib/attendees/*.test.ts` - attendee CSV, QR, and repository behavior.

## Regression Focus

- Kiosk loads at `/`.
- Kiosk can scan while online.
- Kiosk preserves queued scans while offline.
- Queue retry drains pending scans after reconnect.
- Duplicate badge scans are suppressed according to configured rules.
- Admin and review pages require the PIN access flow.
- Event/device assignment updates are reflected on the kiosk.
- Review filters return expected data.
- CSV, Excel-compatible CSV, and PDF exports do not mutate data.
- Attendee CSV upload is all-or-nothing.
- Attendee QR resend/regenerate/revoke flows do not persist plaintext tokens.
- QR and email check-in respect event attendance settings.

## Manual UI Checks

Use browser verification for user-facing layout changes:

- Desktop admin console.
- Mobile/narrow kiosk layout.
- Kiosk installed-PWA-like viewport.
- Attendees management table and upload controls.
- Review page filters and export actions.

Admin visuals should remain aligned with `docs/design.md`.
