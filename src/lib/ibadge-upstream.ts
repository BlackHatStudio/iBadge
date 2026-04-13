function trimTrailingSlash(value: string) {
  return value.replace(/\/+$/, "");
}

/**
 * When set, Next.js `/api/*` route handlers forward to this base URL.
 * Use **only** `IBADGE_API_UPSTREAM` — not `NEXT_PUBLIC_IBADGE_API_BASE_URL`.
 * If the public URL pointed at Express (e.g. localhost:4000) without those routes,
 * proxying would return 404 and hide the built-in dev stubs.
 */
export function getIbadgeApiUpstream(): string {
  const fromEnv = process.env.IBADGE_API_UPSTREAM?.trim() || "";
  return trimTrailingSlash(fromEnv);
}

export async function forwardToUpstream(request: Request): Promise<Response | null> {
  const base = getIbadgeApiUpstream();
  if (!base) {
    return null;
  }

  const url = new URL(request.url);
  const targetUrl = `${base}${url.pathname}${url.search}`;

  const headers = new Headers();
  const contentType = request.headers.get("content-type");
  if (contentType) {
    headers.set("content-type", contentType);
  }
  const authorization = request.headers.get("authorization");
  if (authorization) {
    headers.set("authorization", authorization);
  }

  const init: RequestInit = {
    method: request.method,
    headers,
    cache: "no-store",
  };

  if (request.method !== "GET" && request.method !== "HEAD") {
    init.body = await request.arrayBuffer();
  }

  return fetch(targetUrl, init);
}
