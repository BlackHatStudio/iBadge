import type {
  AttendeeDetail,
  AttendeeInput,
  AttendeeListSummary,
  ImportStatus,
  RequestAuditContext,
} from "@/lib/attendees/types";

export type SqlExecutor = {
  query<T = Record<string, unknown>>(sql: string, params?: Record<string, unknown>): Promise<T[]>;
  transaction<T>(work: (executor: SqlExecutor) => Promise<T>): Promise<T>;
};

function first<T>(rows: T[]) {
  return rows[0] ?? null;
}

function nullable(value: string | null | undefined) {
  const trimmed = String(value ?? "").trim();
  return trimmed.length > 0 ? trimmed : null;
}

function normalizedEmail(value: string) {
  return value.trim().toLowerCase();
}

function bool(value: unknown) {
  return value === true || value === 1;
}

function dateValue(value: unknown) {
  return value instanceof Date ? value.toISOString() : value ? String(value) : null;
}

function mapList(row: Record<string, unknown>): AttendeeListSummary {
  return {
    attendeeListId: Number(row.AttendeeListID),
    listName: String(row.ListName),
    description: row.Description == null ? null : String(row.Description),
    isActive: bool(row.IsActive),
    createdAt: String(dateValue(row.CreatedAt)),
    createdBy: row.CreatedBy == null ? null : String(row.CreatedBy),
    updatedAt: dateValue(row.UpdatedAt),
    updatedBy: row.UpdatedBy == null ? null : String(row.UpdatedBy),
    attendeeCount: Number(row.AttendeeCount ?? 0),
    lastUploadedAt: dateValue(row.LastUploadedAt),
  };
}

function mapAttendee(row: Record<string, unknown>): AttendeeDetail {
  return {
    attendeeId: Number(row.AttendeeID),
    attendeeListId: Number(row.AttendeeListID),
    badgeNumber: row.BadgeNumber == null ? null : String(row.BadgeNumber),
    firstName: String(row.FirstName),
    lastName: String(row.LastName),
    email: String(row.Email),
    phoneNumber: row.PhoneNumber == null ? null : String(row.PhoneNumber),
    company: row.Company == null ? null : String(row.Company),
    createdAt: String(dateValue(row.CreatedAt)),
    createdBy: row.CreatedBy == null ? null : String(row.CreatedBy),
    updatedAt: dateValue(row.UpdatedAt),
    updatedBy: row.UpdatedBy == null ? null : String(row.UpdatedBy),
    qrTokenId: row.QrTokenID == null ? null : Number(row.QrTokenID),
    hasQrToken: row.QrTokenID != null && row.RevokedAtUtc == null,
    sentAtUtc: dateValue(row.SentAtUtc),
    lastSentAtUtc: dateValue(row.LastSentAtUtc),
    sendCount: Number(row.SendCount ?? 0),
    lastSendStatus: row.LastSendStatus == null ? null : String(row.LastSendStatus) as AttendeeDetail["lastSendStatus"],
    lastSendError: row.LastSendError == null ? null : String(row.LastSendError),
    revokedAtUtc: dateValue(row.RevokedAtUtc),
    expiresAtUtc: dateValue(row.ExpiresAtUtc),
  };
}

export class AttendeeListAuditRepository {
  constructor(private readonly db: SqlExecutor) {}

  async write(input: {
    attendeeListId?: number | null;
    attendeeId?: number | null;
    actionType: string;
    actionDescription?: string | null;
    oldValue?: unknown;
    newValue?: unknown;
  }, context: RequestAuditContext) {
    await this.db.query(
      `
        INSERT INTO dbo.AttendeeListAuditLog (
          AttendeeListID, AttendeeID, ActionType, ActionDescription,
          OldValue, NewValue, PerformedBy, SourceIPAddress, UserAgent
        )
        VALUES (
          @attendeeListId, @attendeeId, @actionType, @actionDescription,
          @oldValue, @newValue, @user, @ipAddress, @userAgent
        );
      `,
      {
        attendeeListId: input.attendeeListId ?? null,
        attendeeId: input.attendeeId ?? null,
        actionType: input.actionType,
        actionDescription: input.actionDescription ?? null,
        oldValue: input.oldValue === undefined ? null : JSON.stringify(input.oldValue),
        newValue: input.newValue === undefined ? null : JSON.stringify(input.newValue),
        user: context.user,
        ipAddress: context.ipAddress ?? null,
        userAgent: context.userAgent ?? null,
      }
    );
  }
}

export class AttendeeListRepository {
  constructor(private readonly db: SqlExecutor) {}

