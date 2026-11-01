# Data Model: Search Activity History

**Feature**: [spec.md](./spec.md)

No persisted entities, schema versions, migrations or request shapes change.

## Existing read-only inputs

| Input           | Fields used                                                                                                | Relationship and validation                                                                 |
| --------------- | ---------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------- |
| Activity        | `activityId`, `name`, `notes`, `location`, optional `waypointId`; existing date/update fields for ordering | Use currently loaded, already validated saved records, never unsaved drafts.                |
| Waypoint lookup | Current `waypointId` and `title`                                                                           | Resolve the optional Activity link by ID; no link contributes no title.                     |
| Scoped records  | Existing unscoped, Challenge or recorded-award Activity group                                              | Existing award validation/statistics remain authoritative; filter receives only this group. |

Reuse title and location formatters. Location matching includes visible postcode
label/value or the five-decimal coordinate summary, not hidden metadata. Notes
are searched in full. Ideas, evidence contents, dates and category labels are
not searchable fields.

## Temporary query state

| Field            | Type                       | Lifetime                                                       |
| ---------------- | -------------------------- | -------------------------------------------------------------- |
| `query`          | String                     | Raw input for the mounted history visit only.                  |
| `activeDataMode` | Existing dataset-mode type | Effective mode associated with query; detects dataset changes. |

No entity copies, filtered snapshots, origin IDs or entry keys are stored.
Matching terms and result arrays are derived, not retained.

### Matching rule

1. Trim/lowercase query and split on whitespace, dropping empty tokens.
2. Obtain the Activity's lowercased title, full notes, displayed location and
   optional current Waypoint title.
3. Include only when every token occurs within at least one supported field.
   Tokens may match different fields but must match the same Activity; order
   and repeated query words do not require additional occurrences.
4. Zero tokens includes every scoped Activity. Preserve input order/entity
   identity; the page retains the existing chronology comparator.

Punctuation is literal, not regex/wildcard syntax. No accent folding, fuzzy
matching or phrase syntax is introduced.

### State transitions

| Event                                                    | Query outcome                                                      | Other behavior                                              |
| -------------------------------------------------------- | ------------------------------------------------------------------ | ----------------------------------------------------------- |
| Mount or refresh                                         | Empty                                                              | Existing URL scope interpreted normally.                    |
| Type/paste                                               | Raw value updates; derive terms/results synchronously              | No write, extra load, debounce or evidence fetch.           |
| Clear search                                             | Empty; focus input                                                 | Preserve scope and chronology.                              |
| Award selection, Add/Cancel, ordinary save on same route | Retain                                                             | Existing history, guards and success/error messages intact. |
| Actual route departure                                   | Destroy with page                                                  | Back/Forward or normal link mounts empty.                   |
| Accepted selected dataset change                         | Empty through provider remount                                     | No provider-key or guard changes.                           |
| Declined/blocked selection                               | Retain                                                             | Existing dataset and explicit guard outcome retained.       |
| Effective fallback/recovery                              | Clear before deriving results; permanently replace mode/query pair | Reset search only, not editor/provider children.            |
| Same-mode reload or superseded response                  | Retain unless effective mode actually changes                      | Loading/errors remain; use newly loaded saved records.      |
| Saved Activity or Waypoint-title changes                 | Recompute                                                          | No old cards, deleted records or unsaved text.              |

## Result-state derivation

Keep separate counts for loaded dataset Activities, the unsearched scoped group
and searched results. Follow [UI precedence](./contracts/ui-contract.md);
a zero-length searched array alone cannot establish empty data, empty scope,
failure or no matches.

## Integrity boundaries

Search does not modify associations, awards, evidence arrays, completion or
dataset selection. Validation remains upstream. A disappeared optional link
contributes no text; unexpected malformed loaded data keeps its existing explicit
failure instead of being silently discarded as an empty result.
