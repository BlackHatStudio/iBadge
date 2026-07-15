# PYTHON_APP_STRUCTURE.md
# iBadge Python Application — Folder and File Structure

> Generated: 2026-06-19

---

## Overview

This document defines the complete folder structure for the iBadge Python replacement application. Every folder and file has a defined purpose and naming convention.

---

## Full Tree

```
PythonApp/
│
├── app/                               # Flask application package
│   │
│   ├── __init__.py                    # Empty package marker
│   ├── main.py                        # create_app() factory function
│   │                                  #   - Load config
│   │                                  #   - Init extensions (CSRF, login manager)
│   │                                  #   - Register blueprints
│   │                                  #   - Register error handlers
│   │                                  #   - Apply security headers middleware
│   │
│   ├── config.py                      # Configuration classes
│   │                                  #   - BaseConfig
│   │                                  #   - DevelopmentConfig
│   │                                  #   - TestConfig
│   │                                  #   - ProductionConfig
│   │                                  #   - load_config(env) factory
│   │
│   ├── extensions.py                  # Extension singletons
│   │                                  #   - csrf = CSRFProtect()
│   │                                  #   - login_manager = LoginManager()
│   │
│   ├── auth/                          # Admin PIN authentication
│   │   ├── __init__.py
│   │   ├── routes.py                  # GET/POST /admin/access; GET/POST /logout
│   │   ├── service.py                 # verify_pin(), grant_session(), clear_session()
│   │   │                              #   Uses bcrypt to compare PIN against AdminConfig
│   │   └── decorators.py             # @require_admin — checks Flask session
│   │
│   ├── core/                          # Cross-cutting concerns
│   │   ├── __init__.py
│   │   ├── logging_config.py          # setup_logging() — rotating file handlers
│   │   │                              #   app.log: all requests
│   │   │                              #   audit.log: admin actions, JSON format
│   │   │                              #   error.log: ERROR+ only
│   │   ├── audit.py                   # write_audit(action, user, ip, details)
│   │   │                              #   Never logs: PINs, passwords, tokens
│   │   ├── errors.py                  # ApiError class; register_error_handlers()
│   │   │                              #   404 → JSON {error: {code, message}}
│   │   │                              #   500 → sanitized message; full detail in log
│   │   ├── security.py               # apply_security_headers(app)
│   │   │                              #   X-Content-Type-Options, X-Frame-Options,
│   │   │                              #   X-XSS-Protection, CSP, Referrer-Policy
│   │   └── permissions.py            # Role constants: ROLE_ADMIN, ROLE_KIOSK
│   │
│   ├── database/                      # All database access
│   │   ├── __init__.py
│   │   ├── connection.py              # pyodbc connection pool
│   │   │                              #   get_connection() → context manager
│   │   │                              #   detect_employee_optional_columns() cached
│   │   │
│   │   ├── repositories/             # One repository file per table group
│   │   │   ├── __init__.py
│   │   │   ├── admin_config.py        # get_admin_config(), ensure_default_config()
│   │   │   ├── devices.py             # get_device(), register_device(),
│   │   │   │                          #   update_device(), set_active_event()
│   │   │   ├── employees.py           # list_employees(), upsert_employee()
│   │   │   │                          #   Dynamic optional columns
│   │   │   ├── events.py              # list_events(), get_event(), create_event(),
│   │   │   │                          #   update_event()
│   │   │   ├── scans.py               # insert_scan(), get_review_scans(filters),
│   │   │   │                          #   check_duplicate(), retry_pending()
│   │   │   ├── sync.py                # create_sync_batch(), update_batch_status()
│   │   │   ├── attendee_lists.py      # list_attendee_lists(), get_list(),
│   │   │   │                          #   create_list(), update_list(), set_active()
│   │   │   │                          #   write_audit_log()
│   │   │   ├── attendees.py           # list_attendees(), get_attendee(),
│   │   │   │                          #   create_attendee(), update_attendee(),
│   │   │   │                          #   soft_delete_attendee()
│   │   │   │                          #   create_qr_token(), revoke_qr_token(),
│   │   │   │                          #   record_qr_send()
│   │   │   └── check_in.py            # insert_check_in(), is_duplicate_check_in()
│   │   │
│   │   └── sql/                       # Optional named .sql files
│   │       └── review_scans.sql       # Complex review query (if extracted)
│   │
│   ├── modules/                       # Feature modules (Flask Blueprints)
│   │   │
│   │   ├── kiosk/                     # Public kiosk-facing routes
│   │   │   ├── __init__.py
│   │   │   ├── routes.py              # GET /, GET /registration, GET /offline
│   │   │   ├── api.py                 # POST /api/scans
│   │   │   │                          #   POST /api/kiosk/check-in/email
│   │   │   │                          #   POST /api/kiosk/check-in/qr
│   │   │   └── scan_service.py        # Badge normalization, scan creation logic,
│   │   │                              #   duplicate suppression, checkin logic
│   │   │
│   │   ├── admin/                     # Admin operations dashboard
│   │   │   ├── __init__.py
│   │   │   ├── routes.py              # GET /admin (dashboard)
│   │   │   ├── api.py                 # GET/POST/PUT /api/events
│   │   │   │                          #   GET/PUT /api/devices/current
│   │   │   │                          #   GET /api/employees
│   │   │   │                          #   POST /api/employees/cardholder
│   │   │   └── device_service.py      # Device registration, event assignment
│   │   │
│   │   ├── review/                    # Scan review and export
│   │   │   ├── __init__.py
│   │   │   ├── routes.py              # GET /admin/review
│   │   │   ├── api.py                 # GET /api/scans/review
│   │   │   │                          #   GET /api/reports/export/<format>
│   │   │   └── export.py              # build_csv(), build_pdf()
│   │   │                              #   CSV: Scan time, Badge, Employee,
│   │   │                              #     Email, Company#, Event, Device
│   │   │                              #   PDF: header + filter summary + table
│   │   │
│   │   ├── attendees/                 # Attendee list management
│   │   │   ├── __init__.py
│   │   │   ├── routes.py              # GET /admin/attendees
│   │   │   ├── api.py                 # Full /api/attendee-lists/* REST API
│   │   │   │                          #   Full /api/attendees/* REST API
│   │   │   ├── csv_import.py          # validate_csv_rows(), import_csv_rows()
│   │   │   │                          #   Returns: {rows, errors, total_rows}
│   │   │   └── qr.py                  # generate_qr_token(), hash_qr_token()
│   │   │                              #   send_qr_email() (calls notification provider)
│   │   │
│   │   └── sync/                      # Kiosk sync endpoints
│   │       ├── __init__.py
│   │       └── api.py                 # GET /api/sync/refresh
│   │                                  #   POST /api/sync/retry
│   │                                  #   POST /api/scans/sync-batch
│   │
│   ├── templates/                     # Jinja2 HTML templates
│   │   ├── base.html                  # Layout: meta, CSS links, header, footer
│   │   │                              #   Dark background (#03122b default)
│   │   │                              #   iBadge logo, nav
│   │   │                              #   Security nonce for inline scripts
│   │   │
│   │   ├── auth/
│   │   │   ├── pin_entry.html         # 4-digit PIN form
│   │   │   │                          #   CSRF token included
│   │   │   │                          #   Dark styling matching kiosk design
│   │   │   └── login.html             # Disabled login placeholder
│   │   │
│   │   ├── kiosk/
│   │   │   ├── index.html             # Kiosk page (extends base.html)
│   │   │   │                          #   Hidden badge scanner input
│   │   │   │                          #   Scan panel (badge/QR mode)
│   │   │   │                          #   Email check-in modal
│   │   │   │                          #   Recent scan display
│   │   │   │                          #   Admin access button
│   │   │   └── offline.html           # PWA offline fallback page
│   │   │
│   │   ├── admin/
│   │   │   ├── dashboard.html         # Operations control center
│   │   │   │                          #   5 panels: Kiosk, Sync, Events, Queue, Activity
│   │   │   ├── review.html            # Attendance review + filters + table + charts
│   │   │   └── attendees.html         # Attendee list management
│   │   │
│   │   └── errors/
│   │       ├── 404.html               # Not found
│   │       └── 500.html               # Internal server error
│   │
│   └── static/                        # All local static assets (no CDN)
│       ├── css/
│       │   ├── ibadge.css             # Compiled CSS (Tailwind-equivalent classes)
│       │   │                          #   OR custom CSS implementing the same design
│       │   └── ibadge-admin.css       # Admin-specific styles
│       │
│       ├── js/
│       │   ├── kiosk.js               # Badge scanner, QR camera, offline queue,
│       │   │                          #   email modal, recent scan display
│       │   ├── admin.js               # Admin dashboard modals, chart, sync controls
│       │   ├── review.js              # Filter UI, export preview modal
│       │   └── attendees.js           # Attendee list UI, CSV upload, QR status
│       │
│       ├── img/
│       │   ├── ibadge-full.png        # iBadge full logo
│       │   ├── ibadge-favicon.png     # iBadge icon / favicon
│       │   └── manifest.webmanifest   # PWA manifest
│       │
│       └── vendor/                    # Vendored third-party assets
│           ├── sw.js                  # Service worker (offline PWA)
│           └── fonts/                 # Local font files (if any)
│
├── config/                            # Configuration files (not in git except example)
│   ├── appsettings.example.ini        # Template — committed to git
│   ├── appsettings.dev.ini            # Developer local config — gitignored
│   ├── appsettings.test.ini           # Test config — gitignored or test-safe values
│   └── appsettings.prod.ini           # Production config — NEVER committed to git
│
├── deploy/                            # Deployment and service management scripts
│   ├── install_service.ps1            # Create NSSM service; set env vars
│   ├── uninstall_service.ps1          # Stop + remove NSSM service
│   ├── start_service.ps1              # Start service + verify health
│   ├── stop_service.ps1               # Graceful stop
│   ├── create_offline_package.ps1     # pip download + zip package
│   └── verify_install.ps1             # Post-install smoke check
│
├── wheelhouse/                        # Pre-downloaded Python wheels
│   ├── Flask-3.1.0-py3-none-any.whl
│   ├── ... (all dependency wheels)
│   ├── SHA256SUMS.txt                 # Integrity manifest
│   └── README.md                      # How to rebuild wheelhouse
│
├── logs/                              # Runtime logs (gitignored, created on install)
│   └── README.md                      # Placeholder for git tracking
│
├── tests/                             # Test suite
│   ├── conftest.py                    # pytest fixtures: test app, test DB conn
│   ├── unit/
│   │   ├── test_auth.py               # bcrypt compare, PIN normalization
│   │   ├── test_badge_normalization.py # Badge string normalization logic
│   │   ├── test_csv_import.py         # CSV validation: valid rows, bad rows
│   │   ├── test_qr.py                 # Token generation and hashing
│   │   └── test_export.py             # CSV/PDF builder output
│   │
│   ├── integration/
│   │   ├── test_scan_routes.py        # POST /api/scans, duplicate suppression
│   │   ├── test_check_in_routes.py    # Email + QR check-in flows
│   │   ├── test_event_routes.py       # Event CRUD
│   │   ├── test_device_routes.py      # Device register + event assignment
│   │   ├── test_attendee_routes.py    # Full attendee list + attendee CRUD
│   │   ├── test_review_routes.py      # Review filter + export
│   │   └── test_auth_routes.py        # PIN entry, session management, guard
│   │
│   └── smoke/
│       └── test_smoke.py              # All critical endpoints return 200/expected status
│
├── requirements.txt                   # Direct dependencies (not pinned)
├── requirements.lock.txt              # All pinned versions (pip freeze)
├── run.py                             # Application entry point
│                                      #   from app.main import create_app
│                                      #   from waitress import serve
│                                      #   app = create_app()
│                                      #   serve(app, host='0.0.0.0', port=config.port)
├── README.md                          # Setup, development, deployment guide
└── CHANGELOG.md                       # Version history
```

