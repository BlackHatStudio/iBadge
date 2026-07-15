# IMPLEMENTATION_TASK_LIST.md
# iBadge Python Rebuild — Ordered Task List

> Generated: 2026-06-19

---

## Phase 0 — Discovery (COMPLETE)

| # | Task | Acceptance Criteria | Status |
|---|---|---|---|
| 0.1 | Inventory all Next.js pages, routes, and components | PYTHON_REBUILD_DISCOVERY.md written | ✅ DONE |
| 0.2 | Inventory all API endpoints and database operations | DATABASE_MAPPING.md written | ✅ DONE |
| 0.3 | Inventory authentication and admin access model | Auth section in DISCOVERY.md | ✅ DONE |
| 0.4 | Map all routes to Python equivalents | PYTHON_ROUTE_MAPPING.md written | ✅ DONE |
| 0.5 | Define full architecture | PYTHON_REBUILD_ARCHITECTURE.md written | ✅ DONE |
| 0.6 | Define air-gapped deployment plan | AIRGAPPED_DEPLOYMENT_PLAN.md written | ✅ DONE |
| 0.7 | Validate open NEEDS VALIDATION items with customer | See DISCOVERY.md §11 | ⏳ PENDING |

---

## Phase 1 — Project Skeleton

| # | Task | Dependencies | Acceptance Criteria | Test | Rollback |
|---|---|---|---|---|---|
| 1.1 | Create `PythonApp/` folder structure | 0.x complete | All dirs and `__init__.py` files created | `ls` verify | Delete folder |
| 1.2 | Create `requirements.txt` with pinned versions | 1.1 | All packages listed; buildable on internet machine | `pip install` succeeds | Revert file |
| 1.3 | Create `config.py` with Dev/Test/Prod classes | 1.1 | Config loads from `.ini` file; no hardcoded values | Unit test config load | Revert file |
| 1.4 | Create Flask `app/__init__.py` app factory (`create_app`) | 1.1, 1.3 | App starts with `python run.py`; no errors | `GET /health` returns 200 | Revert file |
| 1.5 | Create `core/errors.py` — 404/500 handlers, ApiError class | 1.4 | 404 returns JSON `{error}`, 500 returns sanitized message | Unit test error responses | Revert file |
| 1.6 | Create `core/security.py` — security headers middleware | 1.4 | All responses include CSP, X-Frame-Options, etc. | Check response headers | Revert file |
| 1.7 | Create `core/logging_config.py` — rotating log setup | 1.4 | Logs written to `logs/app.log`, `logs/audit.log`, `logs/error.log` | Check log files after request | Revert file |
| 1.8 | Create `run.py` entry point with Waitress WSGI server | 1.4 | App runs on configured port; ready for NSSM | Service install test | Revert file |
| 1.9 | Download all packages to `wheelhouse/` | 1.2 | `pip install --no-index --find-links=wheelhouse` succeeds offline | Offline install test | Remove wheelhouse |

---

## Phase 2 — Database Connectivity

| # | Task | Dependencies | Acceptance Criteria | Test | Rollback |
|---|---|---|---|---|---|
| 2.1 | Create `database/connection.py` — pyodbc pool | 1.3 | `get_connection()` returns live SQL Server connection | Integration: SELECT 1 | Revert file |
| 2.2 | Create `database/repositories/admin_config.py` | 2.1 | `get_admin_config()` returns row; creates default if missing | Integration: SELECT from AdminConfig | DROP inserted row |
| 2.3 | Create `database/repositories/events.py` | 2.1 | `list_events()`, `create_event()`, `update_event()` work | Integration: CREATE + SELECT | DELETE test row |
| 2.4 | Create `database/repositories/devices.py` | 2.1 | `register_device()`, `get_device_by_guid()`, `set_active_event()` | Integration: INSERT + SELECT | DELETE test device |
| 2.5 | Create `database/repositories/employees.py` with optional column detection | 2.1 | `list_employees()` returns correct columns; `upsert_employee()` inserts/updates | Integration: SELECT + UPSERT | DELETE test employee |
| 2.6 | Create `database/repositories/scans.py` | 2.1, 2.4, 2.5 | `insert_scan()`, `get_review_scans(filters)`, `retry_pending()` | Integration: INSERT + SELECT + filter | DELETE test scan |
| 2.7 | Create `database/repositories/sync.py` | 2.1 | `create_sync_batch()`, `update_batch_status()` | Integration: INSERT + UPDATE | DELETE test batch |
| 2.8 | Create `database/repositories/attendee_lists.py` | 2.1 | Full CRUD on AttendeeList + AttendeeListAuditLog | Integration: CRUD + audit log | DELETE test list |
| 2.9 | Create `database/repositories/attendees.py` | 2.1 | Full CRUD + soft delete + QrToken operations | Integration: full lifecycle | DELETE test attendee |
| 2.10 | Create `database/repositories/check_in.py` | 2.1 | `insert_check_in()`, `is_duplicate()` | Integration: INSERT + SELECT | DELETE test check-in |

