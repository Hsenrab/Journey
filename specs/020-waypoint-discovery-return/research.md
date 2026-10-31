# Research: Return to Waypoint Discovery Results

**Date**: 2026-10-28  
**Scope**: [#194](https://github.com/Hsenrab/Journey/issues/194) and the
[clarified specification](spec.md). Source inspection only; no application or
browser checks were run during planning.

## 1. Keep navigation metadata in the existing provider lifetime

**Decision**: Add one purpose-specific discovery session, created once per
`WaypointsProvider`, with the planned implementation in
`src/features/journey/waypointDiscovery.ts`.
It stores criteria and opened-result IDs by router list-entry key, not records.
Expose it through the existing context; do not introduce another app provider.

**Evidence**: [`JourneyContext.tsx`](../../src/features/journey/JourneyContext.tsx)
owns selected/effective data modes but renders its children inside
`Fragment key={dataMode}`. List-local state or a session inside that fragment
cannot remember that a history entry belonged to a previous dataset.
[`Locations.tsx`](../../src/pages/Locations.tsx) currently initializes search,
Area, Category and sort locally; Challenge and award filtering come from the URL.

**Rationale**: Provider-owned memory survives route and selected-mode remounts,
but a full reload creates a fresh session. Entries are independent, so normal
navigation to a new list does not inherit a global "last filters" setting.
The provider itself remains usable without a router in existing context tests.

**Alternatives considered**: Local state cannot survive the detail round trip.
Global last-used filters conflate unrelated lists. Putting all criteria in the
URL or browser storage would extend their lifetime past the accepted refresh
boundary. Replacing browser history before each card navigation adds an
unnecessary second navigation.

## 2. Invalidate at actual dataset transitions, not record updates

**Decision**: The session tracks selected and effective mode and rotates its
scope token when either changes. Integrate with the provider's existing accepted
mode-switch and effective-mode settlement paths. Replace captured entries with
invalidated-entry markers, discarding their criteria and selection.

**Evidence**: `changeDataMode` checks pending work and `confirmNavigation`
before changing selection. `loadMode` rejects superseded responses before
applying records or changing effective mode. Demo Cosmos can settle on Demo
local; same-dataset reloads and entity mutations do not themselves change modes.

**Rationale**: A mode pair alone cannot distinguish A -> B -> A. Retaining only
old history-entry keys as invalidation markers lets browser Back distinguish
an old captured scope from a newly supplied URL scope. The former resets;
an invalid explicitly supplied Challenge/award scope still errors.

**Alternatives considered**: Clearing the entry dictionary entirely loses that
distinction. Comparing only the current mode names revives old contexts after
switching back. Invalidating on every record/ETag update defeats fresh-data
return after an Activity save. Cancelled or superseded operations must not
invalidate a session.

## 3. Use ordinary links with namespaced, one-hop origin hints

**Decision**: A plain card activation captures the current discovery snapshot
and attaches a small `waypointDiscoveryOrigin` router-state hint. Browser Back
uses the captured source list-entry key; an explicit return carries the same
hint to a new list entry. Subsequent result activation captures that new entry.

The valid-origin breadcrumb is **Back to Waypoint results**, with its source
Challenge/award query and state. Direct, refreshed, new-tab and other-origin
entry retain the normal **Waypoints** breadcrumb. Known dataset-invalidated
origins return to a bare fresh list.

**Evidence**: [`ClickableCard.tsx`](../../src/components/ClickableCard.tsx) and
[`DetailPageHeader.tsx`](../../src/components/DetailPageHeader.tsx) already
compose MUI with Router links but do not expose link state or event hooks.
[`challengeJourney.ts`](../../src/features/journey/challengeJourney.ts) already
uses a separate origin namespace and deliberately expires it on refresh.

**Rationale**: Small opt-in state/event/ref props preserve existing components
and default callers. Keep real `href` behavior; modified-click/new-tab actions
do not capture a live same-tab return. Do not copy editor mode or draft content
into discovery context.

**Alternatives considered**: A second return button duplicates the breadcrumb.
`navigate(-1)` alone cannot promise a list destination. A shared origin union
would couple unrelated Challenge, Idea and future Map work.

## 4. Restore criteria before filtering, then focus current results once

**Decision**: Classify entry restoration as current, invalidated or absent.
Restore local criteria only from a current entry. For a known invalidated entry,
start fresh and remove captured Challenge/award/editor-mode query parameters
with a replace navigation, without rendering stale scoped results first.
Absent context uses normal direct-entry URL behavior.

After loading succeeds and scope is valid, scroll/focus the matching card's
actual anchor by Waypoint ID. Otherwise focus an explicit missing/nonmatching
result explanation. Handle focus once per completed return, not on subsequent
filter edits, Clear filters, rerenders or background record changes.

**Evidence**: The list already derives membership/order from current data and
uses `awardFilterError`. Its award-sort applicability effect currently runs
without a loaded-state gate, and Area/Category options come solely from current
records. A restored selected value may disappear from those options after edits.
[`LocationDetails.tsx`](../../src/pages/LocationDetails.tsx) demonstrates
`scrollIntoView` plus `focus({ preventScroll: true })` for save feedback.

**Rationale**: Do not lose restored award sort merely because data is still
loading. Preserve the existing loaded-scope applicability rules; do not add
sort/filter semantics. Keep a removed selected Area/Category string selectable
and visibly labelled as having no current Waypoints, without restoring records.
Distinguish empty dataset, no matches, loading and specific load/scope errors.
Errors take precedence over missing-result feedback.

**Alternatives considered**: Pixel-offset restoration fails after sorting or
record changes. Timers, repeated DOM polling and overflow hiding are unnecessary.
Reusing old result objects would violate the live-data boundary.

## 5. Reuse existing draft protection at the new return action

**Decision**: The originated breadcrumb calls `confirmNavigation('Waypoint results')`
once for a plain same-tab activation and prevents navigation on refusal or
pending work. Preserve normal modified-link behavior. Do not add a global
navigation blocker or new confirmation wording.

**Evidence**: Waypoint and Activity editors register dirty work through
`useJourneyDraft`. The existing named Challenge return uses `confirmNavigation`;
`ActivityEditor` additionally blocks router navigation during saving.
Feature 018 deliberately changed Cancel protection, not all browser Back behavior.

**Rationale**: Apply the existing handled boundary to the newly contextual return.
Keep Cancel, Settings, data-mode guards and save feedback unchanged. Browser Back
restoration is validated without expanding unrelated dirty-Back guarantees.

## 6. Validate the changed frontend boundary, not the backend stack

**Decision**: Add a focused browser suite and helper/provider/page/component tests.
Select existing Challenge-return, Idea-navigation, draft and shell cases only
where shared provider/link changes affect their behavior.

**Rationale**: The changed provider is shared, so testing only the two pages is
insufficient. Nothing changes API requests, schemas, Maps endpoints, packages,
build configuration or deployment. No API/Cosmos tests or broad local CI rerun
are required for this feature.

**Alternatives considered**: Mocked browser responses do not prove hosted
authorization, real Cosmos behavior or fix independent postcode-only saves
[#174](https://github.com/Hsenrab/Journey/issues/174). Existing dependencies and
test runners suffice; no research dependency or technical unknown remains.
