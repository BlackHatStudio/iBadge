# Windows Server 2022 Deployment Package And Backend Support Plan

## Scope

This deployment target is:

- Windows Server 2022
- static Next.js front end served by IIS
- separate backend API bundled in the same EXE installer
- SQL Server dedicated kiosk database on the internal network
- browser clients on iPads and PCs
- no end-user login system
- admin access protected by PIN only
- read-only review and export workflows

This plan is written against the current repo state:

- the front end already contains kiosk, admin, review, PWA, IndexedDB queueing, and placeholder `/api/*` route handlers
- `server/src/index.ts` is still a stub and must become the production API/service
- `next.config.ts` currently avoids `output: "export"` because the Next app still owns API routes

Production packaging therefore requires one explicit architectural change:

1. Move all production API responsibility into the `server` service.
2. Build the Next.js app as a static export for IIS.
3. Replace build-time `NEXT_PUBLIC_*` runtime dependencies with an externally written runtime config file.

## 1. Deployment Package Architecture

Recommended deliverable contents for the installer build:

```text
installer/
  iBadge-Setup.exe
  payload/
    frontend/
      out/                         # static Next.js export
      web.config                   # IIS static + SPA fallback + /api reverse proxy rules
      runtime-config.template.js   # installer writes runtime-config.js from this template
    backend/
      node-runtime/                # bundled Node runtime, or packaged backend executable
      dist/                        # compiled server output
      node_modules/                # production dependencies only
      service/
        iBadge.ApiService.exe      # WinSW wrapper or equivalent service host
        iBadge.ApiService.xml
      jobs/
        employee-import-runner.js  # or compiled runner entrypoint
        run-import.cmd
    sql/
      kiosk-schema.sql
      create-database.sql
      preflight.sql
    scripts/
      validate-prereqs.ps1
      install-iis-features.ps1
      configure-iis.ps1
      configure-service.ps1
      run-sql.ps1
      create-folders.ps1
      smoke-test.ps1
```

Required build outputs before packaging:

- front end static export folder
- compiled backend service output
- SQL schema/object script supplied by the project
- IIS `web.config`
- backend service wrapper files
- import runner entrypoint

## 2. Installer Strategy Recommendation

### Primary Recommendation

Use **Advanced Installer** as the EXE installer technology.

Why it is the best fit here:

- strong support for EXE bootstrapper packaging on Windows Server
- good IIS site, app pool, service, registry, environment, and prerequisite handling
- upgrade and maintenance flows are better than hand-rolled script orchestration
- can preserve config/data across upgrades using component rules and permanent resources
- easier to support future EXE-based upgrades and upgrade-in-place execution
- better operationally for enterprise Windows deployment than a script-only installer

### Acceptable Alternative

Use **Inno Setup** if Advanced Installer is not available.

Why it is acceptable:

- reliable EXE packaging
- good scripted control over IIS, service install, SQL execution, and upgrade prompts
- lower licensing cost

Tradeoff:

- more custom scripting and more maintenance burden for IIS/service/upgrade logic

### Installer Requirements To Enforce

The installer must do all of the following:

- validate Windows Server 2022
- validate Node runtime packaging presence if backend is not self-contained
- validate SQL connectivity before schema execution
- validate or install IIS role/features required for static hosting
- validate or install IIS URL Rewrite and ARR if `/api` reverse proxy is used
- deploy the static Next.js output to the IIS physical path
- deploy the backend API service binaries
- write externalized frontend and backend configuration files
- configure IIS site, app pool, bindings, default document, and rewrite rules
- prompt for or import SQL connection settings
- optionally create a dedicated database, then run the supplied SQL object script
- create config, log, temp, and export directories
- create the scheduled import task
- preserve config, export files, and database connection settings across upgrades
- support upgrade-in-place from future EXE releases
- never destructively overwrite config or recreate the database unless explicitly confirmed

## 3. IIS Deployment Layout

### Recommended Hosting Model

Use one IIS site for the front end and reverse proxy `/api/*` to a local backend service.

Reason:

- browser clients use same-origin requests
- no CORS surface for kiosk/admin/review calls
- simpler iPad and PC browser configuration
- frontend static hosting stays in IIS
- backend remains independently restartable and upgradable as a Windows service

### IIS Design

Recommended site characteristics:

