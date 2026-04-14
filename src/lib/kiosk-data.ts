import {
  createEvent,
  getCurrentDevice,
  getEvents,
  getReviewScans,
  postScan,
  registerCurrentDevice,
  syncScanBatch,
  triggerRefresh,
  triggerRetry,
  updateCurrentDevice,
  updateCurrentDeviceEvent,
} from "@/lib/api";
import type {
  AttendanceScan,
  DeviceConfig,
  EmployeeRecord,
  EventRecord,
  RefreshResponse,
  ReviewFilters,
  SyncBatchResponse,
  SyncMetadata,
} from "@/lib/kiosk-types";
import {
  buildReviewSummary,
  clampClassDurationHours,
  centralDateKey,
  employeeMatchForBadge,
  eventLabel,
  formatDisplayDate,
  matchesReviewFilters,
  normalizeBadge,
  nowUtcIso,
} from "@/lib/kiosk-utils";
import { createUuid } from "@/lib/uuid";
import {
  deletePendingScans,
  readDeviceConfig,
  readEmployees,
  readEvents,
  readPendingScans,
  readRecentScans,
  readSyncMetadata,
  replaceEmployees,
  replaceEvents,
  replaceRecentScans,
  upsertPendingScan,
  upsertRecentScan,
  writeDeviceConfig,
  writeSyncMetadata,
} from "@/lib/storage";

const RECENT_HISTORY_LIMIT = 150;

type KioskSnapshot = {
  employees: EmployeeRecord[];
  events: EventRecord[];
  device: DeviceConfig;
  pendingScans: AttendanceScan[];
  recentScans: AttendanceScan[];
  syncMetadata: SyncMetadata;
};

function isBrowserOnline() {
  return typeof navigator !== "undefined" ? navigator.onLine : false;
}

function createDeviceName() {
  return `Attendance Kiosk ${createUuid().slice(0, 4).toUpperCase()}`;
}

function makeLocalDeviceConfig(existing?: Partial<DeviceConfig>): DeviceConfig {
  const now = nowUtcIso();
  const guid = existing?.DeviceGuid ?? createUuid();
  return {
    DeviceId: existing?.DeviceId ?? guid,
    DeviceGuid: guid,
    DeviceName: existing?.DeviceName ?? createDeviceName(),
    ActiveEventId: existing?.ActiveEventId ?? null,
    ActiveEventName: existing?.ActiveEventName ?? null,
    ClassDurationHours: clampClassDurationHours(existing?.ClassDurationHours ?? 0.5),
    RegisteredUTC: existing?.RegisteredUTC ?? now,
    LastUpdatedUTC: now,
  };
}

function normalizeEmployee(raw: unknown): EmployeeRecord | null {
  if (!raw || typeof raw !== "object") {
    return null;
  }

  const candidate = raw as Record<string, unknown>;
  const badgeValue =
    String(candidate.BadgeNumberRaw ?? candidate.BadgeNumber ?? candidate.EmployeeNumber ?? candidate.badgeNumber ?? "").trim();
  const normalizedBadge = normalizeBadge(badgeValue);

  if (!normalizedBadge) {
    return null;
  }

  const emailRaw = candidate.Email ?? candidate.email ?? candidate.EmailAddress ?? candidate.WorkEmail ?? candidate.PrimaryEmail;
  const email = emailRaw == null || emailRaw === "" ? null : String(emailRaw).trim() || null;
  const companyNumRaw = candidate.CompanyNum ?? candidate.companyNum ?? candidate.CompanyNumber ?? candidate.companyNumber;
  const companyNum = companyNumRaw == null || companyNumRaw === "" ? null : String(companyNumRaw).trim() || null;

  return {
    EmpID: candidate.EmpID ? String(candidate.EmpID) : candidate.empId ? String(candidate.empId) : null,
    BadgeNumberRaw: badgeValue,
    BadgeNumberNormalized: normalizedBadge,
    EmployeeName: String(candidate.EmployeeName ?? candidate.FullName ?? candidate.Name ?? candidate.employeeName ?? "Unknown"),
    Email: email,
    CompanyNum: companyNum,
    IsActive: candidate.IsActive === false || candidate.active === false ? false : true,
    LastUpdatedUTC: candidate.LastUpdatedUTC ? String(candidate.LastUpdatedUTC) : nowUtcIso(),
  };
}

