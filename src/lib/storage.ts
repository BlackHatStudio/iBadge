import type { AttendanceScan, DeviceConfig, EmployeeRecord, EventRecord, SyncMetadata } from "@/lib/kiosk-types";

const DB_NAME = "ibadge-kiosk-db";
const DB_VERSION = 2;

export const STORE_NAMES = {
  settings: "settings",
  employees: "employees",
  events: "events",
  pendingScans: "pendingScans",
  recentScans: "recentScans",
} as const;

const SETTINGS_KEYS = {
  deviceConfig: "deviceConfig",
  syncMetadata: "syncMetadata",
  adminPin: "adminPin",
} as const;

const FALLBACK_STORE_KEYS = {
  [STORE_NAMES.employees]: "ibadge:employees",
  [STORE_NAMES.events]: "ibadge:events",
  [STORE_NAMES.pendingScans]: "ibadge:pendingScans",
  [STORE_NAMES.recentScans]: "ibadge:recentScans",
} as const;

const FALLBACK_ROW_KEYS = {
  [STORE_NAMES.employees]: "BadgeNumberNormalized",
  [STORE_NAMES.events]: "EventId",
  [STORE_NAMES.pendingScans]: "DeviceScanGuid",
  [STORE_NAMES.recentScans]: "DeviceScanGuid",
} as const;

type StoreName = (typeof STORE_NAMES)[keyof typeof STORE_NAMES];

type SettingKey = (typeof SETTINGS_KEYS)[keyof typeof SETTINGS_KEYS];

let dbPromise: Promise<IDBDatabase> | null = null;

function canUseIndexedDb() {
  return typeof window !== "undefined" && "indexedDB" in window;
}

function openDb(): Promise<IDBDatabase> {
  if (!canUseIndexedDb()) {
    return Promise.reject(new Error("IndexedDB is not available."));
  }

  if (dbPromise) {
    return dbPromise;
  }

  dbPromise = new Promise((resolve, reject) => {
    const request = window.indexedDB.open(DB_NAME, DB_VERSION);

    request.onupgradeneeded = () => {
      const db = request.result;

      if (!db.objectStoreNames.contains(STORE_NAMES.settings)) {
        db.createObjectStore(STORE_NAMES.settings, { keyPath: "key" });
      }

      if (!db.objectStoreNames.contains(STORE_NAMES.employees)) {
        db.createObjectStore(STORE_NAMES.employees, { keyPath: "BadgeNumberNormalized" });
      }

      if (!db.objectStoreNames.contains(STORE_NAMES.events)) {
        db.createObjectStore(STORE_NAMES.events, { keyPath: "EventId" });
      }

      if (!db.objectStoreNames.contains(STORE_NAMES.pendingScans)) {
        db.createObjectStore(STORE_NAMES.pendingScans, { keyPath: "DeviceScanGuid" });
      }

      if (!db.objectStoreNames.contains(STORE_NAMES.recentScans)) {
        db.createObjectStore(STORE_NAMES.recentScans, { keyPath: "DeviceScanGuid" });
      }
    };

    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error ?? new Error("Unable to open IndexedDB."));
  });

  return dbPromise;
}

async function withStore<T>(
  storeName: StoreName,
  mode: IDBTransactionMode,
  callback: (store: IDBObjectStore, resolve: (value: T) => void, reject: (reason?: unknown) => void) => void
) {
  const db = await openDb();

  return new Promise<T>((resolve, reject) => {
    const transaction = db.transaction(storeName, mode);
    const store = transaction.objectStore(storeName);
    callback(store, resolve, reject);
    transaction.onerror = () => reject(transaction.error ?? new Error(`Transaction failed for ${storeName}.`));
  });
}

function localStorageRead<T>(key: string, fallback: T) {
  if (typeof window === "undefined") {
    return fallback;
  }

  try {
    const stored = window.localStorage.getItem(key);
    return stored ? (JSON.parse(stored) as T) : fallback;
  } catch {
    return fallback;
  }
}

