import { updateCurrentDeviceEventRecord } from "@/lib/ibadge-db";
import { forwardToUpstream } from "@/lib/ibadge-upstream";

export const runtime = "nodejs";

export async function PUT(request: Request) {
  const proxied = await forwardToUpstream(request);
  if (proxied) {
    return proxied;
  }

  try {
    const body = (await request.json().catch(() => ({}))) as Record<string, unknown>;
    const deviceId = String(body.deviceId ?? body.DeviceId ?? "").trim();
    const eventId =
      body.eventId === null || body.EventId === null
        ? null
        : String(body.eventId ?? body.EventId ?? "").trim() || null;

    const device = await updateCurrentDeviceEventRecord(deviceId, eventId);
    return Response.json(device);
  } catch (error) {
    return Response.json(
      { error: error instanceof Error ? error.message : "Unable to update device event." },
      { status: 500 }
    );
  }
}
