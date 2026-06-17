import { apiErrorResponse, attendeeIdFromParam, getAuditContext } from "@/lib/attendees/api-utils";
import { createAttendeeService } from "@/lib/attendees/service";
import { forwardToUpstream } from "@/lib/ibadge-upstream";

export const runtime = "nodejs";

export async function POST(request: Request, context: { params: Promise<{ attendeeListId: string }> }) {
  const proxied = await forwardToUpstream(request);
  if (proxied) return proxied;

  try {
    const { attendeeListId } = await context.params;
    const body = (await request.json().catch(() => ({}))) as {
      attendeeIds?: number[];
      sendAll?: boolean;
      channels?: Array<"EMAIL" | "SMS">;
    };
    return Response.json(
      await createAttendeeService().sendQrForList(
        attendeeIdFromParam(attendeeListId, "Attendee list ID"),
        {
          attendeeIds: Array.isArray(body.attendeeIds) ? body.attendeeIds.map(Number) : [],
          sendAll: body.sendAll === true,
          channels: body.channels,
        },
        getAuditContext(request)
      )
    );
  } catch (error) {
    return apiErrorResponse(error);
  }
}