function normalizeEvent(raw: unknown): EventRecord | null {
  if (!raw || typeof raw !== "object") {
    return null;
  }

  const candidate = raw as Record<string, unknown>;
  const eventId = String(candidate.EventId ?? candidate.id ?? candidate.eventId ?? "").trim();
  const eventName = String(candidate.EventName ?? candidate.name ?? candidate.eventName ?? "").trim();

  if (!eventId || !eventName) {
    return null;
  }

  return {
    EventId: eventId,
    EventName: eventName,
    IsActive: candidate.IsActive === false ? false : true,
    LastUpdatedUTC: candidate.LastUpdatedUTC ? String(candidate.LastUpdatedUTC) : nowUtcIso(),
  };
}

function normalizeDevice(raw: unknown, fallback?: Partial<DeviceConfig>): DeviceConfig | null {
  if (!raw || typeof raw !== "object") {
    return fallback ? makeLocalDeviceConfig(fallback) : null;
  }

  const candidate = raw as Record<string, unknown>;
  const deviceId = String(candidate.DeviceId ?? candidate.deviceId ?? fallback?.DeviceId ?? "").trim();
  const deviceGuid = String(candidate.DeviceGuid ?? candidate.deviceGuid ?? fallback?.DeviceGuid ?? deviceId).trim();

  if (!deviceId && !deviceGuid) {
    return fallback ? makeLocalDeviceConfig(fallback) : null;
  }

  return makeLocalDeviceConfig({
    DeviceId: deviceId || deviceGuid,
    DeviceGuid: deviceGuid || deviceId,
    DeviceName: String(candidate.DeviceName ?? candidate.deviceName ?? fallback?.DeviceName ?? createDeviceName()),
    ActiveEventId:
      candidate.ActiveEventId === null || candidate.activeEventId === null
        ? null
        : String(candidate.ActiveEventId ?? candidate.activeEventId ?? fallback?.ActiveEventId ?? "").trim() || null,
    ActiveEventName:
      candidate.ActiveEventName === null || candidate.activeEventName === null
        ? null
        : String(candidate.ActiveEventName ?? candidate.activeEventName ?? fallback?.ActiveEventName ?? "").trim() || null,
    ClassDurationHours: clampClassDurationHours(
      candidate.ClassDurationHours ?? candidate.classDurationHours ?? fallback?.ClassDurationHours ?? 0.5
    ),
    RegisteredUTC: String(candidate.RegisteredUTC ?? candidate.registeredUtc ?? fallback?.RegisteredUTC ?? nowUtcIso()),
  });
}

