import { apiErrorResponse, attendeeIdFromParam, getAuditContext } from "@/lib/attendees/api-utils";
import { createAttendeeService } from "@/lib/attendees/service";
import { forwardToUpstream } from "@/lib/ibadge-upstream";

export const runtime = "nodejs";

export async function POST(request: Request, context: { params: Promise<{ attendeeId: string }> }) {
  const proxied = await forwardToUpstream(request);
  if (proxied) return proxied;

  try {
    const { attendeeId } = await context.params;
    const body = (await request.json().catch(() => ({}))) as { send?: boolean; channels?: Array<"EMAIL" | "SMS"> };
    const service = createAttendeeService();
    if (body.send) {
      return Response.json(await service.sendQr(attendeeIdFromParam(attendeeId, "Attendee ID"), getAuditContext(request), body.channels ?? ["EMAIL"]));
    }
    const result = await service.regenerateQr(attendeeIdFromParam(attendeeId, "Attendee ID"), getAuditContext(request));
    return Response.json({ qrTokenId: result.qrTokenId, qrPayload: result.qrPayload });
  } catch (error) {
    return apiErrorResponse(error);
  }
}
