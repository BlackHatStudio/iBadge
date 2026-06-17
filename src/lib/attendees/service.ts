import { validateAttendeeCsv, isValidEmail, normalizeEmail } from "@/lib/attendees/csv";
import { NotificationService } from "@/lib/attendees/notification";
import { buildQrPayload, createSecureQrToken, hashQrToken } from "@/lib/attendees/qr";
import {
  AttendeeListAuditRepository,
  AttendeeListRepository,
  AttendeeListUploadBatchRepository,
  AttendeeQrTokenRepository,
  AttendeeRepository,
  type SqlExecutor,
} from "@/lib/attendees/repository";
import { createMssqlExecutor } from "@/lib/attendees/sql-executor";
import { ApiError, type AttendeeInput, type NotificationChannel, type RequestAuditContext } from "@/lib/attendees/types";

function validateAttendeeInput(input: AttendeeInput) {
  if (!input.firstName.trim()) throw new ApiError(400, "VALIDATION_ERROR", "First name is required.");
  if (!input.lastName.trim()) throw new ApiError(400, "VALIDATION_ERROR", "Last name is required.");
  if (!input.email.trim()) throw new ApiError(400, "VALIDATION_ERROR", "Email is required.");
  if (!isValidEmail(input.email)) throw new ApiError(400, "VALIDATION_ERROR", "Email must be valid.");
}

export class AttendeeService {
  constructor(
    private readonly db: SqlExecutor = createMssqlExecutor(),
    private readonly notificationService = new NotificationService()
  ) {}

  private lists(db: SqlExecutor = this.db) {
    return new AttendeeListRepository(db);
  }

  private attendees(db: SqlExecutor = this.db) {
    return new AttendeeRepository(db);
  }

  private qrTokens(db: SqlExecutor = this.db) {
    return new AttendeeQrTokenRepository(db);
  }

  private uploads(db: SqlExecutor = this.db) {
    return new AttendeeListUploadBatchRepository(db);
  }

  private audit(db: SqlExecutor = this.db) {
    return new AttendeeListAuditRepository(db);
  }

  async listAttendeeLists() {
    return this.lists().list();
  }

  async getAttendeeList(attendeeListId: number) {
    const list = await this.lists().get(attendeeListId);
    if (!list) throw new ApiError(404, "NOT_FOUND", "Attendee list not found.");
    return list;
  }

  async createAttendeeList(input: { listName: string; description?: string | null; isActive?: boolean }, context: RequestAuditContext) {
    if (!input.listName.trim()) throw new ApiError(400, "VALIDATION_ERROR", "List name is required.");
    const attendeeListId = await this.db.transaction(async (tx) => {
      const repo = this.lists(tx);
      const audit = this.audit(tx);
      const attendeeListId = await repo.create(input, context);
      await audit.write(
        {
          attendeeListId,
          actionType: "ATTENDEE_LIST_CREATED",
          actionDescription: "Created attendee list",
          newValue: { listName: input.listName.trim(), description: input.description ?? null, isActive: input.isActive ?? true },
        },
        context
      );
      return attendeeListId;
    });
    return this.getAttendeeList(attendeeListId);
  }

  async updateAttendeeList(attendeeListId: number, input: { listName: string; description?: string | null; isActive?: boolean }, context: RequestAuditContext) {
    const oldValue = await this.getAttendeeList(attendeeListId);
    await this.db.transaction(async (tx) => {
      await this.lists(tx).update(attendeeListId, input, context);
      await this.audit(tx).write(
        {
          attendeeListId,
          actionType: "ATTENDEE_LIST_UPDATED",
          actionDescription: "Updated attendee list",
          oldValue,
          newValue: input,
        },
        context
      );
    });
    return this.getAttendeeList(attendeeListId);
  }

  async setAttendeeListActive(attendeeListId: number, isActive: boolean, context: RequestAuditContext) {
    await this.getAttendeeList(attendeeListId);
    await this.db.transaction(async (tx) => {
      await this.lists(tx).setActive(attendeeListId, isActive, context);
      await this.audit(tx).write(
        {
          attendeeListId,
          actionType: isActive ? "ATTENDEE_LIST_ACTIVATED" : "ATTENDEE_LIST_DEACTIVATED",
          actionDescription: isActive ? "Activated attendee list" : "Deactivated attendee list",
        },
        context
      );
    });
    return this.getAttendeeList(attendeeListId);
  }