export function normalizeReviewScan(raw: unknown): AttendanceScan | null {
  if (!raw || typeof raw !== "object") {
    return null;
  }

  const candidate = raw as Record<string, unknown>;
  const scanGuid = String(candidate.DeviceScanGuid ?? candidate.deviceScanGuid ?? candidate.id ?? "").trim();
  const deviceId = String(candidate.DeviceId ?? candidate.deviceId ?? "").trim();
  const badgeRaw = String(candidate.BadgeNumberRaw ?? candidate.badgeNumberRaw ?? candidate.badgeNumber ?? "").trim();

  if (!scanGuid || !deviceId || !badgeRaw) {
    return null;
  }

  return {
    DeviceScanGuid: scanGuid,
    DeviceId: deviceId,
    DeviceGuid: String(candidate.DeviceGuid ?? candidate.deviceGuid ?? deviceId),
    EventId:
      candidate.EventId === null || candidate.eventId === null
        ? null
        : String(candidate.EventId ?? candidate.eventId ?? "").trim() || null,
    EventNameSnapshot:
      candidate.EventNameSnapshot === null || candidate.eventNameSnapshot === null
        ? null
        : String(candidate.EventNameSnapshot ?? candidate.eventNameSnapshot ?? "").trim() || null,
    EmpID: candidate.EmpID ? String(candidate.EmpID) : candidate.empId ? String(candidate.empId) : null,
    BadgeNumberRaw: badgeRaw,
    BadgeNumberNormalized: normalizeBadge(badgeRaw),
    EmployeeNameSnapshot:
      candidate.EmployeeNameSnapshot === null || candidate.employeeNameSnapshot === null
        ? null
        : String(candidate.EmployeeNameSnapshot ?? candidate.employeeNameSnapshot ?? "").trim() || null,
    Email:
      candidate.Email === null || candidate.email === null
        ? null
        : String(candidate.Email ?? candidate.email ?? "").trim() || null,
    CompanyNum:
      candidate.CompanyNum === null || candidate.companyNum === null
        ? null
        : String(candidate.CompanyNum ?? candidate.companyNum ?? "").trim() || null,
    ClassDurationHours:
      candidate.ClassDurationHours === null || candidate.classDurationHours === null
        ? null
        : clampClassDurationHours(candidate.ClassDurationHours ?? candidate.classDurationHours),
    ScanStatus: String(candidate.ScanStatus ?? candidate.scanStatus ?? "UNKNOWN").toUpperCase() as AttendanceScan["ScanStatus"],
    SyncStatus: String(candidate.SyncStatus ?? candidate.syncStatus ?? "SYNCED").toUpperCase() as AttendanceScan["SyncStatus"],
    ScanUTC: String(candidate.ScanUTC ?? candidate.scanUtc ?? candidate.timestamp ?? nowUtcIso()),
    DeviceLocalUTC: String(candidate.DeviceLocalUTC ?? candidate.deviceLocalUtc ?? candidate.ScanUTC ?? nowUtcIso()),
    IsOfflineCaptured: Boolean(candidate.IsOfflineCaptured ?? candidate.isOfflineCaptured),
    SyncAttemptCount: Number(candidate.SyncAttemptCount ?? candidate.syncAttemptCount ?? 0),
    LastSyncAttemptUTC:
      candidate.LastSyncAttemptUTC === null || candidate.lastSyncAttemptUtc === null
        ? null
        : String(candidate.LastSyncAttemptUTC ?? candidate.lastSyncAttemptUtc ?? ""),
    SyncErrorMessage:
      candidate.SyncErrorMessage === null || candidate.syncErrorMessage === null
        ? null
        : String(candidate.SyncErrorMessage ?? candidate.syncErrorMessage ?? ""),
    OfflineCaptured: Boolean(candidate.IsOfflineCaptured ?? candidate.isOfflineCaptured),
    DeviceDisplayName: String(candidate.DeviceDisplayName ?? candidate.deviceName ?? candidate.DeviceName ?? deviceId),
    SuppressedReason:
      candidate.SuppressedReason === null || candidate.suppressedReason === null
        ? null
        : String(candidate.SuppressedReason ?? candidate.suppressedReason ?? ""),
  };
}

function mergeUniqueScans(scans: AttendanceScan[]) {
  const map = new Map<string, AttendanceScan>();
  for (const scan of scans) {
    map.set(scan.DeviceScanGuid, scan);
  }
  return Array.from(map.values()).sort((a, b) => (a.ScanUTC < b.ScanUTC ? 1 : -1));
}

async function persistRecentScans(scans: AttendanceScan[]) {
  await replaceRecentScans(scans.slice(0, RECENT_HISTORY_LIMIT));
}

