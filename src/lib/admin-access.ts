import { readAdminPinSetting, writeAdminPinSetting } from "@/lib/storage";
import { verifyAdminPinRemote } from "@/lib/api";

export const DEFAULT_ADMIN_PIN = "5657";
export const ADMIN_ACCESS_SESSION_KEY = "ibadge.adminSession";
const SESSION_DURATION_MS = 8 * 60 * 60 * 1000;

type AdminSessionRecord = {
  expiresAt: number;
};

export function normalizePin(value: string) {
  return String(value ?? "").replace(/\D/g, "").slice(0, 4);
}

export function isValidPin(value: string) {
  return normalizePin(value).length === 4;
}

export async function readAdminPin() {
  const storedPin = normalizePin(await readAdminPinSetting(DEFAULT_ADMIN_PIN));
  return isValidPin(storedPin) ? storedPin : DEFAULT_ADMIN_PIN;
}

export async function writeAdminPin(value: string) {
  const normalizedPin = normalizePin(value);
  if (!isValidPin(normalizedPin)) {
    throw new Error("Admin PIN must be exactly 4 digits.");
  }

  await writeAdminPinSetting(normalizedPin);
  return normalizedPin;
}

export function hasAdminAccessSession() {
  if (typeof window === "undefined") {
    return false;
  }

  try {
    const raw = window.sessionStorage.getItem(ADMIN_ACCESS_SESSION_KEY);
    if (!raw) {
      return false;
    }

    const session = JSON.parse(raw) as AdminSessionRecord;
    if (!session.expiresAt || session.expiresAt < Date.now()) {
      window.sessionStorage.removeItem(ADMIN_ACCESS_SESSION_KEY);
      return false;
    }

    return true;
  } catch {
    window.sessionStorage.removeItem(ADMIN_ACCESS_SESSION_KEY);
    return false;
  }
}

export function grantAdminAccessSession() {
  if (typeof window === "undefined") {
    return;
  }

  const session: AdminSessionRecord = {
    expiresAt: Date.now() + SESSION_DURATION_MS,
  };

  window.sessionStorage.setItem(ADMIN_ACCESS_SESSION_KEY, JSON.stringify(session));
}

export function clearAdminAccessSession() {
  if (typeof window === "undefined") {
    return;
  }

  window.sessionStorage.removeItem(ADMIN_ACCESS_SESSION_KEY);
}

export async function verifyAdminPin(pin: string, deviceId: string | null) {
  const normalizedPin = normalizePin(pin);
  if (!isValidPin(normalizedPin)) {
    return false;
  }

  try {
    const remoteResult = await verifyAdminPinRemote(normalizedPin, deviceId);
    const accepted = remoteResult.valid === true || remoteResult.authorized === true;
    if (accepted) {
      grantAdminAccessSession();
      return true;
    }
  } catch {
    // Offline fallback remains available through locally cached PIN.
  }

  const localPin = await readAdminPin();
  if (normalizedPin === localPin) {
    grantAdminAccessSession();
    return true;
  }

  return false;
}

export function buildAdminAccessPath(returnTo = "/admin") {
  const params = new URLSearchParams({ returnTo });
  return `/admin/access?${params.toString()}`;
}
