# Research: Complete the Challenge Activity Journey

**Date**: 2026-10-26

**Inputs**: [clarified specification](./spec.md), current application code, and
[constitution](../../.specify/memory/constitution.md).

All technical decisions are resolved from repository evidence. No new dependency,
platform, service integration, or unresolved product decision requires external
research. This document records decisions, not completed implementation.

## 1. Preserve the delivered awards baseline

**Decision**: Treat feature 017's award rules, labels, exact statistics, and
maintenance protections as existing behavior. Preserve them through regression
tests; do not reopen schemas or add an alternative "No award yet" label.

**Rationale**: [Feature 017](../017-challenge-award-levels/spec.md) is merged.
[Waypoint details](../../src/pages/LocationDetails.tsx) already separate
completion from highest awards; [Dashboard](../../src/pages/Dashboard.tsx) already
shows completion in Recently visited. Feature 016's clarified spec explicitly
preserves that work.

**Alternatives considered**: Reimplementing the original award findings would
duplicate completed work and risk reverting agreed semantics. Removing all
award acceptance would lose necessary regression coverage during layout changes.

## 2. Use explicit, transient Router provenance

**Decision**: Add a small `challengeJourney` helper in the existing Journey feature.
Challenge member links and the next-member link supply typed Router state with
origin IDs, selected/active data modes, and a document-lifetime marker. Resolve
it against the current loaded dataset and route before displaying a return.

**Rationale**: [ChallengeDetails](../../src/pages/ChallengeDetails.tsx) already
uses Router links directly, and [IdeaDetails](../../src/pages/IdeaDetails.tsx)
demonstrates treating Router state as unknown. No shared link component or new
provider is needed. IDs identify provenance; current data supplies titles and
membership validity. History state can survive a browser reload, so an in-memory
document marker prevents accidentally treating old state as a fresh visit.

Selected `dataMode` and actual `activeDataMode` are both available from
[JourneyContext](../../src/features/journey/JourneyContext.tsx). Both matter:
Demo Cosmos can load the explicitly warned Demo local dataset. Matching only a
record ID or selected mode could incorrectly reuse context across those datasets.

**Alternatives considered**:

- A membership-derived or "first Challenge" return invents an origin for shared
  or directly opened Waypoints.
- A query-string origin adds a durable URL contract and implies reload/deep-link
  support the specification does not require.
- Browser Back does not name or reliably identify the intended destination.
- A global navigation store, persisted context, or new Context provider is
  unnecessary for this one visit-scoped relationship.
- Router state without a runtime marker can retain a prior document's origin
  after reload; the marker is a local lifecycle check, not an authorization token.

## 3. Generalize the existing dirty/pending guard

**Decision**: Replace `confirmSettingsNavigation()` with destination-aware
`confirmNavigation(destination)`, retaining one provider draft registry and
mutation counter. Update its existing consumers and use it on the new returns.
Check pending state before the empty-registry shortcut.

**Rationale**: [JourneyContext](../../src/features/journey/JourneyContext.tsx)
already registers drafts and tracks mutations. [Layout](../../src/components/Layout.tsx)
currently intercepts only the Settings destination, while the Activity editor's
Router blocker covers pending saving, not all dirty-link navigation. New return
links do not automatically inherit the necessary dirty confirmation.

The guard must synchronously block a pending mutation even before a disabled
button rerenders or after the initiating form unmounts. Target-aware copy avoids
asking about Settings when the user selected a Challenge or Dashboard.

**Alternatives considered**: A second dirty registry or editor-to-page dirty
callback duplicates existing infrastructure. Passing new actions through the
Settings-named API retains misleading copy. Adding a global navigation redesign
exceeds the scope; only the existing consumers and newly introduced actions change.

## 4. Share completion derivation, not saved progress

**Decision**: Extract Dashboard's completed count, total, and
`Math.round(completed / total * 100)` calculation into a domain summary using
existing once/count helpers. Select the first incomplete member from the current
`challengeWaypoints` result without sorting.