function shouldRefreshReferences(metadata: SyncMetadata) {
  if (!metadata.LastReferenceRefreshUTC) {
    return true;
  }

  const last = new Date(metadata.LastReferenceRefreshUTC).getTime();
  return Date.now() - last >= appConfig.referenceRefreshHours * 60 * 60 * 1000;
}

async function ensureDeviceRegistration(localDevice: DeviceConfig) {
  if (!isBrowserOnline()) {
    return localDevice;
  }

  try {
    const remoteDevice = normalizeDevice(
      await getCurrentDevice(localDevice.DeviceId, localDevice.DeviceGuid),
      localDevice
    );

    if (remoteDevice) {
      await writeDeviceConfig(remoteDevice);
      return remoteDevice;
    }
  } catch {
    // Register below when lookup does not succeed.
  }

  try {
    const registered = normalizeDevice(await registerCurrentDevice(localDevice), localDevice) ?? localDevice;
    await writeDeviceConfig(registered);
    return registered;
  } catch {
    return localDevice;
  }
}

function setFirstEventIfNeeded(device: DeviceConfig, events: EventRecord[]) {
  if (device.ActiveEventId || events.length === 0) {
    return device;
  }

  const firstActive = events.find((event) => event.IsActive) ?? events[0];
  return {
    ...device,
    ActiveEventId: firstActive.EventId,
    ActiveEventName: firstActive.EventName,
    LastUpdatedUTC: nowUtcIso(),
  };
}

export async function loadKioskSnapshot(): Promise<KioskSnapshot> {
  const [employees, events, device, pendingScans, recentScans, syncMetadata] = await Promise.all([
    readEmployees(),
    readEvents(),
    readDeviceConfig(),
    readPendingScans(),
    readRecentScans(),
    readSyncMetadata(),
  ]);

  let resolvedDevice = device ?? makeLocalDeviceConfig();
  resolvedDevice = setFirstEventIfNeeded(resolvedDevice, events);
  await writeDeviceConfig(resolvedDevice);

  return {
    employees,
    events,
    device: resolvedDevice,
    pendingScans,
    recentScans,
    syncMetadata,
  };
}

export async function bootstrapKiosk(forceRefresh = false) {
  const snapshot = await loadKioskSnapshot();
  const registeredDevice = await ensureDeviceRegistration(snapshot.device);

  try {
    const refreshed = await refreshReferenceData(forceRefresh, registeredDevice);
    const finalDevice = setFirstEventIfNeeded(refreshed.device ?? registeredDevice, refreshed.events);
    await writeDeviceConfig(finalDevice);

    return {
      ...snapshot,
      ...refreshed,
      device: finalDevice,
    };
  } catch {
    const finalDevice = setFirstEventIfNeeded(registeredDevice, snapshot.events);
    await writeDeviceConfig(finalDevice);

    return {
      ...snapshot,
      device: finalDevice,
    };
  }
}

