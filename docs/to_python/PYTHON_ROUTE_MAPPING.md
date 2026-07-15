# PYTHON_ROUTE_MAPPING.md
# iBadge — Route Mapping: Next.js → Python Flask

> Generated: 2026-06-19

---

## Legend

- **Current Route** — Next.js App Router path
- **Python Route** — Flask Blueprint route
- **Controller** — Python module.function
- **Template** — Jinja2 template file
- **Service** — Business logic module
- **Repository** — Database access module
- **Role** — Required session level

---

## 1. Page Routes (Server-Rendered HTML)

| Current Route | Python Route | Method | Controller | Template | Service | Role | Notes |
|---|---|---|---|---|---|---|---|
| `/` | `/` | GET | `kiosk.routes.kiosk_index` | `kiosk/index.html` | none (JS-driven) | Public | Kiosk page — React replaced by JS-enhanced Jinja template |
| `/registration` | `/registration` | GET | `kiosk.routes.kiosk_index` | `kiosk/index.html` | none | Public | Same template as `/` |
| `/offline` | `/offline` | GET | `kiosk.routes.offline_page` | `kiosk/offline.html` | none | Public | PWA offline fallback |
| `/login` | `/login` | GET | `auth.routes.login_page` | `auth/login.html` | none | Public | Disabled placeholder — keep same UI |
| `/admin/access` | `/admin/access` | GET | `auth.routes.pin_entry_get` | `auth/pin_entry.html` | `auth.service` | Public | 4-digit PIN form |
| `/admin/access` | `/admin/access` | POST | `auth.routes.pin_entry_post` | `auth/pin_entry.html` | `auth.service` | Public | PIN verify + session grant |
| `/admin` | `/admin` | GET | `admin.routes.dashboard` | `admin/dashboard.html` | `admin.service` | Admin | Operations control center |
| `/admin/review` | `/admin/review` | GET | `review.routes.review_page` | `admin/review.html` | `review.service` | Admin | Scan review + export |
| `/admin/attendees` | `/admin/attendees` | GET | `attendees.routes.attendees_page` | `admin/attendees.html` | `attendees.service` | Admin | Attendee list management |

---

## 2. API Routes — Admin / Auth

| Current Route | Python Route | Method | Controller | Service | Repository | Role | Mutating |
|---|---|---|---|---|---|---|---|
| `POST /api/admin/pin/verify` | `POST /api/admin/pin/verify` | POST | `auth.api.verify_pin` | `auth.service.verify_pin` | `database.repositories.admin_config` | Public | No |

---

## 3. API Routes — Devices

| Current Route | Python Route | Method | Controller | Service | Repository | Role | Mutating |
|---|---|---|---|---|---|---|---|
| `POST /api/devices/register` | `POST /api/devices/register` | POST | `admin.api.register_device` | `admin.device_service` | `database.repositories.devices` | Public (kiosk) | Yes |
| `GET /api/devices/current` | `GET /api/devices/current` | GET | `admin.api.get_current_device` | `admin.device_service` | `database.repositories.devices` | Public (kiosk) | No |
| `PUT /api/devices/current` | `PUT /api/devices/current` | PUT | `admin.api.update_current_device` | `admin.device_service` | `database.repositories.devices` | Admin | Yes |
| `PUT /api/devices/current/event` | `PUT /api/devices/current/event` | PUT | `admin.api.update_device_event` | `admin.device_service` | `database.repositories.devices` | Admin | Yes |

---

## 4. API Routes — Events

| Current Route | Python Route | Method | Controller | Service | Repository | Role | Mutating |
|---|---|---|---|---|---|---|---|
| `GET /api/events` | `GET /api/events` | GET | `admin.api.list_events` | `admin.event_service` | `database.repositories.events` | Public (kiosk) | No |
| `POST /api/events` | `POST /api/events` | POST | `admin.api.create_event` | `admin.event_service` | `database.repositories.events` | Admin | Yes |
| `PUT /api/events/<event_id>` | `PUT /api/events/<int:event_id>` | PUT | `admin.api.update_event` | `admin.event_service` | `database.repositories.events` | Admin | Yes |
| `GET /api/events/<id>/attendance-settings` | `GET /api/events/<int:event_id>/attendance-settings` | GET | `admin.api.get_attendance_settings` | `admin.event_service` | `database.repositories.events` | Admin | No |
| `GET /api/events/<id>/attendee-lists` | `GET /api/events/<int:event_id>/attendee-lists` | GET | `attendees.api.get_event_lists` | `attendees.service` | `database.repositories.attendee_lists` | Admin | No |
| `PUT /api/events/<id>/attendee-lists` | `PUT /api/events/<int:event_id>/attendee-lists` | PUT | `attendees.api.set_event_lists` | `attendees.service` | `database.repositories.attendee_lists` | Admin | Yes |