- Site name: `iBadge`
- App pool: `iBadgeStaticPool`
- .NET CLR: `No Managed Code`
- Managed pipeline: `Integrated`
- Physical path: `C:\Program Files\iBadge\current\frontend`
- Bindings:
  - `https://attendance.company.local` preferred
  - `http://servername` only for initial validation if TLS is not ready

Required IIS features/components:

- Web Server (IIS)
- Static Content
- Default Document
- HTTP Errors
- Request Filtering
- URL Rewrite 2.1
- Application Request Routing 3.x

### Frontend `web.config` Responsibilities

`web.config` must:

- serve static files from the exported Next.js output
- rewrite non-file/non-directory requests to `/index.html` or the exported route fallback as required
- reverse proxy `/api/*` to `http://127.0.0.1:4100/api/*`
- optionally expose `/healthz/api` to the local backend health endpoint
- disable caching for `runtime-config.js`
- allow caching for hashed static assets

### Production Requirement For This Repo

The current Next app still uses `src/app/api/**` route handlers as dev stubs. For IIS static hosting, production must:

- remove production dependence on those handlers
- build with static export
- point the browser only at the separate backend API through IIS `/api`

## 4. Backend API Deployment Layout

### Recommended Model

Host the backend as a Windows service on the same server, listening on localhost only.

Recommended runtime:

- Node 20 LTS bundled with the installer and wrapped as a Windows service using **WinSW**

Reason:

- compatible with the current `server` TypeScript/Express codebase
- avoids IIS Node hosting complexity
- isolates backend process restarts from IIS
- supports predictable service recovery and logging
- easy to replace binaries during EXE upgrades

### Backend Service Layout

```text
C:\Program Files\iBadge\current\backend\
  dist\
  node\
  node_modules\
  service\
    iBadge.ApiService.exe
    iBadge.ApiService.xml
  jobs\
    employee-import-runner.js
    run-import.cmd
```

Windows service characteristics:

- Service name: `iBadgeApiService`
- Listen address: `127.0.0.1`
- Port: `4100`
- Startup type: `Automatic`
- Recovery: restart on first and second failure
- Service account:
  - preferred: dedicated domain or local service account with read/write access to `ProgramData\iBadge`
  - database permissions granted explicitly for kiosk DB and read-only source DB

### Backend Responsibilities

The backend service owns all server-side logic:

- device registration and current device configuration
- admin PIN verification and admin session issuance
- event CRUD except delete/void
- scan insert
- offline batch sync
- scan review query execution
- CSV/Excel/PDF export generation
- employee refresh/manual import trigger
- sync retry handling
- duplicate suppression enforcement
- DeviceScanGuid idempotency enforcement

## 5. Configuration Model

### Required Change For Static IIS Hosting

The current front end reads `NEXT_PUBLIC_*` values at build time. That is not sufficient for a static IIS deployment that must support EXE-based upgrades and environment-specific installation.

Implement runtime configuration loading instead.

### Recommended Frontend Runtime Config

Installer writes:

`C:\Program Files\iBadge\current\frontend\runtime-config.js`

Example:

```js
window.__IBADGE_CONFIG__ = {
  apiBaseUrl: "/api",
  referenceRefreshHours: 12,
  queueRetryMinutes: 2,
  duplicateWindowSeconds: 30,
  kioskTitle: "Attendance Kiosk"
};
```

Implementation requirement:

- load `runtime-config.js` before the app boots
- update `src/lib/app-config.ts` to read `window.__IBADGE_CONFIG__`
- preserve `runtime-config.js` across upgrades unless the installer is explicitly told to overwrite it

### Recommended Backend Config

Installer writes:

`C:\ProgramData\iBadge\config\backend.json`

Example values:

```json
{
  "server": {
    "host": "127.0.0.1",
    "port": 4100,
    "trustedProxy": false
  },
  "database": {
    "kioskConnectionString": "Server=SQL01;Database=iBadgeKiosk;User Id=...;Password=...;Encrypt=True;TrustServerCertificate=True;",
    "accessControlConnectionString": "Server=SQL01;Database=AccessControl;User Id=...;Password=...;Encrypt=True;TrustServerCertificate=True;"
  },
  "security": {
    "adminPinHash": "<bcrypt hash>",
    "adminSessionMinutes": 480
  },
  "imports": {
    "defaultCadenceMinutes": 60,
    "commandTimeoutSeconds": 180,
    "batchSize": 5000
  },
  "exports": {
    "rootPath": "C:\\ProgramData\\iBadge\\exports",
    "maxRows": 50000
  },
  "logging": {
    "rootPath": "C:\\ProgramData\\iBadge\\logs"
  },
  "rules": {
    "duplicateWindowSeconds": 30
  }
}
```

