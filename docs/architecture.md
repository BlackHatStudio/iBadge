# Attendi Architecture

## 1. Purpose

Attendi is a badge-based event attendance kiosk and administration platform for controlled training, meetings, safety events, emergency drills, and other structured attendance workflows.

The application provides a clean public-facing kiosk screen for attendee check-in, plus administrative tools for managing attendee lists, QR codes, events, reports, and attendance records.

The primary business goals are:

- Fast badge or QR-based event attendance capture.
- Controlled attendee list management through uploaded CSV files and manual entries.
- Administrative visibility into attendance status, scan history, and reporting.
- Support for offline or preloaded attendee workflows.
- Human-reviewable administrative actions for QR generation, revocation, resend, and attendee maintenance.
- A modular architecture that can later support multi-tenant licensing, customer branding, hosted deployments, and integration with external identity, badge, or access-control systems.

Attendi must be designed as a secure, auditable, production-ready application. Attendance actions, administrative changes, and QR lifecycle events must be traceable and reversible where appropriate.

---

## 2. System Overview

Attendi is organized around four major application surfaces:

1. **Kiosk Attendance Interface**
   - Public-facing event check-in screen.
   - Accepts badge scans, QR scans, or email lookup depending on enabled event configuration.
   - Displays current event title, scan instructions, last scan result, and limited administrative access.

2. **Admin Console**
   - Internal administrative UI for creating and maintaining attendee lists, events, templates, QR codes, and system settings.
   - Provides list upload, validation, correction, activation/deactivation, and QR lifecycle controls.

3. **Attendee Management**
   - Manages offline attendee records imported by CSV or entered manually.
   - Attendees are list-scoped, not globally tied to only one event.
   - Supports multiple active attendee lists.

4. **Reports and Review Pages**
   - Provides attendance summaries, scan history, exception review, and export-ready data.
   - Used by event owners, admins, or compliance reviewers to verify who attended and when.

The application should maintain strict separation between UI, API routes, business services, database access, and integration adapters.

---

## 3. Core User Roles

### 3.1 Public Kiosk User

A kiosk user is an attendee interacting with the kiosk screen. This user is not authenticated into the admin system.

Allowed actions:

- Scan badge.
- Scan QR code.
- Enter email if enabled.
- View basic success or error result for their own scan.

Not allowed:

- View attendee lists.
- Modify attendance data.
- Access reports.
- Access administrative controls without authentication.

### 3.2 Admin User

An admin user manages system configuration, attendee lists, events, QR codes, and reporting.

Allowed actions:

- Create and manage attendee lists.
- Upload CSV attendee files.
- Download CSV templates.
- Review import validation errors.
- Add one-off attendees.
- Activate or deactivate attendee lists.
- Send, resend, regenerate, or revoke QR codes.
- View attendance reports.
- Manage event setup and kiosk routing.

### 3.3 Event Owner / Reviewer

An event owner or reviewer may have limited access to attendance review and reporting.

Allowed actions:

- View attendance for assigned events.
- Export attendance evidence if permitted.
- Review exceptions or unmatched scans.

Not allowed unless explicitly granted:

- Manage global settings.
- Modify attendee lists.
- Regenerate QR codes.
- Manage users or roles.

### 3.4 System Administrator

A system administrator manages application-level configuration, deployments, tenant boundaries, integrations, and security settings.

Allowed actions:

- Manage application configuration.
- Manage users and roles.
- Configure runtime integrations.
- Review audit logs.
- Configure tenant-specific branding and licensing when multi-tenancy is enabled.

---

## 4. Page and Route Overview

The route names below are the intended logical routes. Exact framework routing may vary, but the page ownership and behavior should remain stable.

| Page / Route | Purpose | Primary Audience | Notes |
|---|---|---|---|
| `/` or `/kiosk` | Main kiosk attendance screen | Attendees | Badge scan, QR scan, email lookup, last scan display. |
| `/admin` | Admin landing page | Admins | No sidebar required in the selected design. Should include link to Attendee page. |
| `/admin/attendees` | Attendee list management | Admins | Create list, upload CSV, download template, validate, edit, activate/deactivate. |
| `/admin/events` | Event setup | Admins | Create events, assign attendee lists, configure scan methods. |
| `/admin/reports` or `/reports` | Attendance reporting | Admins / Reviewers | Attendance summaries, exports, scan history, exceptions. |
| `/admin/review` | Attendance review / exception handling | Admins / Reviewers | Review duplicate scans, invalid badges, unmatched QR/email entries. |
| `/admin/settings` | System configuration | System Admins | Branding, kiosk behavior, QR expiration, integrations, tenant settings. |
| `/login` | Admin authentication | Internal users | Required for all protected admin routes. |

