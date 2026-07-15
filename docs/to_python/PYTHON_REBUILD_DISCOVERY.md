# PYTHON_REBUILD_DISCOVERY.md
# iBadge — Full Application Discovery Inventory

> Generated: 2026-06-19 | Source: `/home/ccc/devsolutions/Attendi`

---

## 1. Project Identity

| Field | Value |
|---|---|
| App name | iBadge Attendance Kiosk |
| Internal codename | Attendi |
| Framework | Next.js 15 (App Router, standalone output) |
| Language | TypeScript 5.x |
| UI | React 19 + TailwindCSS 4 + Radix UI primitives |
| Node version required | ≥ 20.9.0 |
| npm version required | ≥ 10.0.0 |
| Production port (webapp) | 3000 (Next.js) |
| Production port (API stub server) | 4000 (Express — dev only) |
| Database | SQL Server (mssql driver v12) |
| PWA | Yes — service worker + offline cache |

---

## 2. Entry Points

| Entry | Path | Purpose |
|---|---|---|
| Next.js webapp | `npm run start` → `next start` | Serves full SSR + API routes |
| Express API stub | `npm run server:dev` → `cd server && npm run dev` | Dev-only JWT token stub (not used in production) |
| Built artifact | `deployment/output/iBadge-iis-package/` | Static Next.js build + standalone server |
| IIS deployment | `web.config` reverse proxy + `run-webapp.cmd` | Proxies `/api/*` to Node, serves static assets |

---

## 3. Environment Variables

### Webapp (.env / runtime-config.js)

| Variable | Purpose |
|---|---|
| `NEXT_PUBLIC_IBADGE_API_BASE_URL` | Browser-side API base (empty = same origin) |
| `NEXT_PUBLIC_IBADGE_REFERENCE_REFRESH_HOURS` | How often kiosk refreshes employee cache (default 12) |
| `NEXT_PUBLIC_IBADGE_QUEUE_RETRY_MINUTES` | Offline queue retry interval (default 2) |
| `NEXT_PUBLIC_IBADGE_DUPLICATE_WINDOW_SECONDS` | Duplicate scan suppression window client-side (default 30) |
| `SQLSERVER_HOST` | SQL Server hostname or IP |
| `SQLSERVER_DATABASE` | Database name (default: ibadge) |
| `SQLSERVER_USER` | SQL login user |
| `SQLSERVER_PASSWORD` | SQL login password |
| `SQLSERVER_ENCRYPT` | TLS encryption (true/false) |
| `SQLSERVER_TRUST_SERVER_CERTIFICATE` | Trust self-signed cert (true/false) |
| `ATTENDEE_SQLSERVER_CONNECTION_STRING` | Full connection string (overrides individual fields) |
| `ATTENDEE_NOTIFICATION_PROVIDER` | MOCK or real provider for QR email sends |
| `ATTENDEE_QR_BASE_URL` | Base URL embedded in QR codes sent to attendees |
| `ATTENDEE_QR_CHECKIN_PATH` | Path appended to base URL for QR check-in (default: /kiosk/check-in) |
| `IBADGE_API_UPSTREAM` | When set, all Next.js `/api/*` calls proxy to this base URL |
| `IBADGE_SQLCMD_SERVER` | Override sqlcmd server (falls back to server/.env) |
| `IBADGE_SQLCMD_DATABASE` | Override sqlcmd database |
| `IBADGE_SQLCMD_USERNAME` | Override sqlcmd username |
| `IBADGE_SQLCMD_PASSWORD` | Override sqlcmd password |

### API server (server/.env)