  async list() {
    const rows = await this.db.query<Record<string, unknown>>(
      `
        SELECT
          l.AttendeeListID, l.ListName, l.Description, l.IsActive,
          l.CreatedAt, l.CreatedBy, l.UpdatedAt, l.UpdatedBy,
          COUNT(a.AttendeeID) AS AttendeeCount,
          MAX(b.UploadedAt) AS LastUploadedAt
        FROM dbo.AttendeeList l
        LEFT JOIN dbo.Attendee a
          ON a.AttendeeListID = l.AttendeeListID
         AND a.DeletedAt IS NULL
        LEFT JOIN dbo.AttendeeListUploadBatch b
          ON b.AttendeeListID = l.AttendeeListID
        GROUP BY l.AttendeeListID, l.ListName, l.Description, l.IsActive,
          l.CreatedAt, l.CreatedBy, l.UpdatedAt, l.UpdatedBy
        ORDER BY l.IsActive DESC, l.ListName ASC;
      `
    );
    return rows.map(mapList);
  }

  async get(attendeeListId: number) {
    const row = first(await this.db.query<Record<string, unknown>>(
      `
        SELECT
          l.AttendeeListID, l.ListName, l.Description, l.IsActive,
          l.CreatedAt, l.CreatedBy, l.UpdatedAt, l.UpdatedBy,
          COUNT(a.AttendeeID) AS AttendeeCount,
          MAX(b.UploadedAt) AS LastUploadedAt
        FROM dbo.AttendeeList l
        LEFT JOIN dbo.Attendee a
          ON a.AttendeeListID = l.AttendeeListID
         AND a.DeletedAt IS NULL
        LEFT JOIN dbo.AttendeeListUploadBatch b
          ON b.AttendeeListID = l.AttendeeListID
        WHERE l.AttendeeListID = @attendeeListId
        GROUP BY l.AttendeeListID, l.ListName, l.Description, l.IsActive,
          l.CreatedAt, l.CreatedBy, l.UpdatedAt, l.UpdatedBy;
      `,
      { attendeeListId }
    ));
    return row ? mapList(row) : null;
  }

  async create(input: { listName: string; description?: string | null; isActive?: boolean }, context: RequestAuditContext) {
    const rows = await this.db.query<{ AttendeeListID: number }>(
      `
        INSERT INTO dbo.AttendeeList (ListName, Description, IsActive, CreatedBy)
        OUTPUT inserted.AttendeeListID
        VALUES (@listName, @description, @isActive, @user);
      `,
      {
        listName: input.listName.trim(),
        description: nullable(input.description),
        isActive: input.isActive ?? true,
        user: context.user,
      }
    );
    return Number(rows[0].AttendeeListID);
  }

  async update(attendeeListId: number, input: { listName: string; description?: string | null; isActive?: boolean }, context: RequestAuditContext) {
    await this.db.query(
      `
        UPDATE dbo.AttendeeList
        SET ListName = @listName,
            Description = @description,
            IsActive = COALESCE(@isActive, IsActive),
            UpdatedAt = SYSUTCDATETIME(),
            UpdatedBy = @user
        WHERE AttendeeListID = @attendeeListId;
      `,
      {
        attendeeListId,
        listName: input.listName.trim(),
        description: nullable(input.description),
        isActive: input.isActive ?? null,
        user: context.user,
      }
    );
  }

  async setActive(attendeeListId: number, isActive: boolean, context: RequestAuditContext) {
    await this.db.query(
      `
        UPDATE dbo.AttendeeList
        SET IsActive = @isActive,
            UpdatedAt = SYSUTCDATETIME(),
            UpdatedBy = @user
        WHERE AttendeeListID = @attendeeListId;
      `,
      { attendeeListId, isActive, user: context.user }
    );
  }

  async getSelectedEventListIds(eventId: string) {
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
}

export class AttendeeRepository {
  constructor(private readonly db: SqlExecutor) {}

  async listByAttendeeList(attendeeListId: number) {
    const rows = await this.db.query<Record<string, unknown>>(
      `
        SELECT
          a.AttendeeID, a.AttendeeListID, a.BadgeNumber, a.FirstName, a.LastName,
          a.Email, a.PhoneNumber, a.Company, a.CreatedAt, a.CreatedBy, a.UpdatedAt, a.UpdatedBy,
          q.QrTokenID, q.SentAtUtc, q.LastSentAtUtc, q.SendCount, q.LastSendStatus,
          q.LastSendError, q.RevokedAtUtc, q.ExpiresAtUtc
        FROM dbo.Attendee a
        OUTER APPLY (
          SELECT TOP 1 *
          FROM dbo.AttendeeQrToken q
          WHERE q.AttendeeID = a.AttendeeID
          ORDER BY CASE WHEN q.RevokedAtUtc IS NULL THEN 0 ELSE 1 END, q.CreatedAt DESC, q.QrTokenID DESC
        ) q
        WHERE a.AttendeeListID = @attendeeListId
          AND a.DeletedAt IS NULL
        ORDER BY a.LastName ASC, a.FirstName ASC;
      `,
      { attendeeListId }
    );
    return rows.map(mapAttendee);
  }

