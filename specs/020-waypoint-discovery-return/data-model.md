# Navigation Data Model

No persisted entity, API, schema version, export/import shape or migration changes.
The session stores navigation metadata only; Waypoints and Activities remain in
the current dataset provided by Journey.

## Discovery criteria

| Field         | Type / meaning                                                        |
| ------------- | --------------------------------------------------------------------- |
| `query`       | Exact search text, preserving current matching semantics              |
| `area`        | Selected existing Area string or the existing `all` sentinel          |
| `category`    | Selected existing Category string or `all`                            |
| `sort`        | Existing `name`, `status` or `lastActivity` sort key                  |
| `status`      | Existing highest-award query value; validated by existing scope rules |
| `challengeId` | Optional originating Challenge ID                                     |

Do not include result arrays, entities, titles copied from records, editor mode,
drafts, access roles, ETags or scroll offsets. Challenge/status remain the only
existing discovery query parameters; this feature adds no URL filter format.

## Provider-owned discovery session

- One session instance per `WaypointsProvider`, created before keyed children.
- Track selected and effective mode plus an opaque scope token.
- Hold a dictionary keyed by a source list's Router `location.key`.
- A current entry contains criteria, opened Waypoint ID and its scope token.
- An invalidated entry retains only the history-entry key/invalidated marker.
  Drop the old criteria and selected identity; never revive them on mode reversal.
- No local/session storage, module-global cross-provider registry or record cache.

The session exposes narrowly scoped capture, lookup/origin resolution and mode
transition operations. Keep its types and validation in the feature helper,
not duplicated in page components.

## Origin hint

The namespaced `waypointDiscoveryOrigin` router-state value identifies the source
list-entry key and opened Waypoint ID. It is not a trusted record or dataset.
Resolve it only against this provider's live session and the detail route ID.
Do not inspect or replace the separate `challengeOrigin` namespace.

Browser Back resolves the captured list-entry key directly. An explicit return
uses the hint to initialize a new list entry; opening its next result captures
that new entry's key and current criteria. Do not replace history simply to
capture a card activation.

## Restoration classification

| Classification | Meaning                                                                  | Required behavior                                                                         |
| -------------- | ------------------------------------------------------------------------ | ----------------------------------------------------------------------------------------- |
| Current        | Entry exists in this live session and its scope matches                  | Restore criteria; request one return-focus operation                                      |
| Invalidated    | Recognized entry belongs to an earlier dataset scope                     | Fresh list, empty search/filters/scope, Name sort, no selected result                     |
| Absent         | Direct/other-origin/new-tab/refresh entry has no current session capture | Ordinary initial local criteria; preserve existing explicit Challenge/status URL behavior |

Absence and known invalidation are expected navigation states, not swallowed
errors. Guard unknown router state by shape and namespace. A malformed
feature-owned payload or unsupported typed criterion must produce a specific
error, not silently coerce to a valid-looking default. Existing scope errors
continue through `awardFilterError`.

For invalidated browser Back entries, ignore the old captured URL scope before
deriving results, then replace it with a bare list URL. Do not indiscriminately
strip scopes from uncaptured direct entries.

## Lifecycle and transitions

1. **Initial load**: create an empty session. Normal current-dataset loading
   must finish before capturing any result.
2. **Result activation**: after existing navigation permission is granted,
   capture the complete current criteria and selected ID for that list entry;
   pass its hint through the ordinary link.
3. **Detail return**: resolve current/stale/absent origin even if the Waypoint
   was deleted or left the Challenge. Existence/membership determines results,
   not whether the user can return to their source list.
4. **Return rendering**: restore criteria before filtering; wait for successful
   loading and valid scope. Derive results solely from current records.
   A mounted list's own query replacements retain its other active controls;
   they are not an unrelated fresh-list entry or another completed return.
   Own query navigation may use PUSH or REPLACE and produce a new Router entry
   key. Carry the captured origin's dataset-scope provenance forward to that
   entry, without restoring old controls or repeating return focus. Preserve
   existing history behavior. After a dataset transition, continuation entries
   resolve as invalidated rather than absent; unrelated direct entries remain
   absent.
5. **Return focus**: focus the selected anchor if matching; otherwise focus
   the missing/nonmatching explanation. Consume that focus request once.
   Later criteria changes clear return-only feedback and do not refocus.
6. **Same-dataset edits/reload**: retain the session and criteria, recomputing
   membership, completion, awards and ordering from updated records.
7. **Accepted selected-mode change**: rotate scope and invalidate old entries
   after pending/dirty guards allow the change, before new pages can reuse them.
8. **Effective-mode change**: invalidate after the existing superseded-load
   check, including Demo Cosmos fallback to Demo local or recovery from it.
9. **Cancelled/superseded operations**: do not invalidate or apply stale data.
10. **Refresh/provider replacement**: new empty session; old hints cannot
    reconstruct the previous criteria or selection.

Selected/effective names returning to a previous pair do not restore its previous
scope token. Same-mode reloads and record revisions are not dataset changes.

## Presentation-only derived state

- Existing predicates and sort determine current results.
- If an Area/Category criterion no longer exists among current options, keep
  its saved string available and label it as having no current Waypoints.
  Do not drop the criterion or resurrect an entity.
- Loading, specific load/scope errors, empty dataset and no matches are
  separate outcomes. Only a loaded valid scope can produce absence feedback.
- Focus uses the anchor associated with the Waypoint ID, never a title/index;
  no pixel restoration, delayed polling or frozen result list is needed.
