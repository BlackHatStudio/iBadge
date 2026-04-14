import { createIbadgeEvent, listIbadgeEvents, updateIbadgeEvent } from "@/lib/ibadge-db";
import { forwardToUpstream } from "@/lib/ibadge-upstream";

export const runtime = "nodejs";

export async function GET(request: Request) {
  const proxied = await forwardToUpstream(request);
  if (proxied) {
    return proxied;
  }

  try {
    return Response.json(await listIbadgeEvents());
  } catch (error) {
    return Response.json(
      {
        error: error instanceof Error ? error.message : "Unable to read events from SQL Server.",
      },
      { status: 500 }
    );
  }
}

export async function POST(request: Request) {
  const proxied = await forwardToUpstream(request);
  if (proxied) {
    return proxied;
  }

  try {
    const body = (await request.json().catch(() => ({}))) as { eventName?: string; name?: string };
    const created = await createIbadgeEvent(String(body.eventName ?? body.name ?? ""));
    return Response.json(created, { status: 201 });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unable to create event.";
    const status = /required/i.test(message) ? 400 : 500;
    return Response.json({ error: message }, { status });
  }
}

export async function PUT(request: Request) {
  const proxied = await forwardToUpstream(request);
  if (proxied) {
    return proxied;
  }

  try {
    const body = (await request.json().catch(() => ({}))) as { eventId?: string; name?: string; isActive?: boolean };
    const eventId = String(body.eventId ?? "").trim();
    const updated = await updateIbadgeEvent(eventId, {
      name: String(body.name ?? ""),
      isActive: body.isActive !== false,
    });
    return Response.json(updated);
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unable to update event.";
    const status = /required|must be numeric/i.test(message) ? 400 : 500;
    return Response.json({ error: message }, { status });
  }
}