| Variable | Purpose |
|---|---|
| `PORT` | Express port (default 4000) |
| `TRUST_PROXY` | Whether to trust reverse proxy headers |
| `IBADGE_VERSION` | App version string |
| `JWT_SECRET` | JWT signing key |
| `IBADGE_ENVIRONMENT` | Production / Development |
| `IBADGE_KIOSK_DB_CONNECTION_STRING` | Kiosk database connection |
| `IBADGE_ACCESS_CONTROL_DB_CONNECTION_STRING` | Employee/access-control source database |
| `IBADGE_EXPORT_ROOT` | Directory for export files |
| `IBADGE_LOG_ROOT` | Directory for log files |
| `IBADGE_DUPLICATE_WINDOW_SECONDS` | Server-side duplicate suppression window |
| `IBADGE_IMPORT_INTERVAL_HOURS` | Automated employee import interval |
| `IBADGE_ADMIN_PIN_HASH` | Bcrypt hash of admin PIN |

---

## 4. All Pages / Routes

### Frontend Pages

| Route | File | Purpose | Access |
|---|---|---|---|
| `/` | `src/app/page.tsx` → `KioskPage` | Badge attendance kiosk screen | Public |
| `/registration` | `src/app/registration/page.tsx` → `KioskPage` | Alternate kiosk entry (same UI) | Public |
| `/offline` | `src/app/offline/page.tsx` | Offline fallback page (PWA) | Public |
| `/login` | `src/app/login/page.tsx` | Operator login stub (disabled, placeholder only) | Public |
| `/admin` | `src/app/admin/page.tsx` → `AdminPage` | Operations control center | PIN-gated (AdminGuard) |
| `/admin/access` | `src/app/admin/access/page.tsx` → `PinEntryForm` | 4-digit PIN entry gate | Public |
| `/admin/review` | `src/app/admin/review/page.tsx` → `ReviewPage` | Scan review + export | PIN-gated (AdminGuard) |
| `/admin/attendees` | `src/app/admin/attendees/page.tsx` → `AttendeesPage` | Attendee list management | PIN-gated (AdminGuard) |

### Page Detail: `/` (Kiosk)

- **Purpose:** Badge scan attendance kiosk. Full-screen, always-on display.
- **Scan modes:** Badge reader (USB HID, hidden input), Camera QR scan (BarcodeDetector API), Email check-in modal.
- **Data sources:** Employee list (cached in IndexedDB/localStorage), Events (cached), Device config.
- **API calls:** `POST /api/kiosk/check-in/email`, `POST /api/kiosk/check-in/qr`, `POST /api/scans`, `GET /api/sync/refresh`.
- **State:** Loads on mount, auto-retries pending queue every N minutes, reconnect handler.
- **UI elements:** iBadge logo, event name heading, scan panel (badge mode / QR camera), alternate check-in buttons (email, QR), recent scan card, admin access button, footer.
- **Offline behavior:** Scans stored locally in pending queue; synced when online.
- **Auth:** None required. Admin access button leads to PIN entry.

### Page Detail: `/admin` (Operations Control Center)

- **Purpose:** Admin dashboard — device config, event management, employee cache controls, sync operations.
- **Access guard:** `AdminGuard` checks `sessionStorage` for valid `ibadge.adminSession` token (8h TTL).
- **Panels:**
  - Active Kiosk: device name, ID, event, status (online/offline)
  - Sync Controls: employee count, add cardholder, view employee list, refresh cache, retry queue
  - Event Management: create events, activate/deactivate, edit via modal
  - Queue Snapshot: pending scan count, pending items table
  - Recent Device Activity: scan activity feed
- **Modals:** Employee list, Scan list, Event list, Event editor, Add cardholder
- **API calls:** Event CRUD, device config updates, employee upsert, refresh/retry.

### Page Detail: `/admin/review` (Attendance History)

- **Purpose:** Review all attendance scans with filtering, summaries, charts, and export.
- **Filters:** Event, date range (from/to), device, employee name/EmpID, badge number, scan status, sync status, device scope (current vs all).
- **Summary cards:** Total scans, Unique employees, Devices, Export ready.
- **Charts:** Bar chart — attendance by event.
- **Exports:** CSV, Excel (CSV with Excel MIME), PDF (via pdf-lib).
- **Export preview modal:** Inline preview before download.
- **Pagination:** Client-side (10 per page).
- **API calls:** `GET /api/scans/review`, `GET /api/reports/export/{format}`.

