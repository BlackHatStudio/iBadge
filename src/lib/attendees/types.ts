export type AttendanceSourceMode = "ACCESS_CONTROL_ONLY" | "ATTENDEE_LIST_ONLY" | "COMBINED";
export type PrimaryCredentialMode = "BADGE" | "QR_CODE";
export type CheckInMethod = "BADGE_SCAN" | "QR_SCAN" | "EMAIL_ENTRY" | "ADMIN_MANUAL";
export type CheckInStatus =
  | "SUCCESS"
  | "ALREADY_CHECKED_IN"
  | "NOT_FOUND"
  | "TOKEN_EXPIRED"
  | "TOKEN_REVOKED"
  | "INVALID_TOKEN"
  | "ATTENDEE_LIST_INACTIVE"
  | "ATTENDEE_LIST_NOT_ALLOWED"
  | "MANUAL_REVIEW_REQUIRED"
  | "FAILED";
export type QrSendStatus = "NOT_SENT" | "SENT" | "FAILED" | "REVOKED" | "REGENERATED";
export type NotificationChannel = "EMAIL" | "SMS";
export type ImportStatus = "PENDING" | "VALIDATED" | "IMPORTED" | "REJECTED" | "FAILED";

export type RequestAuditContext = {
  user: string;
  ipAddress?: string | null;
  userAgent?: string | null;
};

export type AttendeeListSummary = {
  attendeeListId: number;
  listName: string;
  description: string | null;
  isActive: boolean;
  createdAt: string;
  createdBy: string | null;
  updatedAt: string | null;
  updatedBy: string | null;
  attendeeCount: number;
  lastUploadedAt: string | null;
};

export type AttendeeDetail = {
  attendeeId: number;
  attendeeListId: number;
  badgeNumber: string | null;
  firstName: string;
  lastName: string;
  email: string;
  phoneNumber: string | null;
  company: string | null;
  createdAt: string;
  createdBy: string | null;
  updatedAt: string | null;
  updatedBy: string | null;
  qrTokenId: number | null;
  hasQrToken: boolean;
  sentAtUtc: string | null;
  lastSentAtUtc: string | null;
  sendCount: number;
  lastSendStatus: QrSendStatus | null;
  lastSendError: string | null;
  revokedAtUtc: string | null;
  expiresAtUtc: string | null;
};

export type AttendeeInput = {
  badgeNumber?: string | null;
  firstName: string;
  lastName: string;
  email: string;
  phoneNumber?: string | null;
  company?: string | null;
};

export type CsvValidationError = {
  row: number;
  field: string;
  message: string;
};

export type CsvValidationResult = {
  rows: AttendeeInput[];
  errors: CsvValidationError[];
  totalRows: number;
};

export class ApiError extends Error {
  constructor(
    public readonly status: number,
    public readonly code: string,
    message: string
  ) {
    super(message);
  }
}