---

## Naming Conventions

| Type | Convention | Example |
|---|---|---|
| Python files | `snake_case.py` | `scan_service.py` |
| Python classes | `PascalCase` | `AttendeeListRepository` |
| Python functions | `snake_case` | `get_review_scans` |
| Python constants | `SCREAMING_SNAKE` | `DEFAULT_ADMIN_PIN` |
| Flask blueprints | `snake_case` + `_bp` suffix | `kiosk_bp`, `admin_bp` |
| Templates | `snake_case.html` | `pin_entry.html`, `dashboard.html` |
| Config sections | `[lowercase]` | `[database]`, `[server]` |
| API routes | `snake_case` with hyphens in URL | `/api/attendee-lists` |
| Static files | `kebab-case` | `kiosk.js`, `ibadge.css` |
| SQL files | `snake_case.sql` | `review_scans.sql` |

---

## Module Responsibilities Summary

| Module | Owns | Does NOT own |
|---|---|---|
| `auth/` | PIN verification, session management | Database queries (delegates to `database/`) |
| `core/` | Logging, security headers, error responses | Business logic, database access |
| `database/` | All SQL queries, connection pool | Business logic, HTTP routing |
| `modules/kiosk/` | Kiosk page rendering, scan/check-in API | Admin routes, attendee list management |
| `modules/admin/` | Dashboard rendering, event/device/employee APIs | Review, attendees, export |
| `modules/review/` | Scan review rendering, export API, export builders | Scan insertion, attendee management |
| `modules/attendees/` | Attendee list CRUD, CSV import, QR management | Badge scanning, review |
| `modules/sync/` | Kiosk sync endpoints (refresh, retry, batch) | Admin functions |
| `templates/` | HTML rendering only | Business logic (no Jinja filters with logic) |
| `static/` | Local assets only | Remote/CDN assets |

---

## Key Design Rules

1. **Templates contain no business logic** — all data is passed from the route handler.
2. **Repositories contain all SQL** — no raw SQL in routes, services, or templates.
3. **Services orchestrate** — call repositories, apply business rules, return results to routes.
4. **Routes handle HTTP** — parse request, call service, return response/render template.
5. **No CDN dependencies** — every CSS class, JS library, font, and icon must be in `static/`.
6. **No subprocess SQL** — all DB access via pyodbc with parameterized queries.
7. **Audit every admin mutation** — every write action by an admin must call `core/audit.py`.
8. **Config from files, not hardcoded** — no values that differ between environments in source code.
