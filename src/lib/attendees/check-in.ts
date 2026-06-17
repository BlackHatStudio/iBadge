import { hashQrToken } from "@/lib/attendees/qr";
import { createMssqlExecutor } from "@/lib/attendees/sql-executor";
import { ApiError } from "@/lib/attendees/types";
import type { SqlExecutor } from "@/lib/attendees/repository";

type KioskCheckInInput = {
  eventId: string;
  deviceName?: string | null;
  kioskId?: string | null;
};

function publicResponse(status: string, message: string) {
  return { status, message };
}

function normalizeEmail(value: string) {
  return value.trim().toLowerCase();
}

export class AttendeeCheckInService {
  constructor(private readonly db: SqlExecutor = createMssqlExecutor()) {}

  private async getEventSettings(eventId: string) {
    const rows = await this.db.query<{
      AttendanceSourceMode: string | null;
      DuplicateScanWindowSeconds: number | null;
    }>(
      `
        SELECT TOP 1 AttendanceSourceMode, DuplicateScanWindowSeconds
        FROM dbo.EventAttendanceSetting
        WHERE EventID = TRY_CONVERT(int, @eventId);
      `,
      { eventId }
    );
    return {
      attendanceSourceMode: rows[0]?.AttendanceSourceMode ?? "COMBINED",
      duplicateScanWindowSeconds: Number(rows[0]?.DuplicateScanWindowSeconds ?? 60),
    };
  }

  private async selectedListIds(eventId: string) {
    const rows = await this.db.query<{ AttendeeListID: number }>(
      `
        SELECT eal.AttendeeListID
        FROM dbo.EventAttendeeList eal
        INNER JOIN dbo.AttendeeList l ON l.AttendeeListID = eal.AttendeeListID
        WHERE eal.EventID = TRY_CONVERT(int, @eventId)
          AND l.IsActive = 1;
      `,
      { eventId }
    );
    return rows.map((row) => Number(row.AttendeeListID));
  }

  private async isDuplicate(eventId: string, attendeeId: number, windowSeconds: number) {
    const rows = await this.db.query<{ ExistingCount: number }>(
      `
        SELECT COUNT(1) AS ExistingCount
        FROM dbo.AttendanceCheckIn
        WHERE EventID = TRY_CONVERT(int, @eventId)
          AND AttendeeID = @attendeeId
          AND CheckInStatus = N'SUCCESS'
          AND CheckInTimeUtc >= DATEADD(second, -@windowSeconds, SYSUTCDATETIME());
      `,
      { eventId, attendeeId, windowSeconds }
    );
    return Number(rows[0]?.ExistingCount ?? 0) > 0;
  }

  private async insertSuccess(input: KioskCheckInInput & { attendeeId: number; badgeNumber: string | null; method: "QR_SCAN" | "EMAIL_ENTRY" }) {
    await this.db.query(
      `
        INSERT INTO dbo.AttendanceCheckIn (
          EventID, AttendeeID, BadgeNumber, SourceType, CheckInMethod, CheckInStatus,
          CheckInTimeUtc, KioskID, DeviceName, MatchedBy, CreatedAt, CreatedBy
        )
        VALUES (
          TRY_CONVERT(int, @eventId), @attendeeId, @badgeNumber, N'ATTENDEE_LIST', @method, N'SUCCESS',
          SYSUTCDATETIME(), @kioskId, @deviceName, @method, SYSUTCDATETIME(), N'kiosk'
        );
      `,
      {
        eventId: input.eventId,
        attendeeId: input.attendeeId,
        badgeNumber: input.badgeNumber,
        method: input.method,
        kioskId: input.kioskId ?? null,
        deviceName: input.deviceName ?? null,
      }
    );
  }