function localStorageWrite<T>(key: string, value: T) {
  if (typeof window === "undefined") {
    return;
  }

  try {
    window.localStorage.setItem(key, JSON.stringify(value));
  } catch {
    // localStorage is best-effort fallback only
  }
}

function fallbackStoreKey(storeName: Exclude<StoreName, typeof STORE_NAMES.settings>) {
  return FALLBACK_STORE_KEYS[storeName];
}

function fallbackRowKey(storeName: Exclude<StoreName, typeof STORE_NAMES.settings>) {
  return FALLBACK_ROW_KEYS[storeName];
}

function readFallbackStore<T>(storeName: Exclude<StoreName, typeof STORE_NAMES.settings>) {
  return localStorageRead<T[]>(fallbackStoreKey(storeName), []);
}

function writeFallbackStore<T>(storeName: Exclude<StoreName, typeof STORE_NAMES.settings>, rows: T[]) {
  localStorageWrite(fallbackStoreKey(storeName), rows);
}

export async function readJson<T>(key: string, fallback: T): Promise<T> {
  if (typeof window === "undefined") {
    return fallback;
  }

  try {
    const record = await withStore<{ key: string; value: T } | undefined>(
      STORE_NAMES.settings,
      "readonly",
      (store, resolve, reject) => {
        const request = store.get(key);
        request.onsuccess = () => resolve(request.result as { key: string; value: T } | undefined);
        request.onerror = () => reject(request.error);
      }
    );

    return record?.value ?? fallback;
  } catch {
    return localStorageRead(key, fallback);
  }
}

export async function writeJson<T>(key: string, value: T): Promise<void> {
  if (typeof window === "undefined") {
    return;
  }

  try {
    await withStore<void>(STORE_NAMES.settings, "readwrite", (store, resolve, reject) => {
      const request = store.put({ key, value });
      request.onsuccess = () => resolve();
      request.onerror = () => reject(request.error);
    });
  } catch {
    localStorageWrite(key, value);
  }
}

export async function readDeviceConfig(): Promise<DeviceConfig | null> {
  return readJson<DeviceConfig | null>(SETTINGS_KEYS.deviceConfig, null);
}

export async function writeDeviceConfig(config: DeviceConfig): Promise<void> {
  await writeJson<DeviceConfig>(SETTINGS_KEYS.deviceConfig, config);
}

export async function readSyncMetadata(): Promise<SyncMetadata> {
  return readJson<SyncMetadata>(SETTINGS_KEYS.syncMetadata, {
    LastReferenceRefreshUTC: null,
    LastQueueSyncUTC: null,
    LastRetryUTC: null,
    LastReconnectUTC: null,
  });
}

export async function writeSyncMetadata(metadata: SyncMetadata): Promise<void> {
  await writeJson<SyncMetadata>(SETTINGS_KEYS.syncMetadata, metadata);
}

export async function readAdminPinSetting(fallback: string) {
  return readJson<string>(SETTINGS_KEYS.adminPin, fallback);
}

export async function writeAdminPinSetting(pin: string) {
  await writeJson<string>(SETTINGS_KEYS.adminPin, pin);
}

async function readAllFromStore<T>(storeName: StoreName): Promise<T[]> {
  try {
    return await withStore<T[]>(storeName, "readonly", (store, resolve, reject) => {
      const request = store.getAll();
      request.onsuccess = () => resolve((request.result as T[]) ?? []);
      request.onerror = () => reject(request.error);
    });
  } catch {
    if (storeName === STORE_NAMES.settings) {
      return [];
    }

    return readFallbackStore<T>(storeName);
  }
}

async function clearStore(storeName: StoreName) {
  try {
    await withStore<void>(storeName, "readwrite", (store, resolve, reject) => {
      const request = store.clear();
      request.onsuccess = () => resolve();
      request.onerror = () => reject(request.error);
    });
  } catch {
    if (storeName !== STORE_NAMES.settings) {
      writeFallbackStore(storeName, []);
    }
  }
}

