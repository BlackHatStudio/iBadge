import { describe, expect, test } from "vitest";
import { createSecureQrToken, hashQrToken } from "@/lib/attendees/qr";

describe("attendee QR tokens", () => {
  test("generates non-guessable URL-safe tokens", () => {
    const token = createSecureQrToken();
    expect(token).toMatch(/^[A-Za-z0-9_-]{40,}$/);
    expect(createSecureQrToken()).not.toBe(token);
  });

  test("hashes tokens to binary SHA-256 without returning plaintext", () => {
    const hash = hashQrToken("sample-token");
    expect(Buffer.isBuffer(hash)).toBe(true);
    expect(hash.byteLength).toBe(32);
    expect(hash.toString("utf8")).not.toContain("sample-token");
  });
});
