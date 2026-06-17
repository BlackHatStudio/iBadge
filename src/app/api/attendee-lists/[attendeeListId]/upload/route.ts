import { apiErrorResponse, attendeeIdFromParam, getAuditContext, mapSqlError } from "@/lib/attendees/api-utils";
import { createAttendeeService } from "@/lib/attendees/service";
import { forwardToUpstream } from "@/lib/ibadge-upstream";
import { ApiError } from "@/lib/attendees/types";

export const runtime = "nodejs";

export async function POST(request: Request, context: { params: Promise<{ attendeeListId: string }> }) {
  const proxied = await forwardToUpstream(request);
  if (proxied) return proxied;

  try {
    const { attendeeListId } = await context.params;
    const contentType = request.headers.get("content-type") ?? "";
    if (!contentType.includes("multipart/form-data")) {
      throw new ApiError(400, "VALIDATION_ERROR", "CSV upload must be multipart form data.");
    }
    const form = await request.formData();
    const file = form.get("file");
    if (!(file instanceof File)) {
      throw new ApiError(400, "VALIDATION_ERROR", "CSV file is required.");
    }
    const fileName = file.name || "attendees.csv";
    if (!fileName.toLowerCase().endsWith(".csv") || file.type.includes("spreadsheet") || file.type.includes("excel")) {
      throw new ApiError(400, "VALIDATION_ERROR", "Only CSV files are accepted.");
    }

    const result = await createAttendeeService().uploadCsv(
      attendeeIdFromParam(attendeeListId, "Attendee list ID"),
      fileName,
      await file.text(),
      getAuditContext(request)
    );
    return Response.json(result);
  } catch (error) {
    return apiErrorResponse(mapSqlError(error));
  }
}
