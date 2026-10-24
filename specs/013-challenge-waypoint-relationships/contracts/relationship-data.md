# Boundary Contract: Single-Source Challenge-Waypoint Relationships

This changes entity validation, not API routes, authorization, or general response
shapes. See the [data model](../data-model.md).

## Browser data and editing

- API responses, import parsing, bundled Demo initialization, and legacy test-only
  local loads must reject obsolete Challenge membership data.
- Use strict Challenge validation and specific errors naming the obsolete field
  and affected Challenge where available. Do not recommend simply deleting a field
  without checking separately whether its links need preservation.
- Duplicate or unknown Waypoint Challenge assignments are invalid.
- Waypoint editing remains the assignment UI. Successful edits refresh derived
  Challenge views; cancellation or rejected edits do not change saved membership.
- Existing admin/viewer and Demo local/Demo Cosmos/Production rules remain intact.

## Existing Journey API

`/api/journey/{container}` keeps its current operations:

| Operation               | Required behavior                                                                              |
| ----------------------- | ---------------------------------------------------------------------------------------------- |
| GET dataset             | Validate documents and assembled relationships before returning data.                          |
| Create/update Challenge | Reject `waypointIds`; store current-version Challenge entity.                                  |
| Create/update Waypoint  | Validate distinct, existing `challengeIds` and resulting graph; do not update Challenges.      |
| Replace/import dataset  | Validate the whole payload before persistence; reject obsolete fields and invalid assignments. |
| Delete Waypoint         | Preserve atomic detachment/pruning without writing Challenge documents.                        |
| Clear                   | Preserve existing behavior; do not turn it into a repair path for invalid stored data.         |

Keep the existing Waypoint update dataset response even though only the Waypoint
now needs updating. Preserve ETag conflicts and atomicity; no fallback writes,
partial success, retries, or new operations.

### Errors

- Invalid client entities/payloads use the existing HTTP 400 JSON
  `{ "error": "<specific validation message>" }` boundary.
- Expected stored relationship incompatibility uses HTTP 422 with the same error
  envelope and a specific message. Classify only this expected validation failure
  at the API boundary; unexpected exceptions retain their messages and propagate.
- Existing HTTP 403 access and HTTP 409 conflict/import-not-empty behavior remains.
- Messages must identify the obsolete field/version or invalid assignment and
  explain that correction is separate; no sensitive dataset dump in responses.

## Export/import

- New exports use backup version 2 and no Challenge-side assignment list.
- Version-1 backups fail explicitly; changing the envelope version alone does not
  make obsolete entities valid.
- Existing import-only-into-empty-writable-dataset restrictions remain.
- Failed validation performs no writes and does not discard unrelated records.

## Existing load failure UX

- Production load failure is an error and blocks writes; no fixture or stale data
  is presented as Production.
- Demo Cosmos may retain the existing warning-labelled read-only Demo local
  fallback. That is failure to load Demo Cosmos, not acceptance or conversion of
  the rejected dataset.
- No new fallback or repair UI is introduced.

## Excluded changes

No migrations, hosted data correction, Challenge CRUD UI, redesign of the optional
direct Activity-Challenge link, new GPX rules, new Azure resources, or deployment.