### Page Detail: `/admin/attendees` (Attendee List Management)

- **Purpose:** Manage attendee lists for QR-based check-in workflows.
- **Features:**
  - Create/activate/deactivate attendee lists
  - View attendees within a list
  - Add individual attendees (form modal)
  - Edit attendees
  - Delete attendees (soft delete)
  - CSV bulk upload (with validation)
  - Download CSV template
  - Send QR code to all attendees in a list
  - Send QR to individual attendee
  - Revoke QR token
  - Regenerate QR token
  - View QR send status per attendee
- **API calls:** Full CRUD on `/api/attendee-lists` and `/api/attendees`.

### Page Detail: `/admin/access` (PIN Entry)

- **Purpose:** 4-digit PIN entry gate for admin access.
- **Behavior:** Verifies PIN remotely (`POST /api/admin/pin/verify`), with local fallback when offline.
- **Session:** On success, writes `ibadge.adminSession` with 8h expiry to `sessionStorage`.
- **Redirect:** Returns to `returnTo` query param path (default: `/admin`).

---

## 5. All API Endpoints

### Admin / Auth

| Method | Path | Purpose | DB Tables | Auth |
|---|---|---|---|---|
| `POST` | `/api/admin/pin/verify` | Verify 4-digit admin PIN (bcrypt) | `dbo.AdminConfig` | None |

### Devices

| Method | Path | Purpose | DB Tables | Auth |
|---|---|---|---|---|
| `POST` | `/api/devices/register` | Register or update a kiosk device | `dbo.Device`, `dbo.DeviceAssignment`, `dbo.Event` | None |
| `GET` | `/api/devices/current` | Get current device record | `dbo.Device`, `dbo.DeviceAssignment`, `dbo.Event` | None |
| `PUT` | `/api/devices/current` | Update current device (name, assignment) | `dbo.Device`, `dbo.DeviceAssignment` | None |
| `PUT` | `/api/devices/current/event` | Assign device to event | `dbo.DeviceAssignment` | None |

### Events

| Method | Path | Purpose | DB Tables | Auth |
|---|---|---|---|---|
| `GET` | `/api/events` | List all events | `dbo.Event` | None |
| `POST` | `/api/events` | Create new event | `dbo.Event` | None |
| `PUT` | `/api/events/{eventId}` | Update event name/active state | `dbo.Event` | None |
| `GET` | `/api/events/{eventId}/attendance-settings` | Get attendance settings | `dbo.EventAttendanceSetting` | None |
| `GET/PUT` | `/api/events/{eventId}/attendee-lists` | Manage event→attendee list associations | `dbo.EventAttendeeList` | None |

### Scans / Sync

| Method | Path | Purpose | DB Tables | Auth |
|---|---|---|---|---|
| `POST` | `/api/scans` | Record a badge scan | `dbo.BadgeScan`, `dbo.Device`, `dbo.Employee`, `dbo.Event` | None |
| `POST` | `/api/scans/sync-batch` | Batch sync offline scans | `dbo.BadgeScan`, `dbo.SyncBatch`, `dbo.Device` | None |
| `GET` | `/api/scans/review` | Get filtered scans for review | `dbo.BadgeScan`, `dbo.Device`, `dbo.Employee`, `dbo.Event` | None |
| `GET` | `/api/sync/refresh` | Get full reference data (employees + events + device) | `dbo.Employee`, `dbo.Event`, `dbo.Device` | None |
| `POST` | `/api/sync/retry` | Retry all PENDING/FAILED scans for device | `dbo.BadgeScan` | None |

### Kiosk Check-In

