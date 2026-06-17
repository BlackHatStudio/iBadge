import { apiErrorResponse, getAuditContext, mapSqlError } from "@/lib/attendees/api-utils";
import { createAttendeeService } from "@/lib/attendees/service";
import { forwardToUpstream } from "@/lib/ibadge-upstream";

export const runtime = "nodejs";

export async function GET(request: Request) {
  const proxied = await forwardToUpstream(request);
  if (proxied) return proxied;

  try {
    return Response.json(await createAttendeeService().listAttendeeLists());
  } catch (error) {
    return apiErrorResponse(error);
  }
}

export async function POST(request: Request) {
  const proxied = await forwardToUpstream(request);
  if (proxied) return proxied;

  try {
    const body = (await request.json().catch(() => ({}))) as {
      listName?: string;
      description?: string | null;
      isActive?: boolean;
    };
    const created = await createAttendeeService().createAttendeeList(
      {
        listName: String(body.listName ?? ""),
        description: body.description ?? null,
        isActive: body.isActive ?? true,
      },
      getAuditContext(request)
    );
    return Response.json(created, { status: 201 });
  } catch (error) {
    return apiErrorResponse(mapSqlError(error));
  }
}