  async listAttendees(attendeeListId: number) {
    await this.getAttendeeList(attendeeListId);
    return this.attendees().listByAttendeeList(attendeeListId);
  }

  async createAttendee(attendeeListId: number, input: AttendeeInput, context: RequestAuditContext) {
    validateAttendeeInput(input);
    await this.getAttendeeList(attendeeListId);
    return this.db.transaction(async (tx) => {
      const attendeeId = await this.attendees(tx).create(attendeeListId, { ...input, email: normalizeEmail(input.email) }, context);
      await this.audit(tx).write(
        {
          attendeeListId,
          attendeeId,
          actionType: "ATTENDEE_CREATED",
          actionDescription: "Created attendee",
          newValue: { ...input, email: normalizeEmail(input.email) },
        },
        context
      );
      return this.attendees(tx).get(attendeeId);
    });
  }

  async updateAttendee(attendeeId: number, input: AttendeeInput, context: RequestAuditContext) {
    validateAttendeeInput(input);
    const oldValue = await this.attendees().get(attendeeId);
    if (!oldValue) throw new ApiError(404, "NOT_FOUND", "Attendee not found.");
    await this.db.transaction(async (tx) => {
      await this.attendees(tx).update(attendeeId, { ...input, email: normalizeEmail(input.email) }, context);
      await this.audit(tx).write(
        {
          attendeeListId: oldValue.attendeeListId,
          attendeeId,
          actionType: "ATTENDEE_UPDATED",
          actionDescription: "Updated attendee",
          oldValue,
          newValue: { ...input, email: normalizeEmail(input.email) },
        },
        context
      );
    });
    return this.attendees().get(attendeeId);
  }

  async removeAttendee(attendeeId: number, context: RequestAuditContext) {
    const attendee = await this.attendees().get(attendeeId);
    if (!attendee) throw new ApiError(404, "NOT_FOUND", "Attendee not found.");
    await this.db.transaction(async (tx) => {
      await this.attendees(tx).softDelete(attendeeId, context);
      await this.qrTokens(tx).revokeActive(attendeeId, context);
      await this.audit(tx).write(
        {
          attendeeListId: attendee.attendeeListId,
          attendeeId,
          actionType: "ATTENDEE_REMOVED",
          actionDescription: "Removed attendee",
          oldValue: attendee,
        },
        context
      );
    });
  }

  async uploadCsv(attendeeListId: number, fileName: string, text: string, context: RequestAuditContext) {
    await this.getAttendeeList(attendeeListId);
    const uploadBatchId = await this.uploads().create(attendeeListId, fileName, context);
    const validation = validateAttendeeCsv(text);
    const conflictRows = validation.rows.length > 0 ? await this.attendees().findExistingConflicts(attendeeListId, validation.rows) : [];
    const errors = [...validation.errors];
    for (const conflict of conflictRows) {
      if (conflict.Email) {
        errors.push({ row: 0, field: "email", message: `Email ${conflict.Email} already exists in this attendee list.` });
      }
      if (conflict.BadgeNumber) {
        errors.push({ row: 0, field: "badge_number", message: `Badge number ${conflict.BadgeNumber} already exists in this attendee list.` });
      }
    }

    if (errors.length > 0) {
      await this.uploads().updateStatus({
        uploadBatchId,
        totalRows: validation.totalRows,
        validRows: Math.max(validation.totalRows - errors.length, 0),
        invalidRows: errors.length,
        importStatus: "REJECTED",
        validationSummary: { errors },
      });
      await this.audit().write(
        {
          attendeeListId,
          actionType: "ATTENDEE_LIST_UPLOAD_REJECTED",
          actionDescription: "Rejected attendee CSV upload",
          newValue: { uploadBatchId, errors },
        },
        context
      );
      throw new ApiError(400, "VALIDATION_ERROR", JSON.stringify({ uploadBatchId, errors }));
    }

    await this.db.transaction(async (tx) => {
      await this.attendees(tx).bulkCreate(attendeeListId, validation.rows, context);
      await this.uploads(tx).updateStatus({
        uploadBatchId,
        totalRows: validation.totalRows,
        validRows: validation.totalRows,
        invalidRows: 0,
        importStatus: "IMPORTED",
        validationSummary: { imported: validation.totalRows },
      });
      await this.audit(tx).write(
        {
          attendeeListId,
          actionType: "ATTENDEE_LIST_UPLOAD_IMPORTED",
          actionDescription: "Imported attendee CSV upload",
          newValue: { uploadBatchId, imported: validation.totalRows },
        },
        context
      );
    });

    return { uploadBatchId, imported: validation.totalRows };
  }

