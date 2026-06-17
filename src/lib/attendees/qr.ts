import crypto from "node:crypto";

const QR_TOKEN_BYTES = 32;

export function createSecureQrToken() {
  return crypto.randomBytes(QR_TOKEN_BYTES).toString("base64url");
}

export function hashQrToken(token: string) {
  return crypto.createHash("sha256").update(token, "utf8").digest();
}

export function buildQrPayload(token: string) {
  const baseUrl =
    process.env.ATTENDEE_QR_BASE_URL?.trim() ||
    process.env.NEXT_PUBLIC_ATTENDEE_QR_BASE_URL?.trim() ||
    process.env.NEXT_PUBLIC_IBADGE_APP_URL?.trim() ||
    "";
  const path = process.env.ATTENDEE_QR_CHECKIN_PATH?.trim() || "/kiosk/check-in";
  const normalizedPath = path.startsWith("/") ? path : `/${path}`;
  const prefix = baseUrl ? baseUrl.replace(/\/+$/, "") : "";
  return `${prefix}${normalizedPath}?token=${encodeURIComponent(token)}`;
}
