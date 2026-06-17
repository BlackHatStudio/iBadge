import { apiErrorResponse, attendeeIdFromParam, getAuditContext, mapSqlError } from "@/lib/attendees/api-utils";
import { createAttendeeService } from "@/lib/attendees/service";
import { forwardToUpstream } from "@/lib/ibadge-upstream";

export const runtime = "nodejs";

type RouteContext = { params: Promise<{ attendeeId: string }> };

export async function PATCH(request: Request, context: RouteContext) {
  const proxied = await forwardToUpstream(request);
  if (proxied) return proxied;

  try {
    const { attendeeId } = await context.params;
    const body = await request.json().catch(() => ({}));
    return Response.json(
      await createAttendeeService().updateAttendee(
        attendeeIdFromParam(attendeeId, "Attendee ID"),
        {
          badgeNumber: body.badgeNumber ?? null,
          firstName: String(body.firstName ?? ""),
          lastName: String(body.lastName ?? ""),
          email: String(body.email ?? ""),
          phoneNumber: body.phoneNumber ?? null,
          company: body.company ?? null,
        },
        getAuditContext(request)
      )
    );
  } catch (error) {
    return apiErrorResponse(mapSqlError(error));
  }
}

export async function DELETE(request: Request, context: RouteContext) {
  const proxied = await forwardToUpstream(request);
  if (proxied) return proxied;

  try {
    const { attendeeId } = await context.params;
    await createAttendeeService().removeAttendee(attendeeIdFromParam(attendeeId, "Attendee ID"), getAuditContext(request));
    return new Response(null, { status: 204 });
  } catch (error) {
    return apiErrorResponse(error);
  }
}
