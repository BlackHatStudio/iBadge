import { verifyAdminPinRecord } from "@/lib/ibadge-db";
import { forwardToUpstream } from "@/lib/ibadge-upstream";

export const runtime = "nodejs";

export async function POST(request: Request) {
  const proxied = await forwardToUpstream(request);
  if (proxied) {
    return proxied;
  }

  try {
    const body = (await request.json().catch(() => ({}))) as { pin?: string };
    return Response.json(await verifyAdminPinRecord(String(body.pin ?? "")));
  } catch (error) {
    return Response.json(
      { error: error instanceof Error ? error.message : "Unable to verify admin PIN." },
      { status: 500 }
    );
  }
}
