import { forwardToUpstream } from "@/lib/ibadge-upstream";

const csvStub =
  "DeviceScanGuid,ScanUTC,BadgeNumberRaw,EmployeeNameSnapshot,SyncStatus\n";

export async function GET(request: Request, context: { params: Promise<{ format: string }> }) {
  const proxied = await forwardToUpstream(request);
  if (proxied) {
    return proxied;
  }

  const { format } = await context.params;

  if (format === "csv" || format === "excel") {
    return new Response(csvStub, {
      headers: {
        "Content-Type": "text/csv; charset=utf-8",
        "Content-Disposition": `attachment; filename="ibadge-review.${format === "excel" ? "csv" : "csv"}"`,
      },
    });
  }

  if (format === "pdf") {
    return new Response("PDF export is not available in the local dev API stub.", {
      status: 501,
      headers: { "Content-Type": "text/plain; charset=utf-8" },
    });
  }

  return new Response("Not Found", { status: 404 });
}
