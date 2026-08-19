# Data, import, export, backup and restore

## Where data lives

All app data is stored in browser local storage (`waypoints-v1` for personal data, `waypoints-demo-v1` for demo data).
There is no server persistence.

The initial demo partition is loaded from `src/data/demo.json`. Every place, activity,
idea and reference in that fixture is fabricated and visibly labelled as demo content.
The fixture mixes fictional National Trust-style places with unrelated local activities.
It is parsed with `DataSchema` before use; only challenges that explicitly set
`supportsActivityCategories` can use Bronze, Silver or Gold activity categories.

## Stored shape

The persisted root object is:

```json
{
  "waypoints": [],
  "challenges": [],
  "ideas": [],
  "activities": [],
  "references": [],
  "photoReferences": []
}
```

`activities` records include:

- stable IDs and timestamps (`activityId`, `createdAt`, `updatedAt`)
- `date` (`YYYY-MM-DD`)
- optional `waypointId`
- optional `category` (`bronze` | `silver` | `gold`)
- structured location:
  - `{ "kind": "postcode", "postcode": "..." }`, or
  - `{ "kind": "coordinates", "latitude": number, "longitude": number }`
- `notes`
- `referenceIds` and `photoReferenceIds`

Raw `Activity.photos` strings are not used for new data.

## Validation and failure behavior

Validation is shared in `src/domain/visit.ts` and enforced by storage import/load.

- Invalid stored JSON or invalid persisted shape throws immediately.
- Import validates `version`, envelope shape, and full `data` schema.
- Unsupported or malformed imports are rejected; existing stored data remains unchanged.

## Backup format

```json
{
  "version": 1,
  "exportedAt": "2026-08-01T00:00:00.000Z",
  "data": {
    "waypoints": [],
    "challenges": [],
    "ideas": [],
    "activities": [],
    "references": [],
    "photoReferences": []
  }
}
```

## Export / restore / clear

- **Export JSON** downloads the active partition as the envelope above.
- **Restore JSON** replaces the active partition with validated backup content.
- **Clear data** clears activities in the active partition (after confirmation).
