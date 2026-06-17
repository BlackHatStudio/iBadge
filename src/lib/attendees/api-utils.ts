import type { RequestAuditContext } from "@/lib/attendees/types";
import { ApiError } from "@/lib/attendees/types";

export function attendeeIdFromParam(value: string | string[] | undefined, label = "ID") {
  const raw = Array.isArray(value) ? value[0] : value;
  const id = Number(raw);
  if (!Number.isInteger(id) || id <= 0) {
    throw new ApiError(400, "VALIDATION_ERROR", `${label} must be a positive integer.`);
  }
  return id;
}

export function getAuditContext(request: Request): RequestAuditContext {
  const user =
    request.headers.get("x-ibadge-user")?.trim() ||
    request.headers.get("x-authenticated-user")?.trim() ||
    request.headers.get("x-forwarded-user")?.trim() ||
    "system";
  return {
    user,
    ipAddress: request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() || null,
    userAgent: request.headers.get("user-agent"),
  };
}

export function apiErrorResponse(error: unknown) {
  if (error instanceof ApiError) {
    return Response.json({ error: { code: error.code, message: error.message } }, { status: error.status });
  }

  console.error(error);
  return Response.json(
    { error: { code: "INTERNAL_ERROR", message: "The request could not be completed." } },
    { status: 500 }
  );
}

export function mapSqlError(error: unknown) {
  const message = error instanceof Error ? error.message : "";
  if (/UX_Attendee_ActiveEmail|duplicate key|unique/i.test(message) && /Email/i.test(message)) {
    return new ApiError(409, "DUPLICATE_EMAIL", "Email already exists in this attendee list.");
  }
  if (/UX_Attendee_ActiveBadge|duplicate key|unique/i.test(message) && /Badge/i.test(message)) {
    return new ApiError(409, "DUPLICATE_BADGE_NUMBER", "Badge number already exists in this attendee list.");
  }
  if (/UX_AttendeeList_ListName|duplicate key|unique/i.test(message)) {
    return new ApiError(409, "DUPLICATE_ATTENDEE_LIST", "An attendee list with this name already exists.");
  }
  return error;
}
