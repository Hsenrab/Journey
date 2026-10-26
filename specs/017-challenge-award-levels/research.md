# Research: Challenge Award Levels

**Date**: 2026-10-25 | **Feature**: [spec.md](./spec.md)

## 1. Preserve the existing Activity award, not a new ownership model

**Decision**: Keep `Activity.category` as the visit's single Bronze/Silver/Gold
value and `Challenge.supportsActivityCategories` as the eligibility flag.
Add `awardDescriptions` to Challenges. Navigation origin and optional
`Activity.challengeId` do not own the award.

**Rationale**: The user explicitly chose one level shared by all eligible
memberships. Existing highest-award calculation already gives Gold for
Bronze, Gold, Bronze. Completion counts linked Activities independently.

**Alternatives considered**: Per-Challenge award arrays, inferred visit levels,
and a renamed persisted Activity field add unnecessary shape changes or
contradict the agreed model.

Evidence: [domain schemas/helpers](../../src/domain/visit.ts),
[clarifications](./spec.md#clarifications).

## 2. Make all three explanations explicit and editable

**Decision**: Require three trimmed nonblank descriptions only when enabled;
omit the object when disabled. Retain fixed ordering and no default descriptions.
Edits are current guidance and never update historical Activity levels.

**Rationale**: Current Challenge creation exposes only a checkbox, and recording
offers unexplained global tiers. The user chose fixed levels, not subsets, and
expressly allowed explanation editing after recording.

**Alternatives considered**: Arbitrary schemes, criteria snapshots, automatic
classification, or blocking typo corrections are outside the clarified scope.

Evidence: [Dashboard authoring](../../src/pages/Dashboard.tsx),
[Activity editor](../../src/components/ActivityEditor.tsx).

## 3. Enforce the graph rule at every actual boundary

**Decision**: Require a category iff the linked Waypoint has an enabled
membership. Reuse frontend and backend eligibility validation, but extend it
to reject missing required values as well as ineligible supplied values.
Full loads, imports, replacements, raw writes, and contextual JSON application
must agree.

**Rationale**: The editor requires a tier today, but frontend
`validateActivityCategory` and backend graph validation only reject a supplied
ineligible tier. The full frontend `DataSchema` currently checks Challenge
membership references but not this complete Activity invariant.

**Alternatives considered**: Form-only validation leaves imports and direct
callers inconsistent. A new shared validation package is not justified.
Use equivalent focused tests against the existing frontend/backend modules.

Evidence: [visit.ts](../../src/domain/visit.ts),
[draft parser](../../src/domain/draftJsonImport.ts),
[API graph](../../api/src/lib/journeyGraph.ts).

## 4. Replace implicit clearing with deliberate correction

**Decision**: Remove silent clearing in the editor/context; acknowledge
eligibility-removing edits before committing and explicitly choose a level for
an eligible destination. Block awarded Waypoint deletion. Permit Challenge
removal/disabling only if every awarded Activity remains eligible.

**Rationale**: The current editor clears category in an effect; the reducer
also drops category when no Waypoint is supplied. Waypoint deletion strips
both `waypointId` and category from retained Activities. The current Challenge
deletion plan does not detach memberships, so graph validation rejects it.

**Alternatives considered**: Keeping detached awards or bulk repair would add
new historical semantics the user rejected.

Evidence: [Journey context](../../src/features/journey/JourneyContext.tsx),
[API deletion plan](../../api/src/lib/journeyGraph.ts).

## 5. Reuse the coarse ETag snapshot transaction

**Decision**: Route award-sensitive raw create/update/delete candidates through
the existing complete-snapshot transactional replacement mechanism. Retain
target `ifMatch` checks and existing response shapes. Include unchanged retained
documents with their ETags, not only changed Activity rows.

**Rationale**: Frontend edits normally call `replaceJourney`, which already
replaces the loaded snapshot transactionally. Raw create and most raw updates
currently write standalone documents after graph preflight; a concurrent visit
or membership change can invalidate that earlier check. All relevant writers
must contend on the retained snapshot documents.

**Alternatives considered**: Guarding only known affected Activities misses
concurrent creates. New lock documents, generic transaction frameworks, and
retries are unnecessary. Reuse the established 100-operation batch restriction
and fail explicitly above it; do not chunk.

Evidence: [Journey service](../../src/services/journeyApi.ts),
[API handler](../../api/src/functions/journey.ts),
[Cosmos batch operations](../../api/src/lib/cosmos.ts).

## 6. Derive statistics and matching record sets together

**Decision**: Group distinct current members by their highest award, and their
distinct linked Activities by individual award. Derive counts from these sets.
Use the same scoping helper for totals and existing-list drill-downs.

**Rationale**: `statusCounts` currently groups Waypoints globally, while its
Dashboard heading says "Activity categories". Activities has no award/Challenge
filter, and Waypoints has an unscoped status filter. Separate units are required.

**Alternatives considered**: Persisted rollups and statistics endpoints would
duplicate available loaded data and create unnecessary consistency problems.

Evidence: [Dashboard](../../src/pages/Dashboard.tsx),
[Waypoints](../../src/pages/Locations.tsx),
[Activities](../../src/pages/Activities.tsx).

## 7. Audit all presentation consumers, including supporting guidance

**Decision**: Update global and member summaries, Recently visited, Activity
details/history, Map filters and popups, and Settings rules. Hide inapplicable
award content rather than displaying "Not Started" or "Uncategorised".
Keep Waypoint free-text category and completion terminology separate.

**Rationale**: Award status labels appear on more surfaces than feature 016
names. Ordinary Challenges must remain award-free even when sharing eligible
members, while global Waypoint views can explain enabled membership context.

Evidence: [Map](../../src/pages/MapPage.tsx),
[Settings](../../src/pages/Settings.tsx),
[UI guidelines](../../docs/UI_GUIDELINES.md).

## 8. Use explicit breaking-data handling and the existing seed path

**Decision**: Increment Challenge document schema version 3 to 4; keep Activity
version 5 and backup envelope version 2. Reject incompatible payload contents.
Update bundled fictional data and all test builders. Do not migrate or modify
live records.

**Rationale**: Cosmos validates exact per-entity versions. The changed Challenge
shape requires a version change; unchanged Activity fields and backup wrapping
do not. API build copies the frontend Demo fixture and seed validation already
uses the normal schemas.

**Alternatives considered**: Default descriptions, inferred awards, version
compatibility readers, or seed-time repair violate project constraints.

Evidence: [API document schemas](../../api/src/lib/journeySchema.ts),
[storage/backup](../../src/services/storage.ts),
[API build](../../api/package.json), [Demo seed](../../api/src/lib/cosmos.ts).

## Research Outcome

All technical decisions are resolved. Direct source tracing covered frontend
consumers; bounded delegated research covered API schema, graph, persistence,
tests, and seed/build paths. No application checks, remote operations, or browser
acceptance were executed as part of this planning research.
