import type { DeviceConfig, EventRecord, RefreshResponse } from "@/lib/kiosk-types";

export const LOCAL_DEFAULT_EVENT_ID = "ibadge-local-default";

type DevStore = {
  devices: Map<string, DeviceConfig>;
  events: EventRecord[];
};

declare global {
  var __ibadgeDevStore: DevStore | undefined;
}

function nowUtcIso() {
  return new Date().toISOString();
}

function cloneEvent(event: EventRecord): EventRecord {
  return { ...event };
}

function cloneDevice(device: DeviceConfig): DeviceConfig {
  return { ...device };
}

function defaultEvent(): EventRecord {
  return {
    EventId: LOCAL_DEFAULT_EVENT_ID,
    EventName: "Safety Orientation",
    IsActive: true,
    LastUpdatedUTC: nowUtcIso(),
  };
}

function createDefaultDevice(deviceId: string, deviceGuid: string): DeviceConfig {
  const event = devEventsList()[0] ?? defaultEvent();
  const now = nowUtcIso();

  return {
    DeviceId: deviceId,
    DeviceGuid: deviceGuid,
    DeviceName: "Local Dev Kiosk",
    ActiveEventId: event.EventId,
    ActiveEventName: event.EventName,
    RegisteredUTC: now,
    LastUpdatedUTC: now,
  };
}

function getStore(): DevStore {
  if (!globalThis.__ibadgeDevStore) {
    globalThis.__ibadgeDevStore = {
      devices: new Map<string, DeviceConfig>(),
      events: [defaultEvent()],
    };
  }

  return globalThis.__ibadgeDevStore;
}

function findEvent(eventId: string | null | undefined) {
  if (!eventId) {
    return null;
  }

  return getStore().events.find((event) => event.EventId === eventId) ?? null;
}

export function devEventsList() {
  return getStore().events.map(cloneEvent);
}

export function createDevEvent(name: string) {
  const event: EventRecord = {
    EventId: crypto.randomUUID(),
    EventName: name,
    IsActive: true,
    LastUpdatedUTC: nowUtcIso(),
  };

  const store = getStore();
  store.events = [...store.events, event].sort((a, b) => a.EventName.localeCompare(b.EventName));

  return cloneEvent(event);
}

export function devDeviceFromRequest(request: Request) {
  const url = new URL(request.url);
  const deviceId = url.searchParams.get("deviceId")?.trim() || crypto.randomUUID();
  const deviceGuid = url.searchParams.get("deviceGuid")?.trim() || deviceId;
  const store = getStore();
  const existing = store.devices.get(deviceId);

  if (existing) {
    if (existing.DeviceGuid !== deviceGuid) {
      const nextDevice = { ...existing, DeviceGuid: deviceGuid, LastUpdatedUTC: nowUtcIso() };
      store.devices.set(deviceId, nextDevice);
      return cloneDevice(nextDevice);
    }

    return cloneDevice(existing);
  }

  const nextDevice = createDefaultDevice(deviceId, deviceGuid);
  store.devices.set(deviceId, nextDevice);
  return cloneDevice(nextDevice);
}

export function upsertDevDevice(partial: Partial<DeviceConfig> & Pick<DeviceConfig, "DeviceId" | "DeviceGuid">) {
  const store = getStore();
  const existing = store.devices.get(partial.DeviceId);
  const fallbackEvent = findEvent(partial.ActiveEventId ?? existing?.ActiveEventId) ?? devEventsList()[0] ?? null;
  const now = nowUtcIso();

  const nextDevice: DeviceConfig = {
    DeviceId: partial.DeviceId,
    DeviceGuid: partial.DeviceGuid,
    DeviceName: partial.DeviceName?.trim() || existing?.DeviceName || "Local Dev Kiosk",
    ActiveEventId:
      partial.ActiveEventId === undefined
        ? existing?.ActiveEventId ?? fallbackEvent?.EventId ?? null
        : partial.ActiveEventId,
    ActiveEventName:
      partial.ActiveEventName === undefined
        ? existing?.ActiveEventName ?? fallbackEvent?.EventName ?? null
        : partial.ActiveEventName,
    RegisteredUTC: partial.RegisteredUTC ?? existing?.RegisteredUTC ?? now,
    LastUpdatedUTC: now,
  };

  store.devices.set(nextDevice.DeviceId, nextDevice);
  return cloneDevice(nextDevice);
}

export function assignDevDeviceEvent(deviceId: string, deviceGuid: string, eventId: string | null) {
  const selectedEvent = findEvent(eventId);
  return upsertDevDevice({
    DeviceId: deviceId,
    DeviceGuid: deviceGuid,
    ActiveEventId: selectedEvent?.EventId ?? null,
    ActiveEventName: selectedEvent?.EventName ?? null,
  });
}

export function devRefreshBody(deviceId?: string): RefreshResponse {
  const now = nowUtcIso();
  const device = deviceId ? getStore().devices.get(deviceId) ?? null : null;

  return {
    employees: [],
    events: devEventsList(),
    device: device ? cloneDevice(device) : null,
    lastRefreshUTC: now,
  };
}
