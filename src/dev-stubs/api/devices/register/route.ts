import { devEventsList, upsertDevDevice } from "@/lib/ibadge-dev-api";
import { forwardToUpstream } from "@/lib/ibadge-upstream";
import { createUuid } from "@/lib/uuid";

export async function POST(request: Request) {
  const proxied = await forwardToUpstream(request);
  if (proxied) {
    return proxied;
  }

  const body = (await request.json().catch(() => ({}))) as Record<string, unknown>;
  const now = new Date().toISOString();
  const deviceId = String(body.DeviceId ?? body.deviceId ?? createUuid());
  const deviceGuid = String(body.DeviceGuid ?? body.deviceGuid ?? deviceId);

  const defaultEvent = devEventsList()[0];

  return Response.json(
    upsertDevDevice({
      DeviceId: deviceId,
      DeviceGuid: deviceGuid,
      DeviceName: String(body.DeviceName ?? body.deviceName ?? "Kiosk"),
      ActiveEventId:
        body.ActiveEventId === null || body.activeEventId === null
          ? null
          : String(body.ActiveEventId ?? body.activeEventId ?? defaultEvent?.EventId ?? "") || null,
      ActiveEventName:
        body.ActiveEventName === null || body.activeEventName === null
          ? null
          : String(body.ActiveEventName ?? body.activeEventName ?? defaultEvent?.EventName ?? "") || null,
      RegisteredUTC: String(body.RegisteredUTC ?? body.registeredUtc ?? now),
    })
  );
}
