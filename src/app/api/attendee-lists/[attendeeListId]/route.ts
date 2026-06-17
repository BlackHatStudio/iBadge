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
    return Response.json(await createAttendeeService().getAttendeeList(attendeeIdFromParam(attendeeListId, "Attendee list ID")));
  } catch (error) {
    return apiErrorResponse(error);
  }
}

export async function PATCH(request: Request, context: RouteContext) {
  const proxied = await forwardToUpstream(request);
  if (proxied) return proxied;

  try {
    const { attendeeListId } = await context.params;
    const body = (await request.json().catch(() => ({}))) as {
      listName?: string;
      description?: string | null;
      isActive?: boolean;
    };
    const updated = await createAttendeeService().updateAttendeeList(
      attendeeIdFromParam(attendeeListId, "Attendee list ID"),
      {
        listName: String(body.listName ?? ""),
        description: body.description ?? null,
        isActive: body.isActive,
      },
      getAuditContext(request)
    );
    return Response.json(updated);
  } catch (error) {
    return apiErrorResponse(mapSqlError(error));
  }
}