### Required Config Values

Frontend:

- `apiBaseUrl`
- `referenceRefreshHours`
- `queueRetryMinutes`
- `duplicateWindowSeconds`

Backend:

- kiosk DB connection string
- access control source DB connection string
- admin PIN hash
- duplicate suppression window
- API listen port
- export directory
- log directory
- import timeout/batch settings
- optional TLS/public URL metadata for generated links

Operational rule:

- all mutable config lives outside the versioned release folder
- config files are preserved across upgrades

## 6. Scheduled Task / Import Job Design

### Recommendation

Use **Windows Task Scheduler** for the hourly employee import job, not an in-process timer inside the API.

Reason:

- survives API service restarts independently
- easier to inspect and rerun operationally
- easy for the installer to create/update
- easier to support future EXE-based upgrades without scheduler drift

### Job Design

Task name:

- `iBadge Employee Import`

Schedule:

- hourly by default

Execution target:

- `C:\Program Files\iBadge\current\backend\jobs\run-import.cmd`

Concurrency rule:

- no concurrent import runs
- enforce via DB lock row, SQL application lock, or OS mutex

### Import Behavior

Source:

- internal access control SQL Server database

Destination:

- kiosk database `Employee` table

Sync rules:

- upsert by stable employee key or normalized badge number per source contract
- refresh `EmployeeName`, `BadgeNumberRaw`, `BadgeNumberNormalized`, `EmpID`, `LastUpdatedUTC`
- mark employees missing from the source snapshot as `IsActive = 0`
- never hard delete missing employees

Audit logging:

- one row per run in `ImportRun`
- record start/end UTC
- record status: `STARTED`, `SUCCEEDED`, `FAILED`, `PARTIAL`
- record inserted/updated/inactivated/error counts
- store error summary and runtime duration

### Manual Trigger

Admin/API must support manual refresh:

- `POST /api/employee-import/run`
- returns job acceptance and current state
- if a run is already active, return the active run id and status instead of starting a second one

Status endpoint:

- `GET /api/employee-import/status`
- returns last run, current run, counts, and last success UTC

Implementation requirement:

- scheduled task and manual API must call the same import module
- do not maintain two separate import implementations

## 7. Upgrade-Safe File And Folder Layout

### Recommended Layout

```text
C:\Program Files\iBadge\
  current\                       # junction or fixed pointer to active release
    frontend\
    backend\
  releases\
    1.0.0\
      frontend\
      backend\
    1.1.0\
      frontend\
      backend\

C:\ProgramData\iBadge\
  config\
    backend.json
  logs\
    api\
    import\
    installer\
  exports\
    csv\
    excel\
    pdf\
  temp\
  backup\
    pre-upgrade\
```

### Rules

- binaries are versioned under `Program Files`
- mutable data is stored only under `ProgramData`
- IIS site points to `C:\Program Files\iBadge\current\frontend`
- backend service wrapper points to `C:\Program Files\iBadge\current\backend`
- upgrades install a new release folder, update `current`, restart IIS/service, and preserve `ProgramData`

If a `current` junction is not desired, use fixed `frontend` and `backend` paths, but rollback becomes weaker.

## 8. Backend Endpoint Contract

All database operations are backend-only. The browser never talks to SQL Server directly.

### Health

`GET /health`

Purpose:

- service liveness for installer smoke tests and monitoring

Response:

```json
{
  "ok": true,
  "service": "iBadge API",
  "version": "1.0.0"
}
```

### Admin PIN

`POST /api/admin/pin/verify`

Purpose:

- verify PIN and issue a short-lived admin session token/cookie for admin-only endpoints

Request:

```json
{
  "pin": "5657",
  "deviceId": "KIOSK-001"
}
```

Response:

```json
{
  "authorized": true,
  "expiresUtc": "2026-03-24T22:00:00Z"
}
```

Server rules:

- compare against stored hash, not plaintext
- rate limit repeated failures per IP/device
- admin session required for event creation, review export, import trigger, and retry actions

### Devices

