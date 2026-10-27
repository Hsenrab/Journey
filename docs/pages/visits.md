# Activities and waypoint details

Routes:

- `/activities` (activity log and create entry point)
- `/activities/:activityId` (activity details, edit, delete)
- `/waypoints/:id` (waypoint details and waypoint-scoped activity history)

## Purpose

Use one shared activity workflow for add/edit from both the activity log and waypoint details.
Activities can be linked to a waypoint or left unlinked.

## Shared editor behavior

- Fields: date, description/notes, linked waypoint (or no waypoint), optional linked ideas, conditional Bronze/Silver/Gold category, required location, optional recorded GPX track, references, and external photo references.
- Location is explicit: **Postcode** or **Latitude and longitude**.
- Award tier is mandatory exactly when the selected Waypoint belongs to an
  enabled Challenge. All applicable named explanations are shown and one chosen
  level applies across shared memberships; direct Activity/Challenge links do not
  own awards.
- New drafts have no tier selected. Same-Waypoint edits retain their recorded
  tier. A different eligible destination requires a deliberate new selection.
  Moving a recorded award to an ineligible destination requires explicit
  acknowledgement of its removal; cancellation preserves the original record.
- Idea selections are independent from waypoint selection. Changing or clearing waypoint does not clear selected ideas.
- Invalid input keeps entered values and shows field-level messages.
- Previously reported errors and accessible invalid indications update when a
  corrected field is left or a requirement-changing selection finishes. Invalid
  values retain their errors. Location/award dependencies and evidence row
  changes are revalidated without moving focus or writing a record.
- Corrections retain unrelated errors, notes, attachments, and specific
  save/conflict/GPX failures; correcting input does not mean saving succeeded.
- A GPX track can be attached, replaced, or removed. Invalid GPX shows its parser error and keeps other form values and any previously attached track.
- Unsaved edits show a leave warning on page unload and when cancelling the form.
- New Challenge/Dashboard returns also confirm dirty drafts and block pending
  saves. Saving from a Waypoint reveals and focuses its confirmation without
  redirecting. Its valid original Challenge return remains available, with
  truthful contribution feedback even after changing the draft's destination.
- Ordinary creation stays on Activities; an Idea-origin save that retains that
  Idea returns there. Activity details/editing retain their existing navigation
  and do not acquire a Challenge-origin return.
- Add mode includes **Form** and **Paste JSON** tabs. Paste JSON accepts one activity content object
  without entity links or generated identifiers and rejects arrays and unlisted fields.
- **Copy example JSON** copies a representative draft shape. **Load into form** validates the pasted
  JSON, keeps the pasted text on errors, and on success populates the content fields while preserving
  waypoint and idea selections already made in the form.
- An info icon next to the Activity JSON field opens a dialog with a ready-to-copy AI prompt describing
  the exact draft shape. Copy the prompt into an external AI tool (for example GitHub Copilot Chat or
  ChatGPT) alongside source material about the activity, then paste the AI's JSON response into Paste JSON.

### Activity Paste JSON draft example

```json
{
  "name": "Sunrise balloon flight",
  "date": "2026-08-16",
  "notes": "Took an early-morning balloon flight over the Cotswolds and watched the sunrise above the fields.",
  "location": { "kind": "postcode", "postcode": "GL54 2EN" },
  "references": [{ "title": "Flight details", "url": "https://example.com/flight" }],
  "photoReferences": [{ "title": "Sunrise balloon flight", "url": "https://example.com/balloon.jpg" }]
}
```

## Activity list (`/activities`)

- Newest-first activity log.
- Each row shows date, note excerpt, optional waypoint, location summary, optional category, photo count, and reference count.
- **Add activity** opens the shared editor.
- Selecting an activity opens `/activities/:activityId`.
- `challenge=<id>&award=bronze|silver|gold` scopes the list to current member
  Activities with that exact recorded tier, using the same groups as Statistics.
  Active scope and return links remain visible. Invalid filters fail explicitly;
  valid zero matches show an empty state with applicable controls retained.

## Activity details (`/activities/:activityId`)

- Shows date, full notes, location, the visit's own "Recorded award" where
  applicable, optional linked Waypoint, linked Ideas, references, photos, and a
  link to view an attached recorded GPX track on the map.
- Photos are rendered in a simple gallery with previous/next controls.
- References render as metadata cards (title, optional description, optional preview image, hostname, external-link action).
- Reference cards, gallery photos and thumbnails follow the Activity's saved order.
  Reopening the editor preserves that order, including after adding or moving evidence and reloading the page.
- Supports edit via the shared editor and delete with confirmation.

The Map page opens the Activities view for a linked recorded track and fits the map to its recorded geometry. The Activities view also draws attached tracks when opened without a selected activity.

## Delete behavior

Deleting an activity removes the activity and prunes any now-unreferenced activity-linked reference/photo records.
Idea records are preserved and usage is derived from remaining activity links after reload.
Referenced records still used elsewhere remain.