| Method | Path | Purpose | DB Tables | Auth |
|---|---|---|---|---|
| `POST` | `/api/kiosk/check-in/email` | Check in by email address | `dbo.Attendee`, `dbo.AttendeeList`, `dbo.EventAttendeeList`, `dbo.EventAttendanceSetting`, `dbo.AttendanceCheckIn` | None |
| `POST` | `/api/kiosk/check-in/qr` | Check in by QR token | `dbo.AttendeeQrToken`, `dbo.Attendee`, `dbo.AttendeeList`, `dbo.EventAttendanceSetting`, `dbo.AttendanceCheckIn` | None |

### Employees

| Method | Path | Purpose | DB Tables | Auth |
|---|---|---|---|---|
| `GET` | `/api/employees` | List all employees for kiosk cache | `dbo.Employee` | None |
| `POST/PUT` | (via kiosk-data) | Upsert employee cardholder | `dbo.Employee` | None |

### Reports / Export

| Method | Path | Purpose | DB Tables | Auth |
|---|---|---|---|---|
| `GET` | `/api/reports/export/{format}` | Export scans as CSV, Excel, or PDF | `dbo.BadgeScan`, `dbo.Device`, `dbo.Employee`, `dbo.Event` | None |

### Attendee Lists

| Method | Path | Purpose | DB Tables | Auth |
|---|---|---|---|---|
| `GET` | `/api/attendee-lists` | List all attendee lists | `dbo.AttendeeList`, `dbo.Attendee`, `dbo.AttendeeListUploadBatch` | None |
| `POST` | `/api/attendee-lists` | Create attendee list | `dbo.AttendeeList` | None |
| `GET` | `/api/attendee-lists/template.csv` | Download CSV upload template | None | None |
| `GET` | `/api/attendee-lists/{id}` | Get attendee list detail | `dbo.AttendeeList` | None |
| `PUT` | `/api/attendee-lists/{id}` | Update attendee list | `dbo.AttendeeList`, `dbo.AttendeeListAuditLog` | None |
| `POST` | `/api/attendee-lists/{id}/activate` | Activate list | `dbo.AttendeeList`, `dbo.AttendeeListAuditLog` | None |
| `POST` | `/api/attendee-lists/{id}/deactivate` | Deactivate list | `dbo.AttendeeList`, `dbo.AttendeeListAuditLog` | None |
| `GET` | `/api/attendee-lists/{id}/attendees` | Get attendees in list | `dbo.Attendee`, `dbo.AttendeeQrToken` | None |
| `POST` | `/api/attendee-lists/{id}/upload` | CSV bulk upload | `dbo.Attendee`, `dbo.AttendeeListUploadBatch`, `dbo.AttendeeListAuditLog` | None |
| `POST` | `/api/attendee-lists/{id}/send-qr` | Send QR to all in list | `dbo.AttendeeQrToken`, `dbo.Attendee` | None |

### Attendees

| Method | Path | Purpose | DB Tables | Auth |
|---|---|---|---|---|
| `GET` | `/api/attendees/{id}` | Get single attendee | `dbo.Attendee`, `dbo.AttendeeQrToken` | None |
| `PUT` | `/api/attendees/{id}` | Update attendee | `dbo.Attendee`, `dbo.AttendeeListAuditLog` | None |
| `DELETE` | `/api/attendees/{id}` | Soft delete attendee | `dbo.Attendee`, `dbo.AttendeeListAuditLog` | None |
| `POST` | `/api/attendees/{id}/send-qr` | Send QR to individual attendee | `dbo.AttendeeQrToken` | None |
| `POST` | `/api/attendees/{id}/regenerate-qr` | Revoke + create new QR token | `dbo.AttendeeQrToken`, `dbo.AttendeeListAuditLog` | None |
| `POST` | `/api/attendees/{id}/revoke-qr` | Revoke QR token | `dbo.AttendeeQrToken`, `dbo.AttendeeListAuditLog` | None |
| `POST` | `/api/attendees/{id}/resend-qr` | Re-send existing QR | `dbo.AttendeeQrToken` | None |

---

## 6. Database Layer Summary

