import { buildApiUrl } from "@/lib/app-config";
import type {
  AttendanceScan,
  DeviceConfig,
  EventRecord,
  RefreshPayload,
  RefreshResponse,
  ReviewFilters,
  SyncBatchResponse,
} from "@/lib/kiosk-types";
import { createExportQuery } from "@/lib/kiosk-utils";

async function request<T>(path: string, init?: RequestInit): Promise<T> {
  const response = await fetch(buildApiUrl(path), {
    ...init,
    headers: {
      "Content-Type": "application/json",
      ...(init?.headers ?? {}),
    },
    cache: "no-store",
  });

  if (!response.ok) {
    const errorText = await response.text().catch(() => "");
    throw new Error(errorText || `Request failed with status ${response.status}.`);
  }

  if (response.status === 204) {
    return undefined as T;
  }

  return (await response.json()) as T;
}

function deviceQuery(deviceId?: string, deviceGuid?: string) {
  const params = new URLSearchParams();
  if (deviceId) params.set("deviceId", deviceId);
  if (deviceGuid) params.set("deviceGuid", deviceGuid);
  const query = params.toString();
  return query ? `?${query}` : "";
}

export async function postScan(scan: AttendanceScan) {
  return request<{ accepted?: boolean; scan?: Partial<AttendanceScan> }>("/scans", {
    method: "POST",
    body: JSON.stringify(scan),
  });
}

export async function syncScanBatch(scans: AttendanceScan[]) {
  return request<SyncBatchResponse>("/scans/sync-batch", {
    method: "POST",
    body: JSON.stringify({ scans }),
  });
}

export async function getEvents() {
  return request<unknown[]>("/events", { method: "GET" });
}

export async function createEvent(name: string) {
  return request<EventRecord>("/events", {
    method: "POST",
    body: JSON.stringify({ eventName: name }),
  });
}

export async function updateEvent(eventId: string, payload: { name: string; isActive: boolean }) {
  return request<EventRecord>("/events", {
    method: "PUT",
    body: JSON.stringify({ eventId, ...payload }),
  });
}

export async function getCurrentDevice(deviceId?: string, deviceGuid?: string) {
  return request<unknown>(`/devices/current${deviceQuery(deviceId, deviceGuid)}`, { method: "GET" });
}

export async function registerCurrentDevice(device: DeviceConfig) {
  return request<unknown>("/devices/register", {
    method: "POST",
    body: JSON.stringify(device),
  });
}

export async function updateCurrentDevice(device: Partial<DeviceConfig>) {
  return request<unknown>("/devices/current", {
    method: "PUT",
    body: JSON.stringify(device),
  });
}

export async function updateCurrentDeviceEvent(payload: { deviceId: string; eventId: string | null }) {
  return request<unknown>("/devices/current/event", {
    method: "PUT",
    body: JSON.stringify(payload),
  });
}

export async function verifyAdminPinRemote(pin: string, deviceId: string | null) {
  return request<{ valid?: boolean; authorized?: boolean }>("/admin/pin/verify", {
    method: "POST",
    body: JSON.stringify({ pin, deviceId }),
  });
}

export async function triggerRefresh(payload: RefreshPayload) {
  return request<RefreshResponse>("/sync/refresh", {
    method: "POST",
    body: JSON.stringify(payload),
  });
}

export async function triggerRetry(deviceId: string) {
  return request<SyncBatchResponse>("/sync/retry", {
    method: "POST",
    body: JSON.stringify({ deviceId }),
  });
}

export async function getReviewScans(filters: ReviewFilters, deviceId: string | null) {
  const query = createExportQuery(filters, deviceId);
  return request<unknown[]>(`/scans/review${query ? `?${query}` : ""}`, { method: "GET" });
}

export function getExportUrl(format: "csv" | "excel" | "pdf", filters: ReviewFilters, deviceId: string | null) {
  const path =
    format === "csv"
      ? "/reports/export/csv"
      : format === "excel"
        ? "/reports/export/excel"
        : "/reports/export/pdf";
  const query = createExportQuery(filters, deviceId);
  return buildApiUrl(query ? `${path}?${query}` : path);
}