  async regenerateQr(attendeeId: number, context: RequestAuditContext) {
    const token = createSecureQrToken();
    const tokenHash = hashQrToken(token);
    const qrTokenId = await this.db.transaction(async (tx) => {
      const attendee = await this.attendees(tx).get(attendeeId);
      if (!attendee) throw new ApiError(404, "NOT_FOUND", "Attendee not found.");
      await this.qrTokens(tx).revokeActive(attendeeId, context);
      const createdQrTokenId = await this.qrTokens(tx).create(attendeeId, tokenHash, context);
      await this.audit(tx).write(
        {
          attendeeListId: attendee.attendeeListId,
          attendeeId,
          actionType: "ATTENDEE_QR_REGENERATED",
          actionDescription: "Regenerated attendee QR token",
          newValue: { qrTokenId: createdQrTokenId },
        },
        context
      );
      return createdQrTokenId;
    });
    return { qrTokenId, token, qrPayload: buildQrPayload(token) };
  }

  async sendQr(attendeeId: number, context: RequestAuditContext, channels: NotificationChannel[] = ["EMAIL"]) {
    const attendee = await this.attendees().get(attendeeId);
    if (!attendee) throw new ApiError(404, "NOT_FOUND", "Attendee not found.");
    const attendeeList = await this.getAttendeeList(attendee.attendeeListId);
    if (!attendeeList.isActive) throw new ApiError(409, "ATTENDEE_LIST_INACTIVE", "Attendee list is inactive.");
    const generated = await this.regenerateQr(attendeeId, context);

    try {
      await this.notificationService.sendQrCode(attendee, attendeeList, generated.qrPayload, channels);
      await this.qrTokens().recordSend(generated.qrTokenId, "SENT", null, context);
      await this.audit().write(
        {
          attendeeListId: attendee.attendeeListId,
          attendeeId,
          actionType: "ATTENDEE_QR_SENT",
          actionDescription: "Sent attendee QR code",
          newValue: { qrTokenId: generated.qrTokenId, channels },
        },
        context
      );
      return { attendeeId, email: attendee.email, status: "SENT" as const };
    } catch (error) {
      const message = error instanceof Error ? error.message : "Unable to send QR code.";
      await this.qrTokens().recordSend(generated.qrTokenId, "FAILED", message, context);
      await this.audit().write(
        {
          attendeeListId: attendee.attendeeListId,
          attendeeId,
          actionType: "ATTENDEE_QR_SEND_FAILED",
          actionDescription: "Failed to send attendee QR code",
          newValue: { qrTokenId: generated.qrTokenId, error: message },
        },
        context
      );
      return { attendeeId, email: attendee.email, status: "FAILED" as const, error: message };
    }
  }

  async sendQrForList(attendeeListId: number, input: { attendeeIds?: number[]; sendAll?: boolean; channels?: NotificationChannel[] }, context: RequestAuditContext) {
    const attendees = await this.listAttendees(attendeeListId);
    const selected = input.sendAll
      ? attendees
      : attendees.filter((attendee) => new Set(input.attendeeIds ?? []).has(attendee.attendeeId));
    const results = [];
    for (const attendee of selected) {
      results.push(await this.sendQr(attendee.attendeeId, context, input.channels ?? ["EMAIL"]));
    }
    return {
      total: selected.length,
      sent: results.filter((result) => result.status === "SENT").length,
      failed: results.filter((result) => result.status === "FAILED").length,
      skipped: attendees.length - selected.length,
      results,
    };
  }

  async revokeQr(attendeeId: number, context: RequestAuditContext) {
    const attendee = await this.attendees().get(attendeeId);
    if (!attendee) throw new ApiError(404, "NOT_FOUND", "Attendee not found.");
    await this.db.transaction(async (tx) => {
      await this.qrTokens(tx).revokeActive(attendeeId, context);
      await this.audit(tx).write(
        {
          attendeeListId: attendee.attendeeListId,
          attendeeId,
          actionType: "ATTENDEE_QR_REVOKED",
          actionDescription: "Revoked attendee QR token",
        },
        context
      );
    });
  }
}

export function createAttendeeService() {
  return new AttendeeService();
}
