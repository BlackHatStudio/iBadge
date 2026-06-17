# Attendees Module

The Attendees module stores reusable attendee rosters in SQL Server tables under `dbo.AttendeeList`, `dbo.Attendee`, `dbo.AttendeeQrToken`, `dbo.AttendeeListUploadBatch`, and `dbo.AttendeeListAuditLog`.

## CSV Format

Download the template from `/api/attendee-lists/template.csv`.

Required header:

```csv
badge_number,first_name,last_name,email,phone_number,company
```

`first_name`, `last_name`, and `email` are required. `badge_number`, `phone_number`, and `company` are optional. Uploads are all-or-nothing: any validation error rejects the entire file and records the upload batch as `REJECTED`.

## Admin Workflow

Admins can open `/admin/attendees` to create lists, activate/deactivate lists, upload CSV files, add/edit/remove attendees, and send/revoke/regenerate QR credentials. Removed attendees are soft-deleted with `DeletedAt` and `DeletedBy`.

## QR Workflow

QR tokens are secure random values. The plaintext token is used only to build the outbound QR payload and is never stored. SQL Server stores only `SHA-256` binary hashes in `dbo.AttendeeQrToken.TokenHash`.

Because plaintext tokens are not recoverable, resend regenerates a new token, revokes the previous active token, and sends the new payload.

## Notification Providers

Notification sending uses provider abstractions. Development and test default to `ATTENDEE_NOTIFICATION_PROVIDER=MOCK`. Production without a configured provider returns an administrative send failure and records `LastSendStatus = FAILED`.

Environment variables:

```env
ATTENDEE_NOTIFICATION_PROVIDER=MOCK
ATTENDEE_QR_BASE_URL=
ATTENDEE_QR_CHECKIN_PATH=/kiosk/check-in
```

Real SMTP, Microsoft Graph, SendGrid, Twilio, or relay providers can be added behind the provider interfaces without changing attendee persistence.

## Kiosk Check-In

QR and email check-in endpoints validate server-side:

- `/api/kiosk/check-in/qr`
- `/api/kiosk/check-in/email`

They only accept active, non-deleted attendees from active attendee lists selected for the current event through `dbo.EventAttendeeList`. `ACCESS_CONTROL_ONLY` rejects attendee-list check-ins. Duplicate successful attendee check-ins within `DuplicateScanWindowSeconds` default to `Already checked in` and do not create another success record.

## Rollback

Rollback the feature by removing the API/UI changes and dropping the new objects from `deployment/sql/007_attendee_lists_qr_checkin.sql` after backing up production data. Existing badge scan tables and routes are not modified by the migration.