---

## 5. API Routes — Scans and Sync

| Current Route | Python Route | Method | Controller | Service | Repository | Role | Mutating |
|---|---|---|---|---|---|---|---|
| `POST /api/scans` | `POST /api/scans` | POST | `kiosk.api.submit_scan` | `kiosk.scan_service` | `database.repositories.scans` | Public (kiosk) | Yes |
| `POST /api/scans/sync-batch` | `POST /api/scans/sync-batch` | POST | `sync.api.sync_batch` | `sync.batch_service` | `database.repositories.scans`, `sync` | Public (kiosk) | Yes |
| `GET /api/scans/review` | `GET /api/scans/review` | GET | `review.api.get_review_scans` | `review.service` | `database.repositories.scans` | Admin | No |
| `GET /api/sync/refresh` | `GET /api/sync/refresh` | GET | `sync.api.refresh` | `sync.refresh_service` | `database.repositories.employees`, `events`, `devices` | Public (kiosk) | No |
| `POST /api/sync/retry` | `POST /api/sync/retry` | POST | `sync.api.retry` | `sync.retry_service` | `database.repositories.scans` | Public (kiosk) | Yes |

---

## 6. API Routes — Kiosk Check-In

| Current Route | Python Route | Method | Controller | Service | Repository | Role | Mutating |
|---|---|---|---|---|---|---|---|
| `POST /api/kiosk/check-in/email` | `POST /api/kiosk/check-in/email` | POST | `kiosk.api.checkin_email` | `kiosk.checkin_service` | `database.repositories.attendees`, `check_in` | Public | Yes |
| `POST /api/kiosk/check-in/qr` | `POST /api/kiosk/check-in/qr` | POST | `kiosk.api.checkin_qr` | `kiosk.checkin_service` | `database.repositories.attendees`, `check_in` | Public | Yes |

---

## 7. API Routes — Employees

| Current Route | Python Route | Method | Controller | Service | Repository | Role | Mutating |
|---|---|---|---|---|---|---|---|
| `GET /api/employees` | `GET /api/employees` | GET | `admin.api.list_employees` | `admin.employee_service` | `database.repositories.employees` | Public (kiosk) | No |
| *(inline in kiosk-data)* | `POST /api/employees/cardholder` | POST | `admin.api.upsert_cardholder` | `admin.employee_service` | `database.repositories.employees` | Admin | Yes |

---

## 8. API Routes — Reports

| Current Route | Python Route | Method | Controller | Service | Repository | Role | Mutating |
|---|---|---|---|---|---|---|---|
| `GET /api/reports/export/<format>` | `GET /api/reports/export/<format>` | GET | `review.api.export_scans` | `review.export_service` | `database.repositories.scans` | Admin | No |

Query params: `eventId`, `deviceScope`, `dateFrom`, `dateTo`, `employee`, `badgeNumber`, `device`, `scanStatus`, `syncStatus`, `deviceId`
Formats: `csv`, `excel`, `pdf`

---

## 9. API Routes — Attendee Lists

