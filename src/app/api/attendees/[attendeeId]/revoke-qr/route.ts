import { apiErrorResponse, attendeeIdFromParam, getAuditContext } from "@/lib/attendees/api-utils";
import { createAttendeeService } from "@/lib/attendees/service";
import { forwardToUpstream } from "@/lib/ibadge-upstream";

export const runtime = "nodejs";

export async function POST(request: Request, context: { params: Promise<{ attendeeId: string }> }) {
  const proxied = await forwardToUpstream(request);
  if (proxied) return proxied;

  try {
    const { attendeeId } = await context.params;
    await createAttendeeService().revokeQr(attendeeIdFromParam(attendeeId, "Attendee ID"), getAuditContext(request));
    return Response.json({ status: "REVOKED" });
  } catch (error) {
    return apiErrorResponse(error);
  }
}
