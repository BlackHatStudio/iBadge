export type ScanStatus = "MATCHED" | "UNKNOWN" | "INACTIVE";

export type SyncStatus = "PENDING" | "SYNCED" | "FAILED" | "SUPPRESSED";

export type DeviceScope = "current" | "all";

export interface EmployeeRecord {
  EmpID: string | null;
  BadgeNumberRaw: string;
  BadgeNumberNormalized: string;
  EmployeeName: string;
  Email: string | null;
  IsActive: boolean;
  LastUpdatedUTC: string | null;
}

export interface EventRecord {
  EventId: string;
  EventName: string;
  IsActive: boolean;
  LastUpdatedUTC: string | null;
}

export interface DeviceConfig {
  DeviceId: string;
  DeviceGuid: string;
  DeviceName: string;
  ActiveEventId: string | null;
  ActiveEventName: string | null;
  RegisteredUTC: string;
  LastUpdatedUTC: string;
}

export interface AttendanceScan {
  DeviceScanGuid: string;
  DeviceId: string;
  DeviceGuid: string;
  EventId: string | null;
  EventNameSnapshot: string | null;
  EmpID: string | null;
  BadgeNumberRaw: string;
  BadgeNumberNormalized: string;
  EmployeeNameSnapshot: string | null;
  ScanStatus: ScanStatus;
  SyncStatus: SyncStatus;
  ScanUTC: string;
  DeviceLocalUTC: string;
  IsOfflineCaptured: boolean;
  SyncAttemptCount: number;
  LastSyncAttemptUTC: string | null;
  SyncErrorMessage: string | null;
  OfflineCaptured: boolean;
  DeviceDisplayName: string;
  SuppressedReason: string | null;
}

export interface SyncMetadata {
  LastReferenceRefreshUTC: string | null;
  LastQueueSyncUTC: string | null;
  LastRetryUTC: string | null;
  LastReconnectUTC: string | null;
}

export interface ReviewFilters {
  eventId: string;
  deviceScope: DeviceScope;
  dateFrom: string;
  dateTo: string;
  employee: string;
  badgeNumber: string;
  device: string;
  scanStatus: string;
  syncStatus: string;
}

export interface ReviewSummary {
  total: number;
  matched: number;
  unknown: number;
  inactive: number;
  pending: number;
  synced: number;
  offlineCaptured: number;
}

export interface RefreshPayload {
  deviceId: string;
  deviceGuid: string;
  lastRefreshUTC: string | null;
}

export interface RefreshResponse {
  employees?: unknown[];
  events?: unknown[];
  device?: unknown;
  lastRefreshUTC?: string | null;
}

export interface SyncBatchResponse {
  syncedIds?: string[];
  failed?: Array<{
    deviceScanGuid: string;
    error?: string | null;
  }>;
}