| Current Route | Python Route | Method | Controller | Service | Repository | Role | Mutating |
|---|---|---|---|---|---|---|---|
| `GET /api/attendee-lists` | `GET /api/attendee-lists` | GET | `attendees.api.list_attendee_lists` | `attendees.list_service` | `database.repositories.attendee_lists` | Admin | No |
| `POST /api/attendee-lists` | `POST /api/attendee-lists` | POST | `attendees.api.create_attendee_list` | `attendees.list_service` | `database.repositories.attendee_lists` | Admin | Yes |
| `GET /api/attendee-lists/template.csv` | `GET /api/attendee-lists/template.csv` | GET | `attendees.api.csv_template` | none | none | Admin | No |
| `GET /api/attendee-lists/<id>` | `GET /api/attendee-lists/<int:list_id>` | GET | `attendees.api.get_attendee_list` | `attendees.list_service` | `database.repositories.attendee_lists` | Admin | No |
| `PUT /api/attendee-lists/<id>` | `PUT /api/attendee-lists/<int:list_id>` | PUT | `attendees.api.update_attendee_list` | `attendees.list_service` | `database.repositories.attendee_lists` | Admin | Yes |
| `POST /api/attendee-lists/<id>/activate` | `POST /api/attendee-lists/<int:list_id>/activate` | POST | `attendees.api.activate_list` | `attendees.list_service` | `database.repositories.attendee_lists` | Admin | Yes |
| `POST /api/attendee-lists/<id>/deactivate` | `POST /api/attendee-lists/<int:list_id>/deactivate` | POST | `attendees.api.deactivate_list` | `attendees.list_service` | `database.repositories.attendee_lists` | Admin | Yes |
| `GET /api/attendee-lists/<id>/attendees` | `GET /api/attendee-lists/<int:list_id>/attendees` | GET | `attendees.api.list_attendees` | `attendees.attendee_service` | `database.repositories.attendees` | Admin | No |
| `POST /api/attendee-lists/<id>/upload` | `POST /api/attendee-lists/<int:list_id>/upload` | POST | `attendees.api.upload_csv` | `attendees.csv_import` | `database.repositories.attendees` | Admin | Yes |
| `POST /api/attendee-lists/<id>/send-qr` | `POST /api/attendee-lists/<int:list_id>/send-qr` | POST | `attendees.api.send_list_qr` | `attendees.qr_service` | `database.repositories.attendees` | Admin | Yes |

---

## 10. API Routes — Individual Attendees

| Current Route | Python Route | Method | Controller | Service | Repository | Role | Mutating |
|---|---|---|---|---|---|---|---|
| `GET /api/attendees/<id>` | `GET /api/attendees/<int:attendee_id>` | GET | `attendees.api.get_attendee` | `attendees.attendee_service` | `database.repositories.attendees` | Admin | No |
| `PUT /api/attendees/<id>` | `PUT /api/attendees/<int:attendee_id>` | PUT | `attendees.api.update_attendee` | `attendees.attendee_service` | `database.repositories.attendees` | Admin | Yes |
| `DELETE /api/attendees/<id>` | `DELETE /api/attendees/<int:attendee_id>` | DELETE | `attendees.api.delete_attendee` | `attendees.attendee_service` | `database.repositories.attendees` | Admin | Yes (soft) |
| `POST /api/attendees/<id>/send-qr` | `POST /api/attendees/<int:attendee_id>/send-qr` | POST | `attendees.api.send_attendee_qr` | `attendees.qr_service` | `database.repositories.attendees` | Admin | Yes |
| `POST /api/attendees/<id>/regenerate-qr` | `POST /api/attendees/<int:attendee_id>/regenerate-qr` | POST | `attendees.api.regenerate_qr` | `attendees.qr_service` | `database.repositories.attendees` | Admin | Yes |
| `POST /api/attendees/<id>/revoke-qr` | `POST /api/attendees/<int:attendee_id>/revoke-qr` | POST | `attendees.api.revoke_qr` | `attendees.qr_service` | `database.repositories.attendees` | Admin | Yes |
| `POST /api/attendees/<id>/resend-qr` | `POST /api/attendees/<int:attendee_id>/resend-qr` | POST | `attendees.api.resend_qr` | `attendees.qr_service` | `database.repositories.attendees` | Admin | Yes |

---

## 11. Migration Notes

| # | Note |
|---|---|
| 1 | The kiosk page is currently a React SPA. In Python, replace with a Jinja2 template + vanilla JS for badge input handling, QR camera, email modal, and scan display. Keep the same visual design. |
| 2 | The offline PWA queue (IndexedDB/localStorage) is entirely client-side JS — this logic stays in JS and does not need a Python equivalent on the server. |
| 3 | `POST /api/scans` uses `sqlcmd` CLI subprocess in current app. Python must replace this with parameterized `pyodbc` queries — critical security fix. |
| 4 | The `IBADGE_API_UPSTREAM` proxy passthrough (ibadge-upstream.ts) is removed in the Python app. There is only one server. |
| 5 | The Express server (`server/`) is dev-only stub. Python replaces both the Next.js API routes and the Express stub with a single Flask server. |
| 6 | All admin-facing API mutations that are currently unprotected (any caller can create events, export data) shall gain `@require_admin` enforcement in Python. |
| 7 | The `dev-stubs/` directory (mock API responses) has no Python equivalent — integration tests shall use a real test database or mocked pyodbc. |
| 8 | `GET /api/employees` — NEEDS VALIDATION: confirm this endpoint exists as a standalone route or if it's only served through `/api/sync/refresh`. |
