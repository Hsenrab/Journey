# Activities and waypoint details

Routes:

- `/activities` (activity log and create entry point)
- `/activities/:activityId` (activity details, edit, delete)
- `/waypoints/:id` (waypoint details and waypoint-scoped activity history)

## Purpose

Use one shared activity workflow for add/edit from both the activity log and waypoint details.
Activities can be linked to a waypoint or left unlinked.

## Shared editor behavior

- Fields: date, description/notes, linked waypoint (or no waypoint), conditional Bronze/Silver/Gold category, location, references, and external photo references.
- Location is explicit: **Postcode** or **Latitude and longitude**.
- Category is shown only when the selected waypoint belongs to at least one challenge with `supportsActivityCategories: true`.
- If category eligibility is lost after changing waypoint, the category is cleared before save.
- Invalid input keeps entered values and shows field-level messages.
- Unsaved edits show a leave warning on page unload and when cancelling the form.

## Activity list (`/activities`)

- Newest-first activity log.
- Each row shows date, note excerpt, optional waypoint, location summary, optional category, photo count, and reference count.
- **Add activity** opens the shared editor.
- Selecting an activity opens `/activities/:activityId`.

## Activity details (`/activities/:activityId`)

- Shows date, full notes, location, optional category, optional linked waypoint, references, and photos.
- Photos are rendered in a simple gallery with previous/next controls.
- References render as metadata cards (title, optional description, optional preview image, hostname, external-link action).
- Supports edit via the shared editor and delete with confirmation.

## Delete behavior

Deleting an activity removes the activity and prunes any now-unreferenced activity-linked reference/photo records.
Referenced records still used elsewhere remain.