---

## Phase 3 — Authentication

| # | Task | Dependencies | Acceptance Criteria | Test | Rollback |
|---|---|---|---|---|---|
| 3.1 | Create `auth/service.py` — PIN verify with bcrypt | 2.2 | Correct PIN returns True; wrong PIN returns False; offline fallback works | Unit: bcrypt compare; Integration: DB verify | N/A |
| 3.2 | Create `auth/decorators.py` — `@require_admin` | 1.4, 3.1 | Protected routes redirect to `/admin/access` if no valid session | Unit: session check | N/A |
| 3.3 | Create `auth/routes.py` — GET/POST `/admin/access` | 3.1, 3.2 | PIN form loads; correct PIN sets session; wrong PIN shows error; CSRF protected | Integration: POST valid PIN, POST invalid PIN | Clear session |
| 3.4 | Create `templates/auth/pin_entry.html` | 3.3 | Matches iBadge dark design; 4-digit PIN input; error state | Visual: check dark background, cyan border | N/A |
| 3.5 | Implement admin session in server-side Flask session | 3.3 | Session TTL enforced server-side; session cleared on logout | Integration: session expiry test | N/A |
| 3.6 | Implement `POST /api/admin/pin/verify` JSON endpoint | 3.1 | Returns `{valid: true/false}`; used by kiosk offline fallback | Integration: correct + incorrect PIN | N/A |

---

## Phase 4 — Kiosk Page and Badge Scan

| # | Task | Dependencies | Acceptance Criteria | Test | Rollback |
|---|---|---|---|---|---|
| 4.1 | Create `modules/kiosk/routes.py` — GET `/` | 1.4, 3.2 | Kiosk page loads; dark background; iBadge logo visible | Visual + HTTP 200 | N/A |
| 4.2 | Create `templates/kiosk/index.html` with badge input | 4.1 | Hidden badge scanner input captures keystrokes; debounce 500ms | Manual: swipe badge | N/A |
| 4.3 | Create `modules/kiosk/api.py` — POST `/api/scans` | 2.6 | Scan accepted; duplicate suppressed; UNKNOWN match stored | Integration: insert scan, duplicate scan | DELETE test scan |
| 4.4 | Implement badge normalization (strip zeros, uppercase) | 4.3 | Same normalization as TypeScript original | Unit: test 10+ badge formats | N/A |
| 4.5 | Implement QR mode (camera BarcodeDetector) in JS | 4.2 | Camera opens; QR token detected; POST to `/api/kiosk/check-in/qr` | Manual: scan QR code | N/A |
| 4.6 | Implement email check-in modal in JS | 4.2 | Modal opens; POST to `/api/kiosk/check-in/email`; success closes modal | Manual: enter email | N/A |
| 4.7 | Create `modules/kiosk/api.py` — POST `/api/kiosk/check-in/email` | 2.9, 2.10 | Returns SUCCESS, NOT_FOUND, ALREADY_CHECKED_IN, MANUAL_REVIEW_REQUIRED | Integration: test all outcomes | N/A |
| 4.8 | Create `modules/kiosk/api.py` — POST `/api/kiosk/check-in/qr` | 2.9, 2.10 | Returns SUCCESS, INVALID_TOKEN, TOKEN_EXPIRED, TOKEN_REVOKED, ATTENDEE_LIST_NOT_ALLOWED | Integration: test all outcomes | N/A |
| 4.9 | Implement offline scan queue in client JS | 4.2 | Scans stored in localStorage when offline; synced on reconnect | Manual: disconnect network, scan, reconnect | Clear localStorage |
| 4.10 | Add recent scan display to kiosk page | 4.3 | Last 5 scans shown with employee name and time | Visual check | N/A |