### Database Connectivity

The application uses **two separate SQL mechanisms**:

1. **`sqlcmd` CLI subprocess** — used by `ibadge-db.ts` and `ibadge-events-sql.ts` for kiosk-core badge scan operations. Reads connection config from environment or `server/.env`. This is a security risk (subprocess with shell credentials passed as arguments).

2. **`mssql` npm package (connection pool)** — used by `sql-executor.ts` for all attendee list operations. Uses parameterized queries via `mssql` native driver. More secure and appropriate.

### Tables Referenced

| Table | Schema | Operations |
|---|---|---|
| `dbo.AdminConfig` | ibadge | SELECT, INSERT (ensure) |
| `dbo.Event` | ibadge | SELECT, INSERT, UPDATE |
| `dbo.Device` | ibadge | SELECT, INSERT, UPDATE |
| `dbo.DeviceAssignment` | ibadge | SELECT, INSERT, UPDATE |
| `dbo.Employee` | ibadge | SELECT, INSERT, UPDATE (upsert by badge) |
| `dbo.BadgeScan` | ibadge | SELECT, INSERT, UPDATE |
| `dbo.SyncBatch` | ibadge | SELECT, INSERT, UPDATE |
| `dbo.AttendeeList` | ibadge | SELECT, INSERT, UPDATE |
| `dbo.Attendee` | ibadge | SELECT, INSERT, UPDATE (soft delete) |
| `dbo.AttendeeQrToken` | ibadge | SELECT, INSERT, UPDATE |
| `dbo.AttendeeListUploadBatch` | ibadge | SELECT, INSERT, UPDATE |
| `dbo.AttendeeListAuditLog` | ibadge | INSERT |
| `dbo.EventAttendeeList` | ibadge | SELECT, INSERT |
| `dbo.EventAttendanceSetting` | ibadge | SELECT |
| `dbo.AttendanceCheckIn` | ibadge | SELECT, INSERT |

### Dynamic Column Detection

The app queries `sys.columns` at startup to detect optional Employee columns:
- `Email` — optional, used if present
- `CompanyNum` — optional, displayed as company/floor reference
- `Floor` — optional, preferred over CompanyNum if present

---

## 7. Authentication and Authorization

### Current Model (No Traditional Auth)

The application has **no user authentication** in the traditional sense. The "login" page is a disabled placeholder.

**Admin access** is controlled by a **4-digit PIN**:
- PIN hash stored in `dbo.AdminConfig.PinHash` (bcrypt, 10 rounds)
- Default PIN: `5657`
- Verification: `POST /api/admin/pin/verify` (remote, with offline fallback to locally cached PIN)
- Session: `sessionStorage.ibadge.adminSession` — JSON with `expiresAt` timestamp (8 hours)
- No JWT, no cookies for admin (session storage only)
- `AdminGuard` component checks session on every render

**Kiosk operation** requires no authentication — the kiosk screen is fully public.

### Security Issues Observed

| Issue | Location | Severity |
|---|---|---|
| `sqlcmd` subprocess passes credentials as command-line arguments | `ibadge-db.ts` | HIGH — credentials visible in process list |
| All API routes have zero authentication requirement | All `/api/*` routes | HIGH — anyone can call admin/export APIs |
| No CSRF protection on any POST endpoint | All mutation routes | MEDIUM |
| Admin PIN default `5657` with no forced change | `ibadge-db.ts` | MEDIUM |
| Session storage for admin session (cleared on tab close) | `admin-access.ts` | LOW (by design) |
| String interpolation in SQL queries (sqlcmd path) | `ibadge-db.ts` | HIGH — SQL injection risk in filter fields |

---

## 8. Frontend Design System

### Color Palette

