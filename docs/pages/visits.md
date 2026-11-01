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
- **Search activities** narrows the current list as you type. It searches saved
  titles, full notes (including text beyond the card excerpt), displayed postcode
  or coordinate summaries, and current linked Waypoint titles.
- Every whitespace-separated word must match a case-insensitive substring in
  those fields within the same Activity. Words may match different fields in
  either order. Repeated words do not require repeated occurrences. Evidence,
  linked Idea text, dates and award labels are not searched.
- Search intersects the current Challenge/recorded-award scope. It keeps the
  existing date/update ordering and never includes matching records outside that
  scope. Duplicate-title cards still open their own Activity.
- **Clear search** clears only the query, restores that scope and focuses the
  input. Empty data, an empty scope and query no-match have distinct messages;
  loading, invalid scope and specific load errors take precedence.
- Award changes, Add/Cancel and ordinary saves on this page retain the query.
  Leaving history (including returning with browser Back/Forward), refreshing,
  or changing the selected/effective dataset resets it permanently. Same-mode
  reloads retain the query and search the latest saved records.
- Search is available to viewers and in read-only Demo modes without enabling
  writes. It does not save preferences, fetch evidence or alter save behavior.
- Each row shows date, note excerpt, optional waypoint, location summary, optional category, photo count, and reference count.
- **Add activity** opens the shared editor.
- New and edited postcode-only Activities are resolved by the protected Journey API
  through Azure Maps before saving. Already resolved locations and explicit
  coordinate pairs need no lookup. Resolution failures keep the draft and show
  the specific error without writing any records.
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

### Returning to Map exploration

Activities opened from a nearby result, marker action or cluster-member link
offer **Back to Map** alongside their existing Activity/Waypoint breadcrumbs.
That return and browser Back resume the originating live-tab exploration without
another origin search or record write. Existing Waypoint chips and deletion
destinations are unchanged; unrelated nested detail links do not inherit a Map
origin.

An Activity opened inside a Waypoint popup returns to Waypoints mode and retains
an independently valid Waypoint selection, even if that Activity has disappeared.
Popups, progress, positions and route/track geometry always use current records.
Missing selections/overlays are explained without stale content or automatic
reframing. Captured framing is not overridden by initial route/track fits;
direct recorded-track entry and deliberate later planned-route selection still fit.

Search text, resolved origin, unchosen choices/feedback, applicable filters and
the mobile panel last only for the live tab. Dataset changes permanently reset
them with an explanation, including switching away and back. Refresh/new-tab
entry does not invent a contextual return.

Return focus moves once to the current originating result/action or the visible
panel/absence explanation. Existing dirty-draft confirmation and pending-write
blocking apply to the contextual link, without a new browser-Back guard.
Viewers and read-only Demo users retain browsing but not editing.
Controlled nearby-list browser tests and SDK substitutes do not establish live
Azure Maps camera, cluster or touch acceptance.

## Delete behavior

Deleting an activity removes the activity and prunes any now-unreferenced activity-linked reference/photo records.
Idea records are preserved and usage is derived from remaining activity links after reload.
Referenced records still used elsewhere remain.
