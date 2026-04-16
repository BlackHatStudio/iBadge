import { forwardToUpstream } from "@/lib/ibadge-upstream";

export async function POST(request: Request) {
  const proxied = await forwardToUpstream(request);
  if (proxied) {
    return proxied;
  }
  return Response.json({ valid: false, authorized: false });
}