  async checkInQr(input: KioskCheckInInput & { token: string }) {
    if (!input.token.trim()) throw new ApiError(400, "VALIDATION_ERROR", "Token is required.");
    const settings = await this.getEventSettings(input.eventId);
    if (settings.attendanceSourceMode === "ACCESS_CONTROL_ONLY") {
      return publicResponse("FAILED", "QR code not accepted. Please see the attendant.");
    }

    const rows = await this.db.query<{
      AttendeeID: number;
      AttendeeListID: number;
      BadgeNumber: string | null;
      DeletedAt: Date | null;
      IsActive: boolean;
      RevokedAtUtc: Date | null;
      ExpiresAtUtc: Date | null;
    }>(
      `
        SELECT
          a.AttendeeID, a.AttendeeListID, a.BadgeNumber, a.DeletedAt, l.IsActive,
          q.RevokedAtUtc, q.ExpiresAtUtc
        FROM dbo.AttendeeQrToken q
        INNER JOIN dbo.Attendee a ON a.AttendeeID = q.AttendeeID
        INNER JOIN dbo.AttendeeList l ON l.AttendeeListID = a.AttendeeListID
        WHERE q.TokenHash = @tokenHash;
      `,
      { tokenHash: hashQrToken(input.token) }
    );
    const row = rows[0];
    if (!row) return publicResponse("INVALID_TOKEN", "QR code not accepted. Please see the attendant.");
    if (row.RevokedAtUtc) return publicResponse("TOKEN_REVOKED", "QR code not accepted. Please see the attendant.");
    if (row.ExpiresAtUtc && new Date(row.ExpiresAtUtc).getTime() < Date.now()) {
      return publicResponse("TOKEN_EXPIRED", "QR code not accepted. Please see the attendant.");
    }
    if (row.DeletedAt || !row.IsActive) return publicResponse("FAILED", "QR code not accepted. Please see the attendant.");

    const selected = new Set(await this.selectedListIds(input.eventId));
    if (!selected.has(Number(row.AttendeeListID))) {
      return publicResponse("ATTENDEE_LIST_NOT_ALLOWED", "QR code not accepted. Please see the attendant.");
    }
    if (await this.isDuplicate(input.eventId, Number(row.AttendeeID), settings.duplicateScanWindowSeconds)) {
      return publicResponse("ALREADY_CHECKED_IN", "Already checked in.");
    }
    await this.insertSuccess({ ...input, attendeeId: Number(row.AttendeeID), badgeNumber: row.BadgeNumber, method: "QR_SCAN" });
    return publicResponse("SUCCESS", "Check-in successful");
  }

  async checkInEmail(input: KioskCheckInInput & { email: string }) {
    const email = normalizeEmail(input.email);
    if (!email.includes("@")) throw new ApiError(400, "VALIDATION_ERROR", "Email is required.");
    const settings = await this.getEventSettings(input.eventId);
    if (settings.attendanceSourceMode === "ACCESS_CONTROL_ONLY") {
      return publicResponse("FAILED", "Email not found. Please see the attendant.");
    }
    const selected = await this.selectedListIds(input.eventId);
    if (selected.length === 0) return publicResponse("NOT_FOUND", "Email not found. Please see the attendant.");

    const rows = await this.db.query<{ AttendeeID: number; BadgeNumber: string | null }>(
      `
        SELECT a.AttendeeID, a.BadgeNumber
        FROM dbo.Attendee a
        INNER JOIN dbo.AttendeeList l ON l.AttendeeListID = a.AttendeeListID
        WHERE a.Email = @email
          AND a.DeletedAt IS NULL
          AND l.IsActive = 1
          AND a.AttendeeListID IN (SELECT TRY_CONVERT(int, value) FROM OPENJSON(@selectedListIdsJson));
      `,
      { email, selectedListIdsJson: JSON.stringify(selected) }
    );
    if (rows.length === 0) return publicResponse("NOT_FOUND", "Email not found. Please see the attendant.");
    if (rows.length > 1) return publicResponse("MANUAL_REVIEW_REQUIRED", "Unable to check in. Please see the attendant.");

    const attendee = rows[0];
    if (await this.isDuplicate(input.eventId, Number(attendee.AttendeeID), settings.duplicateScanWindowSeconds)) {
      return publicResponse("ALREADY_CHECKED_IN", "Already checked in.");
    }
    await this.insertSuccess({ ...input, attendeeId: Number(attendee.AttendeeID), badgeNumber: attendee.BadgeNumber, method: "EMAIL_ENTRY" });
    return publicResponse("SUCCESS", "Check-in successful");
  }
}