---

## Phase 5 — Sync API

| # | Task | Dependencies | Acceptance Criteria | Test | Rollback |
|---|---|---|---|---|---|
| 5.1 | Create `modules/sync/api.py` — GET `/api/sync/refresh` | 2.5, 2.3, 2.4 | Returns `{employees, events, device}` in one response | Integration: GET + compare DB | N/A |
| 5.2 | Create `modules/sync/api.py` — POST `/api/sync/retry` | 2.6 | PENDING/FAILED scans for device set to SYNCED | Integration: retry test | Revert scan status |
| 5.3 | Create `modules/sync/api.py` — POST `/api/scans/sync-batch` | 2.6, 2.7 | Batch of scans inserted; SyncBatch record created; partial failures reported | Integration: batch with one bad scan | DELETE test records |

---

## Phase 6 — Admin Dashboard

| # | Task | Dependencies | Acceptance Criteria | Test | Rollback |
|---|---|---|---|---|---|
| 6.1 | Create `modules/admin/routes.py` — GET `/admin` | 3.2, 2.4, 2.3 | Admin dashboard loads; PIN-gated; shows device, event, sync info | Integration + Visual | N/A |
| 6.2 | Create `templates/admin/dashboard.html` | 6.1 | Matches iBadge dark design; all 5 panels present | Visual: all panels | N/A |
| 6.3 | Create `modules/admin/api.py` — Event CRUD | 2.3 | `POST /api/events`, `PUT /api/events/<id>` work | Integration: create + update | DELETE test event |
| 6.4 | Create `modules/admin/api.py` — Device config | 2.4 | Device name update, event assignment update | Integration: update device | Revert device name |
| 6.5 | Create `modules/admin/api.py` — Employee cache + cardholder upsert | 2.5 | `GET /api/employees`, `POST /api/employees/cardholder` | Integration: upsert + list | DELETE test employee |
| 6.6 | Implement admin dashboard JS (modals, live status, refresh) | 6.2 | Employee list modal, scan list modal, event editor modal, cardholder modal | Manual: open each modal | N/A |
| 6.7 | Add theme toggle (dark/light) to admin pages | 6.2 | Toggle switches theme; preference stored in localStorage | Manual: toggle | N/A |

---

## Phase 7 — Scan Review

| # | Task | Dependencies | Acceptance Criteria | Test | Rollback |
|---|---|---|---|---|---|
| 7.1 | Create `modules/review/routes.py` — GET `/admin/review` | 3.2 | Review page loads; PIN-gated | Integration + HTTP 200 | N/A |
| 7.2 | Create `templates/admin/review.html` | 7.1 | Filter panel, summary cards, scan table, chart, export buttons | Visual | N/A |
| 7.3 | Create `modules/review/api.py` — GET `/api/scans/review` | 2.6 | Returns filtered scans matching all filter params | Integration: test each filter | N/A |
| 7.4 | Create `modules/review/export.py` — CSV builder | 2.6 | CSV matches column spec: Scan time, Badge, Employee, Email, Company#, Event, Device | Unit: test CSV output | N/A |
| 7.5 | Create PDF builder using ReportLab | 7.4 | PDF contains header, event name, filter summary, scan table | Unit: generate PDF with test data | N/A |
| 7.6 | Create `modules/review/api.py` — GET `/api/reports/export/<format>` | 7.4, 7.5 | Returns correct Content-Type; file downloads | Integration: GET csv + pdf | N/A |
| 7.7 | Implement export preview modal in JS | 7.6 | Preview modal shows CSV table or embedded PDF before download | Manual: open preview | N/A |
| 7.8 | Implement pagination on review table | 7.3 | 10 results per page; page navigation works | Manual: >10 scans | N/A |

---

## Phase 8 — Attendee Management

