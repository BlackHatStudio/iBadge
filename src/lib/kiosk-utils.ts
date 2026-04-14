import type { AttendanceScan, EmployeeRecord, EventRecord, ReviewFilters, ReviewSummary } from "@/lib/kiosk-types";

export function normalizeBadge(value: string) {
  const normalized = value.trim().replace(/\s+/g, "").toUpperCase();
  if (/^\d+$/.test(normalized)) {
    return normalized.replace(/^0+(?=\d)/, "");
  }
  return normalized;
}

export function formatDisplayDate(value: string | null | undefined) {
  if (!value) {
    return "Not available";
  }

  const date = new Date(value);
  if (Number.isNaN(date.getTime())) {
    return value;
  }

  return date.toLocaleString();
}

/** Scan instant as local time in US Central (handles CST/CDT). Time of day only — use when the report header already states the date range. */
export function formatScanTimeCentralOnly(iso: string | null | undefined): string {
  if (!iso) {
    return "";
  }
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) {
    return String(iso);
  }
  return d.toLocaleTimeString("en-US", {
    timeZone: "America/Chicago",
    hour: "numeric",
    minute: "2-digit",
    hour12: true,
  });
}

export function nowUtcIso() {
  return new Date().toISOString();
}

export function clampClassDurationHours(value: number | string | null | undefined) {
  const parsed = Number(value);
  if (!Number.isFinite(parsed)) {
    return 0.5;
  }
  const rounded = Math.round(parsed * 2) / 2;
  return Math.min(4, Math.max(0.5, rounded));
}

