import { getReviewScansRecord } from "@/lib/ibadge-db";
import { forwardToUpstream } from "@/lib/ibadge-upstream";
import type { ReviewFilters } from "@/lib/kiosk-types";

export const runtime = "nodejs";

export async function GET(request: Request) {
  const proxied = await forwardToUpstream(request);
  if (proxied) {
    return proxied;
  }

  try {
    const url = new URL(request.url);
    const filters: ReviewFilters = {
      eventId: url.searchParams.get("eventId") ?? "all",
      deviceScope: url.searchParams.get("deviceScope") === "all" ? "all" : "current",
      dateFrom: url.searchParams.get("dateFrom") ?? "",
      dateTo: url.searchParams.get("dateTo") ?? "",
      employee: url.searchParams.get("employee") ?? "",
      badgeNumber: url.searchParams.get("badgeNumber") ?? "",
      device: url.searchParams.get("device") ?? "",
      scanStatus: url.searchParams.get("scanStatus") ?? "all",
      syncStatus: url.searchParams.get("syncStatus") ?? "all",
    };

    return Response.json(await getReviewScansRecord(filters, url.searchParams.get("deviceId")));
  } catch (error) {
    return Response.json(
      { error: error instanceof Error ? error.message : "Unable to read review scans." },
      { status: 500 }
    );
  }
}
