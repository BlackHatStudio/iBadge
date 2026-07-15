# DATABASE_MAPPING.md
# iBadge — Database Object Mapping

> Generated: 2026-06-19 | Source database: `ibadge` (SQL Server)

---

## 1. Connection Strategy

### Current (Next.js)

The existing app uses **two separate database connection mechanisms**:

| Mechanism | Used by | Assessment |
|---|---|---|
| `sqlcmd` CLI subprocess | `ibadge-db.ts` (kiosk core) | **INSECURE** — credentials passed as command-line args, SQL built via string interpolation |
| `mssql` npm driver (connection pool) | `sql-executor.ts` (attendee module) | Correct — parameterized queries, connection pool |

### Python Replacement

Use **`pyodbc`** exclusively with a single connection pool strategy:

```python
import pyodbc

# Connection string (assembled from config, never hardcoded)
conn_str = (
    f"DRIVER={{ODBC Driver 18 for SQL Server}};"
    f"SERVER={config.db.host};"
    f"DATABASE={config.db.name};"
    f"UID={config.db.user};"
    f"PWD={config.db.password};"
    f"Encrypt={'yes' if config.db.encrypt else 'no'};"
    f"TrustServerCertificate={'yes' if config.db.trust_cert else 'no'};"
)
# Or use a full connection string from config
```

All queries must use `?` placeholder parameterization. No string interpolation into SQL.

---

## 2. Table Inventory

### `dbo.AdminConfig`

| Column | Type | Notes |
|---|---|---|
| AdminConfigID | int IDENTITY | PK |
| PinHash | nvarchar | bcrypt hash of 4-digit admin PIN |
| PinSalt | nvarchar | bcrypt salt (extractable from hash) |
| RefreshIntervalHours | int | Default: 12 |
| DuplicateSuppressSeconds | int | Default: 30 |
| CreatedUTC | datetime2 | |
| ModifiedUTC | datetime2 | |

**Operations:** SELECT TOP 1 (ensure row exists), INSERT (bootstrap default), UPDATE (future PIN change)
**Notes:** App ensures exactly one row exists at startup. Default PIN hash is `5657` bcrypt.

---

### `dbo.Event`

| Column | Type | Notes |
|---|---|---|
| EventID | int IDENTITY | PK |
| EventName | nvarchar | Unique (enforced by app, not FK) |
| IsActive | bit | 1 = active |
| CreatedUTC | datetime2 | |

**Operations:** SELECT (list, get by ID, get active), INSERT (create), UPDATE (rename, activate/deactivate)
**Read pattern:** `SELECT EventID, EventName, IsActive, CreatedUTC FROM dbo.Event ORDER BY EventName`
**Write notes:** No strict unique constraint confirmed — app checks for existing name before insert.

---

### `dbo.Device`

| Column | Type | Notes |
|---|---|---|
| DeviceID | int IDENTITY | PK |
| DeviceGuid | uniqueidentifier | Browser-generated GUID, unique |
| DeviceName | nvarchar | Display name |
| DeviceClass | nvarchar | Always 'Kiosk' in current app |
| IsActive | bit | |
| LastSeenUTC | datetime2 | Updated on every sync |
| LastEmployeeSyncUTC | datetime2 | |
| LastEventSyncUTC | datetime2 | |
| CreatedUTC | datetime2 | |

**Operations:** SELECT (by ID, by GUID), INSERT (register), UPDATE (LastSeen, name)

---

### `dbo.DeviceAssignment`

| Column | Type | Notes |
|---|---|---|
| DeviceAssignmentID | int IDENTITY | PK |
| DeviceID | int | FK → Device |
| EventID | int | FK → Event |
| IsActive | bit | Only one active per device |
| AssignedUTC | datetime2 | |
| EndedUTC | datetime2 | Null = still active |

**Operations:** SELECT (active assignment for device), INSERT (assign), UPDATE (deactivate old assignment)
**Pattern:** `OUTER APPLY (SELECT TOP 1 ... WHERE IsActive=1 AND EndedUTC IS NULL ORDER BY AssignedUTC DESC)` to get current event per device.

---

### `dbo.Employee`

| Column | Type | Notes |
|---|---|---|
| EmpID | int IDENTITY | PK |
| BadgeNumber | nvarchar | Raw badge number |
| FirstName | nvarchar | |
| LastName | nvarchar | |
| IsActive | bit | |
| LastImportedUTC | datetime2 | |
| Email | nvarchar(320) | **Optional column** — may not exist |
| CompanyNum | nvarchar | **Optional column** — may not exist |
| Floor | nvarchar | **Optional column** — may not exist, used instead of CompanyNum if present |

