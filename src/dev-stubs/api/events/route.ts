import { createDevEvent, devEventsList, updateDevEvent } from "@/lib/ibadge-dev-api";
import { forwardToUpstream } from "@/lib/ibadge-upstream";

export async function GET(request: Request) {
  const proxied = await forwardToUpstream(request);
  if (proxied) {
    return proxied;
  }
  return Response.json(devEventsList());
}

export async function POST(request: Request) {
  const proxied = await forwardToUpstream(request);
  if (proxied) {
    return proxied;
  }

  const body = (await request.json().catch(() => ({}))) as { eventName?: string; name?: string };
  const name = String(body.eventName ?? body.name ?? "New Event").trim() || "New Event";
  return Response.json(createDevEvent(name));
}

export async function PUT(request: Request) {
  const proxied = await forwardToUpstream(request);
  if (proxied) {
    return proxied;
  }

  const body = (await request.json().catch(() => ({}))) as { eventId?: string; name?: string; isActive?: boolean };
  const eventId = String(body.eventId ?? "").trim();
  if (!eventId) {
    return Response.json({ error: "Event ID is required." }, { status: 400 });
  }

  return Response.json(updateDevEvent(eventId, { name: body.name, isActive: body.isActive }));
}