async function writeManyToStore<T>(storeName: StoreName, rows: T[]) {
  try {
    await withStore<void>(storeName, "readwrite", (store, resolve, reject) => {
      for (const row of rows) {
        store.put(row);
      }

      store.transaction.oncomplete = () => resolve();
      store.transaction.onerror = () => reject(store.transaction.error);
    });
  } catch {
    if (storeName === STORE_NAMES.settings) {
      return;
    }

    const keyField = fallbackRowKey(storeName);
    const existingRows = readFallbackStore<Record<string, unknown>>(storeName);
    const nextRows = new Map(existingRows.map((row) => [String(row[keyField]), row]));

    for (const row of rows as Record<string, unknown>[]) {
      nextRows.set(String(row[keyField]), row);
    }

    writeFallbackStore(storeName, Array.from(nextRows.values()) as T[]);
  }
}

async function deleteKeys(storeName: StoreName, keys: string[]) {
  try {
    await withStore<void>(storeName, "readwrite", (store, resolve, reject) => {
      for (const key of keys) {
        store.delete(key);
      }

      store.transaction.oncomplete = () => resolve();
      store.transaction.onerror = () => reject(store.transaction.error);
    });
  } catch {
    if (storeName === STORE_NAMES.settings) {
      return;
    }

    const keyField = fallbackRowKey(storeName);
    const keysToDelete = new Set(keys);
    const existingRows = readFallbackStore<Record<string, unknown>>(storeName);
    writeFallbackStore(
      storeName,
      existingRows.filter((row) => !keysToDelete.has(String(row[keyField])))
    );
  }
}

export async function readEmployees(): Promise<EmployeeRecord[]> {
  return readAllFromStore<EmployeeRecord>(STORE_NAMES.employees);
}

export async function replaceEmployees(employees: EmployeeRecord[]) {
  await clearStore(STORE_NAMES.employees);
  if (employees.length > 0) {
    await writeManyToStore(STORE_NAMES.employees, employees);
  }
}

export async function readEvents(): Promise<EventRecord[]> {
  return readAllFromStore<EventRecord>(STORE_NAMES.events);
}

export async function replaceEvents(events: EventRecord[]) {
  await clearStore(STORE_NAMES.events);
  if (events.length > 0) {
    await writeManyToStore(STORE_NAMES.events, events);
  }
}

export async function readPendingScans(): Promise<AttendanceScan[]> {
  const scans = await readAllFromStore<AttendanceScan>(STORE_NAMES.pendingScans);
  return scans.sort((a, b) => (a.ScanUTC < b.ScanUTC ? 1 : -1));
}

export async function upsertPendingScan(scan: AttendanceScan) {
  await writeManyToStore(STORE_NAMES.pendingScans, [scan]);
}

export async function deletePendingScans(scanIds: string[]) {
  if (scanIds.length === 0) {
    return;
  }

  await deleteKeys(STORE_NAMES.pendingScans, scanIds);
}

export async function readRecentScans(): Promise<AttendanceScan[]> {
  const scans = await readAllFromStore<AttendanceScan>(STORE_NAMES.recentScans);
  return scans.sort((a, b) => (a.ScanUTC < b.ScanUTC ? 1 : -1));
}

export async function replaceRecentScans(scans: AttendanceScan[]) {
  await clearStore(STORE_NAMES.recentScans);
  if (scans.length > 0) {
    await writeManyToStore(STORE_NAMES.recentScans, scans);
  }
}

export async function upsertRecentScan(scan: AttendanceScan) {
  await writeManyToStore(STORE_NAMES.recentScans, [scan]);
}

export async function deleteRecentScans(scanIds: string[]) {
  if (scanIds.length === 0) {
    return;
  }

  await deleteKeys(STORE_NAMES.recentScans, scanIds);
}
