# Navigation Model: Map Exploration

This changes no Waypoint, Activity, Challenge, import, persisted schema or API.

## Exploration entry

Key: source React Router history-entry key.

- `mode`: `waypoints | activities`.
- `progressFilter`: `all | started | not-started`.
- `medalFilter`: `all | bronze | silver | gold`; applies only where existing rules allow.
- `mobilePanel`: `map | list`.
- `originQuery`: entered text, independent of the resolved origin.
- `origin`: optional validated latitude/longitude.
- `originChoices`: unchosen nearby-search choices, containing only displayed
  labels and coordinates; ephemeral search UI metadata, not Journey entities.
- `searchFeedback`: handled no-match/failure message or no feedback. No pending
  promise or token/render error is retained.
- `camera`: optional finite SDK center/zoom and available bearing/pitch. Absence
  is valid before readiness; malformed ready-camera values fail explicitly.
- `selectedRouteChallengeId`, `trackActivityId`: optional current-data identifiers.
- `selection`: optional `{ kind: waypoint | activity, id }` for the marker/popup.
- `openedRecord`: `{ kind, id }`, distinct from selection for related Activities
  opened inside a Waypoint popup.
- `entryPath`: `nearby | marker | cluster`, for return-focus placement.
- `scope`: live dataset generation.

No entities, geometry, tokens, SDK objects, DOM nodes or result-set snapshots.

## Origin hint and lookup

Router state namespace: `mapExplorationOrigin`, with `entryKey`, exact opened
record kind/ID and the non-secret live `scope` identifier. A new random scope is
created per provider lifetime and accepted selected/effective dataset transition.
Original captures retain invalidated scope provenance separately from the latest
capture under a history key, so an old hint cannot adopt a new capture after a
dataset change or provider restart. Invalidated entries retain identifiers only,
not their old search, camera or selection metadata.
Full metadata stays in memory, not router state. Only `/map` and the
existing optional `activityId` intent form the return URL.

- Missing/unmatched origin: ordinary direct-entry behavior.
- Valid matching origin and current entry: resumable.
- Recognized invalidated entry: reset with dataset-change explanation.
- Unknown entry after refresh: session ended; no old-context restoration claim.
- Malformed supplied Map namespace: explicit validation failure, not a silent default.

## Transitions

1. Accepted ordinary record activation captures an immutable metadata entry before
   navigation. Declined/default-prevented/modified activation captures nothing.
2. Browser Back resolves the original key. Explicit return follows the entry into
   its new key so later Back/Forward journeys remain coherent.
3. Accepted selected/effective dataset changes invalidate all prior entries
   permanently, including A -> B -> A. Cancelled/superseded transitions do not.
4. Same-dataset reload/edit retains metadata; selections/overlays resolve anew.
5. Ready current-data restoration applies camera/focus once. Loading does not
   consume restoration; later user interactions do not replay focus or framing.
6. Refresh/provider teardown ends the registry. Invalidated entries cannot be
   revived by a saved router hint or a new capture under a reused history key.

## Selection rules

Resolve names, positions, filters, linked Activities and geometry from current data.
Moved records use their current position, never an old popup coordinate. Missing
or inapplicable targets clear the corresponding selection/overlay and explain
absence without changing the captured framing. A valid Waypoint selection can
remain when its related Activity action disappears. Cluster IDs are never retained.
