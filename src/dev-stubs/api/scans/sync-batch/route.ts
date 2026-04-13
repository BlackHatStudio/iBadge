import { forwardToUpstream } from "@/lib/ibadge-upstream";

export async function POST(request: Request) {
  const proxied = await forwardToUpstream(request);
  if (proxied) {
    return proxied;
  }
  return Response.json({ syncedIds: [] as string[], failed: [] as { deviceScanGuid: string; error?: string | null }[] });
}