| # | Task | Dependencies | Acceptance Criteria | Test | Rollback |
|---|---|---|---|---|---|
| 8.1 | Create `modules/attendees/routes.py` — GET `/admin/attendees` | 3.2 | Attendees page loads; PIN-gated | HTTP 200 | N/A |
| 8.2 | Create `templates/admin/attendees.html` | 8.1 | List panel, attendee table, modals for add/edit/delete, QR status | Visual | N/A |
| 8.3 | Create `modules/attendees/api.py` — AttendeeList CRUD | 2.8 | All list endpoints functional; audit log written | Integration: full CRUD | DELETE test list |
| 8.4 | Create `modules/attendees/api.py` — Attendee CRUD | 2.9 | Add, update, soft delete attendees | Integration: full CRUD | DELETE test attendee |
| 8.5 | Create `modules/attendees/csv_import.py` | 2.9 | Parse CSV; validate rows; report errors by row/field; bulk insert | Unit: valid CSV + bad CSV | DELETE imported rows |
| 8.6 | Create CSV upload endpoint | 8.5 | `POST /api/attendee-lists/<id>/upload` accepts file; returns validation summary | Integration: upload valid + invalid CSV | DELETE batch record |
| 8.7 | Create `modules/attendees/qr.py` — token generation | — | HMAC-SHA256 token; hash stored as bytes in DB | Unit: generate + hash | N/A |
| 8.8 | Implement QR send endpoint | 8.7, 2.9 | Generates token; calls notification provider; records send status | Integration: MOCK send | Revoke generated token |
| 8.9 | Implement QR revoke/regenerate endpoints | 8.7, 2.9 | Revoke sets RevokedAtUtc; regenerate revokes old + creates new | Integration: revoke + regenerate | N/A |
| 8.10 | Implement event→attendee list association endpoint | 2.8 | `PUT /api/events/<id>/attendee-lists` updates EventAttendeeList | Integration: associate + verify check-in | DELETE association |

---

## Phase 9 — Logging and Audit

| # | Task | Dependencies | Acceptance Criteria | Test | Rollback |
|---|---|---|---|---|---|
| 9.1 | Implement `core/audit.py` — structured audit log writer | 1.7 | All audit events written to `logs/audit.log` in JSON format | Unit: write + verify | N/A |
| 9.2 | Add audit calls to auth events | 3.3 | PIN success/fail logged with IP | Integration: verify log after login | N/A |
| 9.3 | Add audit calls to all admin mutations | 6.3–6.5, 8.3–8.9 | Event create/update, cardholder upsert, list CRUD, QR ops logged | Integration: verify each audit entry | N/A |
| 9.4 | Add audit calls to export actions | 7.6 | Export format, filter summary, device ID logged | Integration: trigger export, check log | N/A |
| 9.5 | Verify no sensitive data logged | 9.1–9.4 | PIN values, passwords, QR token values, connection strings absent from all logs | Code review + log scan | N/A |

---

## Phase 10 — Offline Testing and Packaging

| # | Task | Dependencies | Acceptance Criteria | Test | Rollback |
|---|---|---|---|---|---|
| 10.1 | Build wheelhouse from `requirements.txt` | 1.9 | All packages downloaded; `SHA256SUMS.txt` generated | Verify file count | Rebuild |
| 10.2 | Test offline install on clean Windows VM | 10.1 | Full install completes with no internet; service starts | Full smoke test | Rollback per plan |
| 10.3 | Create `deploy/install_service.ps1` | 1.8 | Script installs NSSM service; service starts on boot | Fresh VM install | Uninstall service |
| 10.4 | Create `deploy/verify_install.ps1` | 10.3 | Checks service status, health endpoint, log files, DB connection | Run after install | N/A |
| 10.5 | Create `tests/smoke/test_smoke.py` | all | All critical routes return expected status codes | pytest smoke suite | N/A |
| 10.6 | Create `deploy/create_offline_package.ps1` | 10.1 | Produces versioned zip with correct contents | Unzip + verify | N/A |

---

## Phase 11 — Production Cutover

| # | Task | Dependencies | Acceptance Criteria | Status |
|---|---|---|---|---|
| 11.1 | Customer review of discovery + architecture docs | 0.x | Customer approves or flags changes | ⏳ |
| 11.2 | Validate all NEEDS VALIDATION items | 0.7 | All open items resolved | ⏳ |
| 11.3 | Install on production server (parallel to existing) | 10.x | Python app running on alternate port; not yet primary | ⏳ |
| 11.4 | Parallel acceptance testing | 11.3 | All workflows verified against production database | ⏳ |
| 11.5 | Switch IIS to Python app | 11.4 | Traffic routed to Flask; existing Next.js service stopped | ⏳ |
| 11.6 | Monitor for 48 hours | 11.5 | No critical errors in logs; scan data correct in DB | ⏳ |
| 11.7 | Decommission Next.js service | 11.6 | Node service removed; Next.js files archived | ⏳ |
