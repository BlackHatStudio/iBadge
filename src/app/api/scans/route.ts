import { insertScanRecord } from "@/lib/ibadge-db";
import { forwardToUpstream } from "@/lib/ibadge-upstream";
import type { AttendanceScan } from "@/lib/kiosk-types";

export const runtime = "nodejs";

export async function POST(request: Request) {
  const proxied = await forwardToUpstream(request);
  if (proxied) {
    return proxied;
  }

  try {
    const body = (await request.json()) as AttendanceScan;
    const scan = await insertScanRecord(body);
    return Response.json({ accepted: true, scan });
  } catch (error) {
    return Response.json(
      { error: error instanceof Error ? error.message : "Unable to store badge scan." },
      { status: 500 }
    );
  }
}
