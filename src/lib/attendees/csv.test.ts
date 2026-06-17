import { describe, expect, test } from "vitest";
import { ATTENDEE_CSV_TEMPLATE, validateAttendeeCsv } from "@/lib/attendees/csv";

describe("attendee CSV", () => {
  test("returns the exact template header", () => {
    expect(ATTENDEE_CSV_TEMPLATE).toBe("badge_number,first_name,last_name,email,phone_number,company\r\n");
  });

  test("validates required fields and email format", () => {
    const result = validateAttendeeCsv("badge_number,first_name,last_name,email,phone_number,company\n,Jane,,bad,,");
    expect(result.errors).toEqual([
      { row: 2, field: "last_name", message: "Last name is required." },
      { row: 2, field: "email", message: "Email must be valid." },
    ]);
  });

  test("rejects duplicate emails and badge numbers within the uploaded CSV", () => {
    const result = validateAttendeeCsv(
      [
        "badge_number,first_name,last_name,email,phone_number,company",
        "100,Jane,Doe,jane@example.com,,Acme",
        "100,John,Doe,JANE@example.com,,Acme",
      ].join("\n")
    );
    expect(result.errors).toContainEqual({ row: 3, field: "email", message: "Email duplicates row 2 in this upload." });
    expect(result.errors).toContainEqual({ row: 3, field: "badge_number", message: "Badge number duplicates row 2 in this upload." });
  });
});
