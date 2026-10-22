# Waypoint Location Save: Research and Decisions

## Original save-path findings

- `WaypointEditor` accepts optional place/address-only input and calls its page's
  submission handler. JSON entry loads into that same form.
- `Locations`/`LocationDetails` call provider add/update. The reducer constructs
  Waypoints plus Challenge links, references, and photos as a complete candidate.
- Provider `persist` calls `replaceJourney`, not `createJourneyEntity` or
  `updateJourneyEntity`.
- API `JourneyMutationSchema` currently validates replacement with the strict
  `JourneyDataSchema`; a supplied Waypoint location must already have coordinates.
- API replacement never calls `geocodedEntity`; entity create/update does.
- `replaceDataset` writes an ETag-checked batch and preserves atomicity, with an
  existing 100-operation maximum. Changing to entity CRUD would also require
  coordinated supporting-record and membership writes.
- Client `responseError` currently loses the error body for expected 400 failures;
  preserving that detail is necessary for actionable resolution failures.

## Implementation inventory

- Work is on the actual `implement-waypoint-location-save` branch, created from
  main with the existing specification changes preserved. No save-path deviation
  required a provider or page implementation change.
- The replacement schema reuses strict collection constraints and changes only
  Waypoint location input. Saved documents and imports still use the resolved
  schema. Graph validation accepts a structural graph-only projection, avoiding
  casts or weaker saved data types.
- Replacement resolves through the existing `geocodedEntity` boundary, then
  validates the strict dataset and graph before document conversion and the batch.
- `effectiveWaypointLocation` is the pure domain normalizer; editor coordinate
  validation runs before it, and metadata-only input is explicitly rejected.
- The client validates JSON error envelopes with Zod and preserves status context;
  only exact HTTP 409 conflict/import codes become the existing typed errors.
- Impacted consumers: editor -> Locations/LocationDetails -> provider reducer and
  pending tracking -> replacement client -> mutation schema/graph -> handler ->
  existing managed-identity resolver -> strict documents -> Cosmos batch. Shared
  client error handling also affects load/import/clear/entity operations. Frontend
  and API builds plus built-host smoke tests cover packaging. Existing deployment
  workflows consume those unchanged outputs; no deployment is authorized.
- UI self-review: no layout, spacing, field styles, tabs, breakpoints, or shared
  components changed. The new validation uses the existing coordinate MUI Alert;
  remote failures use the existing page Alert with their specific message.

## Decision: preserve atomic replacement

**Decision**: add a narrowly typed replacement-input allowance for unresolved
Waypoint locations, resolve before final persisted-data validation, then use the
existing batch.

**Rationale**: fixes the real browser path while preserving references, membership,
photos, concurrency, and atomic failure. Existing managed-identity geocoding is reusable.

**Alternatives considered**: entity create/update alone does not cover all related
records atomically; a new save endpoint duplicates existing infrastructure;
browser geocoding adds an unnecessary pre-save round trip and splits save semantics.
Relaxing stored/imported schemas would violate the approved coordinates guarantee.

## Decision: normalize editor submission by values

**Decision**: a pure domain helper compares validated current input with the
initial Waypoint location. It computes the effective submitted location without
mutating the stored record or erasing the visible draft on failure.

**Rationale**: both user decisions depend on initial versus current values.
Trimming textual input and comparing coordinates numerically avoids re-resolution
for whitespace or equivalent numeric formatting. An explicit pair means a valid
pair whose numeric value differs from the initial pair; editing then reverting
does not establish a different location.

**Alternatives considered**: per-keystroke clearing can destroy coordinates before
the user finishes editing; touched flags falsely treat reverted fields as new
coordinates; putting domain rules directly in JSX duplicates validation logic.
Do not change low-level entity APIs to infer UI edit intent: callers supplying a
complete valid pair continue to provide authoritative coordinates.

## Decision: bound the #174 repair

**Decision**: resolve only the Waypoint replacement gap here. Keep Activity inputs
strict on this boundary and retain its remaining #174 work explicitly.

**Rationale**: this plan implements the clarified Waypoint feature, not Activity
editing. The shared replacement change must not silently change Activity behaviour.

**Alternatives considered**: resolving all entity types would widen the task to
Activity postcode semantics and its separate acceptance surface.

## Decision: preserve validation and failure boundaries

**Decision**: authorize, validate unresolved input/graph, resolve, strictly validate
the final dataset/graph, then write. Report expected no-result errors through the
existing response boundary and preserve their specific detail in the browser.

**Rationale**: no failed lookup may omit a location, partially save supporting
records, or become an apparently successful save. Existing pending tracking spans
the request, including Maps calls.

**Alternatives considered**: geocoding persisted records, retrying failed lookups,
choosing another provider, partial writes, and returning stale coordinates are
outside scope and contrary to project constraints.

## Unchanged constraints and open defects

- Existing saved-document versions, restore validation, managed identity, Maps
  account configuration, RBAC, containers, and deployment workflows remain intact.
- #170 duplicate identities and #171 Challenge-side consistency remain separate.
- No Maps-result chooser, confidence threshold, regional restriction, metadata
  rewrite, capacity expansion, or persisted-data migration is introduced.
- No unresolved planning questions remain. Executed validation belongs in
  [evidence](evidence.md); repository inspection is not hosted acceptance.
