import { registerDeviceRecord } from "@/lib/ibadge-db";
import { forwardToUpstream } from "@/lib/ibadge-upstream";

export const runtime = "nodejs";

export async function POST(request: Request) {
  const proxied = await forwardToUpstream(request);
  if (proxied) {
    return proxied;
  }

  try {
    const body = (await request.json().catch(() => ({}))) as Record<string, unknown>;
    const device = await registerDeviceRecord({
      DeviceId: body.DeviceId ? String(body.DeviceId) : body.deviceId ? String(body.deviceId) : undefined,
      DeviceGuid: body.DeviceGuid ? String(body.DeviceGuid) : body.deviceGuid ? String(body.deviceGuid) : undefined,
      DeviceName: body.DeviceName ? String(body.DeviceName) : body.deviceName ? String(body.deviceName) : undefined,
      ActiveEventId:
        body.ActiveEventId === null || body.activeEventId === null
          ? null
          : body.ActiveEventId
            ? String(body.ActiveEventId)
            : body.activeEventId
              ? String(body.activeEventId)
              : undefined,
    });

    return Response.json(device);
  } catch (error) {
    return Response.json(
      { error: error instanceof Error ? error.message : "Unable to register device." },
      { status: 500 }
    );
  }
}
