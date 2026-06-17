# Review and Exports Feature

The review page is available at `/admin/review` and is rendered by `src/components/review-page.tsx`.

## Responsibilities

- Filter attendance scans by event, date range, employee, badge number, device, scan status, sync status, and device scope.
- Show synced, pending, failed, suppressed, matched, unknown, inactive, and offline-captured scan states.
- Export the filtered review result.

## API Routes

- `GET /api/scans/review`
- `GET /api/reports/export/csv`
- `GET /api/reports/export/excel`
- `GET /api/reports/export/pdf`

Export routes should accept the same filters as the review route.

## Export Rules

- CSV and Excel-compatible output use CSV formatting.
- PDF output is generated through `src/lib/review-pdf.ts`.
- Export actions must not mutate scan data.
- Export filenames should be stable and operationally clear.

## Filter Rules

- `deviceScope=current` limits results to the current device when a numeric device id is available.
- `deviceScope=all` allows cross-device review.
- `eventId=all` means all events.
- Status filters should use the stored status values, normalized to uppercase.

## Regression Checks

- Review page requires admin access.
- Filters produce matching API query parameters.
- Export links preserve active filters.
- PDF export opens as a valid PDF.
- CSV output escapes commas, quotes, and line breaks.
