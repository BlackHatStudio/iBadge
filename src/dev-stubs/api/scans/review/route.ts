import { forwardToUpstream } from "@/lib/ibadge-upstream";

export async function GET(request: Request) {
  const proxied = await forwardToUpstream(request);
  if (proxied) {
    return proxied;
  }
  return Response.json([]);
}
