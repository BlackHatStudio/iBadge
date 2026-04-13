import { retryDeviceScans } from "@/lib/ibadge-db";
import { forwardToUpstream } from "@/lib/ibadge-upstream";

export const runtime = "nodejs";

export async function POST(request: Request) {
  const proxied = await forwardToUpstream(request);
  if (proxied) {
    return proxied;
  }

  try {
    const body = (await request.json().catch(() => ({}))) as { deviceId?: string };
    return Response.json(await retryDeviceScans(String(body.deviceId ?? "")));
  } catch (error) {
    return Response.json(
      { error: error instanceof Error ? error.message : "Unable to retry queued scans." },
      { status: 500 }
    );
  }
}
