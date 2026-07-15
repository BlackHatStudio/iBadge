# PYTHON_REBUILD_REQUIREMENTS.md
# iBadge Python Rebuild — Requirements

> Generated: 2026-06-19

---

## 1. Functional Requirements

### FR-01 — Kiosk Check-In (Badge Scan)
- The system shall accept badge number input from a USB HID badge reader (keyboard emulation).
- The system shall match badge numbers against the employee roster using normalized comparison (strip leading zeros, uppercase, strip spaces).
- The system shall record a badge scan with: badge number, employee name snapshot, event ID, device ID, scan timestamp (UTC), and scan status (MATCHED / UNKNOWN / INACTIVE).
- The system shall suppress duplicate scans for the same badge + event within a configurable window (default: 30 seconds; server enforces its own window).
- The system shall queue scans locally when offline and sync them to the server when reconnected.

### FR-02 — Kiosk Check-In (QR Code)
- The system shall accept QR code tokens via camera (BarcodeDetector) and verify them against `dbo.AttendeeQrToken`.
- The system shall reject expired, revoked, or invalid tokens.
- The system shall return one of: SUCCESS, ALREADY_CHECKED_IN, INVALID_TOKEN, TOKEN_EXPIRED, TOKEN_REVOKED, ATTENDEE_LIST_NOT_ALLOWED.

### FR-03 — Kiosk Check-In (Email)
- The system shall accept an email address and look up the attendee in the selected event's active attendee lists.
- The system shall return SUCCESS, NOT_FOUND, ALREADY_CHECKED_IN, or MANUAL_REVIEW_REQUIRED (multiple matches).

### FR-04 — Admin PIN Access
- The system shall protect all admin pages behind a 4-digit PIN.
- The PIN shall be stored as a bcrypt hash in `dbo.AdminConfig`.
- Admin sessions shall expire after 8 hours.
- The system shall support offline PIN verification using a locally cached PIN.

### FR-05 — Event Management
- Administrators shall be able to create, rename, activate, and deactivate events.
- Events shall be listed and sortable.
- Devices shall be assignable to events.

### FR-06 — Device Management
- The system shall register kiosk devices with a device GUID and name.
- Each device shall track an active event assignment.
- The system shall record `LastSeenUTC`, `LastEmployeeSyncUTC`, `LastEventSyncUTC`.

### FR-07 — Employee Cache Refresh
- The system shall provide an endpoint to return the full employee list, event list, and device record in a single response.
- The system shall auto-refresh the employee cache on a configurable interval (default: 12 hours) and on reconnect.
- Administrators shall be able to trigger a manual cache refresh.

### FR-08 — Add Cardholder
- Administrators shall be able to upsert a new employee record (first name, last name, badge number, optional email, optional company number).
- After saving, the local employee cache shall be refreshed.

### FR-09 — Attendee List Management
- Administrators shall be able to create, view, activate, and deactivate named attendee lists.
- Each list shall track attendee count and last upload date.
- Lists shall be associatable with events via `dbo.EventAttendeeList`.

### FR-10 — Attendee CRUD
- Administrators shall be able to add, edit, and soft-delete attendees within a list.
- Each attendee record: first name, last name, email (required), badge number (optional), phone number (optional), company (optional).

### FR-11 — CSV Bulk Upload
- Administrators shall be able to upload a CSV file to import attendees into a list.
- The system shall validate rows before import (required fields, email format).
- The system shall report validation errors by row and field.
- The system shall record upload batch metadata in `dbo.AttendeeListUploadBatch`.

### FR-12 — QR Token Management
- The system shall generate unique QR tokens (HMAC-SHA256 hashed before storage).
- Administrators shall be able to: send QR to individual attendee, send QR to all in a list, revoke a QR, regenerate a QR.
- QR send status shall be tracked (SENT, FAILED, REVOKED, REGENERATED).

### FR-13 — Scan Review
- Administrators shall be able to review all badge scans with filters: event, date range, employee, badge number, device, scan status, sync status, device scope.
- Results shall include: scan time, employee name, badge, event, device, scan status, sync status.
- Pagination shall be supported.

### FR-14 — Export
- The system shall export filtered scan data as CSV, Excel-compatible CSV, and PDF.
- PDF shall include event name, filter summary, and a scan table.
- Downloads shall use appropriate Content-Disposition headers.

### FR-15 — Offline Queue Retry
- The system shall expose an endpoint to retry all PENDING/FAILED scans for a device.
- The system shall batch-sync offline scans via `POST /api/scans/sync-batch`.

---

## 2. Non-Functional Requirements

### NFR-01 — Performance
- The kiosk scan submission shall complete within 2 seconds under normal network conditions.
- The employee cache refresh shall handle up to 10,000 employee records.
- The review page shall load within 3 seconds for up to 50,000 scan records with pagination.

### NFR-02 — Availability
- The kiosk shall remain operational (offline mode) when the server is unreachable.
- The web application shall start within 10 seconds of the Windows service starting.

### NFR-03 — Maintainability
- Code shall be organized in modules: auth, database, kiosk, admin, attendees, reports, core.
- SQL shall be kept in repository modules or `.sql` files, not scattered through templates.
- Templates shall contain no business logic.

### NFR-04 — Compatibility
- The Python application shall run on Python 3.11 or 3.12.
- The application shall run on Windows Server 2019 or 2022.
- The database shall be SQL Server 2019 or later.
- The browser target is Chromium-based (Edge, Chrome) — BarcodeDetector API required for QR mode.