export async function refreshReferenceData(forceRefresh: boolean, device?: DeviceConfig) {
  const [cachedEmployees, cachedEvents, cachedMetadata] = await Promise.all([
    readEmployees(),
    readEvents(),
    readSyncMetadata(),
  ]);

  const resolvedDevice = device ?? (await readDeviceConfig()) ?? makeLocalDeviceConfig();

  if (!isBrowserOnline()) {
    return {
      employees: cachedEmployees,
      events: cachedEvents,
      device: resolvedDevice,
      syncMetadata: cachedMetadata,
    };
  }

  if (!forceRefresh && !shouldRefreshReferences(cachedMetadata) && cachedEmployees.length > 0 && cachedEvents.length > 0) {
    return {
      employees: cachedEmployees,
      events: cachedEvents,
      device: resolvedDevice,
      syncMetadata: cachedMetadata,
    };
  }

  let employees = cachedEmployees;
  let events = cachedEvents;
  let nextDevice = resolvedDevice;
  let didRefresh = false;

  const results = await Promise.allSettled([
    triggerRefresh({
      deviceId: resolvedDevice.DeviceId,
      deviceGuid: resolvedDevice.DeviceGuid,
      lastRefreshUTC: cachedMetadata.LastReferenceRefreshUTC,
    }),
    getEvents(),
    getCurrentDevice(resolvedDevice.DeviceId, resolvedDevice.DeviceGuid),
  ]);

  const refreshResult = results[0];
  if (refreshResult.status === "fulfilled") {
    didRefresh = true;
    const payload = refreshResult.value as RefreshResponse;
    const normalizedEmployees = (payload.employees ?? []).map(normalizeEmployee).filter(Boolean) as EmployeeRecord[];
    if (normalizedEmployees.length > 0) {
      employees = normalizedEmployees;
      await replaceEmployees(employees);
    }

    const inlineEvents = (payload.events ?? []).map(normalizeEvent).filter(Boolean) as EventRecord[];
    if (inlineEvents.length > 0) {
      events = inlineEvents;
      await replaceEvents(events);
    }

    const refreshedDevice = normalizeDevice(payload.device, nextDevice);
    if (refreshedDevice) {
      nextDevice = refreshedDevice;
      await writeDeviceConfig(nextDevice);
    }
  }

  const eventsResult = results[1];
  if (eventsResult.status === "fulfilled") {
    didRefresh = true;
    const normalizedEvents = eventsResult.value.map(normalizeEvent).filter(Boolean) as EventRecord[];
    if (normalizedEvents.length > 0) {
      events = normalizedEvents;
      await replaceEvents(events);
    }
  }

  const deviceResult = results[2];
  if (deviceResult.status === "fulfilled") {
    didRefresh = true;
    const normalizedDevice = normalizeDevice(deviceResult.value, nextDevice);
    if (normalizedDevice) {
      nextDevice = normalizedDevice;
      await writeDeviceConfig(nextDevice);
    }
  }

  const nextMetadata: SyncMetadata = {
    ...cachedMetadata,
    LastReferenceRefreshUTC: didRefresh ? nowUtcIso() : cachedMetadata.LastReferenceRefreshUTC,
  };

  if (didRefresh) {
    await writeSyncMetadata(nextMetadata);
  }

  return {
    employees,
    events,
    device: nextDevice,
    syncMetadata: nextMetadata,
  };
}

export function findSuppressedDuplicate(
  recentScans: AttendanceScan[],
  params: { badgeRaw: string; eventId: string | null; scanUtc?: string; classDurationHours: number }
) {
  const normalizedBadge = normalizeBadge(params.badgeRaw);
  const scanUtc = params.scanUtc ?? nowUtcIso();
  const scanTime = new Date(scanUtc).getTime();
  const scanDay = centralDateKey(scanUtc);
  const windowMs = clampClassDurationHours(params.classDurationHours) * 60 * 60 * 1000;

  return (
    recentScans.find((scan) => {
      if ((scan.EventId ?? null) !== (params.eventId ?? null)) {
        return false;
      }

      if (normalizeBadge(scan.BadgeNumberRaw) !== normalizedBadge) {
        return false;
      }

      if (centralDateKey(scan.ScanUTC) !== scanDay) {
        return false;
      }

      return scanTime - new Date(scan.ScanUTC).getTime() <= windowMs;
    }) ?? null
  );
}

