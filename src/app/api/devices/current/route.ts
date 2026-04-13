import { getCurrentDeviceRecord, updateCurrentDeviceRecord } from "@/lib/ibadge-db";
import { forwardToUpstream } from "@/lib/ibadge-upstream";

export const runtime = "nodejs";

export async function GET(request: Request) {
  const proxied = await forwardToUpstream(request);
  if (proxied) {
    return proxied;
  }

  const url = new URL(request.url);
  const device = await getCurrentDeviceRecord(url.searchParams.get("deviceId"), url.searchParams.get("deviceGuid"));
  if (!device) {
    return Response.json({ error: "Device not found." }, { status: 404 });
  }

  return Response.json(device);
}

export async function PUT(request: Request) {
  const proxied = await forwardToUpstream(request);
  if (proxied) {
    return proxied;
  }

  try {
    const body = (await request.json().catch(() => ({}))) as Record<string, unknown>;
    const device = await updateCurrentDeviceRecord({
      DeviceId: body.DeviceId ? String(body.DeviceId) : body.deviceId ? String(body.deviceId) : undefined,
      DeviceGuid: body.DeviceGuid ? String(body.DeviceGuid) : body.deviceGuid ? String(body.deviceGuid) : undefined,
      DeviceName: body.DeviceName ? String(body.DeviceName) : body.deviceName ? String(body.deviceName) : undefined,
    });

    return Response.json(device);
  } catch (error) {
    return Response.json(
      { error: error instanceof Error ? error.message : "Unable to update device." },
      { status: 500 }
    );
  }
}