  async get(attendeeId: number, includeDeleted = false) {
    const row = first(await this.db.query<Record<string, unknown>>(
      `
        SELECT
          a.AttendeeID, a.AttendeeListID, a.BadgeNumber, a.FirstName, a.LastName,
          a.Email, a.PhoneNumber, a.Company, a.CreatedAt, a.CreatedBy, a.UpdatedAt, a.UpdatedBy,
          q.QrTokenID, q.SentAtUtc, q.LastSentAtUtc, q.SendCount, q.LastSendStatus,
          q.LastSendError, q.RevokedAtUtc, q.ExpiresAtUtc
        FROM dbo.Attendee a
        OUTER APPLY (
          SELECT TOP 1 *
          FROM dbo.AttendeeQrToken q
          WHERE q.AttendeeID = a.AttendeeID
          ORDER BY CASE WHEN q.RevokedAtUtc IS NULL THEN 0 ELSE 1 END, q.CreatedAt DESC, q.QrTokenID DESC
        ) q
        WHERE a.AttendeeID = @attendeeId
          AND (@includeDeleted = 1 OR a.DeletedAt IS NULL);
      `,
      { attendeeId, includeDeleted }
    ));
    return row ? mapAttendee(row) : null;
  }

  async create(attendeeListId: number, input: AttendeeInput, context: RequestAuditContext) {
    const rows = await this.db.query<{ AttendeeID: number }>(
      `
        INSERT INTO dbo.Attendee (
          AttendeeListID, BadgeNumber, FirstName, LastName, Email, PhoneNumber, Company, CreatedBy
        )
        OUTPUT inserted.AttendeeID
        VALUES (
          @attendeeListId, @badgeNumber, @firstName, @lastName, @email, @phoneNumber, @company, @user
        );
      `,
      {
        attendeeListId,
        badgeNumber: nullable(input.badgeNumber),
        firstName: input.firstName.trim(),
        lastName: input.lastName.trim(),
        email: normalizedEmail(input.email),
        phoneNumber: nullable(input.phoneNumber),
        company: nullable(input.company),
        user: context.user,
      }
    );
    return Number(rows[0].AttendeeID);
  }

  async bulkCreate(attendeeListId: number, attendees: AttendeeInput[], context: RequestAuditContext) {
    for (const attendee of attendees) {
      await this.create(attendeeListId, attendee, context);
    }
  }

  async update(attendeeId: number, input: AttendeeInput, context: RequestAuditContext) {
    await this.db.query(
      `
        UPDATE dbo.Attendee
        SET BadgeNumber = @badgeNumber,
            FirstName = @firstName,
            LastName = @lastName,
            Email = @email,
            PhoneNumber = @phoneNumber,
            Company = @company,
            UpdatedAt = SYSUTCDATETIME(),
            UpdatedBy = @user
        WHERE AttendeeID = @attendeeId
          AND DeletedAt IS NULL;
      `,
      {
        attendeeId,
        badgeNumber: nullable(input.badgeNumber),
        firstName: input.firstName.trim(),
        lastName: input.lastName.trim(),
        email: normalizedEmail(input.email),
        phoneNumber: nullable(input.phoneNumber),
        company: nullable(input.company),
        user: context.user,
      }
    );
  }

  async softDelete(attendeeId: number, context: RequestAuditContext) {
    await this.db.query(
      `
        UPDATE dbo.Attendee
        SET DeletedAt = SYSUTCDATETIME(),
            DeletedBy = @user,
            UpdatedAt = SYSUTCDATETIME(),
            UpdatedBy = @user
        WHERE AttendeeID = @attendeeId
          AND DeletedAt IS NULL;
      `,
      { attendeeId, user: context.user }
    );
  }

  async findExistingConflicts(attendeeListId: number, attendees: AttendeeInput[]) {
    const emails = attendees.map((attendee) => normalizedEmail(attendee.email)).filter(Boolean);
    const badges = attendees.map((attendee) => nullable(attendee.badgeNumber)).filter(Boolean);
    const rows = await this.db.query<{ Email: string | null; BadgeNumber: string | null }>(
      `
        SELECT Email, BadgeNumber
        FROM dbo.Attendee
        WHERE AttendeeListID = @attendeeListId
          AND DeletedAt IS NULL
          AND (
            Email IN (SELECT value FROM OPENJSON(@emailsJson))
            OR (
              BadgeNumber IS NOT NULL
              AND BadgeNumber IN (SELECT value FROM OPENJSON(@badgesJson))
            )
          );
      `,
      { attendeeListId, emailsJson: JSON.stringify(emails), badgesJson: JSON.stringify(badges) }
    );
    return rows;
  }
}

export class AttendeeListUploadBatchRepository {
  constructor(private readonly db: SqlExecutor) {}