**Operations:** SELECT (all employees for cache, lookup by badge), INSERT+UPDATE (upsert by normalized badge)
**Badge matching:** `UPPER(REPLACE(LTRIM(REPLACE(BadgeNumber, '0', ' ')), ' ', ''))` — strips leading zeros, uppercases
**Optional column detection:** Query `sys.columns WHERE object_id = OBJECT_ID('dbo.Employee')` at startup, cache result.
**Upsert pattern:** UPDATE where normalized badge matches; if `@@ROWCOUNT = 0` then INSERT.

---

### `dbo.BadgeScan`

| Column | Type | Notes |
|---|---|---|
| ScanID | bigint IDENTITY | PK |
| DeviceScanGuid | uniqueidentifier | Client-generated, deduplicate key |
| DeviceID | int | FK → Device |
| EventID | int | FK → Event |
| EmpID | int | FK → Employee (nullable, UNKNOWN scans) |
| BadgeNumberRaw | nvarchar | Raw scanned badge |
| EmployeeNameSnapshot | nvarchar | Name at time of scan (denormalized) |
| ScanStatus | nvarchar | MATCHED / UNKNOWN / INACTIVE |
| SyncStatus | nvarchar | PENDING / SYNCED / FAILED / SUPPRESSED |
| ScanUTC | datetime2 | Server-received timestamp |
| DeviceLocalUTC | datetime2 | Device-reported timestamp |
| IsOfflineCaptured | bit | Was this scanned while offline? |
| SyncBatchID | bigint | FK → SyncBatch (nullable) |
| SyncAttemptCount | int | |
| LastSyncAttemptUTC | datetime2 | |
| SyncErrorMessage | nvarchar | |
| CreatedUTC | datetime2 | |

**Operations:** INSERT (record scan), SELECT (review with filters), UPDATE (retry — set SYNCED)
**Duplicate check:** Look for same badge + event + date within ±N hours where SyncStatus <> 'SUPPRESSED'
**Review filters:** eventId, deviceScope, dateFrom, dateTo, employee, badgeNumber, device, scanStatus, syncStatus
**Sort:** `ORDER BY ScanUTC DESC`

---

### `dbo.SyncBatch`

| Column | Type | Notes |
|---|---|---|
| SyncBatchID | bigint IDENTITY | PK |
| DeviceID | int | FK → Device |
| BatchGuid | uniqueidentifier | |
| BatchCreatedUTC | datetime2 | |
| BatchReceivedUTC | datetime2 | |
| RecordCount | int | |
| Status | nvarchar | RECEIVED / COMPLETED / PARTIAL / FAILED |

**Operations:** INSERT (create batch), UPDATE (set final status)

---

### `dbo.AttendeeList`

| Column | Type | Notes |
|---|---|---|
| AttendeeListID | int IDENTITY | PK |
| ListName | nvarchar | Display name |
| Description | nvarchar | Optional |
| IsActive | bit | |
| CreatedAt | datetime2 | |
| CreatedBy | nvarchar | Audit: who created |
| UpdatedAt | datetime2 | |
| UpdatedBy | nvarchar | Audit: who updated |

**Operations:** SELECT (list, get, count attendees), INSERT (create), UPDATE (rename, activate/deactivate)
**Join:** LEFT JOIN dbo.Attendee for count; LEFT JOIN dbo.AttendeeListUploadBatch for last upload date.

---

### `dbo.Attendee`

| Column | Type | Notes |
|---|---|---|
| AttendeeID | int IDENTITY | PK |
| AttendeeListID | int | FK → AttendeeList |
| BadgeNumber | nvarchar | Optional |
| FirstName | nvarchar | Required |
| LastName | nvarchar | Required |
| Email | nvarchar | Required, normalized to lowercase |
| PhoneNumber | nvarchar | Optional |
| Company | nvarchar | Optional |
| CreatedAt | datetime2 | |
| CreatedBy | nvarchar | |
| UpdatedAt | datetime2 | |
| UpdatedBy | nvarchar | |
| DeletedAt | datetime2 | Soft delete timestamp |
| DeletedBy | nvarchar | |

