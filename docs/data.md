# Data, import, export, backup and restore

## Where data lives

Real Journey data is stored only in Azure Cosmos DB for NoSQL. The browser loads the
complete active dataset through the authenticated same-origin `/api/journey` Function
and never keeps a data cache or offline queue. The `production`, `test`, and `demo`
containers are separate, and each uses `/datasetId` as its partition key.

Cosmos stores one document per entity. Every document contains `id`, `datasetId`,
`type`, and `schemaVersion`; relationships remain IDs and are hydrated into the
validated `WaypointsData` response. Cosmos ETags are kept in application memory and
are not included in JSON exports.

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

- **Export JSON** downloads the authoritative production partition as the envelope above.
- **Restore JSON** validates the complete backup and is accepted only when production
  is empty; demo and test records can never appear in a production export.
- **Clear data** is a protected production mutation. Demo is deterministic and read-only.

An update or delete requires its entity ETag. Cosmos `412 Precondition Failed` is
returned as an explicit `409 Conflict`; the UI must preserve unsaved values and offer
Reload latest or Cancel rather than retrying or overwriting another tab.

Production begins empty. Existing browser-local records are not migrated. The test
container is used only with unique run partitions such as `ci-<run-id>` and every
run must delete and verify its partition after success or failure.
