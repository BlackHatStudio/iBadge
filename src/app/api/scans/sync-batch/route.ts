import { syncBatchRecords } from "@/lib/ibadge-db";
import { forwardToUpstream } from "@/lib/ibadge-upstream";
import type { AttendanceScan } from "@/lib/kiosk-types";

export const runtime = "nodejs";

export async function POST(request: Request) {
  const proxied = await forwardToUpstream(request);
  if (proxied) {
    return proxied;
  }

  try {
    const body = (await request.json().catch(() => ({}))) as { scans?: AttendanceScan[] };
    return Response.json(await syncBatchRecords(body.scans ?? []));
  } catch (error) {
    return Response.json(
      { error: error instanceof Error ? error.message : "Unable to sync scan batch." },
      { status: 500 }
    );
  }
}