Public kiosk routes must not expose administrative data or internal API responses.

---

## 5. Primary Workflow

### 5.1 Attendee List Setup Workflow

1. Admin opens the Attendee Management page.
2. Admin creates a new attendee list.
3. Admin downloads the CSV template or uploads an existing CSV file.
4. System validates the CSV file.
5. System displays validation results.
6. Admin corrects rejected rows if needed.
7. System imports valid attendees into the selected list.
8. Admin activates the attendee list.
9. Admin assigns the attendee list to one or more events.
10. Admin generates or sends QR codes when required.

Required CSV columns:

```text
badge_number
first_name
last_name
email
phone
company
```

Recommended system-managed fields:

```text
attendee_id
attendee_list_id
is_active
created_at
created_by
updated_at
updated_by
revoked_at
revoked_by
```

Attendee records should be list-scoped. The same email address may exist on multiple attendee lists.

---

### 5.2 Kiosk Attendance Workflow

1. Kiosk loads the assigned event configuration.
2. Kiosk displays:
   - Attendi brand/logo.
   - Event title.
   - Instruction: `Scan Badge on the reader`.
   - Badge input field.
   - Email button.
   - QR code button.
   - Last scan name/time.
   - Admin button.
3. Attendee scans a badge, scans a QR code, or enters an email.
4. UI submits the scan payload to the attendance API.
5. API validates event status, attendee list membership, attendee active status, QR validity, and duplicate-scan rules.
6. API writes an immutable attendance event record.
7. API returns a minimal result to the kiosk.
8. Kiosk displays success, warning, or rejection state.
9. Badge input resets and auto-advances for the next attendee.

The kiosk must never receive full attendee lists unless explicitly required for a controlled offline mode. When offline mode is implemented, the local cache must be encrypted, time-bounded, and scoped only to the assigned event/list.

---

### 5.3 QR Code Workflow

1. Admin selects one or more attendees.
2. Admin chooses send, resend, revoke, or regenerate QR.
3. System creates a QR token or updates token lifecycle state.
4. System logs the administrative action.
5. System sends the QR email when requested.
6. Kiosk validates the QR token during check-in.
7. Revoked, expired, inactive, or mismatched tokens are rejected.

QR tokens must not expose internal attendee IDs, database keys, or predictable values. Tokens should be random, signed, time-bounded, and revocable.

---

### 5.4 Reporting Workflow

1. Admin or reviewer opens Reports.
2. User filters by event, list, date range, company, or attendance status.
3. API queries attendance records, attendee metadata, and scan history.
4. UI displays summary metrics and detailed rows.
5. User exports records if authorized.
6. Export action is logged.

Reports should preserve historical truth. If an attendee record is later edited, prior attendance records should still retain the original scan evidence and audit context.

---

## 6. Runtime Boundaries

Attendi should be deployed with explicit runtime boundaries. The application must not rely on hidden coupling or direct UI-to-database access.

### 6.1 Browser / Kiosk Runtime

Responsibilities:

- Render kiosk UI.
- Capture badge, QR, and email input.
- Submit attendance events to API.
- Display minimal result state.
- Reset input after scan.

Must not:

- Store administrative credentials.
- Access database directly.
- Expose full attendee data.
- Contain privileged business logic.

### 6.2 Admin Browser Runtime

Responsibilities:

- Render admin pages.
- Manage protected admin workflows.
- Submit administrative actions to API.
- Display validation and reporting data based on authorization.

Must not:

- Bypass server authorization.
- Hardcode tenant, event, or database identifiers.
- Trust client-side role checks as authoritative.

### 6.3 API Runtime

Responsibilities:

- Authenticate administrative users.
- Authorize every protected action.
- Validate kiosk scan requests.
- Enforce attendee list, event, QR, and duplicate-scan rules.
- Own all writes to the database.
- Generate audit records.
- Call integration adapters for email, badge systems, or external identity providers.

The API is the primary trust boundary. All authorization must be enforced server-side.

### 6.4 Database Runtime

Responsibilities:

- Persist tenants, users, roles, events, attendee lists, attendees, QR tokens, attendance records, imports, and audit logs.
- Enforce referential integrity.
- Preserve historical records.
- Support reporting and audit review.