`GET /api/devices/current?deviceId=...&deviceGuid=...`

Purpose:

- return current device registration and active event assignment

`POST /api/devices/register`

Purpose:

- register a device if it does not already exist

`PUT /api/devices/current`

Purpose:

- update device display name and mutable device metadata

`PUT /api/devices/current/event`

Purpose:

- change the active event for the current device

Response shape for device endpoints:

```json
{
  "DeviceId": "KIOSK-001",
  "DeviceGuid": "6f9d8d5b-....",
  "DeviceName": "North Lobby iPad",
  "ActiveEventId": "event-guid",
  "ActiveEventName": "Safety Training",
  "RegisteredUTC": "2026-03-24T15:00:00Z",
  "LastUpdatedUTC": "2026-03-24T15:30:00Z"
}
```

### Events

`GET /api/events`

Purpose:

- return active/inactive event catalog for kiosk/admin pages

`POST /api/events`

Purpose:

- create a new event

Request:

```json
{
  "eventName": "Safety Training"
}
```

Response:

```json
{
  "EventId": "event-guid",
  "EventName": "Safety Training",
  "IsActive": true,
  "LastUpdatedUTC": "2026-03-24T15:30:00Z"
}
```

No delete or void endpoint is exposed.

### Single Scan Insert

`POST /api/scans`

Purpose:

- accept one kiosk scan immediately

Request body matches the existing client `AttendanceScan` shape.

Required server behavior:

1. If `DeviceScanGuid` already exists, return success for the existing record and do not insert a second row.
2. If `DeviceScanGuid` is new but the same `BadgeNumberNormalized + DeviceId + EventId` exists within the last 30 seconds, suppress it server-side.
3. Otherwise persist it immediately.

Recommended response:

```json
{
  "accepted": true,
  "duplicateSuppressed": false,
  "alreadyExisted": false,
  "scan": {
    "DeviceScanGuid": "guid",
    "SyncStatus": "SYNCED",
    "SuppressedReason": null
  }
}
```

For suppressed duplicates:

```json
{
  "accepted": true,
  "duplicateSuppressed": true,
  "alreadyExisted": false,
  "scan": {
    "DeviceScanGuid": "guid",
    "SyncStatus": "SUPPRESSED",
    "SuppressedReason": "DUPLICATE_30_SECOND_WINDOW"
  }
}
```

### Offline Batch Sync

`POST /api/scans/sync-batch`

Purpose:

- accept queued offline scans from one device

Request:

```json
{
  "scans": [
    {
      "DeviceScanGuid": "guid-1"
    }
  ]
}
```

Response:

```json
{
  "syncedIds": ["guid-1"],
  "failed": [
    {
      "deviceScanGuid": "guid-2",
      "error": "Event not found."
    }
  ]
}
```

Server rules:

- run the same idempotency and duplicate suppression rules as single insert
- treat an existing `DeviceScanGuid` as success, not failure
- return partial success cleanly

### Retry Pending Sync

`POST /api/sync/retry`

Purpose:

- server-assisted retry of queued scans for a device

Request:

```json
{
  "deviceId": "KIOSK-001"
}
```

Response:

```json
{
  "syncedIds": ["guid-1", "guid-2"],
  "failed": []
}
```

### Reference Refresh

`POST /api/sync/refresh`

Purpose:

- return latest employee roster, event catalog, and current device configuration for kiosk refresh

Request:

```json
{
  "deviceId": "KIOSK-001",
  "deviceGuid": "device-guid",
  "lastRefreshUTC": "2026-03-24T10:00:00Z"
}
```

Response:

```json
{
  "employees": [],
  "events": [],
  "device": {},
  "lastRefreshUTC": "2026-03-24T16:00:00Z"
}
```

### Review Queries

`GET /api/scans/review`

Supported filters:

- `eventId`
- `dateFrom`
- `dateTo`
- `employee`
- `badgeNumber`
- `device`
- `scanStatus`
- `syncStatus`
- `deviceScope=current|all`
- `currentDeviceId`

Purpose:

- read-only review page data

Response:

- list of scans matching the existing client `AttendanceScan` shape

No mutation endpoints are exposed for review.

### Exports

`GET /api/reports/export/csv`

`GET /api/reports/export/excel`

`GET /api/reports/export/pdf`

Purpose:

- generate filtered exports from the same review query contract

Behavior:

