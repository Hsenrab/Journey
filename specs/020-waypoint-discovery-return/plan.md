# Implementation Plan: Return to Waypoint Discovery Results

**Branch**: `020-waypoint-discovery-return` | **Date**: 2026-10-28 |
**Spec**: [spec.md](spec.md)

**Input**: [#194](https://github.com/Hsenrab/Journey/issues/194), including all
three accepted clarifications.

**Status**: Design complete; implementation and application validation not started.

**Design artifacts**: [Research](research.md), [navigation model](data-model.md),
[UI contract](contracts/ui-contract.md), [validation guide](quickstart.md).

## Summary

Preserve the originating Waypoint shortlist through list/detail return in the
same live tab. Reuse the existing provider lifetime for a small, typed,
navigation-only session keyed by list history entry. Cards capture criteria
and opened-result identity; the contextual breadcrumb and browser Back resume
that entry against current loaded records.

Refresh ends the session. Selected/effective dataset transitions invalidate old
entries permanently, including A -> B -> A. Returning focuses the current matching
card link or an absence explanation. No entity snapshots, browser storage, new
URL filters, additional provider, backend or dependency are required.

## Technical Context

**Language/Version**: TypeScript ~6.0.2, strict mode; React 19.2.

**Primary Dependencies**: React Router 7.18, MUI 9.2, existing Zod 4 validation
where applicable. No dependency changes.

**Storage**: Provider-owned ephemeral navigation metadata only. Real records
continue through the unchanged Journey API/Cosmos boundary.

**Testing**: Vitest 4.1 + Testing Library, Playwright Chromium 1.62, Oxlint and
Prettier. Use the existing data-router harness for routed editor interactions.

**Target Platform**: Existing authenticated browser application; 360 by 800
mobile and 1280 by 800 desktop, admin/viewer plus Demo local.

**Project Type**: Frontend-only behavior within the existing React application.

**Performance Goals**: No new network requests for capturing/restoring context.
Use existing filtering/sorting. Focus once when loaded results are available,
without timers or polling. Metadata grows with captured history entries, not
copies of result sets.

**Constraints**: Live-session lifetime; independent list entries; current-data
results; explicit load/scope errors; dataset invalidation; existing guards and
award/completion semantics. No record persistence, service, schema, build or
deployment changes.

**Scale/Scope**: One list/detail journey and minimal opt-in shared-link props.
No new list-size or latency guarantee is inferred from unmeasured user data.

## Constitution Check

Evaluated against constitution v1.0.2 before research and after design.

| Principle                            | Design evidence                                                                                                     | Before / After |
| ------------------------------------ | ------------------------------------------------------------------------------------------------------------------- | -------------- |
| Small, direct changes                | One feature helper, existing provider/pages/links; no generic navigation framework                                  | PASS / PASS    |
| Explicit failures                    | Preserve load/scope errors; absence and recognized invalidation are explicit navigation states, not error fallbacks | PASS / PASS    |
| Typed domain rules and consistent UI | Typed metadata/resolvers, existing filtering helpers, MUI links/alerts and shared theme                             | PASS / PASS    |
| Protected access and data integrity  | No record cache, storage/API/auth changes or navigation writes; preserve read-only modes                            | PASS / PASS    |
| Evidence-based validation            | Scoped helper/provider/page/component tests and selected browser regressions; no hosted claims                      | PASS / PASS    |

No exceptions or unresolved technical questions remain.

## Project Structure

### Documentation (this feature)

```text
specs/020-waypoint-discovery-return/
  spec.md
  plan.md
  research.md
  data-model.md
  quickstart.md
  contracts/ui-contract.md
  checklists/requirements.md
```

`tasks.md` is produced by the next workflow, not this plan.

### Source Code (repository root)

Planned new files:

- `src/features/journey/waypointDiscovery.ts` and its colocated unit tests.
- `e2e/waypoint-discovery-return.spec.ts`.

Planned updates:

- `src/features/journey/JourneyContext.tsx` and its tests: session ownership and
  accepted selected/effective dataset transitions.
- `src/pages/Locations.tsx` and its tests: capture/restore, current-data feedback,
  selected-value options, loaded applicability and one-shot focus.
- `src/pages/LocationDetails.tsx` and its tests: resolve list origin and contextual
  breadcrumb, including deleted-record detail.
- `src/components/ClickableCard.tsx` and its tests: optional router state,
  activation handler and anchor ref.
- `src/components/DetailPageHeader.tsx` and its tests: optional breadcrumb state
  and activation handler.
- `docs/pages/locations.md`: return lifetime, focus, dataset reset and updated
  list/direct-entry wording.

**Structure Decision**: Keep navigation rules in the existing Journey feature
and presentation in the existing pages/components. No App routing, Layout,
editors, storage, domain schema, API or infrastructure change is planned.

## Implementation Approach

1. **Session and invalidation**: Implement the typed navigation session described
   in [data-model.md](data-model.md). Own it above the provider's keyed children.
   Invalidate only after a requested mode switch is accepted and when an effective
   dataset changes after the existing superseded-load check. Cancelled switches,
   pending-write rejection, same-dataset reloads and record edits retain context.
2. **Link integration**: Add only optional link props. On an unmodified card
   activation, reuse `confirmNavigation` if navigation must discard registered
   work, then capture criteria for the source entry and attach the origin hint.
   Declined/default-prevented/modified activations must not capture a journey.
   Keep ordinary real-link and keyboard behavior for every existing caller.
3. **List restoration**: Prefer a captured current history entry or a valid
   explicit-return hint. Known invalidated entries reset every criterion and
   replace captured scope/editor query with a bare list; absent context uses
   normal URL behavior. Exclude editor mode/drafts from snapshots. Preserve
   `awardFilterError`, filtering, ordering, active counts and Clear filters.
   Distinguish a genuinely new list entry from the mounted list's own URL
   navigations, including award-filter REPLACE and Add/Cancel PUSH operations.
   Preserve captured-origin dataset provenance across changed entry keys and
   preserve existing history behavior. Those operations must not reset other
   local controls or trigger another return-focus operation.
   Do not normalize restored award sort during loading; use existing loaded-scope
   applicability rules. Retain removed selected Area/Category values as labelled
   criteria, not record copies.
4. **Detail return**: Reuse the breadcrumb for **Back to Waypoint results**.
   Resolve origin independently of current record membership/existence so a
   deleted Waypoint still offers the contextual return. Use the existing
   `confirmNavigation` boundary exactly once; pending work blocks it. Do not
   overwrite Challenge-origin state or add a new global Back/draft guard.
5. **Current-data focus and states**: When loaded scope is valid, focus the
   matching anchor by ID, even after reordering, or a specific absence message.
   Do not steal focus on later filter/record changes. Distinguish empty dataset
   from no matches; load/scope errors outrank absence feedback. Preserve the
   existing read-only notice and save-confirmation focus.
6. **Documentation and checks**: Update the guide alongside behavior and tests.
   Follow the [UI contract](contracts/ui-contract.md) and
   [validation guide](quickstart.md). Do not fix independent defects or add
   tests/infrastructure for unrelated services.

## Requirement and Validation Coverage

| Requirements / outcomes        | Design and validation boundary                                                           |
| ------------------------------ | ---------------------------------------------------------------------------------------- |
| FR-001, FR-002, FR-003; SC-001 | Per-entry capture, breadcrumb state, browser Back and live-only session tests            |
| FR-004, FR-005; SC-002         | Current-record identity, moved/missing results and actual anchor/message focus           |
| FR-006; SC-003                 | Selected/effective transitions, invalidated entry markers, A -> B -> A and refresh tests |
| FR-007, FR-008; SC-003         | Clear/count/sort checks; selected options; invalid scopes and distinct load/empty states |
| FR-009, FR-010; SC-005         | Other-origin isolation, zero writes, existing guards and current save feedback           |
| FR-011; SC-004                 | Both viewport sizes, admin/viewer, keyboard/overflow and desktop primary-content checks  |
| FR-012; SC-005                 | No new storage/schema/service/filter semantics; targeted award/completion regressions    |

The shared provider and link components require their own tests plus selected
existing consumer journeys, not just tests of edited pages. Frontend lint,
typecheck and affected tests run once after implementation. The browser runner
already builds test-mode output; a separate production build is needed only if
implementation expands into build/configuration changes. No local API/Cosmos
suite, full local CI or deployment is part of this frontend feature.