The database must use foreign keys, constraints, timestamps, and audit fields. No orphaned records should be permitted.

### 6.5 Integration Runtime

Potential integration adapters:

- Email service adapter.
- QR generation service.
- Badge reader input adapter.
- Access control system adapter.
- Identity provider adapter.
- Reporting/export adapter.

Adapters must be replaceable and versioned. External systems must not receive internal credentials or unrestricted database access.

---

## 7. Data Flow

### 7.1 Kiosk Scan Data Flow

```text
Badge / QR / Email Input
        |
        v
Kiosk UI
        |
        v
POST /api/attendance/check-in
        |
        v
Attendance Service
        |
        +--> Event Validation
        +--> Attendee List Validation
        +--> Attendee Active Status Check
        +--> QR Token Validation
        +--> Duplicate Scan Rule Check
        |
        v
Attendance Repository
        |
        v
Database: attendance_events + audit_log
        |
        v
Minimal API Response
        |
        v
Kiosk Result Display
```

The kiosk response should include only the data required for display, such as:

```json
{
  "status": "accepted",
  "displayName": "Jane Smith",
  "scanTime": "2026-06-17T14:35:00Z",
  "message": "Checked in"
}
```

Do not return full attendee records, internal IDs, QR secrets, role data, or administrative metadata to the kiosk.

---

### 7.2 Attendee Import Data Flow

```text
CSV Upload
        |
        v
Admin UI
        |
        v
POST /api/admin/attendee-lists/{id}/import
        |
        v
Import Service
        |
        +--> File Type Validation
        +--> Header Validation
        +--> Row-Level Validation
        +--> Duplicate Detection
        +--> Normalization
        |
        v
Import Batch Record
        |
        v
Attendee Repository
        |
        v
Database: attendee_import_batches + attendee_import_rows + attendees
        |
        v
Validation Summary Returned to Admin UI
```

The import workflow should record both accepted and rejected rows. Rejected rows should remain available for administrator correction and evidence.

---

### 7.3 QR Lifecycle Data Flow

```text
Admin QR Action
        |
        v
Admin UI
        |
        v
POST /api/admin/attendees/{id}/qr-action
        |
        v
QR Service
        |
        +--> Authorization Check
        +--> Attendee Active Check
        +--> Token Generate / Revoke / Regenerate
        +--> Email Dispatch When Requested
        |
        v
Database: attendee_qr_tokens + audit_log
        |
        v
Admin Action Result
```

QR token state should support:

- `active`
- `revoked`
- `expired`
- `regenerated`
- `sent`
- `failed_to_send`

---

### 7.4 Reporting Data Flow

```text
Report Filter Input
        |
        v
Reports UI
        |
        v
GET /api/admin/reports/attendance
        |
        v
Reporting Service
        |
        +--> Authorization Scope Check
        +--> Query Builder
        +--> Export Permission Check
        |
        v
Database Views / Reporting Queries
        |
        v
Report Rows + Summary Metrics
```

Exports must be logged with user, timestamp, filter criteria, and record count.

---

## 8. Recommended Data Model Ownership

| Domain | Tables / Entities | Owning Module |
|---|---|---|
| Tenant / Customer | tenants, tenant_settings, tenant_branding | Tenant Module |
| Identity / Access | users, roles, user_roles, sessions | Identity Module |
| Events | events, event_settings, event_attendee_lists | Event Module |
| Attendee Lists | attendee_lists, attendees, attendee_import_batches, attendee_import_rows | Attendee Module |
| QR Codes | attendee_qr_tokens, qr_delivery_log | QR Module |
| Attendance | attendance_events, attendance_exceptions | Attendance Module |
| Reporting | reporting views, export_log | Reporting Module |
| Audit | audit_log, security_events | Audit Module |
| Integrations | integration_configs, integration_health, outbound_messages | Integration Module |

Each module should own its database writes through a service/repository boundary. Other modules may read through approved interfaces or reporting views but should not perform unmanaged cross-domain writes.

---

## 9. Module Ownership

### 9.1 Kiosk Module

Owns:

- Kiosk screen layout.
- Badge input handling.
- QR scanner launch behavior.
- Email lookup launch behavior.
- Last scan display.
- Kiosk idle/reset behavior.

Depends on:

- Attendance API.
- Event configuration API.

Does not own:

- Attendance rule enforcement.
- Attendee lookup business logic.
- QR validation logic.
- Admin authentication.

---

### 9.2 Admin Module

Owns:

- Admin dashboard page.
- Navigation between admin pages.
- Protected administrative workflows.
- Admin UI state management.

