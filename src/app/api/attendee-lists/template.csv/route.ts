import { ATTENDEE_CSV_TEMPLATE } from "@/lib/attendees/csv";

export const runtime = "nodejs";

export async function GET() {
  return new Response(ATTENDEE_CSV_TEMPLATE, {
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": 'attachment; filename="attendee-list-template.csv"',
    },
  });
}
