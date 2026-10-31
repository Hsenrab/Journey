# Locations

Route: `/waypoints` — implemented in `src/pages/Locations.tsx`.

## Purpose

Browse user-created waypoints, see their current status, and open a waypoint to log or
review an activity.

## Supported actions

- Search by title, saved area or category
- Filter eligible Waypoints by highest recorded award (all, No award recorded,
  Bronze, Silver, Gold); ordinary-only scopes omit award controls
- Filter by saved area and category under **More filters**, a
  closed-by-default accordion whose summary reports how many of those filters are active
- Sort by name, highest recorded award where applicable, or last activity date
- Add a waypoint with the shared waypoint add form
- Open a location's details page

## Data read

- Waypoints and activities from `useWaypoints().data`, and derived statuses from `useWaypoints().statusFor`

## Data written

- Waypoint creation through `useWaypoints().addWaypoint`.

## Rules and data flow

1. Eligible Waypoints show their highest recorded Activity award, or "No award
   recorded" without visits. Ordinary Waypoints and ordinary Challenge contexts
   omit award indicators. Completion remains independent.
2. Search is case-insensitive and matches the waypoint title, saved area and category.
3. Filtering is applied before sorting; sorting by name uses locale comparison, sorting by progress
   orders by status value, and sorting by last activity date shows newest activities first.
   Award-control applicability uses the selected dataset or Challenge before
   list filters and pagination. Empty results retain applicable controls and
   a clearing action.
4. Add mode includes **Form** and **Paste JSON** tabs. Paste JSON accepts one waypoint content object
   without entity links or generated identifiers and rejects arrays and unlisted fields.
5. **Copy example JSON** copies a representative draft shape. **Load into form** validates the pasted
   JSON, keeps the pasted text on errors, and on success populates the content fields while preserving
   challenge selections already made in the form.
6. An info icon next to the Waypoint JSON field opens a dialog with a ready-to-copy AI prompt describing
   the exact draft shape. Copy the prompt into an external AI tool (for example GitHub Copilot Chat or
   ChatGPT) alongside source material about the waypoint, then paste the AI's JSON response into Paste
   JSON.
7. Each card links to `/waypoints/:id`, where the id is the stable identifier used as the storage
   key.

## Returning to discovery results

Opening a result remembers that particular list's search text, Area, Category,
sort, highest-award filter and Challenge scope for the live, same-tab journey.
The detail breadcrumb becomes **Back to Waypoint results**. Both that link and
browser Back restore the shortlist without re-entering criteria, including after
successive comparisons.

Return uses current records, not copied cards. The opened Waypoint's link is
scrolled into view and focused by ID, even if its position changed or another
Waypoint has the same title. If it no longer matches, the explanation is
**The Waypoint you opened no longer matches these filters.** If deleted, it is
**The Waypoint you opened is no longer available.** Loading and scope/load errors
take precedence. A removed selected Area or Category remains labelled
**(no current waypoints)** rather than silently clearing that filter.

Clear filters removes search, Area, Category and highest-award filtering, but
retains Challenge scope and the applicable chosen sort. Further interaction does
not repeatedly move focus. Award filtering and Add/Cancel retain the other list
controls and their existing browser-history behavior.

Changing the selected or effective dataset clears captured discovery context,
including history entries reached later: return starts with no filters or
Challenge scope and Name sorting. Switching back does not revive the old list.
Refreshing either page also ends the captured journey; explicit Challenge/award
URL parameters retain their normal independent behavior. Unrelated direct links
still report invalid scope rather than silently becoming an unfiltered list.

Direct, new-tab, Idea, Map and Challenge entries do not borrow a discovery origin.
Viewer and Demo local browsing stays read-only. A dirty contextual breadcrumb
return asks the existing destination-aware discard question once; pending work
blocks it. This adds no global dirty browser-Back guarantee or draft recovery.
Navigation alone never writes records or saves filters to browser storage.

## Cancelling a Waypoint draft

Creating and editing a Waypoint use the same Cancel behavior:

- An unchanged draft closes immediately, without a warning or save. Restoring all
  initial values, switching tabs or entering only whitespace in Paste JSON does
  not introduce a warning.
- A changed draft asks **You have unsaved Waypoint changes. Discard them?**.
  Declining keeps the current tab, all form/JSON content, Challenge selections,
  completion settings, evidence order and visible errors.
- Confirming discard closes the editor without saving and retains the current
  list/detail context. Reopening starts from the saved Waypoint or new-record
  defaults, not from the discarded draft.
- Unapplied non-whitespace JSON is unsaved work, even if it is invalid. Clearing
  JSON does not remove changes already loaded into the form.
- During a save, form controls, Save and Cancel are disabled and show **Saving...**.
  A handled failure retains the draft and its specific error, restores editing,
  and makes Cancel available with the same discard protection.

This protection applies to Cancel only; other navigation and browser-close
safeguards remain unchanged. It adds no autosave or draft recovery, and does not
give viewers or read-only data modes editing access. Confirmation controls and
appearance are supplied by the browser.

## Challenge browsing and recording

Opening a Waypoint from a Challenge offers **Back to [original Challenge]**
while browsing, recording, and after a successful save. Shared membership never
chooses a different Challenge. Direct visits and page reloads do not invent a
Challenge origin; list visits use the discovery return described above instead.
Challenge returns are removed if the
original Challenge/membership disappears or the loaded dataset changes.

**Log activity** brings the title field into view and focuses it. Empty GPX,
reference, and photo sections stay collapsed. For a minimal draft, Save is
within one viewport of additional scrolling after the last required field,
before unrelated Waypoint history.

Successful recording stays on the Waypoint and reveals/focuses the confirmation,
not its return button. Follow the named return to see current Challenge progress.
Changing the draft's destination retains that original return, but confirmation
explicitly explains non-contribution if the Activity is unlinked or elsewhere.
Loaded deletion/reassignment determines current progress, not an old receipt.

Dirty returns ask before discarding; pending mutations block navigation.
Viewers and Demo local users retain browsing and return links, with the read-only
notice and Settings link, but no recording/editing controls.

### Waypoint Paste JSON draft example

```json
{
  "title": "Take a hot-air balloon ride",
  "description": "Experience a sunrise flight in a hot-air balloon and see the landscape from above.",
  "category": "Adventure",
  "tags": ["ballooning", "flight", "bucket list"],
  "completion": { "mode": "once" },
  "location": {
    "addressOrRegion": "Cotswolds",
    "source": "Manual research",
    "approximate": true
  },
  "references": [{ "title": "Balloon ride details", "url": "https://example.com/balloon-ride" }],
  "photoReferences": [{ "title": "Balloon flight", "url": "https://example.com/balloon.jpg" }]
}
```

## Future improvements

- Saved filter defaults across unrelated visits or refreshes (not part of live discovery return)
- Group by area or allow a different travel reference point
- Show visit dates and note previews on the cards