Depends on:

- Identity API.
- Attendee API.
- Event API.
- Reporting API.
- Audit API where required.

Does not own:

- Server-side authorization.
- Direct database access.

---

### 9.3 Attendee Module

Owns:

- Attendee list creation.
- CSV template generation.
- CSV import validation.
- Manual attendee creation.
- Attendee active/inactive status.
- List activation/deactivation.

Rules:

- Attendees belong to attendee lists.
- Lists can be active or inactive.
- Same email may exist across multiple lists.
- Removing or deactivating an attendee must invalidate or block QR usage.
- Deleting should be soft-delete unless legal or retention rules require purge.

---

### 9.4 Event Module

Owns:

- Event creation.
- Event title and display configuration.
- Event date/time.
- Assigned attendee lists.
- Enabled check-in methods.
- Event status.

Rules:

- A kiosk should be bound to a specific event or event selection context.
- Inactive events should reject check-ins.
- Events must not reference deleted attendee lists.

---

### 9.5 Attendance Module

Owns:

- Check-in endpoint.
- Scan normalization.
- Duplicate scan policy.
- Attendance record creation.
- Attendance exception creation.
- Kiosk-safe response payloads.

Rules:

- Attendance records are append-only evidence records.
- Updates should be correction records, not destructive overwrites.
- Every check-in attempt should be traceable.
- Invalid attempts may be stored as exceptions depending on retention and privacy policy.

---

### 9.6 QR Module

Owns:

- QR token generation.
- QR validation.
- QR revocation.
- QR regeneration.
- QR delivery status.

Rules:

- QR values must be non-predictable.
- QR tokens must be revocable.
- QR tokens must not expose database keys.
- QR lifecycle actions must be audited.

---

### 9.7 Reporting Module

Owns:

- Attendance summaries.
- Event reports.
- Attendee status reports.
- Export generation.
- Export audit logging.

Rules:

- Reports should use read-only queries or reporting views.
- Export permissions must be checked server-side.
- Reports should preserve historical attendance evidence.

---

### 9.8 Audit Module

Owns:

- Audit event schema.
- Administrative action logging.
- Security event logging.
- Export logging.
- QR lifecycle logging.

Minimum audit fields:

```text
audit_id
tenant_id
actor_user_id
action
entity_type
entity_id
before_json
after_json
ip_address
user_agent
created_at
correlation_id
```

---

### 9.9 Integration Module

Owns:

- External service adapters.
- Email delivery adapter.
- Future identity provider adapter.
- Future badge/access-control adapter.
- Integration health checks.

Rules:

- Adapters must be isolated behind interfaces.
- External credentials must be stored securely.
- Integration failures must be logged.
- Retries must be bounded and traceable.

---

## 10. Security Boundaries

### 10.1 Authentication

- Admin pages require authenticated sessions.
- Public kiosk check-in does not imply admin authentication.
- External authentication must never require or expose internal database credentials.
- Production authentication should support enterprise SSO when needed.

### 10.2 Authorization

- All protected APIs must enforce server-side RBAC.
- UI role checks are usability controls only, not security controls.
- Administrative QR actions require explicit permission.
- Export actions require explicit permission.

### 10.3 Data Protection

- Do not expose internal IDs or secrets to kiosk clients.
- Do not store QR token plaintext if a hash-based validation model is feasible.
- Encrypt sensitive configuration values.
- Avoid storing unnecessary personal data.
- Use retention rules for import files, rejected rows, and logs.

### 10.4 Auditability

The following actions must be audited:

- Login success/failure.
- Attendee list creation/update/deactivation.
- CSV import.
- Manual attendee creation/update/deactivation.
- QR send/resend/revoke/regenerate.
- Event creation/update/deactivation.
- Attendance correction.
- Report export.
- Settings changes.

---

## 11. Environment Boundaries

Attendi must maintain explicit environment isolation.

| Environment | Purpose | Rules |
|---|---|---|
| Development | Local development and feature work | Uses local/dev database only. No production credentials. |
| Test / QA | Validation, regression testing, demo data | Uses controlled synthetic or approved test data. |
| Production | Live customer operation | Least-privilege credentials, backups, monitoring, audit retention. |

Rules:

- Never develop directly against production.
- Never hardcode production values.
- Configuration must come from environment variables or a secure configuration store.
- Migrations must be versioned and reversible where possible.
- Deployments must include validation and rollback steps.

---

## 12. Recommended API Ownership

