# Tasks: Return to Waypoint Discovery Results

**Branch**: `020-waypoint-discovery-return`  
**Input**: [Specification](spec.md), [plan](plan.md), [research](research.md),
[navigation model](data-model.md), [UI contract](contracts/ui-contract.md) and
[validation guide](quickstart.md).  
**Scope**: [#194](https://github.com/Hsenrab/Journey/issues/194).

**Tests**: Required by the specification's acceptance scenarios and SC-005
regression checks. Write the relevant assertions before behavior changes.
Use targeted tests during implementation only when they provide feedback;
run formatting and the selected final checks once after implementation.
Record collection/startup failures separately from assertion-level failures.

**Organization**: Setup, shared foundation, then US1 (P1), US2 (P2) and US3 (P2).
The stories build on one list/detail journey and share files; complete their
increments in that order rather than pretending they can be implemented
independently in parallel.

## Format and Path Conventions

- Every task uses `- [ ] Tnnn [P?] [USn?] Description with exact file paths`.
- `[P]` identifies a task with a safe parallel partner once its listed
  prerequisites are complete. It does not waive dependencies or permit
  concurrent edits to the same file.
- Paths are repository-relative. Tests stay alongside their source; browser
  cases belong in the existing `e2e/` directory.
- Use the existing stack, dependencies and test infrastructure. No application
  scaffolding, API, schema, persistence, infrastructure or migration work is needed.

## Phase 1: Setup

**Purpose**: Establish fictional fixtures and a routed harness without new tooling.

- [x] T001 Prepare a routed list/detail harness in `src/pages/Locations.test.tsx` using `src/test/DataMemoryRouter.tsx`, and the local fixture/interception scaffold in `e2e/waypoint-discovery-return.spec.ts`. Use schema-valid coordinate-based records, duplicate titles, long labels, ordinary/award-enabled Challenges, once/count completion, enough matching cards to open one below the first screen, controlled dataset updates and write counters. Keep fixtures inside these test files and name the browser describe group `Waypoint discovery return`.

**Checkpoint**: Existing runners and isolated fixtures are ready; no dependencies
or production records have been changed.

## Phase 2: Foundational Navigation and Link Contracts

**Purpose**: Supply the shared session and opt-in link integration before story work.

### Tests first

- [x] T002 [P] Add session contract tests in `src/features/journey/waypointDiscovery.test.ts`: exact criteria capture by list-entry key, independent entries, namespaced origin/route-ID validation, current/invalidated/absent classification, malformed feature-owned metadata errors, refresh/provider replacement, selected/effective scope changes and A -> B -> A. Assert invalidation drops criteria and selected identity while retaining only recognized entry markers; no entity snapshots or browser storage.
- [x] T003 [P] Add lifecycle integration tests in `src/features/journey/JourneyContext.test.tsx`: one session above keyed children, accepted mode switches and effective fallback/recovery invalidate, while declined switches, pending-write rejection, superseded responses, same-mode reloads and record edits do not independently invalidate valid context. Preserve provider tests that run without a router and verify an isolated session per provider.
- [x] T004 [P] Add optional-link contract tests in `src/components/ClickableCard.test.tsx` and `src/components/DetailPageHeader.test.tsx`: router state/event forwarding, prevented activation, actual anchor refs, keyboard access, real hrefs and unchanged default callers. Keep the existing MUI/Router composition rather than replacing links with buttons.

### Implementation

- [x] T005 [P] Implement the typed provider-owned session factory and origin/classification helpers in `src/features/journey/waypointDiscovery.ts`, satisfying T002 without a module-global registry or record cache. Use these verbatim criterion constraints from `specs/020-waypoint-discovery-return/data-model.md`:
  - `query`: "Exact search text, preserving current matching semantics".
  - `area`: "Selected existing Area string or the existing `all` sentinel".
  - `category`: "Selected existing Category string or `all`".
  - `sort`: "Existing `name`, `status` or `lastActivity` sort key".
  - `status`: "Existing highest-award query value; validated by existing scope rules".
  - `challengeId`: "Optional originating Challenge ID".
  - Store only criteria, opened ID and scope token for current entries; invalidated entries retain only entry keys/markers. Resolve foreign/absent context as its explicit expected state, reject malformed own payloads with specific errors, and leave the separate `challengeOrigin` namespace untouched.
- [x] T006 [P] Wire session ownership and transitions in `src/features/journey/JourneyContext.tsx`: create it once before `Fragment key={dataMode}`, expose the typed session through the existing context, invalidate after selected-mode guards accept and after effective-mode settlement passes the superseded-load check, and retain all current load/role/write/guard behavior. Do not add a router dependency, another provider or invalidate on record/ETag changes.
- [x] T007 [P] Add minimal optional state/activation/anchor-ref props in `src/components/ClickableCard.tsx` and optional breadcrumb state/activation props in `src/components/DetailPageHeader.tsx`, satisfying T004 with proper React/Router types. Keep all existing defaults, focus styling and ordinary modified-link behavior unchanged.

**Checkpoint**: Session and link contracts are usable without modifying other
origins, storage or domain rules. US1 may now use this foundation.

## Phase 3: US1 - Resume the Same Shortlist (Priority: P1, MVP)

**Goal**: Preserve all current discovery criteria through explicit return and
browser Back, with no criteria re-entry.

**Independent test**: Apply search, Area, Category, sort, applicable highest-award
filtering and Challenge scope; open a result and return through each mechanism.
Compare every control, scope, ordered result ID and active secondary-filter count.
Clear filters and repeat with another result without leaking another list's state.

### Tests first

- [x] T008 [P] [US1] Add US1 routed page tests in `src/pages/Locations.test.tsx` and `src/pages/LocationDetails.test.tsx` for capture/current-entry restoration, both return mechanisms, the `Back to Waypoint results` breadcrumb and source query/state, repeated result visits, independent list entries, no extra history step and zero writes. Cover exact search text, punctuation/non-ASCII criteria, Clear preserving Challenge/sort, and award-filter REPLACE and Add/Cancel PUSH navigations retaining other controls, provenance and existing history behavior.
- [x] T009 [P] [US1] Add US1 browser cases in `e2e/waypoint-discovery-return.spec.ts` for unchanged-data round trips via the contextual breadcrumb and actual browser Back, at 360 by 800 and 1280 by 800. Exercise ordinary and award-enabled scope, complete criteria/order/count restoration, Clear behavior and successive result visits; assert no criteria re-entry or navigation writes.

### Implementation

- [x] T010 [P] [US1] Implement US1 list capture/restoration in `src/pages/Locations.tsx`: after a permitted plain same-tab result activation capture current criteria/entry key/ID and attach the origin hint; restore current entries or explicit-return hints before filtering. Keep Challenge/status in their existing URL format, exclude editor/draft content, preserve the current predicates/order/count/Clear semantics, and distinguish own-list PUSH/REPLACE query navigations from a genuinely new list entry. Carry captured-origin dataset provenance across changed entry keys without repeating return focus or changing existing history behavior. Do not capture declined, prevented or modified activations or create a history entry merely to capture context.
- [x] T011 [P] [US1] Implement the current-origin breadcrumb in `src/pages/LocationDetails.tsx` using the existing shared header and session resolver: label it `Back to Waypoint results`, carry source Challenge/award query and state, and reuse `confirmNavigation('Waypoint results')` once for a plain activation. Keep direct/other-origin defaults and existing Challenge state independent; do not add a second return button or global navigation blocker.

**Checkpoint**: US1 is a testable comparison-flow MVP. This is not authorization
to release an incomplete feature; continue with fresh-data focus and boundary cases.

## Phase 4: US2 - Resume in the Right Place with Current Data (Priority: P2)

**Goal**: Restore focus by current record identity and handle changed, missing,
invalid or cross-dataset context explicitly.

**Independent test**: Open a result below the first screen, change its order or
membership and return. Verify the current matching anchor or absence explanation
receives focus. Repeat after deletion, failed loading, invalid scope, dataset
switching away and back, fallback/recovery and refresh.

### Tests first

- [x] T012 [P] [US2] Add US2 page regressions in `src/pages/Locations.test.tsx` and `src/pages/LocationDetails.test.tsx`: matching/moved/duplicate-title anchor focus, both absence messages, selected Area/Category options that disappeared, Activity-driven completion/award/order updates, no refocus after control or record changes, and errors/loading preceding absence feedback. Cover known-invalidated entry reset versus uncaptured explicit invalid scope, deleted-detail return, refresh and selected/effective A -> B -> A; keep award sort through loading and preserve existing loaded applicability rules.
- [x] T013 [P] [US2] Extend `e2e/waypoint-discovery-return.spec.ts` with US2 cases for ID-correct visible return focus after reordering, changed/nonmatching/deleted records, missing selected options, and distinct loading/load-failure/invalid-scope/empty/no-match states. Exercise breadcrumb and old-history returns after selected/effective dataset changes, A -> B -> A and Demo fallback/recovery; refresh list and detail to prove context expires while existing explicit URL scope retains normal semantics. Use valid intercepted record updates, not stale snapshots or real services.

For T012 and T013, include return -> award-filter REPLACE or Add/Cancel PUSH ->
Settings -> dataset change -> browser Back, also switching away and back.
Assert a bare unscoped list, empty search/filters, Name sort and no stale selected
focus. Direct invalid scopes must still produce their existing errors.

### Implementation

- [x] T014 [P] [US2] Complete US2 list behavior in `src/pages/Locations.tsx`: reset recognized invalidated entries to empty search/no filters/no Challenge/Name sort/no selection and replace captured query/editor mode without rendering stale results; leave unrelated direct invalid scopes as errors. After successful valid loading, scroll/focus the actual matching anchor by ID once, or focus exactly `The Waypoint you opened no longer matches these filters.` / `The Waypoint you opened is no longer available.` Retain removed Area/Category strings as selectable `(no current waypoints)` criteria; distinguish empty data from no matches, gate award applicability until loaded, and clear return-only feedback without stealing focus after later interaction.
- [x] T015 [P] [US2] Complete US2 detail-origin resolution in `src/pages/LocationDetails.tsx`: allow a current captured list return even when the record was deleted or left the Challenge, but send a recognized dataset-invalidated origin to a bare fresh list. Preserve specific load/missing states, refresh/direct-entry defaults and current Activity-save confirmation focus; never infer a Challenge or list origin from record membership.

**Checkpoint**: US1 and US2 work against current data; no dataset reversal or
refresh resurrects a captured shortlist or stale selected record.

## Phase 5: US3 - Browse Without Editing or an Invented Origin (Priority: P2)

**Goal**: Prove read-only, other-origin, accessibility and draft boundaries for
the completed comparison journey.

**Independent test**: Complete both return mechanisms as admin/viewer on both
viewport sizes, plus Demo local. Exercise direct/Idea/Challenge origins, modified
activation/new tabs, dirty Waypoint and Activity returns, pending work and declined
mode changes without new edit actions, double confirmation or lost input.

- [x] T016 [P] [US3] Add US3 contract/regression tests in `src/pages/Locations.test.tsx` and `src/pages/LocationDetails.test.tsx` for viewer/Demo local notices and Settings link, zero writes/no new write actions, direct/Idea/Challenge/Map-shaped state isolation, refresh and modified activations. Assert a dirty Waypoint or Activity return asks the existing destination-aware question once, decline preserves route/input/errors, acceptance returns, and pending work blocks navigation without prematurely invalidating context.
- [x] T017 [P] [US3] Complete the US3 matrix in `e2e/waypoint-discovery-return.spec.ts`: admin/viewer x 360/1280 for breadcrumb and browser Back, Demo local browsing, direct/other origins, new-tab isolation, real Tab/Enter activation, visible focus, dirty accept/decline and pending/cancelled transitions. Add long-label overflow, initial desktop primary-content and below-first-screen focus assertions plus focused-return screenshots at both sizes; do not claim programmatic dialog replies prove native keyboard behavior.
- [x] T018 [US3] Complete the source-level UI self-review and any needed small integration/layout fixes in `src/pages/Locations.tsx` and `src/pages/LocationDetails.tsx` against `docs/UI_GUIDELINES.md`, updating corresponding assertions/screenshots in `e2e/waypoint-discovery-return.spec.ts` if necessary. Preserve shared theme spacing, wrapping, read-only gates and existing guards without changing editors, Layout or other-origin flows. Actual browser measurements and screenshot review belong to T020; do not hide overflow, shorten fixtures or broaden native-dialog behavior.

**Checkpoint**: All story behavior and acceptance assertions are implemented.
Final validation still must execute and inspect the actual browser evidence.

## Phase 6: Documentation and Final Validation

- [x] T019 Update `docs/pages/locations.md` with live-only shortlist return, contextual breadcrumb, current-record focus/absence feedback, dataset reset and direct/other-origin boundaries; reconcile its existing list/direct-entry and future-filter wording with the new behavior. Keep unrelated future saved-search proposals out of this feature, and maintain the execution instructions in `specs/020-waypoint-discovery-return/quickstart.md` if actual selectors or impacted surfaces changed.
- [x] T020 Execute the scoped final validation in `specs/020-waypoint-discovery-return/quickstart.md` after implementation: format only changed files; check diagnostics; run frontend lint/typecheck and the selected helper/provider/page/component and browser tests once; inspect actual focused-return screenshots and measured `scrollWidth <= clientWidth`/desktop-content/focus results. Record commands, counts, UI review, warnings and exact blockers in that guide. Revisit the impact trace if implementation expanded; rerun successful checks only when covered files changed. No unrelated API/Cosmos/full local CI, separate production build absent build/config changes, hosted claims, commit, push or deployment without a separate request.

## Dependencies and Execution Order

The prerequisites below are completion requirements, not implied by ID order.
All dependencies point backward; tasks in the same file remain serialized.

| Task | Prerequisites |
| ---- | ------------- |
| T001 | None          |
| T002 | T001          |
| T003 | T001          |
| T004 | T001          |
| T005 | T002          |
| T006 | T003, T005    |
| T007 | T004          |
| T008 | T006, T007    |
| T009 | T006, T007    |
| T010 | T008, T009    |
| T011 | T008, T009    |
| T012 | T010, T011    |
| T013 | T010, T011    |
| T014 | T012, T013    |
| T015 | T012, T013    |
| T016 | T014, T015    |
| T017 | T014, T015    |
| T018 | T016, T017    |
| T019 | T018          |
| T020 | T019          |

### Story completion graph

```text
Setup T001
  -> Foundation T002-T007
  -> US1 T008-T011 (comparison-flow MVP)
  -> US2 T012-T015 (current data, focus and invalidation)
  -> US3 T016-T018 (access, origin and UI acceptance)
  -> Documentation T019
  -> Final validation T020
```

Stories are independently demonstrable/testable increments, not independent
same-file implementation branches. The final feature requires all three.

## Parallel Execution Examples

| Stage                     | Safe parallel tasks                                                     | Why                                                    |
| ------------------------- | ----------------------------------------------------------------------- | ------------------------------------------------------ |
| Foundation test authoring | T002 + T003 + T004 after T001                                           | Helper, provider and component test files differ       |
| Foundation implementation | T005 + T007 after their tests; T006 may overlap T007 once T005 finishes | Helper/provider source differs from shared-link source |
| US1 test authoring        | T008 + T009                                                             | Page tests versus browser suite                        |
| US1 implementation        | T010 + T011 after both test tasks                                       | List versus detail source                              |
| US2 test authoring        | T012 + T013                                                             | Page tests versus browser suite                        |
| US2 implementation        | T014 + T015 after both test tasks                                       | List versus detail source                              |
| US3 test authoring        | T016 + T017                                                             | Page tests versus browser suite                        |

Do not overlap T008/T012/T016 or T009/T013/T017/T018: those tasks
reuse files across increments. T018 owns both page sources and the browser suite;
T019/T020 serialize documentation/evidence changes. Parallel authoring does not
require background agents or concurrent test runners.

## Requirement and Outcome Coverage

| Requirement | Implementing / proving tasks               |
| ----------- | ------------------------------------------ |
| FR-001      | T002, T005, T008-T011, T012-T015           |
| FR-002      | T004, T007-T011                            |
| FR-003      | T008-T010, T012-T014, T017                 |
| FR-004      | T004, T007, T012-T014, T017-T018           |
| FR-005      | T012-T015                                  |
| FR-006      | T002-T003, T005-T006, T012-T015            |
| FR-007      | T008-T010, T012, T014                      |
| FR-008      | T008, T012-T015                            |
| FR-009      | T002, T005, T011, T015-T017                |
| FR-010      | T003-T004, T006-T007, T010-T011, T016-T020 |
| FR-011      | T009, T013, T017-T018, T020                |
| FR-012      | T001-T007, T010-T011, T014-T015, T019-T020 |
| SC-001      | T008-T011, T020                            |
| SC-002      | T012-T015, T017, T020                      |
| SC-003      | T002-T003, T012-T015, T020                 |
| SC-004      | T016-T018, T020                            |
| SC-005      | T003-T004, T008-T009, T016-T020            |

## Implementation Strategy

1. Establish fixtures and the minimal shared session/link contracts, writing their
   assertions first. Keep metadata out of persisted entities and all failures explicit.
2. Deliver US1 as the MVP comparison flow, with both return mechanisms testable.
   Use focused feedback rather than repeatedly running broad checks.
3. Add US2 and then US3, extending existing tests and source rather than creating
   alternative navigation systems or duplicate fixture modules.
4. Update the user guide and run T020 once the implementation is complete. Any
   failed check is a failure, not a reason to weaken assertions or hide state.
5. Mark tasks complete only after their work is implemented and appropriately
   verified. Publishing and deployment remain separate user-requested actions.