**Operations:** SELECT (list by list ID, get by ID), INSERT, UPDATE, soft-delete (set DeletedAt)
**All read queries filter:** `AND a.DeletedAt IS NULL`
**Conflict check:** Before bulk import, check for existing Email or BadgeNumber matches within the list.

---

### `dbo.AttendeeQrToken`

| Column | Type | Notes |
|---|---|---|
| QrTokenID | int IDENTITY | PK |
| AttendeeID | int | FK → Attendee |
| TokenHash | varbinary(MAX) | HMAC-SHA256 hash of actual token value |
| ExpiresAtUtc | datetime2 | Null = never expires |
| RevokedAtUtc | datetime2 | Null = active |
| RevokedBy | nvarchar | |
| SentAtUtc | datetime2 | First send timestamp |
| LastSentAtUtc | datetime2 | Most recent send |
| SendCount | int | |
| LastSendStatus | nvarchar | NOT_SENT / SENT / FAILED / REVOKED / REGENERATED |
| LastSendError | nvarchar | |
| CreatedAt | datetime2 | |
| CreatedBy | nvarchar | |
| UpdatedAt | datetime2 | |
| UpdatedBy | nvarchar | |

**Operations:** SELECT (find by hash, find active for attendee), INSERT, UPDATE (send status, revoke)
**Active token query:** `ORDER BY CASE WHEN RevokedAtUtc IS NULL THEN 0 ELSE 1 END, CreatedAt DESC LIMIT 1`

---

### `dbo.AttendeeListUploadBatch`

| Column | Type | Notes |
|---|---|---|
| UploadBatchID | int IDENTITY | PK |
| AttendeeListID | int | FK → AttendeeList |
| OriginalFileName | nvarchar | |
| UploadedAt | datetime2 | Auto-set by DB default or app |
| UploadedBy | nvarchar | |
| ImportStatus | nvarchar | PENDING / VALIDATED / IMPORTED / REJECTED / FAILED |
| TotalRows | int | |
| ValidRows | int | |
| InvalidRows | int | |
| ValidationSummary | nvarchar(MAX) | JSON |
| CreatedBy | nvarchar | |

---

### `dbo.AttendeeListAuditLog`

| Column | Type | Notes |
|---|---|---|
| AuditLogID | bigint IDENTITY | PK |
| AttendeeListID | int | Nullable FK |
| AttendeeID | int | Nullable FK |
| ActionType | nvarchar | e.g., 'LIST_CREATED', 'ATTENDEE_DELETED' |
| ActionDescription | nvarchar | Human-readable description |
| OldValue | nvarchar(MAX) | JSON |
| NewValue | nvarchar(MAX) | JSON |
| PerformedBy | nvarchar | User identifier |
| SourceIPAddress | nvarchar | |
| UserAgent | nvarchar | |
| CreatedAt | datetime2 | |

---

### `dbo.EventAttendeeList`

| Column | Type | Notes |
|---|---|---|
| EventID | int | FK → Event |
| AttendeeListID | int | FK → AttendeeList |
| *(PK is composite)* | | |

**Operations:** SELECT (get lists for event), INSERT (associate list to event)

---

### `dbo.EventAttendanceSetting`

| Column | Type | Notes |
|---|---|---|
| EventID | int | FK → Event (likely PK) |
| AttendanceSourceMode | nvarchar | ACCESS_CONTROL_ONLY / ATTENDEE_LIST_ONLY / COMBINED |
| DuplicateScanWindowSeconds | int | Window for duplicate suppression |

**Operations:** SELECT TOP 1 by EventID

---

### `dbo.AttendanceCheckIn`

| Column | Type | Notes |
|---|---|---|
| CheckInID | bigint IDENTITY | PK |
| EventID | int | FK → Event |
| AttendeeID | int | FK → Attendee |
| BadgeNumber | nvarchar | Snapshot |
| SourceType | nvarchar | 'ATTENDEE_LIST' |
| CheckInMethod | nvarchar | QR_SCAN / EMAIL_ENTRY / BADGE_SCAN / ADMIN_MANUAL |
| CheckInStatus | nvarchar | SUCCESS / etc. |
| CheckInTimeUtc | datetime2 | |
| KioskID | nvarchar | Device ID (as string) |
| DeviceName | nvarchar | |
| MatchedBy | nvarchar | |
| CreatedAt | datetime2 | |
| CreatedBy | nvarchar | Always 'kiosk' |

**Operations:** SELECT (duplicate check), INSERT (record check-in)

---

## 3. Table Relationships

