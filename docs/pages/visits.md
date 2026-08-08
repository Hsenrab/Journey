# Visits (location details)

Route: `/locations/:id` — implemented in `src/pages/LocationDetails.tsx`.

## Purpose

Show the reference information for one location, let a new visit be logged, and show the visit
history and derived status for that location.

## Supported actions

- Read the location description and open the official National Trust visitor information page
- Choose a completion level (Bronze, Silver, Gold)
- Set the visit date
- Add free-text notes
- Add photo references, one URL or filename per line
- Save the visit
- Review previous visits to the location and its current status
- Return to the location list

## Data read

- The matching entry in `locations` (`src/data/locations.ts`)
- The visits for the id from `useJourney().visitsFor`, and the derived status from
  `useJourney().statusFor`

## Data written

One new visit record appended to the history through `useJourney().addVisit` and persisted to local
storage:

```json
{
  "visitId": "8f0d0f6e-2b4a-4f43-9f0f-6a1f6a5a1c2b",
  "locationId": "may-hill",
  "date": "2026-04-12",
  "status": "silver",
  "notes": "…",
  "photos": ["…"],
  "createdAt": "2026-04-12T18:00:00.000Z",
  "updatedAt": "2026-04-12T18:00:00.000Z"
}
```

## Rules and data flow

1. An unknown id shows a "Location not found" message and no form.
2. `not-started` is not selectable — it represents the absence of any visit, so the form offers
   Bronze, Silver and Gold and defaults to Bronze.
3. The date defaults to today and must be a real `YYYY-MM-DD` date; an invalid date is rejected with
   an error message and nothing is saved.
4. Photo references are split on newlines, trimmed, and empty lines are dropped.
5. Saving appends a visit; earlier visits are never overwritten, and the location's status is the
   highest status awarded by any of its visits, so a later lower visit cannot downgrade it.
6. The context writes the updated data to local storage immediately, and a success message is shown.

## Future improvements

- Per-location checklists describing what silver and gold require
- Editing or deleting an individual visit
- Thumbnails or validation for photo references
- Warn before navigating away with unsaved edits
