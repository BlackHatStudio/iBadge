import { apiErrorResponse, getAuditContext } from "@/lib/attendees/api-utils";
import { createMssqlExecutor } from "@/lib/attendees/sql-executor";
import { forwardToUpstream } from "@/lib/ibadge-upstream";

export const runtime = "nodejs";

type RouteContext = { params: Promise<{ eventId: string }> };

export async function GET(request: Request, context: RouteContext) {
  const proxied = await forwardToUpstream(request);
  if (proxied) return proxied;

  try {
    const { eventId } = await context.params;
    const db = createMssqlExecutor();
    const rows = await db.query(
      `
        SELECT l.AttendeeListID, l.ListName, l.Description, l.IsActive
        FROM dbo.EventAttendeeList eal
        INNER JOIN dbo.AttendeeList l ON l.AttendeeListID = eal.AttendeeListID
        WHERE eal.EventID = TRY_CONVERT(int, @eventId)
        ORDER BY l.ListName ASC;
      `,
      { eventId }
    );
    return Response.json(rows);
  } catch (error) {
    return apiErrorResponse(error);
  }
}

export async function POST(request: Request, context: RouteContext) {
  const proxied = await forwardToUpstream(request);
  if (proxied) return proxied;

  try {
    const { eventId } = await context.params;
    const body = (await request.json().catch(() => ({}))) as { attendeeListIds?: number[] };
    const attendeeListIds = Array.isArray(body.attendeeListIds) ? body.attendeeListIds.map(Number).filter(Number.isInteger) : [];
    const db = createMssqlExecutor();
    const audit = getAuditContext(request);
    await db.transaction(async (tx) => {
      await tx.query(`DELETE FROM dbo.EventAttendeeList WHERE EventID = TRY_CONVERT(int, @eventId);`, { eventId });
      for (const attendeeListId of attendeeListIds) {
        await tx.query(
          `
            INSERT INTO dbo.EventAttendeeList (EventID, AttendeeListID, CreatedBy)
            SELECT TRY_CONVERT(int, @eventId), @attendeeListId, @user
            WHERE NOT EXISTS (
              SELECT 1 FROM dbo.EventAttendeeList
              WHERE EventID = TRY_CONVERT(int, @eventId)
                AND AttendeeListID = @attendeeListId
            );
          `,
          { eventId, attendeeListId, user: audit.user }
        );
      }
    });
    return Response.json({ attendeeListIds });
  } catch (error) {
    return apiErrorResponse(error);
  }
}
