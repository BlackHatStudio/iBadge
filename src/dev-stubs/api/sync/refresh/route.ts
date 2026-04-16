import { devRefreshBody } from "@/lib/ibadge-dev-api";
import { forwardToUpstream } from "@/lib/ibadge-upstream";

export async function POST(request: Request) {
  const proxied = await forwardToUpstream(request);
  if (proxied) {
    return proxied;
  }

  const body = (await request.json().catch(() => ({}))) as { deviceId?: string };
  return Response.json(devRefreshBody(body.deviceId));
}
