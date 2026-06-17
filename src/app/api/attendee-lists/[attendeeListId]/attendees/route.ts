import { apiErrorResponse, attendeeIdFromParam, getAuditContext, mapSqlError } from "@/lib/attendees/api-utils";
import { createAttendeeService } from "@/lib/attendees/service";
import { forwardToUpstream } from "@/lib/ibadge-upstream";

export const runtime = "nodejs";

type RouteContext = { params: Promise<{ attendeeListId: string }> };

export async function GET(request: Request, context: RouteContext) {
  const proxied = await forwardToUpstream(request);
  if (proxied) return proxied;

  try {
    const { attendeeListId } = await context.params;
    return Response.json(await createAttendeeService().listAttendees(attendeeIdFromParam(attendeeListId, "Attendee list ID")));
  } catch (error) {
    return apiErrorResponse(error);
  }
}

export async function POST(request: Request, context: RouteContext) {
  const proxied = await forwardToUpstream(request);
  if (proxied) return proxied;

  try {
    const { attendeeListId } = await context.params;
    const body = await request.json().catch(() => ({}));
    const attendee = await createAttendeeService().createAttendee(
      attendeeIdFromParam(attendeeListId, "Attendee list ID"),
      {
        badgeNumber: body.badgeNumber ?? null,
        firstName: String(body.firstName ?? ""),
        lastName: String(body.lastName ?? ""),
        email: String(body.email ?? ""),
        phoneNumber: body.phoneNumber ?? null,
        company: body.company ?? null,
      },
      getAuditContext(request)
    );
    return Response.json(attendee, { status: 201 });
  } catch (error) {
    return apiErrorResponse(mapSqlError(error));
  }
}
