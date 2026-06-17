import { describe, expect, test, vi, beforeEach } from "vitest";
import { normalizePin, isValidPin, verifyAdminPin, DEFAULT_ADMIN_PIN } from "@/lib/admin-access";

vi.mock("@/lib/api", () => ({
  verifyAdminPinRemote: vi.fn(),
}));

vi.mock("@/lib/storage", () => ({
  readAdminPinSetting: vi.fn(),
  writeAdminPinSetting: vi.fn(),
}));

import { verifyAdminPinRemote } from "@/lib/api";
import { readAdminPinSetting } from "@/lib/storage";

const mockVerifyRemote = vi.mocked(verifyAdminPinRemote);
const mockReadPinSetting = vi.mocked(readAdminPinSetting);

describe("normalizePin", () => {
  test("strips non-digit characters", () => {
    expect(normalizePin("12-34")).toBe("1234");
    expect(normalizePin("ab12cd34ef")).toBe("1234");
  });

  test("limits output to 4 digits", () => {
    expect(normalizePin("123456")).toBe("1234");
  });

  test("handles empty and nullish input", () => {
    expect(normalizePin("")).toBe("");
    expect(normalizePin(undefined as unknown as string)).toBe("");
  });
});

describe("isValidPin", () => {
  test("returns true for exactly 4 digits", () => {
    expect(isValidPin("1234")).toBe(true);
    expect(isValidPin("0000")).toBe(true);
  });

  test("returns false for fewer than 4 digits", () => {
    expect(isValidPin("123")).toBe(false);
    expect(isValidPin("")).toBe(false);
  });

  test("normalizes before checking — truncates extra digits to 4, so still valid", () => {
    expect(isValidPin("12345")).toBe(true);
  });
});

describe("verifyAdminPin", () => {
  beforeEach(() => {
    vi.resetAllMocks();
    mockReadPinSetting.mockResolvedValue(DEFAULT_ADMIN_PIN);
  });

  test("rejects immediately for an invalid (short) PIN without calling remote", async () => {
    const result = await verifyAdminPin("123", null);
    expect(result).toBe(false);
    expect(mockVerifyRemote).not.toHaveBeenCalled();
  });

  test("grants access when remote returns valid=true", async () => {
    mockVerifyRemote.mockResolvedValue({ valid: true });
    expect(await verifyAdminPin("1234", "device-1")).toBe(true);
  });

  test("grants access when remote returns authorized=true", async () => {
    mockVerifyRemote.mockResolvedValue({ authorized: true });
    expect(await verifyAdminPin("1234", "device-1")).toBe(true);
  });

  test("falls back to local PIN when remote throws (offline scenario)", async () => {
    mockVerifyRemote.mockRejectedValue(new Error("Network unavailable"));
    mockReadPinSetting.mockResolvedValue(DEFAULT_ADMIN_PIN);
    expect(await verifyAdminPin(DEFAULT_ADMIN_PIN, null)).toBe(true);
  });

  test("returns false when remote throws and local PIN does not match", async () => {
    mockVerifyRemote.mockRejectedValue(new Error("Network unavailable"));
    mockReadPinSetting.mockResolvedValue("9999");
    expect(await verifyAdminPin("1234", null)).toBe(false);
  });

  test("falls back to local check when remote does not accept the PIN", async () => {
    mockVerifyRemote.mockResolvedValue({ valid: false });
    mockReadPinSetting.mockResolvedValue(DEFAULT_ADMIN_PIN);
    expect(await verifyAdminPin(DEFAULT_ADMIN_PIN, null)).toBe(true);
  });

  test("returns false when both remote and local PIN reject", async () => {
    mockVerifyRemote.mockResolvedValue({ valid: false });
    mockReadPinSetting.mockResolvedValue("9999");
    expect(await verifyAdminPin("1234", null)).toBe(false);
  });
});
