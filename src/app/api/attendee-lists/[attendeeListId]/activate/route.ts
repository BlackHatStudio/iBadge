import { apiErrorResponse, attendeeIdFromParam, getAuditContext } from "@/lib/attendees/api-utils";
import { createAttendeeService } from "@/lib/attendees/service";
import { forwardToUpstream } from "@/lib/ibadge-upstream";

export const runtime = "nodejs";

export async function POST(request: Request, context: { params: Promise<{ attendeeListId: string }> }) {
  const proxied = await forwardToUpstream(request);
  if (proxied) return proxied;

  try {
    const { attendeeListId } = await context.params;
    return Response.json(
      await createAttendeeService().setAttendeeListActive(
        attendeeIdFromParam(attendeeListId, "Attendee list ID"),
        true,
        getAuditContext(request)
      )
    );
  } catch (error) {
    return apiErrorResponse(error);
  }
}
