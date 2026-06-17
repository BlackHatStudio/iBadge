import { apiErrorResponse } from "@/lib/attendees/api-utils";
import { AttendeeCheckInService } from "@/lib/attendees/check-in";
import { forwardToUpstream } from "@/lib/ibadge-upstream";

export const runtime = "nodejs";

export async function POST(request: Request) {
  const proxied = await forwardToUpstream(request);
  if (proxied) return proxied;

  try {
    const body = (await request.json().catch(() => ({}))) as {
      email?: string;
      eventId?: string;
      deviceName?: string | null;
      kioskId?: string | null;
    };
    const result = await new AttendeeCheckInService().checkInEmail({
      email: String(body.email ?? ""),
      eventId: String(body.eventId ?? ""),
      deviceName: body.deviceName ?? null,
      kioskId: body.kioskId ?? null,
    });
    return Response.json(result);
  } catch (error) {
    return apiErrorResponse(error);
  }
}