export function createScanRecord(
  badgeRaw: string,
  device: DeviceConfig,
  employees: EmployeeRecord[],
  events: EventRecord[]
) {
  const matchedEmployee = employeeMatchForBadge(employees, badgeRaw);
  const currentEventName = eventLabel(events, device.ActiveEventId, device.ActiveEventName);
  const scanUtc = nowUtcIso();

  const scanStatus = !matchedEmployee ? "UNKNOWN" : matchedEmployee.IsActive ? "MATCHED" : "INACTIVE";

  const record: AttendanceScan = {
    DeviceScanGuid: createUuid(),
    DeviceId: device.DeviceId,
    DeviceGuid: device.DeviceGuid,
    EventId: device.ActiveEventId,
    EventNameSnapshot: currentEventName,
    EmpID: matchedEmployee?.EmpID ?? null,
    BadgeNumberRaw: badgeRaw.trim(),
    BadgeNumberNormalized: normalizeBadge(badgeRaw),
    EmployeeNameSnapshot: matchedEmployee?.EmployeeName ?? null,
    Email: matchedEmployee?.Email ?? null,
    CompanyNum: matchedEmployee?.CompanyNum ?? null,
    ClassDurationHours: device.ClassDurationHours,
    ScanStatus: scanStatus,
    SyncStatus: "PENDING",
    ScanUTC: scanUtc,
    DeviceLocalUTC: scanUtc,
    IsOfflineCaptured: !isBrowserOnline(),
    SyncAttemptCount: 0,
    LastSyncAttemptUTC: null,
    SyncErrorMessage: null,
    OfflineCaptured: !isBrowserOnline(),
    DeviceDisplayName: device.DeviceName,
    SuppressedReason: null,
  };

  return {
    record,
    matchedEmployee,
  };
}

async function persistQueuedScan(scan: AttendanceScan) {
  await Promise.all([upsertPendingScan(scan), upsertRecentScan(scan)]);
  const recent = mergeUniqueScans([scan, ...(await readRecentScans())]);
  await persistRecentScans(recent);
}

async function markScanAsSynced(scan: AttendanceScan) {
  const syncedScan: AttendanceScan = {
    ...scan,
    SyncStatus: "SYNCED",
    SyncErrorMessage: null,
    LastSyncAttemptUTC: nowUtcIso(),
  };

  const recent = mergeUniqueScans([syncedScan, ...(await readRecentScans())]);
  await Promise.all([persistRecentScans(recent), deletePendingScans([syncedScan.DeviceScanGuid])]);

  const metadata = await readSyncMetadata();
  await writeSyncMetadata({
    ...metadata,
    LastQueueSyncUTC: syncedScan.LastSyncAttemptUTC,
  });

  return syncedScan;
}

async function markScanAsFailed(scan: AttendanceScan, errorMessage: string) {
  const failedScan: AttendanceScan = {
    ...scan,
    SyncStatus: "FAILED",
    SyncAttemptCount: scan.SyncAttemptCount + 1,
    LastSyncAttemptUTC: nowUtcIso(),
    SyncErrorMessage: errorMessage,
  };

  await persistQueuedScan(failedScan);
  return failedScan;
}

export async function submitScan(record: AttendanceScan) {
  if (!isBrowserOnline()) {
    const offlineRecord = {
      ...record,
      SyncStatus: "PENDING" as const,
      IsOfflineCaptured: true,
      OfflineCaptured: true,
      SyncErrorMessage: "Captured offline.",
    };
    await persistQueuedScan(offlineRecord);
    return offlineRecord;
  }

  let currentRecord = record;

  for (let attempt = 0; attempt < 2; attempt += 1) {
    try {
      currentRecord = {
        ...currentRecord,
        SyncAttemptCount: currentRecord.SyncAttemptCount + 1,
        LastSyncAttemptUTC: nowUtcIso(),
      };

      const response = await postScan(currentRecord);
      const mergedScan = response.scan ? { ...currentRecord, ...response.scan } : currentRecord;
      if (response.accepted === false || mergedScan.SyncStatus === "SUPPRESSED" || Boolean(mergedScan.SuppressedReason)) {
        return {
          ...mergedScan,
          SyncStatus: "SUPPRESSED",
          SuppressedReason: mergedScan.SuppressedReason ?? "DuplicateBadgeForEvent",
        };
      }
      return await markScanAsSynced(mergedScan);
    } catch (error) {
      if (attempt === 1) {
        return markScanAsFailed(currentRecord, error instanceof Error ? error.message : "Unable to sync scan.");
      }
    }
  }

  return markScanAsFailed(currentRecord, "Unable to sync scan.");
}

