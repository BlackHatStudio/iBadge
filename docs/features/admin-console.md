# Admin Console Feature

The admin console is centered on `/admin` and related routes under `/admin/*`.

## Routes

- `/admin` - event and device operations.
- `/admin/access` - PIN access flow.
- `/admin/attendees` - attendee list and QR credential management.
- `/admin/review` - scan review and export.

## Access Model

Admin access is guarded by the PIN flow. The frontend verifies access through `/api/admin/pin/verify`. PIN hash storage and default initialization are handled server-side.

## Event and Device Management

Admin workflows can:

- List events.
- Create events.
- Update event name and active state.
- Resolve/register the current device.
- Update device display information.
- Assign an active event to a device.
- Configure event attendee list participation and attendance source settings.

## Attendee Management

Attendee workflows are documented in `../attendees-module.md`. The admin console should keep attendee list operations separate from access-control employee imports.

## Visual Rules

Use `../design.md` for the admin layout style:

- Full-page dark shell.
- iBadge header/logo treatment.
- Cyan outline/fill action styles.
- Status strip.
- Panel cards.
- Dark admin forms and tables.

Do not replace `design.md` with operational documentation.