**Rationale**: [Domain completion](../../src/domain/visit.ts) already counts
currently linked Activities and uses `count >= target`. Dashboard explicitly
returns 0% for zero members. Challenge details currently put route content before
members and lack the required top-level completion explanation and next step.
Provider writes already adopt their committed dataset before returning success.

**Alternatives considered**: A saved progress field, optimistic increment, or
progress refetch introduces drift, extra requests, or a new data contract.
Ranking members by award, visit date, location, or completion fraction changes
the agreed existing-order recommendation.

## 5. Revalidate previously reported fields with one validator

**Decision**: Extract the existing synchronous field rules from
[ActivityEditor](../../src/components/ActivityEditor.tsx) into
`domain/activityDraftValidation.ts`. Reuse its result for submission and
reported-field/group correction. Track which fields/groups have been reported
even after their visible error clears.
Define the validator's raw-form input in the domain helper; do not import the
provider's normalized `ActivityDraft` or component-local types into `domain/`.

**Rationale**: The current `validate()` function centralizes title, UK date,
location, award, acknowledgment, reference, and photo checks, but is mainly called
on submit. Its current submit-focus ref can remain specific to submission.
Reusing one pure validator preserves exact messages and avoids putting new
business rules into event handlers.

Dependent groups need deliberate treatment: postcode/coordinate mode changes,
coordinate pairs, award eligibility/removal, and indexed reference/photo errors.
Collection reordering must not attach a previous row's error to a different row.
Unrelated field errors, independent GPX parsing errors, and page-level
save/conflict failures must not be cleared by a correction.

**Alternatives considered**: Clearing an error on any keystroke can mark invalid
data as valid. Validating every untouched field immediately broadens the
interaction contract. Duplicating individual rules in blur handlers risks
disagreement with submission. A form-library migration is unnecessary.

## 6. Keep focus local to intentional transitions

**Decision**: Add an explicit Waypoint-only opt-in for first-required-field
focus. After a successful Waypoint save, reveal and focus a programmatically
focusable confirmation container; do not automatically navigate or focus its
return button.

**Rationale**: [LocationDetails](../../src/pages/LocationDetails.tsx) owns the
inline editor and already closes it in `onSaved`. The shared editor exposes
`onSaved(draft)`, and `addActivity()` returns the committed ID. These existing
boundaries support accurate confirmation without changing Activities or
Idea-origin destinations.

Existing evidence sections already collapse when empty and expand for existing
content. Save is already inside the form before Waypoint history. Measure the
specified one-viewport reach before changing layout rather than assume a sticky
bar is needed.

**Alternatives considered**: Always focusing every Activity editor changes
unrelated entry flows. Auto-redirecting to the Challenge contradicts the
clarification. Arbitrary timers or polling for focus are unnecessary; use
mounted-element refs and transition effects.

## 7. Preserve loading, failure, and reader boundaries

**Decision**: Resolve origin and display current progress only from successfully
loaded data. Keep loading, missing record, failed load, and empty membership
distinct. Retain the visibly warned Demo Cosmos -> Demo local exception and
render `ReadOnlyNotice` wherever write controls are hidden.

**Rationale**: Provider state distinguishes selected/active modes and explicit
load states. Some current page branches can retain a previous entity while a
reload fails; new progress must not describe that retained snapshot as current.
Viewer navigation does not need mutation permission, and provenance grants no
permission to write.

**Alternatives considered**: Showing zero counts for loading/failure makes an
error look like an empty Challenge. Preserving a stale success or assuming
Production has Demo recovery violates the existing data boundary.

## 8. Validate the required outcome, not a layout proxy

**Decision**: Use direct domain/component tests plus isolated Playwright journeys
at the exact two viewport sizes. Assert actual focus, request counts, scope,
current counts, no overflow, and measured scroll to Save.

**Rationale**: Existing [award acceptance](../../e2e/challenge-awards.spec.ts)
already supplies fictional data, protected API mocks, role checks, and request
count assertions. The existing WSL Node/npm setup is usable without installing
another runtime.

**Alternatives considered**: Source-only review, a screenshot without assertions,
or testing CSS values cannot establish navigation correctness, keyboard focus,
or the one-viewport requirement. Hosted authorization and real Azure rendering
are not established by isolated browser fixtures.
