import { execFile } from "node:child_process";
import { existsSync, readFileSync } from "node:fs";
import * as path from "node:path";
import { promisify } from "node:util";
import bcrypt from "bcryptjs";

import type {
  AttendanceScan,
  DeviceConfig,
  EmployeeRecord,
  EventRecord,
  RefreshResponse,
  ReviewFilters,
  SyncBatchResponse,
} from "@/lib/kiosk-types";
import { buildReviewPdfBuffer } from "@/lib/review-pdf";
import { formatScanTimeCentralOnly } from "@/lib/kiosk-utils";
import { createUuid } from "@/lib/uuid";

const execFileAsync = promisify(execFile);
const SQLCMD_PATH = "sqlcmd";
const DEFAULT_ADMIN_PIN = "5657";
const DEFAULT_REFRESH_INTERVAL_HOURS = 12;
const DEFAULT_DUPLICATE_SUPPRESS_SECONDS = 30;

type SqlcmdConfig = {
  server: string;
  database: string;
  authArgs: string[];
};

type AdminConfigRow = {
  AdminConfigID: number;
  PinHash: string;
  PinSalt: string;
  RefreshIntervalHours: number;
  DuplicateSuppressSeconds: number;
  CreatedUTC: string;
  ModifiedUTC: string;
};

type DeviceRow = {
  DeviceId: string;
  DeviceGuid: string;
  DeviceName: string;
  ActiveEventId: string | null;
  ActiveEventName: string | null;
  RegisteredUTC: string;
  LastUpdatedUTC: string;
};

type EmployeeOptionalColumns = {
  HasEmail: boolean;
  HasCompanyNum: boolean;
  HasFloor: boolean;
};

let employeeOptionalColumnsCache: EmployeeOptionalColumns | null = null;

function parseEnvFile(filePath: string) {
  if (!existsSync(filePath)) {
    return {} as Record<string, string>;
  }

  const parsed: Record<string, string> = {};
  for (const line of readFileSync(filePath, "utf8").split(/\r?\n/)) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#")) {
      continue;
    }

    const equalsIndex = trimmed.indexOf("=");
    if (equalsIndex <= 0) {
      continue;
    }

    const key = trimmed.slice(0, equalsIndex).trim();
    let value = trimmed.slice(equalsIndex + 1).trim();
    if (
      (value.startsWith('"') && value.endsWith('"')) ||
      (value.startsWith("'") && value.endsWith("'"))
    ) {
      value = value.slice(1, -1);
    }

    parsed[key] = value;
  }

  return parsed;
}

function sqlcmdConfig(): SqlcmdConfig {
  const serverEnv = parseEnvFile(path.join(process.cwd(), "server", ".env"));
  const server =
    process.env.IBADGE_SQLCMD_SERVER?.trim() ||
    serverEnv.DB_SERVER ||
    serverEnv.SQLSERVER_HOST ||
    "localhost";
  const database =
    process.env.IBADGE_SQLCMD_DATABASE?.trim() ||
    serverEnv.DB_NAME ||
    serverEnv.SQLSERVER_DATABASE ||
    "ibadge";
  const username =
    process.env.IBADGE_SQLCMD_USERNAME?.trim() ||
    serverEnv.DB_USER ||
    serverEnv.SQLSERVER_USER ||
    "";
  const password =
    process.env.IBADGE_SQLCMD_PASSWORD?.trim() ||
    serverEnv.DB_PASSWORD ||
    serverEnv.SQLSERVER_PASSWORD ||
    "";

  return {
    server,
    database,
    authArgs: username && password ? ["-U", username, "-P", password] : ["-E"],
  };
}

function cleanSqlcmdOutput(stdout: string) {
  return stdout
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter(
      (line) =>
        line.length > 0 &&
        !/^\(\d+\s+rows?\s+affected\)$/i.test(line) &&
        !/^Changed database context to /i.test(line)
    )
    .join("");
}

async function runSql(query: string) {
  const config = sqlcmdConfig();
  const finalQuery = `
    SET ANSI_NULLS ON;
    SET QUOTED_IDENTIFIER ON;
    SET ANSI_PADDING ON;
    SET ANSI_WARNINGS ON;
    SET ARITHABORT ON;
    SET CONCAT_NULL_YIELDS_NULL ON;
    SET NUMERIC_ROUNDABORT OFF;
    ${query}
  `;
  const { stdout } = await execFileAsync(
    SQLCMD_PATH,
    [
      ...config.authArgs,
      "-S",
      config.server,
      "-d",
      config.database,
      "-Q",
      finalQuery,
      "-w",
      "65535",
      "-y",
      "0",
      "-Y",
      "0",
    ],
    { maxBuffer: 1024 * 1024 * 8 }
  );

  return cleanSqlcmdOutput(stdout);
}

async function queryJsonArray<T>(query: string): Promise<T[]> {
  const output = await runSql(query);
  if (!output) {
    return [];
  }

  return JSON.parse(output) as T[];
}

async function queryJsonOne<T>(query: string): Promise<T | null> {
  const output = await runSql(query);
  if (!output) {
    return null;
  }

  return JSON.parse(output) as T;
}