function applySyncBatchResult(scans: AttendanceScan[], result: SyncBatchResponse) {
  const failed = new Map<string, string | null>();
  for (const item of result.failed ?? []) {
    failed.set(item.deviceScanGuid, item.error ?? "Retry failed.");
  }

  const syncedIds = new Set(result.syncedIds ?? []);

  return scans.map((scan) => {
    if (failed.has(scan.DeviceScanGuid)) {
      return {
        ...scan,
        SyncStatus: "FAILED" as const,
        SyncAttemptCount: scan.SyncAttemptCount + 1,
        LastSyncAttemptUTC: nowUtcIso(),
        SyncErrorMessage: failed.get(scan.DeviceScanGuid) ?? "Retry failed.",
      };
    }

    if (syncedIds.size === 0 || syncedIds.has(scan.DeviceScanGuid)) {
      return {
        ...scan,
        SyncStatus: "SYNCED" as const,
        LastSyncAttemptUTC: nowUtcIso(),
        SyncErrorMessage: null,
      };
    }

    return scan;
  });
}

export async function retryPendingQueue(options?: { useRetryEndpoint?: boolean }) {
  const pending = await readPendingScans();
  if (!isBrowserOnline() || pending.length === 0) {
    return { pending, synced: 0 };
  }

  let resolved = pending;

  try {
    const result = await syncScanBatch(pending);
    if (options?.useRetryEndpoint) {
      try {
        await triggerRetry(pending[0].DeviceId);
      } catch {
        // The local queue sync is the critical path. Server-side retry is optional.
      }
    }
    resolved = applySyncBatchResult(pending, result);
  } catch {
    resolved = await Promise.all(pending.map((scan) => submitScan(scan)));
  }

  const synced = resolved.filter((scan) => scan.SyncStatus === "SYNCED");
  const unsynced = resolved.filter((scan) => scan.SyncStatus !== "SYNCED");

  await Promise.all([
    deletePendingScans(synced.map((scan) => scan.DeviceScanGuid)),
    Promise.all(unsynced.map((scan) => upsertPendingScan(scan))),
    persistRecentScans(mergeUniqueScans([...resolved, ...(await readRecentScans())])),
  ]);

  const metadata = await readSyncMetadata();
  await writeSyncMetadata({
    ...metadata,
    LastRetryUTC: nowUtcIso(),
    LastQueueSyncUTC: synced.length > 0 ? nowUtcIso() : metadata.LastQueueSyncUTC,
  });

  return {
    pending: unsynced,
    synced: synced.length,
  };
}

export async function updateDeviceName(name: string) {
  const current = (await readDeviceConfig()) ?? makeLocalDeviceConfig();
  const nextDevice = {
    ...current,
    DeviceName: name.trim() || current.DeviceName,
    LastUpdatedUTC: nowUtcIso(),
  };

  await writeDeviceConfig(nextDevice);

  if (isBrowserOnline()) {
    try {
      const updated = normalizeDevice(await updateCurrentDevice(nextDevice), nextDevice) ?? nextDevice;
      await writeDeviceConfig(updated);
      return updated;
    } catch {
      return nextDevice;
    }
  }

  return nextDevice;
}

export async function updateDeviceConfiguration(name: string, eventId: string | null, events: EventRecord[]) {
  const current = (await readDeviceConfig()) ?? makeLocalDeviceConfig();
  const renamed = await updateDeviceName(name);
  const currentEvents = events.length > 0 ? events : await readEvents();
  const updatedEvent = await setActiveEvent(eventId, currentEvents);
  const nextDevice = {
    ...updatedEvent,
    DeviceName: renamed.DeviceName,
    ClassDurationHours: current.ClassDurationHours,
  };
  await writeDeviceConfig(nextDevice);
  return nextDevice;
}

