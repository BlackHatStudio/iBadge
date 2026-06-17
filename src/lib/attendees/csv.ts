import { parseCsvTextToRows } from "@/lib/kiosk-utils";
import type { AttendeeInput, CsvValidationError, CsvValidationResult } from "@/lib/attendees/types";

export const ATTENDEE_CSV_HEADERS = ["badge_number", "first_name", "last_name", "email", "phone_number", "company"] as const;
export const ATTENDEE_CSV_TEMPLATE = `${ATTENDEE_CSV_HEADERS.join(",")}\r\n`;

const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export function normalizeEmail(value: string) {
  return value.trim().toLowerCase();
}

export function isValidEmail(value: string) {
  return EMAIL_PATTERN.test(normalizeEmail(value));
}

function normalizeOptional(value: string | null | undefined) {
  const trimmed = String(value ?? "").trim();
  return trimmed.length > 0 ? trimmed : null;
}

function addError(errors: CsvValidationError[], row: number, field: string, message: string) {
  errors.push({ row, field, message });
}

export function validateAttendeeCsv(text: string): CsvValidationResult {
  const rows = parseCsvTextToRows(text);
  const errors: CsvValidationError[] = [];
  if (rows.length === 0) {
    return { rows: [], errors: [{ row: 1, field: "file", message: "CSV file is empty." }], totalRows: 0 };
  }

  const header = rows[0].map((cell) => cell.trim().toLowerCase());
  const expected = [...ATTENDEE_CSV_HEADERS];
  if (header.length !== expected.length || expected.some((column, index) => header[index] !== column)) {
    return {
      rows: [],
      errors: [{ row: 1, field: "header", message: `CSV header must be exactly: ${expected.join(",")}` }],
      totalRows: Math.max(rows.length - 1, 0),
    };
  }

  const seenEmails = new Map<string, number>();
  const seenBadges = new Map<string, number>();
  const parsed: AttendeeInput[] = [];

  rows.slice(1).forEach((cells, index) => {
    const rowNumber = index + 2;
    const [badgeRaw, firstRaw, lastRaw, emailRaw, phoneRaw, companyRaw] = cells;
    const firstName = String(firstRaw ?? "").trim();
    const lastName = String(lastRaw ?? "").trim();
    const email = normalizeEmail(String(emailRaw ?? ""));
    const badgeNumber = normalizeOptional(badgeRaw);
    const phoneNumber = normalizeOptional(phoneRaw);
    const company = normalizeOptional(companyRaw);

    if (!firstName) addError(errors, rowNumber, "first_name", "First name is required.");
    if (!lastName) addError(errors, rowNumber, "last_name", "Last name is required.");
    if (!email) {
      addError(errors, rowNumber, "email", "Email is required.");
    } else if (!isValidEmail(email)) {
      addError(errors, rowNumber, "email", "Email must be valid.");
    }

    if (email) {
      const firstSeenRow = seenEmails.get(email);
      if (firstSeenRow) {
        addError(errors, rowNumber, "email", `Email duplicates row ${firstSeenRow} in this upload.`);
      } else {
        seenEmails.set(email, rowNumber);
      }
    }

    if (badgeNumber) {
      const normalizedBadge = badgeNumber.trim().toUpperCase();
      const firstSeenRow = seenBadges.get(normalizedBadge);
      if (firstSeenRow) {
        addError(errors, rowNumber, "badge_number", `Badge number duplicates row ${firstSeenRow} in this upload.`);
      } else {
        seenBadges.set(normalizedBadge, rowNumber);
      }
    }

    parsed.push({ badgeNumber, firstName, lastName, email, phoneNumber, company });
  });

  return { rows: errors.length > 0 ? [] : parsed, errors, totalRows: rows.length - 1 };
}