function escapeSqlString(value: string) {
  return value.replace(/'/g, "''");
}

function sqlNVarChar(value: string | null | undefined) {
  if (value === null || value === undefined) {
    return "NULL";
  }

  return `N'${escapeSqlString(value)}'`;
}

function sqlVarChar(value: string | null | undefined) {
  if (value === null || value === undefined) {
    return "NULL";
  }

  return `'${escapeSqlString(value)}'`;
}

function sqlDateTime(value: string | null | undefined) {
  if (!value) {
    return "NULL";
  }

  return `TRY_CONVERT(datetime2, ${sqlVarChar(value)})`;
}

function sqlBool(value: boolean) {
  return value ? "1" : "0";
}

function isNumericId(value: string | null | undefined) {
  return Boolean(value && /^\d+$/.test(value.trim()));
}

function currentUtcSql(columnName: string) {
  return `CASE WHEN ${columnName} IS NULL THEN NULL ELSE CONVERT(nvarchar(33), ${columnName}, 127) + 'Z' END`;
}

function trimOrNull(value: string | null | undefined) {
  const trimmed = String(value ?? "").trim();
  return trimmed.length > 0 ? trimmed : null;
}

async function getEmployeeOptionalColumns() {
  if (employeeOptionalColumnsCache) {
    return employeeOptionalColumnsCache;
  }

  const result =
    (await queryJsonOne<EmployeeOptionalColumns>(`
      SET NOCOUNT ON;
      SELECT
        CAST(MAX(CASE WHEN name = N'Email' THEN 1 ELSE 0 END) AS bit) AS HasEmail,
        CAST(MAX(CASE WHEN name = N'CompanyNum' THEN 1 ELSE 0 END) AS bit) AS HasCompanyNum,
        CAST(MAX(CASE WHEN name = N'Floor' THEN 1 ELSE 0 END) AS bit) AS HasFloor
      FROM sys.columns
      WHERE object_id = OBJECT_ID(N'dbo.Employee')
      FOR JSON PATH, WITHOUT_ARRAY_WRAPPER;
    `)) ?? { HasEmail: false, HasCompanyNum: false, HasFloor: false };

  employeeOptionalColumnsCache = {
    HasEmail: Boolean(result.HasEmail),
    HasCompanyNum: Boolean(result.HasCompanyNum),
    HasFloor: Boolean(result.HasFloor),
  };

  return employeeOptionalColumnsCache;
}

function eventSelectSql(whereClause: string) {
  return `
    SET NOCOUNT ON;
    SELECT
      CAST(EventID AS nvarchar(50)) AS EventId,
      EventName,
      CAST(IsActive AS bit) AS IsActive,
      ${currentUtcSql("CreatedUTC")} AS LastUpdatedUTC
    FROM dbo.Event
    ${whereClause}
  `;
}

function devicePayloadSelect(whereClause: string) {
  return `
    SET NOCOUNT ON;
    SELECT
      CAST(d.DeviceID AS nvarchar(50)) AS DeviceId,
      CONVERT(nvarchar(36), d.DeviceGuid) AS DeviceGuid,
      d.DeviceName,
      CASE WHEN activeAssignment.EventID IS NULL THEN NULL ELSE CAST(activeAssignment.EventID AS nvarchar(50)) END AS ActiveEventId,
      activeAssignment.EventName AS ActiveEventName,
      ${currentUtcSql("d.CreatedUTC")} AS RegisteredUTC,
      ${currentUtcSql("COALESCE(d.LastSeenUTC, d.CreatedUTC)")} AS LastUpdatedUTC
    FROM dbo.Device d
    OUTER APPLY (
      SELECT TOP 1 da.EventID, e.EventName
      FROM dbo.DeviceAssignment da
      LEFT JOIN dbo.Event e ON e.EventID = da.EventID
      WHERE da.DeviceID = d.DeviceID
        AND da.IsActive = 1
        AND da.EndedUTC IS NULL
      ORDER BY da.AssignedUTC DESC, da.DeviceAssignmentID DESC
    ) activeAssignment
    ${whereClause}
    FOR JSON PATH, INCLUDE_NULL_VALUES, WITHOUT_ARRAY_WRAPPER;
  `;
}

function employeeSelectSql(optionalColumns: EmployeeOptionalColumns) {
  const companyValueSql = optionalColumns.HasFloor
    ? "NULLIF(LTRIM(RTRIM(CONVERT(nvarchar(100), Floor))), '')"
    : optionalColumns.HasCompanyNum
      ? "NULLIF(LTRIM(RTRIM(CONVERT(nvarchar(100), CompanyNum))), '')"
      : "CAST(NULL AS nvarchar(100))";
  return `
    SET NOCOUNT ON;
    SELECT
      CAST(EmpID AS nvarchar(50)) AS EmpID,
      BadgeNumber AS BadgeNumberRaw,
      UPPER(REPLACE(BadgeNumber, ' ', '')) AS BadgeNumberNormalized,
      NULLIF(LTRIM(RTRIM(CONCAT(ISNULL(FirstName, ''), ' ', ISNULL(LastName, '')))), '') AS EmployeeName,
      CAST(IsActive AS bit) AS IsActive,
      ${currentUtcSql("LastImportedUTC")} AS LastUpdatedUTC,
      ${optionalColumns.HasEmail ? "NULLIF(LTRIM(RTRIM(Email)), '')" : "CAST(NULL AS nvarchar(320))"} AS Email,
      ${companyValueSql} AS CompanyNum
    FROM dbo.Employee
    ORDER BY EmpID
    FOR JSON PATH, INCLUDE_NULL_VALUES;
  `;
}

function scanSelectSql(whereClause: string, optionalColumns: EmployeeOptionalColumns) {
  const companyValueSql = optionalColumns.HasFloor
    ? "NULLIF(LTRIM(RTRIM(CONVERT(nvarchar(100), emp.Floor))), '')"
    : optionalColumns.HasCompanyNum
      ? "NULLIF(LTRIM(RTRIM(CONVERT(nvarchar(100), emp.CompanyNum))), '')"
      : "CAST(NULL AS nvarchar(100))";
  return `
    SET NOCOUNT ON;
    SELECT
      CONVERT(nvarchar(36), bs.DeviceScanGuid) AS DeviceScanGuid,
      CAST(bs.DeviceID AS nvarchar(50)) AS DeviceId,
      CONVERT(nvarchar(36), d.DeviceGuid) AS DeviceGuid,
      CAST(bs.EventID AS nvarchar(50)) AS EventId,
      e.EventName AS EventNameSnapshot,
      CASE WHEN bs.EmpID IS NULL THEN NULL ELSE CAST(bs.EmpID AS nvarchar(50)) END AS EmpID,
      bs.BadgeNumberRaw,
      bs.EmployeeNameSnapshot,
      ${optionalColumns.HasEmail ? "NULLIF(LTRIM(RTRIM(emp.Email)), '')" : "CAST(NULL AS nvarchar(320))"} AS Email,
      ${companyValueSql} AS CompanyNum,
      CAST(NULL AS int) AS ClassDurationHours,
      bs.ScanStatus,
      bs.SyncStatus,
      ${currentUtcSql("bs.ScanUTC")} AS ScanUTC,
      ${currentUtcSql("bs.DeviceLocalUTC")} AS DeviceLocalUTC,
      CAST(bs.IsOfflineCaptured AS bit) AS IsOfflineCaptured,
      bs.SyncAttemptCount,
      ${currentUtcSql("bs.LastSyncAttemptUTC")} AS LastSyncAttemptUTC,
      bs.SyncErrorMessage,
      d.DeviceName AS DeviceDisplayName,
      CAST(NULL AS nvarchar(100)) AS SuppressedReason
    FROM dbo.BadgeScan bs
    INNER JOIN dbo.Device d ON d.DeviceID = bs.DeviceID
    LEFT JOIN dbo.Event e ON e.EventID = bs.EventID
    LEFT JOIN dbo.Employee emp ON emp.EmpID = bs.EmpID
    ${whereClause}
    FOR JSON PATH, INCLUDE_NULL_VALUES;
  `;
}

async function ensureAdminConfigRow() {
  let config = await queryJsonOne<AdminConfigRow>(`
    SET NOCOUNT ON;
    SELECT TOP 1
      AdminConfigID,
      PinHash,
      PinSalt,
      RefreshIntervalHours,
      DuplicateSuppressSeconds,
      ${currentUtcSql("CreatedUTC")} AS CreatedUTC,
      ${currentUtcSql("ModifiedUTC")} AS ModifiedUTC
    FROM dbo.AdminConfig
    ORDER BY AdminConfigID DESC
    FOR JSON PATH, WITHOUT_ARRAY_WRAPPER;
  `);

  if (config) {
    return config;
  }

  const salt = await bcrypt.genSalt(10);
  const hash = await bcrypt.hash(DEFAULT_ADMIN_PIN, salt);

  await runSql(`
    SET NOCOUNT ON;
    INSERT INTO dbo.AdminConfig (
      PinHash,
      PinSalt,
      RefreshIntervalHours,
      DuplicateSuppressSeconds,
      CreatedUTC,
      ModifiedUTC
    )
    VALUES (
      ${sqlNVarChar(hash)},
      ${sqlNVarChar(bcrypt.getSalt(hash))},
      ${DEFAULT_REFRESH_INTERVAL_HOURS},
      ${DEFAULT_DUPLICATE_SUPPRESS_SECONDS},
      SYSUTCDATETIME(),
      SYSUTCDATETIME()
    );
  `);

  config = await queryJsonOne<AdminConfigRow>(`
    SET NOCOUNT ON;
    SELECT TOP 1
      AdminConfigID,
      PinHash,
      PinSalt,
      RefreshIntervalHours,
      DuplicateSuppressSeconds,
      ${currentUtcSql("CreatedUTC")} AS CreatedUTC,
      ${currentUtcSql("ModifiedUTC")} AS ModifiedUTC
    FROM dbo.AdminConfig
    ORDER BY AdminConfigID DESC
    FOR JSON PATH, WITHOUT_ARRAY_WRAPPER;
  `);

  if (!config) {
    throw new Error("Unable to initialize AdminConfig.");
  }

  return config;
}

async function getEventById(eventId: string | null | undefined) {
  if (!isNumericId(eventId)) {
    return null;
  }

  return queryJsonOne<EventRecord>(`
    ${eventSelectSql(`WHERE EventID = ${eventId}`)}
    FOR JSON PATH, WITHOUT_ARRAY_WRAPPER;
  `);
}

async function getFirstActiveEvent() {
  return queryJsonOne<EventRecord>(`
    ${eventSelectSql(`WHERE IsActive = 1 ORDER BY EventName`)}
    FOR JSON PATH, WITHOUT_ARRAY_WRAPPER;
  `);
}

async function getDeviceByIdentity(deviceId?: string | null, deviceGuid?: string | null) {
  if (isNumericId(deviceId)) {
    return queryJsonOne<DeviceRow>(devicePayloadSelect(`WHERE d.DeviceID = ${deviceId}`));
  }

  const guid = trimOrNull(deviceGuid) ?? trimOrNull(deviceId);
  if (!guid) {
    return null;
  }

  return queryJsonOne<DeviceRow>(devicePayloadSelect(`WHERE d.DeviceGuid = TRY_CONVERT(uniqueidentifier, ${sqlVarChar(guid)})`));
}

async function ensureDeviceRow(input: {
  deviceId?: string | null;
  deviceGuid?: string | null;
  deviceName?: string | null;
}) {
  const existing = await getDeviceByIdentity(input.deviceId, input.deviceGuid);
  const resolvedGuid = trimOrNull(input.deviceGuid) ?? trimOrNull(existing?.DeviceGuid) ?? createUuid();
  const resolvedName = trimOrNull(input.deviceName) ?? trimOrNull(existing?.DeviceName) ?? "Kiosk";

  if (existing && isNumericId(existing.DeviceId)) {
    await runSql(`
      SET NOCOUNT ON;
      UPDATE dbo.Device
      SET DeviceName = ${sqlNVarChar(resolvedName)},
          IsActive = 1,
          LastSeenUTC = SYSUTCDATETIME()
      WHERE DeviceID = ${existing.DeviceId};
    `);

    return getDeviceByIdentity(existing.DeviceId, resolvedGuid);
  }

  await runSql(`
    SET NOCOUNT ON;
    INSERT INTO dbo.Device (
      DeviceGuid,
      DeviceName,
      DeviceClass,
      IsActive,
      LastSeenUTC,
      LastEmployeeSyncUTC,
      LastEventSyncUTC,
      CreatedUTC
    )
    VALUES (
      TRY_CONVERT(uniqueidentifier, ${sqlVarChar(resolvedGuid)}),
      ${sqlNVarChar(resolvedName)},
      N'Kiosk',
      1,
      SYSUTCDATETIME(),
      NULL,
      NULL,
      SYSUTCDATETIME()
    );
  `);

  return getDeviceByIdentity(null, resolvedGuid);
}

async function setActiveDeviceAssignment(deviceId: string, eventId: string | null) {
  if (!isNumericId(deviceId)) {
    throw new Error("Device ID must be numeric.");
  }

  await runSql(`
    SET NOCOUNT ON;
    UPDATE dbo.DeviceAssignment
    SET IsActive = 0,
        EndedUTC = COALESCE(EndedUTC, SYSUTCDATETIME())
    WHERE DeviceID = ${deviceId}
      AND IsActive = 1
      AND EndedUTC IS NULL;
  `);

  if (isNumericId(eventId)) {
    await runSql(`
      SET NOCOUNT ON;
      INSERT INTO dbo.DeviceAssignment (DeviceID, EventID, IsActive, AssignedUTC, EndedUTC)
      VALUES (${deviceId}, ${eventId}, 1, SYSUTCDATETIME(), NULL);
    `);
  }

  return getDeviceByIdentity(deviceId, null);
}

async function ensureInitialAssignment(device: DeviceRow, preferredEventId?: string | null) {
  if (device.ActiveEventId) {
    return device;
  }

  const selected = (await getEventById(preferredEventId)) ?? (await getFirstActiveEvent());
  if (!selected) {
    return device;
  }

  const updated = await setActiveDeviceAssignment(device.DeviceId, selected.EventId);
  if (!updated) {
    throw new Error("Unable to assign initial event to device.");
  }

  return updated;
}

function normalizeEmployeeName(firstName: string | null | undefined, lastName: string | null | undefined, fallback?: string | null) {
  const fullName = `${firstName ?? ""} ${lastName ?? ""}`.trim();
  return fullName || fallback || null;
}

async function resolveScanDependencies(scan: AttendanceScan) {
  const optionalColumns = await getEmployeeOptionalColumns();
  const device = await ensureDeviceRow({
    deviceId: scan.DeviceId,
    deviceGuid: scan.DeviceGuid,
    deviceName: scan.DeviceDisplayName,
  });

  if (!device) {
    throw new Error("Unable to resolve device for scan.");
  }

  const eventId = isNumericId(scan.EventId) ? scan.EventId : device.ActiveEventId;
  if (!isNumericId(eventId)) {
    throw new Error("This device does not have an active event.");
  }

  const employeeRows = await queryJsonArray<{
    EmpID: number;
    BadgeNumber: string;
    FirstName: string | null;
    LastName: string | null;
    IsActive: boolean;
    Email: string | null;
    CompanyNum: string | null;
  }>(`
    SET NOCOUNT ON;
    SELECT TOP 1
      EmpID,
      BadgeNumber,
      FirstName,
      LastName,
      CAST(IsActive AS bit) AS IsActive,
      ${optionalColumns.HasEmail ? "NULLIF(LTRIM(RTRIM(Email)), '')" : "CAST(NULL AS nvarchar(320))"} AS Email,
      ${
        optionalColumns.HasFloor
          ? "NULLIF(LTRIM(RTRIM(CONVERT(nvarchar(100), Floor))), '')"
          : optionalColumns.HasCompanyNum
            ? "NULLIF(LTRIM(RTRIM(CONVERT(nvarchar(100), CompanyNum))), '')"
            : "CAST(NULL AS nvarchar(100))"
      } AS CompanyNum
    FROM dbo.Employee
    WHERE ${
      isNumericId(scan.EmpID)
        ? `EmpID = ${scan.EmpID}`
        : `UPPER(REPLACE(LTRIM(REPLACE(BadgeNumber, '0', ' ')), ' ', '')) = UPPER(REPLACE(LTRIM(REPLACE(${sqlNVarChar(scan.BadgeNumberRaw)}, '0', ' ')), ' ', ''))`
    }
    ORDER BY EmpID
    FOR JSON PATH, INCLUDE_NULL_VALUES;
  `);

  const employee = employeeRows[0] ?? null;
  const employeeName = employee
    ? normalizeEmployeeName(employee.FirstName, employee.LastName, scan.EmployeeNameSnapshot)
    : scan.EmployeeNameSnapshot ?? null;
  const scanStatus = !employee ? "UNKNOWN" : employee.IsActive ? "MATCHED" : "INACTIVE";

  return {
    device,
    eventId,
    employeeId: employee ? String(employee.EmpID) : null,
    employeeName,
    email: employee?.Email ?? scan.Email ?? null,
    companyNum: employee?.CompanyNum ?? scan.CompanyNum ?? null,
    scanStatus,
  };
}

function buildReviewWhere(filters: ReviewFilters, currentDeviceId: string | null) {
  const where: string[] = ["1 = 1"];

  if (filters.deviceScope === "current" && isNumericId(currentDeviceId)) {
    where.push(`bs.DeviceID = ${currentDeviceId}`);
  }

  if (isNumericId(filters.eventId) && filters.eventId !== "all") {
    where.push(`bs.EventID = ${filters.eventId}`);
  }

  if (filters.scanStatus && filters.scanStatus !== "all") {
    where.push(`bs.ScanStatus = ${sqlNVarChar(filters.scanStatus.toUpperCase())}`);
  }

  if (filters.syncStatus && filters.syncStatus !== "all") {
    where.push(`bs.SyncStatus = ${sqlNVarChar(filters.syncStatus.toUpperCase())}`);
  }

  if (filters.device) {
    where.push(`d.DeviceName LIKE N'%${escapeSqlString(filters.device)}%'`);
  }

  if (filters.employee) {
    const escaped = escapeSqlString(filters.employee);
    where.push(`(bs.EmployeeNameSnapshot LIKE N'%${escaped}%' OR CAST(bs.EmpID AS nvarchar(50)) LIKE N'%${escaped}%')`);
  }

  if (filters.badgeNumber) {
    where.push(`bs.BadgeNumberRaw LIKE N'%${escapeSqlString(filters.badgeNumber)}%'`);
  }

  if (filters.dateFrom) {
    where.push(`bs.ScanUTC >= TRY_CONVERT(datetime2, ${sqlVarChar(`${filters.dateFrom}T00:00:00`)})`);
  }

  if (filters.dateTo) {
    where.push(`bs.ScanUTC <= TRY_CONVERT(datetime2, ${sqlVarChar(`${filters.dateTo}T23:59:59.999`)})`);
  }

  return where.join(" AND ");
}

async function findExistingEventDuplicate(
  eventId: string,
  badgeNumberNormalized: string,
  scanUtc: string,
  classDurationHours: number
) {
  const optionalColumns = await getEmployeeOptionalColumns();
  const clampedHours = Math.min(8, Math.max(1, Math.round(classDurationHours || 1)));
  const rows = await queryJsonArray<AttendanceScan>(`
    ${scanSelectSql(
      `WHERE bs.EventID = ${eventId}
         AND UPPER(REPLACE(LTRIM(REPLACE(bs.BadgeNumberRaw, '0', ' ')), ' ', '')) =
             UPPER(REPLACE(LTRIM(REPLACE(${sqlNVarChar(badgeNumberNormalized)}, '0', ' ')), ' ', ''))
         AND bs.SyncStatus <> N'SUPPRESSED'
         AND bs.ScanUTC <= ${sqlDateTime(scanUtc)}
         AND bs.ScanUTC >= DATEADD(hour, -${clampedHours}, ${sqlDateTime(scanUtc)})
         AND CONVERT(date, (bs.ScanUTC AT TIME ZONE 'UTC') AT TIME ZONE 'Central Standard Time') =
             CONVERT(date, (${sqlDateTime(scanUtc)} AT TIME ZONE 'UTC') AT TIME ZONE 'Central Standard Time')
       ORDER BY bs.ScanUTC DESC, bs.ScanID DESC`,
      optionalColumns
    )}
  `);

  return rows[0] ?? null;
}

function csvEscape(value: string | number | boolean | null | undefined) {
  const text = value === null || value === undefined ? "" : String(value);
  if (/[",\r\n]/.test(text)) {
    return `"${text.replace(/"/g, '""')}"`;
  }
  return text;
}

function buildCsv(scans: AttendanceScan[]) {
  const lines = [
    ["Scan time (Central)", "Badge", "Employee", "Email", "Company#", "Event", "Device"].join(","),
  ];

  for (const scan of scans) {
    lines.push(
      [
        formatScanTimeCentralOnly(scan.ScanUTC),
        scan.BadgeNumberRaw,
        scan.EmployeeNameSnapshot,
        scan.Email,
        scan.CompanyNum,
        scan.EventNameSnapshot,
        scan.DeviceDisplayName,
      ]
        .map(csvEscape)
        .join(",")
    );
  }

  return `${lines.join("\r\n")}\r\n`;
}

export async function listIbadgeEvents() {
  return queryJsonArray<EventRecord>(`
    ${eventSelectSql("ORDER BY EventName")}
    FOR JSON PATH, INCLUDE_NULL_VALUES;
  `);
}

export async function createIbadgeEvent(name: string) {
  const trimmedName = name.trim();
  if (!trimmedName) {
    throw new Error("Event name is required.");
  }

  const existing = await queryJsonOne<EventRecord>(`
    ${eventSelectSql(`WHERE EventName = ${sqlNVarChar(trimmedName)}`)}
    FOR JSON PATH, WITHOUT_ARRAY_WRAPPER;
  `);

  if (existing) {
    return existing;
  }

  const created = await queryJsonOne<EventRecord>(`
    SET NOCOUNT ON;
    DECLARE @Inserted TABLE (EventID int);
    INSERT INTO dbo.Event (EventName, IsActive, CreatedUTC)
    OUTPUT inserted.EventID INTO @Inserted(EventID)
    VALUES (${sqlNVarChar(trimmedName)}, 1, SYSUTCDATETIME());

    SELECT
      CAST(e.EventID AS nvarchar(50)) AS EventId,
      e.EventName,
      CAST(e.IsActive AS bit) AS IsActive,
      ${currentUtcSql("e.CreatedUTC")} AS LastUpdatedUTC
    FROM dbo.Event e
    INNER JOIN @Inserted inserted ON inserted.EventID = e.EventID
    FOR JSON PATH, WITHOUT_ARRAY_WRAPPER;
  `);

  if (!created) {
    throw new Error("Event insert did not return a row.");
  }

  return created;
}

export async function updateIbadgeEvent(eventId: string, updates: { name: string; isActive: boolean }) {
  if (!isNumericId(eventId)) {
    throw new Error("Event ID must be numeric.");
  }

  const trimmedName = updates.name.trim();
  if (!trimmedName) {
    throw new Error("Event name is required.");
  }

  const updated = await queryJsonOne<EventRecord>(`
    SET NOCOUNT ON;
    UPDATE dbo.Event
    SET EventName = ${sqlNVarChar(trimmedName)},
        IsActive = ${updates.isActive ? 1 : 0}
    WHERE EventID = ${eventId};

    SELECT
      CAST(EventID AS nvarchar(50)) AS EventId,
      EventName,
      CAST(IsActive AS bit) AS IsActive,
      ${currentUtcSql("CreatedUTC")} AS LastUpdatedUTC
    FROM dbo.Event
    WHERE EventID = ${eventId}
    FOR JSON PATH, WITHOUT_ARRAY_WRAPPER;
  `);

  if (!updated) {
    throw new Error("Event update did not return a row.");
  }

  return updated;
}

export async function getCurrentDeviceRecord(deviceId?: string | null, deviceGuid?: string | null) {
  return getDeviceByIdentity(deviceId, deviceGuid);
}

export async function registerDeviceRecord(device: Partial<DeviceConfig>) {
  const ensured = await ensureDeviceRow({
    deviceId: device.DeviceId,
    deviceGuid: device.DeviceGuid,
    deviceName: device.DeviceName,
  });

  if (!ensured) {
    throw new Error("Unable to register device.");
  }

  return ensureInitialAssignment(ensured, device.ActiveEventId);
}

export async function updateCurrentDeviceRecord(device: Partial<DeviceConfig>) {
  const ensured = await ensureDeviceRow({
    deviceId: device.DeviceId,
    deviceGuid: device.DeviceGuid,
    deviceName: device.DeviceName,
  });

  if (!ensured) {
    throw new Error("Unable to update device.");
  }

  return getDeviceByIdentity(ensured.DeviceId, ensured.DeviceGuid);
}

export async function updateCurrentDeviceEventRecord(deviceId: string, eventId: string | null) {
  const device = await getDeviceByIdentity(deviceId, null);
  if (!device) {
    throw new Error("Device not found.");
  }

  if (eventId !== null && !isNumericId(eventId)) {
    throw new Error("Event ID must be numeric.");
  }

  const updated = await setActiveDeviceAssignment(device.DeviceId, eventId);
  if (!updated) {
    throw new Error("Unable to update active event.");
  }

  return updated;
}

export async function verifyAdminPinRecord(pin: string) {
  const normalized = String(pin ?? "").replace(/\D/g, "").slice(0, 4);
  if (normalized.length !== 4) {
    return { valid: false, authorized: false };
  }

  const config = await ensureAdminConfigRow();
  const authorized = await bcrypt.compare(normalized, config.PinHash);
  return { valid: authorized, authorized };
}

export async function getRefreshPayload(deviceId?: string | null, deviceGuid?: string | null): Promise<RefreshResponse> {
  const optionalColumns = await getEmployeeOptionalColumns();
  const [employees, events, device] = await Promise.all([
    queryJsonArray<EmployeeRecord>(employeeSelectSql(optionalColumns)),
    listIbadgeEvents(),
    getDeviceByIdentity(deviceId, deviceGuid),
  ]);

  if (device && isNumericId(device.DeviceId)) {
    await runSql(`
      SET NOCOUNT ON;
      UPDATE dbo.Device
      SET LastSeenUTC = SYSUTCDATETIME(),
          LastEmployeeSyncUTC = SYSUTCDATETIME(),
          LastEventSyncUTC = SYSUTCDATETIME()
      WHERE DeviceID = ${device.DeviceId};
    `);
  }

  return {
    employees,
    events,
    device,
    lastRefreshUTC: new Date().toISOString(),
  };
}

export async function insertScanRecord(scan: AttendanceScan, syncBatchId?: string | null) {
  const resolved = await resolveScanDependencies(scan);
  const optionalColumns = await getEmployeeOptionalColumns();
  const existingDuplicate = await findExistingEventDuplicate(
    resolved.eventId,
    scan.BadgeNumberNormalized,
    scan.ScanUTC,
    scan.ClassDurationHours ?? 1
  );

  if (existingDuplicate) {
    return {
      ...scan,
      EventId: existingDuplicate.EventId,
      EventNameSnapshot: existingDuplicate.EventNameSnapshot,
      EmpID: existingDuplicate.EmpID,
      EmployeeNameSnapshot: existingDuplicate.EmployeeNameSnapshot,
      Email: existingDuplicate.Email,
      CompanyNum: existingDuplicate.CompanyNum,
      ClassDurationHours: scan.ClassDurationHours ?? 1,
      ScanStatus: existingDuplicate.ScanStatus,
      SyncStatus: "SUPPRESSED" as const,
      SuppressedReason: "DuplicateBadgeForEvent",
    };
  }

  const createdRows = await queryJsonArray<AttendanceScan>(`
    SET NOCOUNT ON;
    DECLARE @Inserted TABLE (ScanID bigint);

    INSERT INTO dbo.BadgeScan (
      DeviceScanGuid,
      DeviceID,
      EventID,
      EmpID,
      BadgeNumberRaw,
      EmployeeNameSnapshot,
      ScanStatus,
      SyncStatus,
      SyncAttemptCount,
      LastSyncAttemptUTC,
      SyncErrorMessage,
      ScanUTC,
      DeviceLocalUTC,
      IsOfflineCaptured,
      SyncBatchID,
      CreatedUTC
    )
    OUTPUT inserted.ScanID INTO @Inserted(ScanID)
    VALUES (
      TRY_CONVERT(uniqueidentifier, ${sqlVarChar(scan.DeviceScanGuid)}),
      ${resolved.device.DeviceId},
      ${resolved.eventId},
      ${resolved.employeeId ?? "NULL"},
      ${sqlNVarChar(scan.BadgeNumberRaw)},
      ${sqlNVarChar(resolved.employeeName)},
      ${sqlNVarChar(resolved.scanStatus)},
      N'SYNCED',
      ${Number.isFinite(scan.SyncAttemptCount) ? Math.max(scan.SyncAttemptCount, 1) : 1},
      SYSUTCDATETIME(),
      NULL,
      ${sqlDateTime(scan.ScanUTC)},
      ${sqlDateTime(scan.DeviceLocalUTC ?? scan.ScanUTC)},
      ${sqlBool(Boolean(scan.IsOfflineCaptured))},
      ${syncBatchId && /^\d+$/.test(syncBatchId) ? syncBatchId : "NULL"},
      SYSUTCDATETIME()
    );

    ${scanSelectSql("WHERE bs.ScanID IN (SELECT ScanID FROM @Inserted)", optionalColumns)}
  `);
  const created = createdRows[0] ?? null;

  if (!created) {
    throw new Error("Scan insert did not return a row.");
  }

  return {
    ...created,
    Email: resolved.email,
    CompanyNum: resolved.companyNum,
    ClassDurationHours: scan.ClassDurationHours ?? 1,
  };
}

export async function syncBatchRecords(scans: AttendanceScan[]): Promise<SyncBatchResponse> {
  if (scans.length === 0) {
    return { syncedIds: [], failed: [] };
  }

  const first = scans[0];
  const device = await ensureDeviceRow({
    deviceId: first.DeviceId,
    deviceGuid: first.DeviceGuid,
    deviceName: first.DeviceDisplayName,
  });

  if (!device || !isNumericId(device.DeviceId)) {
    throw new Error("Unable to resolve device for sync batch.");
  }

  const batch = await queryJsonOne<{ SyncBatchID: string }>(`
    SET NOCOUNT ON;
    DECLARE @Inserted TABLE (SyncBatchID bigint);
    INSERT INTO dbo.SyncBatch (
      DeviceID,
      BatchGuid,
      BatchCreatedUTC,
      BatchReceivedUTC,
      RecordCount,
      Status
    )
    OUTPUT inserted.SyncBatchID INTO @Inserted(SyncBatchID)
    VALUES (
      ${device.DeviceId},
      TRY_CONVERT(uniqueidentifier, ${sqlVarChar(createUuid())}),
      SYSUTCDATETIME(),
      SYSUTCDATETIME(),
      ${scans.length},
      N'RECEIVED'
    );
    SELECT CAST(SyncBatchID AS nvarchar(50)) AS SyncBatchID
    FROM @Inserted
    FOR JSON PATH, WITHOUT_ARRAY_WRAPPER;
  `);

  if (!batch?.SyncBatchID) {
    throw new Error("Unable to create sync batch.");
  }

  const syncedIds: string[] = [];
  const failed: Array<{ deviceScanGuid: string; error?: string | null }> = [];

  for (const scan of scans) {
    try {
      const inserted = await insertScanRecord(scan, batch.SyncBatchID);
      syncedIds.push(inserted.DeviceScanGuid);
    } catch (error) {
      failed.push({
        deviceScanGuid: scan.DeviceScanGuid,
        error: error instanceof Error ? error.message : "Unable to sync scan.",
      });
    }
  }

  await runSql(`
    SET NOCOUNT ON;
    UPDATE dbo.SyncBatch
    SET Status = ${sqlNVarChar(failed.length > 0 ? (syncedIds.length > 0 ? "PARTIAL" : "FAILED") : "COMPLETED")}
    WHERE SyncBatchID = ${batch.SyncBatchID};
  `);

  return { syncedIds, failed };
}

export async function retryDeviceScans(deviceId: string): Promise<SyncBatchResponse> {
  if (!isNumericId(deviceId)) {
    return { syncedIds: [], failed: [] };
  }

  const rows = await queryJsonArray<{ DeviceScanGuid: string }>(`
    SET NOCOUNT ON;
    DECLARE @Updated TABLE (DeviceScanGuid uniqueidentifier);

    UPDATE dbo.BadgeScan
    SET SyncStatus = N'SYNCED',
        LastSyncAttemptUTC = SYSUTCDATETIME(),
        SyncErrorMessage = NULL
    OUTPUT inserted.DeviceScanGuid INTO @Updated(DeviceScanGuid)
    WHERE DeviceID = ${deviceId}
      AND SyncStatus IN (N'PENDING', N'FAILED');

    SELECT CONVERT(nvarchar(36), DeviceScanGuid) AS DeviceScanGuid
    FROM @Updated
    FOR JSON PATH, INCLUDE_NULL_VALUES;
  `);

  return { syncedIds: rows.map((row) => row.DeviceScanGuid), failed: [] };
}

export async function getReviewScansRecord(filters: ReviewFilters, currentDeviceId: string | null) {
  const optionalColumns = await getEmployeeOptionalColumns();
  return queryJsonArray<AttendanceScan>(
    scanSelectSql(`WHERE ${buildReviewWhere(filters, currentDeviceId)} ORDER BY bs.ScanUTC DESC`, optionalColumns)
  );
}

export async function buildExportResponse(
  format: "csv" | "excel" | "pdf",
  filters: ReviewFilters,
  currentDeviceId: string | null
) {
  const scans = await getReviewScansRecord(filters, currentDeviceId);
  const filenameBase = "ibadge-review";

  if (format === "csv" || format === "excel") {
    const body = buildCsv(scans);
    return new Response(body, {
      headers: {
        "Content-Type": format === "excel" ? "application/vnd.ms-excel; charset=utf-8" : "text/csv; charset=utf-8",
        "Content-Disposition": `attachment; filename="${filenameBase}.csv"`,
      },
    });
  }

  const events = await listIbadgeEvents();
  const eventDisplayName =
    filters.eventId === "all" || !filters.eventId
      ? "All events"
      : events.find((e) => e.EventId === filters.eventId)?.EventName ?? `Event ${filters.eventId}`;

  const pdf = await buildReviewPdfBuffer({
    eventDisplayName,
    filters,
    scans,
  });

  return new Response(pdf, {
    headers: {
      "Content-Type": "application/pdf",
      "Content-Disposition": `attachment; filename="${filenameBase}.pdf"`,
    },
  });
}
