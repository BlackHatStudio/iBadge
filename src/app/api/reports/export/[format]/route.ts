import { buildExportResponse } from "@/lib/ibadge-db";
import { forwardToUpstream } from "@/lib/ibadge-upstream";
import type { ReviewFilters } from "@/lib/kiosk-types";

export const runtime = "nodejs";

export async function GET(request: Request, context: { params: Promise<{ format: string }> }) {
  const proxied = await forwardToUpstream(request);
  if (proxied) {
    return proxied;
  }

  const { format } = await context.params;
  if (format !== "csv" && format !== "excel" && format !== "pdf") {
    return new Response("Not Found", { status: 404 });
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

    return buildExportResponse(format, filters, url.searchParams.get("deviceId"));
  } catch (error) {
    return new Response(error instanceof Error ? error.message : "Unable to export review data.", {
      status: 500,
      headers: { "Content-Type": "text/plain; charset=utf-8" },
    });
  }
}