  async create(attendeeListId: number, originalFileName: string, context: RequestAuditContext) {
    const rows = await this.db.query<{ UploadBatchID: number }>(
      `
        INSERT INTO dbo.AttendeeListUploadBatch (
          AttendeeListID, OriginalFileName, UploadedBy, ImportStatus, CreatedBy
        )
        OUTPUT inserted.UploadBatchID
        VALUES (@attendeeListId, @originalFileName, @user, N'PENDING', @user);
      `,
      { attendeeListId, originalFileName, user: context.user }
    );
    return Number(rows[0].UploadBatchID);
  }

  async updateStatus(input: {
    uploadBatchId: number;
    totalRows: number;
    validRows: number;
    invalidRows: number;
    importStatus: ImportStatus;
    validationSummary?: unknown;
  }) {
    await this.db.query(
      `
        UPDATE dbo.AttendeeListUploadBatch
        SET TotalRows = @totalRows,
            ValidRows = @validRows,
            InvalidRows = @invalidRows,
            ImportStatus = @importStatus,
            ValidationSummary = @validationSummary
        WHERE UploadBatchID = @uploadBatchId;
      `,
      {
        uploadBatchId: input.uploadBatchId,
        totalRows: input.totalRows,
        validRows: input.validRows,
        invalidRows: input.invalidRows,
        importStatus: input.importStatus,
        validationSummary: input.validationSummary === undefined ? null : JSON.stringify(input.validationSummary),
      }
    );
  }
}

export class AttendeeQrTokenRepository {
  constructor(private readonly db: SqlExecutor) {}

  async revokeActive(attendeeId: number, context: RequestAuditContext) {
    await this.db.query(
      `
        UPDATE dbo.AttendeeQrToken
        SET RevokedAtUtc = SYSUTCDATETIME(),
            RevokedBy = @user,
            LastSendStatus = COALESCE(LastSendStatus, N'REVOKED'),
            UpdatedAt = SYSUTCDATETIME(),
            UpdatedBy = @user
        WHERE AttendeeID = @attendeeId
          AND RevokedAtUtc IS NULL;
      `,
      { attendeeId, user: context.user }
    );
  }

  async create(attendeeId: number, tokenHash: Buffer, context: RequestAuditContext) {
    const rows = await this.db.query<{ QrTokenID: number }>(
      `
        INSERT INTO dbo.AttendeeQrToken (AttendeeID, TokenHash, ExpiresAtUtc, CreatedBy)
        OUTPUT inserted.QrTokenID
        VALUES (@attendeeId, @tokenHash, NULL, @user);
      `,
      { attendeeId, tokenHash, user: context.user }
    );
    return Number(rows[0].QrTokenID);
  }

  async recordSend(qrTokenId: number, status: "SENT" | "FAILED", error: string | null, context: RequestAuditContext) {
    await this.db.query(
      `
        UPDATE dbo.AttendeeQrToken
        SET SentAtUtc = CASE WHEN @status = N'SENT' AND SentAtUtc IS NULL THEN SYSUTCDATETIME() ELSE SentAtUtc END,
            LastSentAtUtc = CASE WHEN @status = N'SENT' THEN SYSUTCDATETIME() ELSE LastSentAtUtc END,
            SendCount = SendCount + 1,
            LastSendStatus = @status,
            LastSendError = @error,
            UpdatedAt = SYSUTCDATETIME(),
            UpdatedBy = @user
        WHERE QrTokenID = @qrTokenId;
      `,
      { qrTokenId, status, error, user: context.user }
    );
  }

  async findValidToken(tokenHash: Buffer) {
    return first(await this.db.query<Record<string, unknown>>(
      `
        SELECT
          q.QrTokenID, q.AttendeeID, q.ExpiresAtUtc, q.RevokedAtUtc,
          a.AttendeeListID, a.BadgeNumber, a.FirstName, a.LastName, a.Email, a.DeletedAt,
          l.IsActive
        FROM dbo.AttendeeQrToken q
        INNER JOIN dbo.Attendee a ON a.AttendeeID = q.AttendeeID
        INNER JOIN dbo.AttendeeList l ON l.AttendeeListID = a.AttendeeListID
        WHERE q.TokenHash = @tokenHash;
      `,
      { tokenHash }
    ));
  }
}
