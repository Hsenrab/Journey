# Waypoint Location Save: Data Model

## Existing persisted entities

No identity, relationship, document version, backup version, or storage key changes.

- Waypoint retains its stable ID, descriptive fields, tags, Challenge IDs,
  once/count completion, reference IDs, photo IDs, and optional location.
- A supplied persisted Waypoint location retains required latitude/longitude and
  optional place name, address/region, source, and approximate flag.
- Challenge membership remains synchronized on both sides by the existing reducer.
- Ideas/Activities continue linking independently; editing location changes neither
  their locations nor historical data. Shared references/photos retain existing rules.

## Transient editor inputs

The normalizer receives the initial optional location and the validated current
optional location; no persisted touched flag or edit-history field is introduced.

- Identifying text: trimmed `placeName` and `addressOrRegion`, with empty as absent.
- Coordinate pair: validated finite numeric latitude/longitude in existing ranges.
- Metadata: source and approximate flag; neither alone identifies a searchable place.
- Coordinate comparison: numeric equality of both values against the initial pair.
- Text comparison: equality of both trimmed identifying fields against initial text.

| Current values versus initial                                              | Effective submitted location                         |
| -------------------------------------------------------------------------- | ---------------------------------------------------- |
| No location on a new Waypoint                                              | Absent                                               |
| New searchable text without coordinates                                    | Unresolved place, with supplied metadata             |
| Valid coordinates changed or newly supplied                                | Current coordinate location; no automatic lookup     |
| Text changed, initial pair untouched, identifying text remains             | Current place/metadata without stale coordinates     |
| Previously named place has both identifying fields cleared, pair untouched | Entire location absent, including metadata           |
| Coordinate-only location unchanged                                         | Existing coordinate location                         |
| Only metadata or formatting changes                                        | Preserve valid pair; no lookup                       |
| Partial/invalid supplied pair                                              | Validation error; no submission                      |
| No pair and only metadata                                                  | Validation error; not silently discarded or geocoded |

Clearing an existing pair while retaining searchable text requests resolution.
An explicitly changed valid pair wins even when all identifying text is removed.
Removing all location fields remains valid because Waypoint location is optional.

## Replacement request input

Use a replacement-specific dataset input type:

- Waypoints allow absent location, a complete valid pair, or searchable text with
  both coordinates absent.
- Other fields/collections retain the existing request constraints.
- Saved-document and import schemas still require complete coordinates.
- Request ETags retain existing concurrency semantics; no new token is introduced.

## Save lifecycle

Draft -> validation -> effective location -> pending replacement -> resolution ->
strict dataset validation -> ETag-checked atomic write -> authoritative response.

- Success adopts the returned dataset and ETags and exits the editor as before.
- Validation/lookup/conflict failure preserves the draft and stored dataset;
  mode switching remains blocked until the request settles, then draft discard
  rules still apply.
- If any unresolved Waypoint fails, none of the proposed dataset is written.
- No background repair, draft persistence, stale-data fallback, or migration.