| API Area | Example Routes | Owning Module |
|---|---|---|
| Kiosk Config | `GET /api/kiosk/events/{eventId}` | Event Module |
| Check-In | `POST /api/attendance/check-in` | Attendance Module |
| Attendee Lists | `GET/POST /api/admin/attendee-lists` | Attendee Module |
| Attendee Import | `POST /api/admin/attendee-lists/{id}/import` | Attendee Module |
| Attendees | `GET/POST/PATCH /api/admin/attendees` | Attendee Module |
| QR Actions | `POST /api/admin/attendees/{id}/qr` | QR Module |
| Events | `GET/POST/PATCH /api/admin/events` | Event Module |
| Reports | `GET /api/admin/reports/attendance` | Reporting Module |
| Exports | `POST /api/admin/reports/attendance/export` | Reporting Module |
| Audit | `GET /api/admin/audit` | Audit Module |
| Settings | `GET/PATCH /api/admin/settings` | Admin / Tenant Module |

All API routes must validate input, enforce authorization, and produce structured error responses.

---

## 13. Error Handling Standards

API errors should use consistent response shapes.

Example:

```json
{
  "error": {
    "code": "ATTENDEE_NOT_ACTIVE",
    "message": "This attendee is not active for the selected event.",
    "correlationId": "01JABCDEF123456789"
  }
}
```

Kiosk-safe messages should be concise and non-sensitive. Admin responses may include more detail when authorized.

Do not expose stack traces, SQL errors, environment variables, secrets, or internal exception details to users.

---

## 14. Deployment and Operational Requirements

Minimum production expectations:

- HTTPS only.
- Secure session handling.
- Least-privilege database user for runtime API.
- Separate migration/admin database credential.
- Structured logs with correlation IDs.
- Database backups.
- Migration history table.
- Audit log retention policy.
- Health check endpoint.
- Readiness check for database and integration dependencies.
- Deployment rollback procedure.

Recommended operational endpoints:

```text
GET /health/live
GET /health/ready
GET /version
```

---

## 15. File / Folder Ownership Guidance

Exact framework layout may vary, but ownership should remain clear.

```text
src/
  app/
    kiosk/
    admin/
    admin/attendees/
    admin/events/
    admin/reports/
    login/

  components/
    kiosk/
    admin/
    attendees/
    events/
    reports/
    shared/

  server/
    api/
    services/
      attendance/
      attendees/
      audit/
      events/
      integrations/
      qr/
      reporting/
      tenant/
    repositories/
    middleware/
    validation/
    config/

  database/
    migrations/
    seeds/
    views/

  docs/
    architecture.md
```

Rules:

- UI components should not contain database code.
- Services own business rules.
- Repositories own database queries.
- Validation schemas must be shared or consistently mirrored between client and server where appropriate.
- Environment-specific config must not be hardcoded.

---

## 16. Non-Negotiable Architecture Rules

1. The kiosk must not have administrative authority.
2. Admin authorization must be enforced server-side.
3. Attendance records must be auditable.
4. QR tokens must be revocable and non-predictable.
5. CSV imports must preserve rejected-row evidence.
6. Attendee list membership must be enforced during check-in.
7. Environment configuration must be isolated between dev, test, and production.
8. Database writes must flow through API services, not directly from UI code.
9. Reporting exports must be permissioned and logged.
10. External integrations must use adapters, not direct hidden coupling.
11. No production credentials in source control.
12. No customer-specific hacks that bypass tenant, role, or audit boundaries.

---

## 17. Future Expansion Considerations

The current architecture should leave room for:

- Multi-tenant customer deployments.
- Customer-specific branding.
- License enforcement.
- Hosted SaaS deployment.
- On-prem deployment for industrial customers.
- Enterprise SSO.
- Badge/access-control system integration.
- Offline kiosk mode.
- SMS delivery for QR codes.
- Event-specific custom questions.
- Compliance evidence packages.
- API-based integration with training systems.

Future expansion must preserve the core trust boundaries and audit model.

---

## 18. Summary

Attendi is a modular attendance kiosk and administration system centered on controlled check-in, attendee list governance, QR lifecycle management, and auditable reporting.

The application should be treated as an enterprise operations platform, not a simple form app. The architecture must preserve clear boundaries between kiosk UI, admin UI, API services, database persistence, and external integrations.

The system is production-ready only when it enforces least privilege, maintains historical evidence, logs administrative actions, validates all runtime inputs, isolates environments, and avoids hidden coupling between modules.