```
dbo.Event (1) ─────────────────── (M) dbo.DeviceAssignment
dbo.Device (1) ─────────────────── (M) dbo.DeviceAssignment
dbo.Device (1) ─────────────────── (M) dbo.BadgeScan
dbo.Event  (1) ─────────────────── (M) dbo.BadgeScan
dbo.Employee (0..1) ────────────── (M) dbo.BadgeScan
dbo.Device (1) ─────────────────── (M) dbo.SyncBatch
dbo.Event  (1) ─────────────────── (M) dbo.EventAttendeeList
dbo.AttendeeList (1) ──────────── (M) dbo.EventAttendeeList
dbo.AttendeeList (1) ──────────── (M) dbo.Attendee
dbo.AttendeeList (1) ──────────── (M) dbo.AttendeeListUploadBatch
dbo.AttendeeList (1) ──────────── (M) dbo.AttendeeListAuditLog
dbo.Attendee (1) ──────────────── (M) dbo.AttendeeQrToken
dbo.Attendee (1) ──────────────── (M) dbo.AttendanceCheckIn
dbo.Attendee (1) ──────────────── (M) dbo.AttendeeListAuditLog
dbo.Event    (1) ──────────────── (M) dbo.AttendanceCheckIn
dbo.Event    (1) ──────────────── (1) dbo.EventAttendanceSetting
```

---

## 4. Optional Column Detection (Python Pattern)

```python
def detect_employee_optional_columns(conn) -> dict:
    cursor = conn.cursor()
    cursor.execute("""
        SELECT name
        FROM sys.columns
        WHERE object_id = OBJECT_ID(N'dbo.Employee')
          AND name IN ('Email', 'CompanyNum', 'Floor')
    """)
    cols = {row.name for row in cursor.fetchall()}
    return {
        'has_email': 'Email' in cols,
        'has_company_num': 'CompanyNum' in cols,
        'has_floor': 'Floor' in cols,
    }
```

Cache result at application startup. Do not re-query per request.

---

## 5. Migration Risks

| Risk | Severity | Mitigation |
|---|---|---|
| Optional Employee columns not present | MEDIUM | Detect at startup; build dynamic SELECT |
| Badge normalization mismatch | HIGH | Replicate exact logic: strip leading zeros, uppercase, strip spaces |
| Duplicate scan window edge cases | MEDIUM | Use same timezone-aware date comparison (Central Time) |
| `dbo.AdminConfig` default PIN creates on first run | LOW | Replicate ensure-row logic in Python startup |
| `AttendeeQrToken.TokenHash` is varbinary, not nvarchar | MEDIUM | Use `pyodbc` `Binary()` type for hash parameter |
| `EventAttendanceSetting` rows may not exist for all events | LOW | Default to 'COMBINED' mode if no row found |
| `OPENJSON` usage (find conflicts by list) | LOW | Python equivalent: pass values as individual parameters or use temp table |
| `sqlcmd` subprocess path — Python must not replicate | HIGH | Never use subprocess for SQL. Always use pyodbc |
| Timezones: scans use UTC, display in Central Time | MEDIUM | Convert at display layer; store UTC in DB always |
| `AttendeeQrToken.TokenHash` stored as Buffer (binary) | MEDIUM | Python: `hashlib.sha256(token.encode()).digest()` → bytes → pyodbc Binary |

---

## 6. Required Indexes (Inferred from Query Patterns)

| Table | Suggested Index | Reason |
|---|---|---|
| `dbo.BadgeScan` | `(EventID, ScanUTC DESC)` | Review queries filter by event + date range |
| `dbo.BadgeScan` | `(DeviceID, SyncStatus)` | Retry: fetch PENDING/FAILED for device |
| `dbo.BadgeScan` | `(DeviceScanGuid)` | Dedup check on batch sync |
| `dbo.Employee` | `(IsActive)` | Filter active employees for cache |
| `dbo.Device` | `(DeviceGuid)` | Lookup by GUID on register/get |
| `dbo.Attendee` | `(AttendeeListID, DeletedAt)` | List attendees by list |
| `dbo.Attendee` | `(Email, AttendeeListID)` | Email check-in lookup |
| `dbo.AttendeeQrToken` | `(TokenHash)` | QR check-in lookup |
| `dbo.AttendanceCheckIn` | `(EventID, AttendeeID, CheckInTimeUtc)` | Duplicate check-in detection |

**NEEDS VALIDATION:** Confirm these indexes exist in production. If not, add them as part of migration pre-flight.