export function centralDateKey(value: string | null | undefined) {
  if (!value) {
    return "";
  }

  const date = new Date(value);
  if (Number.isNaN(date.getTime())) {
    return "";
  }

  return new Intl.DateTimeFormat("en-CA", {
    timeZone: "America/Chicago",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(date);
}

/** Local calendar date as YYYY-MM-DD for `<input type="date">`. */
export function localDateString(date: Date = new Date()) {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

export function createDefaultReviewFilters(activeEventId: string | null): ReviewFilters {
  const today = localDateString();
  return {
    eventId: activeEventId ?? "all",
    deviceScope: "current",
    dateFrom: today,
    dateTo: today,
    employee: "",
    badgeNumber: "",
    device: "",
    scanStatus: "all",
    syncStatus: "all",
  };
}

export function matchesReviewFilters(
  scan: AttendanceScan,
  filters: ReviewFilters,
  currentDeviceId: string | null
) {
  if (filters.deviceScope === "current" && currentDeviceId && scan.DeviceId !== currentDeviceId) {
    return false;
  }

  if (filters.eventId !== "all" && scan.EventId !== filters.eventId) {
    return false;
  }

  if (filters.scanStatus !== "all" && scan.ScanStatus !== filters.scanStatus) {
    return false;
  }

  if (filters.syncStatus !== "all" && scan.SyncStatus !== filters.syncStatus) {
    return false;
  }

  if (filters.device && !scan.DeviceDisplayName.toLowerCase().includes(filters.device.toLowerCase())) {
    return false;
  }

  if (filters.employee) {
    const employeeQuery = filters.employee.toLowerCase();
    const matchesName = (scan.EmployeeNameSnapshot ?? "").toLowerCase().includes(employeeQuery);
    const matchesEmpId = (scan.EmpID ?? "").toLowerCase().includes(employeeQuery);
    if (!matchesName && !matchesEmpId) {
      return false;
    }
  }

  if (filters.badgeNumber && !scan.BadgeNumberRaw.toLowerCase().includes(filters.badgeNumber.toLowerCase())) {
    return false;
  }

  if (filters.dateFrom) {
    const from = new Date(`${filters.dateFrom}T00:00:00`).getTime();
    if (new Date(scan.ScanUTC).getTime() < from) {
      return false;
    }
  }

  if (filters.dateTo) {
    const to = new Date(`${filters.dateTo}T23:59:59.999`).getTime();
    if (new Date(scan.ScanUTC).getTime() > to) {
      return false;
    }
  }

  return true;
}

export function buildReviewSummary(scans: AttendanceScan[]): ReviewSummary {
  return scans.reduce<ReviewSummary>(
    (summary, scan) => {
      summary.total += 1;
      if (scan.ScanStatus === "MATCHED") summary.matched += 1;
      if (scan.ScanStatus === "UNKNOWN") summary.unknown += 1;
      if (scan.ScanStatus === "INACTIVE") summary.inactive += 1;
      if (scan.SyncStatus === "PENDING" || scan.SyncStatus === "FAILED") summary.pending += 1;
      if (scan.SyncStatus === "SYNCED") summary.synced += 1;
      if (scan.IsOfflineCaptured) summary.offlineCaptured += 1;
      return summary;
    },
    {
      total: 0,
      matched: 0,
      unknown: 0,
      inactive: 0,
      pending: 0,
      synced: 0,
      offlineCaptured: 0,
    }
  );
}

export function eventLabel(events: EventRecord[], eventId: string | null, fallback: string | null) {
  if (!eventId) {
    return fallback ?? "No event selected";
  }

  return events.find((event) => event.EventId === eventId)?.EventName ?? fallback ?? "Unknown event";
}

export function employeeMatchForBadge(employees: EmployeeRecord[], badgeValue: string) {
  const normalized = normalizeBadge(badgeValue);
  return employees.find((employee) => employee.BadgeNumberNormalized === normalized) ?? null;
}

export function createExportQuery(filters: ReviewFilters, deviceId: string | null) {
  const params = new URLSearchParams();

  if (filters.eventId && filters.eventId !== "all") params.set("eventId", filters.eventId);
  if (filters.dateFrom) params.set("dateFrom", filters.dateFrom);
  if (filters.dateTo) params.set("dateTo", filters.dateTo);
  if (filters.employee) params.set("employee", filters.employee);
  if (filters.badgeNumber) params.set("badgeNumber", filters.badgeNumber);
  if (filters.device) params.set("device", filters.device);
  if (filters.scanStatus && filters.scanStatus !== "all") params.set("scanStatus", filters.scanStatus);
  if (filters.syncStatus && filters.syncStatus !== "all") params.set("syncStatus", filters.syncStatus);
  params.set("deviceScope", filters.deviceScope);
  if (filters.deviceScope === "current" && deviceId) params.set("deviceId", deviceId);

  return params.toString();
}

/**
 * Parses CSV text into rows (RFC-style quoted fields; strips UTF-8 BOM).
 */
export function parseCsvTextToRows(text: string): string[][] {
  const rows: string[][] = [];
  const input = text.replace(/^\uFEFF/, "");
  let row: string[] = [];
  let field = "";
  let i = 0;
  let inQuotes = false;

  while (i < input.length) {
    const c = input[i];
    if (inQuotes) {
      if (c === '"') {
        if (input[i + 1] === '"') {
          field += '"';
          i += 2;
          continue;
        }
        inQuotes = false;
        i += 1;
        continue;
      }
      field += c;
      i += 1;
      continue;
    }
    if (c === '"') {
      inQuotes = true;
      i += 1;
      continue;
    }
    if (c === ",") {
      row.push(field);
      field = "";
      i += 1;
      continue;
    }
    if (c === "\r") {
      if (input[i + 1] === "\n") {
        i += 1;
      }
      row.push(field);
      field = "";
      rows.push(row);
      row = [];
      i += 1;
      continue;
    }
    if (c === "\n") {
      row.push(field);
      field = "";
      rows.push(row);
      row = [];
      i += 1;
      continue;
    }
    field += c;
    i += 1;
  }

  row.push(field);
  const lastRowEmpty = row.length === 1 && row[0] === "";
  if (!lastRowEmpty) {
    rows.push(row);
  }

  return rows.filter((r) => r.some((cell) => String(cell).trim().length > 0));
}