- accept the same filter parameters as `/api/scans/review`
- stream the generated file back to the browser
- set correct `Content-Type` and `Content-Disposition`
- write temporary output only under `ProgramData\iBadge\temp`

Recommended libraries:

- CSV: native stream writer
- Excel: `exceljs`
- PDF: `pdfkit` or `pdf-lib`

### Employee Import

`POST /api/employee-import/run`

Purpose:

- manual employee refresh trigger from admin

`GET /api/employee-import/status`

Purpose:

- current and last import status

## 9. SQL Execution / Install Sequence

The installer must support two paths:

- create objects in an existing dedicated database
- create a new dedicated database, then create objects

### Recommended Sequence

1. Validate target OS is Windows Server 2022.
2. Validate SQL Server host is reachable.
3. Collect or import:
   - SQL Server name
   - target database name
   - authentication mode and credentials
   - access control source DB connection
4. Test connection to SQL Server.
5. If `Create new database` is selected:
   - run `IF DB_ID(@DbName) IS NULL CREATE DATABASE [@DbName]`
6. Reconnect to the target database context.
7. Run `preflight.sql` to verify:
   - create/alter permissions
   - required ANSI settings
   - required schemas
   - ability to create tables, procedures, indexes
8. Run the supplied kiosk schema/object script.
9. Seed required reference/config rows if they are not part of the supplied script:
   - admin config row
   - event defaults if any
   - import settings row if stored in DB
10. Validate required objects exist.
11. Start backend service only after schema creation succeeds.
12. Run installer smoke tests against `/health`, `/api/events`, and a DB connectivity check endpoint if implemented.

### SQL Permissions

Minimum required for the kiosk DB account:

- `SELECT`, `INSERT`, `UPDATE`, `EXECUTE` on kiosk DB objects
- `CREATE TABLE/PROC/INDEX` only during install if the installer account is running schema creation

Minimum required for the access control source DB account:

- read-only access only

### Database Object Notes

At minimum the schema should include support for:

- `Employee`
- `Device`
- `Event`
- `AttendanceScan`
- `ImportRun`

Recommended indexes:

- unique index on `AttendanceScan.DeviceScanGuid`
- index on `(BadgeNumberNormalized, DeviceId, EventId, ScanUTC DESC)` for duplicate suppression lookup
- indexes supporting review filters:
  - `ScanUTC`
  - `EventId`
  - `EmpID`
  - `BadgeNumberNormalized`
  - `DeviceId`
  - `ScanStatus`
  - `SyncStatus`

## 10. Install And Update Sequence

### Fresh Install

1. Run EXE installer as administrator.
2. Validate Windows Server 2022.
3. Validate/install IIS role and required IIS components.
4. Validate/install URL Rewrite and ARR if reverse proxy mode is enabled.
5. Create `Program Files` and `ProgramData` folder structure.
6. Deploy frontend release files.
7. Deploy backend release files.
8. Write `runtime-config.js`.
9. Write `backend.json`.
10. Configure IIS site, app pool, bindings, and reverse proxy.
11. Install/configure backend Windows service.
12. Validate SQL connectivity.
13. Create DB if selected.
14. Run schema/object script.
15. Create scheduled import task.
16. Start backend service.
17. Run smoke tests.
18. Finish install and output a validation summary.

### Upgrade In Place

1. Run newer EXE installer.
2. Detect existing install/version.
3. Backup current config and service wrapper files to `ProgramData\iBadge\backup\pre-upgrade`.
4. Preserve:
   - `ProgramData\iBadge\config`
   - `ProgramData\iBadge\exports`
   - database
5. Stop backend service.
6. Optionally place IIS site in maintenance mode for a short window.
7. Install new release under `releases\<new-version>`.
8. Run DB upgrade script if the release requires schema changes.
9. Update `current` pointer.
10. Restart service and IIS site/app pool.
11. Run post-upgrade smoke tests.
12. Leave prior release folder available for rollback until validation completes.

## 11. Operational Behavior

### Scan Flow

When a badge is scanned:

1. Client creates a local scan record with `DeviceScanGuid`.
2. Client attempts immediate sync to `POST /api/scans`.
3. Backend persists the scan immediately if accepted.
4. If backend is unreachable, client queues locally in IndexedDB.
5. Client retries once immediately, then leaves the record queued.
6. On reconnect or retry action, client submits queued items to `/api/scans/sync-batch` or `/api/sync/retry`.
7. If the backend already has the same `DeviceScanGuid`, it returns success without duplicating the record.

