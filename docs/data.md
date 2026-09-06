# Data, import, export, backup and restore

## Where data lives

Real Journey data is stored only in Azure Cosmos DB for NoSQL. The browser loads the
complete active dataset through the authenticated same-origin `/api/journey` Function
and never keeps a data cache or offline queue. It can access only the `production` and
read-only `demo` containers. The separate `test` container uses `/datasetId` as its
partition key and is accessible only to the test deployment identity.

Cosmos stores one document per entity. Every document contains `id`, `datasetId`,
`type`, and `schemaVersion`; relationships remain IDs and are hydrated into the
validated `WaypointsData` response. Cosmos ETags are kept in application memory and
are not included in JSON exports.

Each document type declares its own schema version (`idea` and `activity` are version
2; the other types are version 1). A document whose version or entity shape does not
match the current schema fails validation with its specific error. There is no
migration, compatibility parser, or fallback for obsolete documents; production data
may be deleted and recreated instead.

The deployment workflow seeds the initial demo partition from `src/data/demo.json`.
The runtime Function has read-only access to that container. Every place, activity,
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

`ideas` records include:

- stable IDs and API-owned timestamps (`ideaId`, `createdAt`, `updatedAt`)
- `title`, and possibly empty `description` and `notes`
- `waypointIds` (zero, one, or many distinct Waypoint IDs)
- `planningState` (`active` | `someday` | `rejected`) with `rejectionReason` present
  only when rejected
- `difficulty` (`1` | `2` | `3` | `4`)
- optional `location`
- `referenceIds`; Ideas never hold photo references

`activities` records include:

- stable IDs and timestamps (`activityId`, `createdAt`, `updatedAt`)
- `date` (`YYYY-MM-DD`)
- optional `waypointId`
- `ideaIds` (zero, one, or many distinct Idea IDs, independent of `waypointId`)
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

## API validation and transactional deletion

The Function validates the complete entity for its type and every referenced ID before
writing. Missing, duplicate, or unknown referenced IDs are rejected with an explicit
`400`; invalid IDs are never silently removed during ordinary create or update requests.

Each operation that changes several documents runs as a single Cosmos transactional
batch in the dataset's `/datasetId` logical partition:

- **Delete a Waypoint** — delete the Waypoint, remove its ID from every Challenge
  `waypointIds` and Idea `waypointIds` array, and clear `waypointId` on Activities
  recorded under it. All Challenges, Ideas, Activities, references, and photos are
  preserved.
- **Delete an Idea** — delete the Idea and remove its ID from every Activity `ideaIds`
  array. Activities are preserved; only Reference documents that become unreferenced by
  every remaining entity are deleted.
- **Delete an Activity** — delete the Activity and preserve all Ideas. Derived Idea
  usage follows from the remaining Activities. Only Reference and PhotoReference
  documents that become unreferenced by every remaining entity are deleted.

An update or delete requires its entity ETag, and every batch operation carries the
ETag of the document it touches. Cosmos `412 Precondition Failed` is returned as an
explicit `409 Conflict`; the UI must preserve unsaved values and offer Reload latest or
Cancel rather than retrying or overwriting another tab.

Production begins empty. Existing browser-local records are not migrated. The test
container is used only with unique run partitions such as `ci-<run-id>` and every
run must delete and verify its partition after success or failure.