| Token | Value | Usage |
|---|---|---|
| Background dark | `#03122b`, `#031225`, `#020b1b` | Page backgrounds |
| Panel background | `#071a33`, `#041632` | Card/panel fills |
| Accent primary | `#25b8ff` / `cyan-300` | Borders, glows, highlights |
| Text primary | `#f4f7fb` / white | Headings, primary text |
| Text muted | `white/60`–`white/78` | Secondary labels |
| Success | `emerald-300` / `emerald-400` | Scan matched, synced |
| Warning/Pending | `amber-300` / `amber-400` | Pending sync, unknown |
| Info | `cyan-200` / `cyan-300` | Info states |
| Danger | `rose-300` | Errors, revoked |

### Layout

- Kiosk page: full-screen, centered, single column, max-width 900px
- Admin pages: max-width 1440px, grid layout with 1–2 columns
- Responsive breakpoints: `sm:` (640px), `lg:`, `xl:` (1280px)

### Component Patterns

- **Buttons:** `GlowButton` (cyan-400 fill), `OutlineGlowButton` (dark outline)
- **Cards/Panels:** `PanelCard` — rounded-[1.6rem], dark background, subtle cyan border + inset glow
- **Status Pills:** Color-coded badges (success/info/pending/muted)
- **Modals:** Fixed overlay, backdrop blur, dark card
- **Tables:** Dark headers, white/8 row dividers, hover states
- **Forms:** Tall inputs (h-12 to h-16), rounded-2xl, dark fill

### Icons

All icons from `lucide-react`. Must be vendored locally in Python app.

---

## 9. Deployment (Current Production)

### Windows Server + IIS

1. **Build:** `npm run build:all` produces `deployment/output/iBadge-iis-package/`
2. **IIS site:** Serves static Next.js standalone build from `app/` directory
3. **web.config:** URL rewrite rules:
   - `^api/(.*)` → reverse proxy to `http://127.0.0.1:{API_PORT}/api/{R:1}` (Node process)
   - All other routes → SPA rewrite to `index.html`
4. **Node process:** `run-webapp.cmd` or Windows Service via `iBadge.WebApp.xml` (WinSW/NSSM)
5. **API service:** Express server registered as Windows Service via `iBadge.ApiService.xml`
6. **Logs:** Written to `IBADGE_LOG_ROOT`
7. **Exports:** Written to `IBADGE_EXPORT_ROOT`

### Installer

- Inno Setup installer: `deployment/installer/iBadgeWebAppInstaller.iss`
- Kiosk installer: `deployment/installer/KioskAttendanceInstaller.iss`

---

## 10. PWA / Offline Behavior

- Service worker registered at `/sw.js`
- Manifest at `/manifest.webmanifest`
- Employees and events cached in `localStorage` / IndexedDB
- Scans queued locally when offline, synced when reconnected
- Auto-retry interval every `NEXT_PUBLIC_IBADGE_QUEUE_RETRY_MINUTES` minutes
- Offline page served for navigation failures

---

## 11. Open Items / NEEDS VALIDATION

| # | Item |
|---|---|
| 1 | Confirm exact SQL Server version in production |
| 2 | Confirm whether Windows Authentication (trusted connection `-E`) or SQL auth is used in production |
| 3 | Confirm whether `ATTENDEE_NOTIFICATION_PROVIDER` has a real email implementation or is always MOCK |
| 4 | Confirm production port configuration (IIS binding, Node port) |
| 5 | Confirm whether `/api/employees` route has its own handler or uses sync/refresh |
| 6 | Confirm full column list of `dbo.Employee` in production (Email, CompanyNum, Floor) |
| 7 | Confirm `dbo.EventAttendanceSetting` schema and which events have records |
| 8 | `AttendanceCheckIn.KioskID` vs `AttendeeID` — confirm FK schema |
| 9 | Confirm QR token expiry rules in production (`ExpiresAtUtc` always null?) |
| 10 | Confirm `SyncBatch` table usage — is it used for reporting? |
| 11 | Login page is a stub — confirm whether full user auth is a requirement for the Python replacement |
| 12 | Confirm if `IBADGE_API_UPSTREAM` proxy is used in production or only for dev |