export async function updateDeviceClassDuration(classDurationHours: number) {
  const current = (await readDeviceConfig()) ?? makeLocalDeviceConfig();
  const nextDevice = {
    ...current,
    ClassDurationHours: clampClassDurationHours(classDurationHours),
    LastUpdatedUTC: nowUtcIso(),
  };

  await writeDeviceConfig(nextDevice);
  return nextDevice;
}

export async function setActiveEvent(eventId: string | null, events: EventRecord[]) {
  const current = (await readDeviceConfig()) ?? makeLocalDeviceConfig();
  const selectedEvent = events.find((event) => event.EventId === eventId) ?? null;

  const nextDevice: DeviceConfig = {
    ...current,
    ActiveEventId: selectedEvent?.EventId ?? null,
    ActiveEventName: selectedEvent?.EventName ?? null,
    LastUpdatedUTC: nowUtcIso(),
  };

  await writeDeviceConfig(nextDevice);

  if (isBrowserOnline()) {
    try {
      const updated = normalizeDevice(
        await updateCurrentDeviceEvent({
          deviceId: nextDevice.DeviceId,
          eventId: selectedEvent?.EventId ?? null,
        }),
        nextDevice
      ) ?? nextDevice;
      await writeDeviceConfig(updated);
      return updated;
    } catch {
      return nextDevice;
    }
  }

  return nextDevice;
}

export async function createAndCacheEvent(name: string) {
  const created = normalizeEvent(await createEvent(name));
  if (!created) {
    throw new Error("Event creation did not return a usable event record.");
  }

  const events = mergeEvents([created, ...(await readEvents())]);
  await replaceEvents(events);
  return { created, events };
}

function mergeEvents(events: EventRecord[]) {
  const map = new Map<string, EventRecord>();
  for (const event of events) {
    map.set(event.EventId, event);
  }
  return Array.from(map.values()).sort((a, b) => a.EventName.localeCompare(b.EventName));
}

export async function getReviewData(filters: ReviewFilters, currentDeviceId: string | null) {
  const localScans = (await readRecentScans()).filter((scan) => matchesReviewFilters(scan, filters, currentDeviceId));

  if (!isBrowserOnline()) {
    return {
      scans: localScans,
      summary: buildReviewSummary(localScans),
      source: "local" as const,
      message:
        filters.deviceScope === "all"
          ? "Offline mode can only show scans cached on this device."
          : "Showing locally cached scans while offline.",
    };
  }

  try {
    const remote = (await getReviewScans(filters, currentDeviceId))
      .map(normalizeReviewScan)
      .filter(Boolean) as AttendanceScan[];

    const scans =
      filters.deviceScope === "current" ? mergeUniqueScans([...remote, ...localScans]).filter((scan) => matchesReviewFilters(scan, filters, currentDeviceId)) : remote;

    return {
      scans,
      summary: buildReviewSummary(scans),
      source: "remote" as const,
      message: `Review data refreshed from the API at ${formatDisplayDate(nowUtcIso())}.`,
    };
  } catch {
    return {
      scans: localScans,
      summary: buildReviewSummary(localScans),
      source: "local" as const,
      message: "Backend review endpoint is unavailable. Showing device-cached history.",
    };
  }
}

export function summarizeCountsByEvent(scans: AttendanceScan[], events: EventRecord[]) {
  const counts = new Map<string, { label: string; count: number }>();
  for (const scan of scans) {
    const eventId = scan.EventId ?? "none";
    const label = eventLabel(events, scan.EventId, scan.EventNameSnapshot);
    const current = counts.get(eventId) ?? { label, count: 0 };
    current.count += 1;
    counts.set(eventId, current);
  }

  return Array.from(counts.values()).sort((a, b) => b.count - a.count);
}

export type { KioskSnapshot };
