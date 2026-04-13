import { assignDevDeviceEvent } from "@/lib/ibadge-dev-api";
import { forwardToUpstream } from "@/lib/ibadge-upstream";

export async function PUT(request: Request) {
  const proxied = await forwardToUpstream(request);
  if (proxied) {
    return proxied;
  }

  const body = (await request.json().catch(() => ({}))) as {
    deviceId?: string;
    eventId?: string | null;
    DeviceId?: string;
    EventId?: string | null;
  };
  const deviceId = String(body.deviceId ?? body.DeviceId ?? crypto.randomUUID());
  const eventId =
    body.eventId === null || body.EventId === null
      ? null
      : String(body.eventId ?? body.EventId ?? "").trim() || null;

  return Response.json(assignDevDeviceEvent(deviceId, deviceId, eventId));
}
