# Visits (location details)

Route: `/locations/:id` — implemented in `src/pages/LocationDetails.tsx`.

## Purpose

Show the reference information for one location and let the visit for it be recorded or updated.

## Supported actions

- Read the location description and open the official National Trust visitor information page
- Choose a completion level (Bronze, Silver, Gold)
- Set the visit date
- Add free-text notes
- Add photo references, one URL or filename per line
- Save the visit
- Return to the location list

## Data read

- The matching entry in `locations` (`src/data/locations.ts`)
- The existing visit record for the id, if any, used to pre-fill the form

## Data written

One visit record keyed by the location id, written through `useJourney().saveVisit` and persisted to
local storage:

```json
{ "status": "silver", "date": "2026-04-12", "notes": "…", "photos": ["…"] }
```

## Rules and data flow

1. An unknown id shows a "Location not found" message and no form.
2. `not-started` is not selectable — it represents the absence of a record, so the form defaults to
   Bronze for a new visit and to the saved status otherwise.
3. The date defaults to today for a new visit.
4. Photo references are split on newlines, trimmed, and empty lines are dropped.
5. Saving replaces the whole record for that location; there is a single current record per
   location rather than a visit history.
6. The context writes the updated data to local storage immediately, and a success message is shown.

## Future improvements

- Per-location checklists describing what silver and gold require
- Multiple dated visits per location with a history view
- Thumbnails or validation for photo references
- Warn before navigating away with unsaved edits