### Duplicate Suppression Rule

Server must enforce:

- same badge
- same device
- same event
- within 30 seconds

Result:

- scan is marked `SUPPRESSED`
- original accepted scan remains authoritative
- suppressed attempts remain reviewable if the business wants audit visibility

## 12. Implementation Requirements For This Repo

These changes are required before packaging:

1. Convert the Next.js front end to a true static export build for IIS.
2. Remove production reliance on `src/app/api/**`.
3. Implement runtime config loading instead of build-time `NEXT_PUBLIC_*` only.
4. Replace the stub backend in `server/src/index.ts` with the full API described above.
5. Add SQL data access layer and DB-backed duplicate/idempotency enforcement.
6. Add import runner shared by:
   - scheduled task
   - manual API trigger
7. Add export generation implementation.
8. Add admin PIN hashing and session issuance.
9. Add installer assets:
   - `web.config`
   - service wrapper config
   - SQL scripts
   - PowerShell validation/configuration scripts

## 13. Rollback Considerations

Application rollback is only safe if database changes are compatible.

Recommended rollback model:

- preserve prior release under `releases\<old-version>`
- repoint `current` to the prior release
- restart IIS and backend service

Before any upgrade that changes schema:

- back up the kiosk database
- back up `ProgramData\iBadge\config`

Rollback rules:

- if schema change is backward-compatible, app rollback can proceed without DB restore
- if schema change is not backward-compatible, rollback requires DB restore from the pre-upgrade backup
- installer must not auto-drop or recreate the database during rollback

## 14. Operational Validation Checklist

Use this after install and after every upgrade.

### Server Validation

- Windows Server 2022 confirmed
- IIS site exists and is started
- HTTPS binding resolves correctly
- static site loads from IIS without Node dependency
- backend Windows service is installed and running
- backend listens only on localhost
- `/health` returns OK through the expected path

### Database Validation

- kiosk DB connection succeeds
- source access control DB connection succeeds
- required schema objects exist
- `AttendanceScan.DeviceScanGuid` uniqueness is enforced
- duplicate suppression query path works inside 30 seconds
- import logging writes to `ImportRun`

### Functional Validation

- kiosk first-load registers device
- device name update persists
- active event change persists
- admin PIN verification works
- admin-only endpoints require admin authorization
- scan insert succeeds online
- offline scan queues locally
- reconnect drains queue without double insert
- repeated retry of same `DeviceScanGuid` is idempotent
- duplicate same badge/device/event within 30 seconds is suppressed
- review filters work for:
  - event
  - date range
  - employee
  - badge number
  - device
  - scan status
  - sync status
  - current device vs all devices
- review page remains read-only
- no delete/void operation is exposed anywhere

### Export Validation

- CSV export works for filtered results
- Excel export works for filtered results
- PDF export works for filtered results
- exported rows match review filter criteria
- export files are generated without writing into program binaries folders

### Import Validation

- scheduled import task exists and is enabled
- hourly run executes successfully
- manual import trigger works
- missing source employees are marked inactive, not deleted
- import counts and failures are logged to `ImportRun`

### Upgrade Validation

- EXE upgrade-in-place completes successfully
- config files are preserved
- database is preserved
- logs and exports remain intact
- site returns to service after upgrade
- prior release remains available for rollback until signoff

## 15. QA / UAT Validation Checklist

### Kiosk

- kiosk works on iPad Safari
- kiosk works on desktop browser
- PWA installs on supported client platforms
- offline shell loads after prior online visit
- employee/event cache remains usable offline
- local pending queue survives browser restart

### Admin

- PIN gate blocks review/admin entry when unauthorized
- valid PIN opens admin flow
- invalid PIN is rejected
- device scope and all-device scope behave as expected

### Scanning

- matched employee scan records correctly
- unknown badge records correctly
- inactive employee records correctly
- immediate sync path works
- offline queue and later sync path works
- duplicate server suppression behaves exactly once within 30 seconds

### Reporting

- review filter combinations return expected records
- totals and statuses match database contents
- CSV, Excel, and PDF exports are correct and readable

### Supportability

- installer log is retained
- backend log is retained
- import log is retained
- upgrade preserves configuration
- rollback procedure has been test executed at least once in UAT