---

## 3. Security Requirements

### SEC-01 — No Hardcoded Credentials
- No passwords, connection strings, PINs, or API keys shall be hardcoded in source files.
- All sensitive values shall be loaded from environment variables or a local `.ini` configuration file.

### SEC-02 — Parameterized Queries
- All database queries shall use parameterized inputs.
- String interpolation into SQL queries is explicitly prohibited.
- The `sqlcmd` subprocess pattern used in the existing app shall NOT be replicated.

### SEC-03 — Least Privilege
- The SQL Server account used by the Python app shall have SELECT/INSERT/UPDATE only on required tables.
- No DDL permissions shall be granted to the runtime account.

### SEC-04 — Admin Protection
- All admin routes shall be server-side protected (not only client-side).
- Admin session verification shall be performed on every request to admin endpoints.
- A `@require_admin` decorator pattern shall enforce this.

### SEC-05 — CSRF Protection
- All state-mutating form submissions shall include CSRF token validation (Flask-WTF or equivalent).

### SEC-06 — Input Validation
- All form inputs and API request bodies shall be validated and sanitized server-side.
- File uploads (CSV) shall be validated for type, size, and content.

### SEC-07 — Security Headers
- The application shall include: `X-Content-Type-Options`, `X-Frame-Options`, `X-XSS-Protection`, `Content-Security-Policy`, `Referrer-Policy`.
- CSP shall not allow inline scripts from external origins.

### SEC-08 — Session Security
- Admin sessions shall use server-side session storage (Flask session with signed cookies, or database-backed).
- Session cookies shall be `HttpOnly`, `SameSite=Lax`.
- Session TTL: 8 hours, matching the existing behavior.

### SEC-09 — No External Dependencies at Runtime
- No CDN-loaded scripts, fonts, stylesheets, or images.
- All third-party assets must be vendored in `app/static/vendor/`.

### SEC-10 — Audit Logging
- All privileged actions shall be logged: admin login, PIN verification, event create/update, cardholder upsert, attendee list mutations, QR operations, scan exports.
- Log entries shall include: timestamp (UTC), action type, user/device identifier, IP address, result.
- Passwords, PINs, connection strings, and QR token values shall NEVER be logged.

---

## 4. Audit / Logging Requirements

| Event | Log Level | Details to Capture |
|---|---|---|
| Admin PIN verified | INFO | Device ID, result (success/fail), IP |
| Admin PIN failed | WARNING | IP, attempt count |
| Event created | INFO | Event name, admin session ID |
| Event updated | INFO | Event ID, old/new values |
| Cardholder upsert | INFO | Badge number, name |
| Attendee list created | INFO | List name, user |
| Attendee list activated/deactivated | INFO | List ID, user |
| Attendee added/updated/deleted | INFO | List ID, attendee email |
| CSV upload | INFO | File name, row count, error count |
| QR send | INFO | Attendee ID, status |
| QR revoke/regenerate | INFO | Attendee ID, user |
| Scan export | INFO | Format, filter summary, device ID |
| Badge scan submitted | DEBUG | Badge, event, scan status |
| Database error | ERROR | Query context (sanitized), error message |
| Application startup/shutdown | INFO | Version, config source |

---

## 5. Offline Deployment Requirements

- The application installer package shall require no internet access to install.
- All Python packages shall be pre-downloaded and included in a `wheelhouse/` directory.
- Installation shall use `pip install --no-index --find-links=wheelhouse/ -r requirements.txt`.
- A virtual environment shall be created locally on the target machine.
- All static assets (CSS, JS, fonts, images) shall be served from local disk.
- SQL Server connectivity shall use `pyodbc` with the installed ODBC driver (SQL Server Native Client or ODBC Driver 17/18).
- The package shall include: install guide, configuration guide, service install scripts, smoke test steps, rollback steps.

---

## 6. Database Requirements

- Target: SQL Server 2019 or later.
- The Python app shall NOT use `sqlcmd` subprocess. It shall use `pyodbc` directly.
- Connection shall support both SQL authentication and Windows authentication.
- Connection pooling shall be configured (min 2, max 10 connections).
- All queries shall use parameterized placeholders (`?` for pyodbc).
- Transactions shall be used for multi-step mutations (e.g., bulk attendee insert + batch record).
- The app shall detect optional `dbo.Employee` columns (Email, CompanyNum, Floor) at startup and cache the result.

---

## 7. User Role Requirements

| Role | Access | Authentication |
|---|---|---|
| Kiosk User (public) | Kiosk scan page only | None |
| Admin | All pages + mutations | 4-digit PIN + session |
| System/Service | No UI access | Internal only |

Future enhancement (NEEDS VALIDATION): Full user authentication with named accounts and role-based access may be required by the customer. Design the Python app to support adding this without refactoring.

---

## 8. Reporting / Export Requirements

| Report | Format | Trigger |
|---|---|---|
| Attendance review | CSV | Admin manual download |
| Attendance review | Excel-compatible CSV | Admin manual download |
| Attendance review | PDF | Admin manual download |

PDF report shall include:
- iBadge logo / report title
- Event name (or "All Events")
- Applied filter summary (date range, device, etc.)
- Scan table: Scan Time, Employee, Badge, Event, Device, Scan Status

CSV/Excel columns: Scan time (Central), Badge, Employee, Email, Company#, Event, Device.
