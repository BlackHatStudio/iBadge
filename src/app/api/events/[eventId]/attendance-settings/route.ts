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
    const rows = await createMssqlExecutor().query(
      `
        SELECT TOP 1
          EventID, AttendanceSourceMode, PrimaryCredentialMode,
          EnableEmailFallback, EnableBadgeFallback, EnableQrFallback,
          DuplicateScanWindowSeconds, UpdatedAt, UpdatedBy
        FROM dbo.EventAttendanceSetting
        WHERE EventID = TRY_CONVERT(int, @eventId);
      `,
      { eventId }
    );
    return Response.json(
      rows[0] ?? {
        EventID: Number(eventId),
        AttendanceSourceMode: "COMBINED",
        PrimaryCredentialMode: "BADGE",
        EnableEmailFallback: true,
        EnableBadgeFallback: true,
        EnableQrFallback: true,
        DuplicateScanWindowSeconds: 60,
      }
    );
  } catch (error) {
    return apiErrorResponse(error);
  }
}

export async function PATCH(request: Request, context: RouteContext) {
  const proxied = await forwardToUpstream(request);
  if (proxied) return proxied;

  try {
    const { eventId } = await context.params;
    const body = (await request.json().catch(() => ({}))) as Record<string, unknown>;
    const audit = getAuditContext(request);
    await createMssqlExecutor().query(
      `
        MERGE dbo.EventAttendanceSetting AS target
        USING (SELECT TRY_CONVERT(int, @eventId) AS EventID) AS source
        ON target.EventID = source.EventID
        WHEN MATCHED THEN UPDATE SET
          AttendanceSourceMode = @attendanceSourceMode,
          PrimaryCredentialMode = @primaryCredentialMode,
          EnableEmailFallback = @enableEmailFallback,
          EnableBadgeFallback = @enableBadgeFallback,
          EnableQrFallback = @enableQrFallback,
          DuplicateScanWindowSeconds = @duplicateScanWindowSeconds,
          UpdatedAt = SYSUTCDATETIME(),
          UpdatedBy = @user
        WHEN NOT MATCHED THEN INSERT (
          EventID, AttendanceSourceMode, PrimaryCredentialMode, EnableEmailFallback,
          EnableBadgeFallback, EnableQrFallback, DuplicateScanWindowSeconds, UpdatedAt, UpdatedBy
        )
        VALUES (
          source.EventID, @attendanceSourceMode, @primaryCredentialMode, @enableEmailFallback,
          @enableBadgeFallback, @enableQrFallback, @duplicateScanWindowSeconds, SYSUTCDATETIME(), @user
        );
      `,
      {
        eventId,
        attendanceSourceMode: String(body.attendanceSourceMode ?? "COMBINED"),
        primaryCredentialMode: String(body.primaryCredentialMode ?? "BADGE"),
        enableEmailFallback: body.enableEmailFallback !== false,
        enableBadgeFallback: body.enableBadgeFallback !== false,
        enableQrFallback: body.enableQrFallback !== false,
        duplicateScanWindowSeconds: Number(body.duplicateScanWindowSeconds ?? 60),
        user: audit.user,
      }
    );
    return GET(request, context);
  } catch (error) {
    return apiErrorResponse(error);
  }
}
