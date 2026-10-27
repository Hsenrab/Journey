---
description: 'Implementation tasks for the Challenge Activity Journey'
---

# Tasks: Complete the Challenge Activity Journey

**Input**: [specification](./spec.md), [plan](./plan.md),
[research](./research.md), [data model](./data-model.md),
[UI contract](./contracts/challenge-journey-ui.md), and
[validation guide](./quickstart.md).

**Working branch**: `chore/ux-agent-and-journey-spec`

**Scope**: Frontend-only feature 016. No new dependencies, routes, backend
endpoints, persisted fields, migrations, or Azure changes. Feature 017 awards
are delivered behavior to preserve, not redesign.

**Tests**: Included to prove the specification's acceptance scenarios and
SC-001 through SC-008, including the eight-case role/viewport/progress matrix.
Write story tests before the corresponding behavior; targeted unit/component
runs during implementation are appropriate when useful. Do not run broad
checks or the end-to-end suite repeatedly during implementation. Run selected
final checks once at T039; never mark acceptance complete from test code alone.

## Format and Path Conventions

- Every task uses `- [ ] T### [P?] [US#?] Description`.
- `[P]` identifies disjoint-file work that can run concurrently once its
  prerequisites are complete; it does not authorize automatic delegation.
- Story labels map to the numbered stories in the specification.
- Source paths are repository-relative. Tests are colocated with source except
  browser acceptance in `e2e/`.
- Leave every task unchecked until its implementation and applicable evidence
  are complete. Generating this file does not complete implementation tasks.

## Phase 1: Setup

**Goal**: Prepare isolated fictional data and browser setup without new tooling.

- [x] T001 Extend the existing fictional builders in `src/test/demoData.ts` with zero/partial/complete/empty Challenges, shared and ordinary/award-enabled members, once/count targets including one and three, exact/above-target counts, and long content; keep existing fixtures valid and do not create another bundled Demo dataset.
- [x] T002 Create the isolated fixture setup in `e2e/challenge-activity-journey.spec.ts` using T001 and the existing `e2e/challenge-awards.spec.ts` pattern: fixed date, identity/Journey mocks, mutable committed data, read/write counters, explicit Maps mock, admin/viewer roles, and selected-versus-active mode scenarios with matching IDs across datasets; add no authentication bypass or production storage path.

## Phase 2: Foundational Navigation Guard

**Goal**: Reuse one existing dirty registry and pending-mutation counter.

**Gate**: Complete this phase before integrating story navigation. No second
registry, compatibility wrapper, or generic navigation framework.

- [x] T003 [P] Add destination-aware confirmation tests in `src/features/journey/JourneyContext.test.tsx` for clean navigation, dirty accept/decline, existing data-mode outcomes, and synchronous pending blocking even when the draft registry is empty; preserve explicit errors and draft contents.
- [x] T004 [P] Add guard-consumer tests in `src/components/Layout.test.tsx` for existing Settings navigation, keyboard activation, modified/new-tab link behavior, and one confirmation rather than duplicate prompts.
- [x] T005 Replace `confirmSettingsNavigation()` with `confirmNavigation(destination)` in `src/features/journey/JourneyContext.tsx` and update `src/components/Layout.tsx` plus the provider's data-mode consumer; check pending mutations before the empty-registry shortcut, retain existing draft registration and discard outcomes, and remove the obsolete API.

## Phase 3: User Story 1 - Return to the Challenge I Started From (P1, MVP)

**Goal**: Preserve a truthful, named return through Waypoint browsing, recording,
and successful confirmation, followed by a direct Dashboard return.

**Independent test**: Dashboard -> Challenge A -> shared Waypoint -> record ->
focused confirmation -> Challenge A -> Dashboard. Repeat browsing as viewer,
test direct/list/reloaded entry, and decline/accept a dirty return. No browser
Back, automatic redirect, invented origin, or falsely successful save.

### Tests

- [x] T006 [P] [US1] Add origin-contract tests in `src/features/journey/challengeJourney.test.ts`: `challengeId`, `waypointId`, and `documentId` are `string`; `dataMode` and `activeDataMode` are `JourneyDataMode` with values `demo-local`, `demo-cosmos`, and `production`; reject malformed state, wrong document/route/mode, unloaded/failed data, missing records, and removed original membership; cover shared membership and current-title resolution.
- [x] T007 [P] [US1] Add Waypoint and cross-route tests in `src/pages/LocationDetails.test.tsx` and `src/app/App.test.tsx` for named returns in browsing/editor/confirmation, reader parity, dirty accept/decline and pending blocking, success-only confirmation focus without redirect, and retained explicit failures/drafts; cover saved unlinked/outside/same-Challenge destinations and later loaded deletion/reassignment.
- [x] T008 [P] [US1] Add tests in `src/pages/ChallengeDetails.test.tsx` for explicit member-link origin state and the page-level `Back to Dashboard` action targeting `/challenges`, including dirty route/award drafts, pending mutations, and reader navigation.
- [x] T009 [P] [US1] Add existing-destination regression assertions in `src/pages/Activities.test.tsx`, `src/pages/ActivityDetails.test.tsx`, and `src/pages/IdeaDetails.test.tsx`: ordinary creation remains on Activities, eligible Idea-origin saves return to that Idea, and Activity details/editing retain their navigation without Challenge origin propagation.
- [x] T010 [P] [US1] Add navigation acceptance in `e2e/challenge-activity-journey.spec.ts` for both one-action return legs at 360x800 and 1280x800, explicit shared origins, direct/list/reloaded entry, viewer browsing, original returns after draft reassignment/unlinking, and pending/failed/cancelled saves; assert actual confirmation focus/visibility only after success and no automatic navigation.

### Implementation

- [x] T011 [US1] Implement the small typed origin creator/resolver in `src/features/journey/challengeJourney.ts` using the exact T006 fields and mode values; accept Router `challengeOrigin` state as unknown, create one in-memory marker per document, validate current loaded scope/route/existence/membership, and use current titles; do not persist context, infer membership origin, create a provider, or forward it into Activity details.
- [x] T012 [US1] Wire member Router links and visible page-level `Back to Dashboard` in `src/pages/ChallengeDetails.tsx` through T011 and the shared T005 guard; preserve existing member order, route/award draft protection, ordinary link semantics, and explicit loading/missing/failure states.
- [x] T013 [US1] Wire the valid named origin return and dedicated Activity-save confirmation in `src/pages/LocationDetails.tsx`; use the committed `addActivity` ID and current loaded Activity destination to explain contribution, preserve the original return for unlinked/outside destinations, reveal/focus the confirmation container once after success, and never redirect or focus its button automatically; gate current progress/origin on loaded data and keep read-only notices and ordinary Waypoints navigation.

**Checkpoint**: US1 can be demonstrated with existing progress rendering. New
summary/next-member behavior and recording-entry focus remain later increments.

## Phase 4: User Story 2 - Understand the Result and What Remains (P1)

**Goal**: Explain completed-Waypoint percentage and the next incomplete member
using current loaded data and unchanged completion arithmetic.

**Independent test**: Compare Dashboard and Challenge details for zero, partial,
complete, and empty Challenges. A first Activity against a three-count member
shows 1 of 3 while a two-member Challenge remains 0/2 and 0%; crossing 2/3 to
3/3 with the other member complete changes 1/2 and 50% to 2/2 and 100%.

### Tests

- [x] T014 [P] [US2] Add shared-summary tests in `src/domain/visit.test.ts` for once-only, count target one, partial/exact/above-target counts, zero/empty membership, shared members, and rounded percentages such as 1/3 = 33%; assert actual Activity counts are not capped and awards/Ideas/direct Challenge links do not independently complete members.
- [x] T015 [P] [US2] Add component assertions in `src/pages/ChallengeDetails.test.tsx` and `src/pages/Dashboard.test.tsx` for matching completed/total/percentage, the completed-Waypoint explanation, the first-in-existing-order incomplete action and member progress preceding optional map/route administration, no next action for complete/empty data, and distinct loading/missing/failed states without current-looking stale counts.
- [x] T016 [P] [US2] Add progress acceptance in `e2e/challenge-activity-journey.spec.ts` at both target viewports for the exact partial-increment and threshold-crossing examples, once/count-one/exact/above-target/empty cases, current loaded deletion/reassignment, and next-member origin; assert no manual reload, saved progress field, or extra progress-specific Journey read.

### Implementation

- [x] T017 [US2] Extract the shared completion summary alongside existing helpers in `src/domain/visit.ts`: `completed = completedWaypointCount(members, activities)`, `total = members.length`, and `percentage = total === 0 ? 0 : Math.round((completed / total) * 100)`; preserve existing once/count and membership rules without schema changes.
- [x] T018 [US2] Use T017 in `src/pages/Dashboard.tsx` so the existing percentage and member count match Challenge details; preserve Recently visited and existing loaded/error/read-only behavior, and never present loading/failed retained data as current zero or successful progress.
- [x] T019 [US2] Add the summary, explanation, and first incomplete member action near the heading in `src/pages/ChallengeDetails.tsx`, before long descriptions and optional map/route administration; place member progress before optional map/route administration too, use T017 and existing member order, carry T011 origin on the next-member link, omit misleading actions for complete/empty data, and preserve all route capabilities and explicit state boundaries.

**Checkpoint**: US1's complete return journey now exposes understandable,
up-to-date member and aggregate progress without another progress request.

## Phase 5: User Story 3 - Preserve Completion and Award Clarity (P2)

**Goal**: Protect feature 017 while the journey and progress presentation change.
No award rules or production labels are redesigned in this phase.

**Independent test**: Inspect Waypoint details and Recently visited for ordinary,
applicable-unrecorded, and recorded awards with partial/complete progress as
admin and viewer. Completion remains distinct from awards.

- [x] T020 [P] [US3] Add journey-specific regression assertions in `src/pages/LocationDetails.test.tsx` for omitted inapplicable award indicators, explicit applicable `No award recorded`, highest-versus-recorded labels, and completion remaining visible for partial/completed members after the new confirmation/navigation renders.
- [x] T021 [P] [US3] Add regression assertions in `src/pages/Dashboard.test.tsx` for Recently visited completion alongside separately identified recorded awards, applicable `No award recorded`, and no award-tier indicator for ordinary membership; prevent reintroducing an unqualified `Not Started` award status.
- [x] T022 [P] [US3] Extend the affected journey assertions in `e2e/challenge-awards.spec.ts` to protect the new return/summary layout's completion-versus-award distinction at both sizes; retain the existing conditional mandatory levels, exact scoped statistics, history protection, and viewer cases unchanged.

**Checkpoint**: The new journey preserves the delivered awards contract. Any
failure caused by earlier phases must be fixed at its source, not by weakening
these assertions.

## Phase 6: User Story 4 - See When My Corrections Are Valid (P2)

**Goal**: Correct reported field feedback across shared Activity forms without
new validation rules, focus jumps, writes, draft loss, or erased save failures.

**Independent test**: Submit an invalid draft, correct and blur one reported
field, and verify visible/accessibility errors before resubmitting. Repeat
still-invalid input, requirement-changing selections, evidence edits, and
expected save failures on creation/editing entry surfaces.

### Tests

- [x] T023 [P] [US4] Add `src/domain/activityDraftValidation.test.ts` covering the existing exact title, UK-date, postcode/coordinate pair/numeric/range, conditional award/removal acknowledgment, indexed reference/photo title/HTTPS/preview rules, error keys/messages, and normalized location result; use raw form values, not normalized submission values.
- [x] T024 [P] [US4] Add correction tests in `src/components/ActivityEditor.test.tsx` and `src/components/ActivityEditor.lifecycle.test.tsx` for reported-field blur, still-invalid edits, previously reported fields becoming invalid again, dependent selections, indexed evidence removal/reordering, and independent JSON/GPX errors; assert retained values/attachments/unrelated feedback, no correction-induced write/focus movement, and preserved submit-only first-invalid focus.
- [x] T025 [P] [US4] Add shared-form caller tests in `src/pages/Activities.test.tsx`, `src/pages/ActivityDetails.test.tsx`, `src/pages/IdeaDetails.test.tsx`, and `src/pages/LocationDetails.test.tsx` showing corrections work across creation/editing surfaces while specific save/conflict messages, draft contents, and existing save destinations remain intact.
- [x] T026 [P] [US4] Add browser correction cases to `e2e/activity-recording.spec.ts` for blur/selection-completion timing, accessible invalid indications and error associations, unchanged unrelated errors, conditional awards/location groups, and evidence corrections; count writes and inspect active focus before another submission.

### Implementation

- [x] T027 [US4] Extract the existing synchronous field validator into `src/domain/activityDraftValidation.ts` with a domain-owned typed raw-form input and existing eligibility context; retain exact rules/messages/keys and return normalized location when location is valid, without importing React, editor-local types, or the provider's normalized `ActivityDraft`.
- [x] T028 [US4] Replace duplicated/submission-local validation in `src/components/ActivityEditor.tsx` with T027 for submit and correction; track previously reported fields even after visible errors clear, revalidate reported fields by blur, preserve unrelated errors and save failures, and keep feedback-only state out of persistence and dirty-value comparisons.
- [x] T029 [US4] Complete requirement-changing group handling in `src/components/ActivityEditor.tsx` for postcode/coordinate mode and pairs, Waypoint-driven award eligibility/removal acknowledgment, and indexed reference/photo removal/reordering; validate newly committed values without misassigning row errors, preserve existing JSON application/GPX and attachment boundaries, and never trigger submit-focus behavior or writes from correction.

**Checkpoint**: Every supported shared Activity form reports current validity
before resubmission, without altering existing save/navigation outcomes.

## Phase 7: User Story 5 - Reach Recording and Save without Unrelated Content (P3)

**Goal**: Deliberate Waypoint recording-entry focus and measured Save reach,
preserving existing collapsed-empty and populated-edit evidence behavior.

**Independent test**: At 360x800 and 1280x800, open Log activity on a long
Waypoint, inspect actual focus/visibility, and complete ordinary and
award-required minimal drafts with Save at most one viewport of additional
scrolling beyond the last applicable required field.

### Tests

- [x] T030 [P] [US5] Add explicit-entry-focus tests in `src/components/ActivityEditor.lifecycle.test.tsx` showing the opt-in focuses the first required editable field once without refocusing during correction/rerenders; other creation/editing entries retain existing focus and populated evidence behavior.
- [x] T031 [P] [US5] Add Waypoint integration tests in `src/pages/LocationDetails.test.tsx` for Log activity enabling the focus opt-in, form actions preceding unrelated history, collapsed empty evidence, editable existing evidence, and keyboard Save/Cancel; keep geometric viewport assertions in T032 rather than approximate them in JSDOM.
- [x] T032 [P] [US5] Add real-browser focus/scroll acceptance in `e2e/challenge-activity-journey.spec.ts` at 360x800 and 1280x800 with long descriptions/history, ordinary and award-required minimal drafts, and expanded/populated evidence regression; from the visible last required field measure actual scroll delta <= viewport height to a fully visible/actionable Save, with no optional expansion/history traversal, obscured focus, clipped actions, or horizontal page overflow.

### Implementation

- [x] T033 [US5] Add the explicit Waypoint-only first-required-field focus/visibility opt-in to `src/components/ActivityEditor.tsx` and enable it when Log activity opens in `src/pages/LocationDetails.tsx`; use mounted refs/effects for intentional entry only, preserving other entry destinations, correction focus, and T013's separate success-container focus.
- [x] T034 [US5] Measure the existing action row in the browser before changing layout in `src/components/ActivityEditor.tsx` or `src/pages/LocationDetails.tsx`; make only a directly necessary adjustment if the T032 criterion is unmet, retain empty GPX/reference/photo collapse and populated editing behavior, and do not add speculative sticky/duplicate Save controls or move actions beyond Waypoint history.

**Checkpoint**: Entry focus, successful-save focus, and Save reach each have
separate direct evidence rather than screenshot/CSS proxies.

## Phase 8: Polish and Cross-Cutting Acceptance

- [x] T035 [P] Update `docs/pages/dashboard.md` with the direct return path, completed-Waypoint percentage, unchanged Activity-count implications, and Recently visited completion/award distinction.
- [x] T036 [P] Update `docs/pages/locations.md` with the named original Challenge return, invalid/direct-origin behavior, recording-entry and success focus, truthful non-contribution confirmation, read-only browsing, and optional evidence/Save behavior.
- [x] T037 [P] Update `docs/pages/visits.md` with corrected-field feedback timing, retained save failures/draft evidence, conditional awards, and unchanged Activities/Idea-origin/Activity-details destinations.
- [x] T038 [P] Complete integrated acceptance in `e2e/challenge-activity-journey.spec.ts` for all eight 360x800/1280x800 x admin/viewer x zero/partial combinations; add read-only Demo parity, selected/active mode changes with matching IDs, visibly warned Demo Cosmos fallback, and invalid/deleted/removed-membership origins; assert reader notices/Settings links, zero write controls/writes, correct returns/progress, and keyboard/wrapped-content usability. Verify explicit Production failure in production-mode component/provider tests: the isolated browser build's test-mode local Production path cannot exercise the real Production API boundary.
- [x] T039 Trace changed imports/callers and guard/data-mode consumers against `specs/016-challenge-activity-journey/quickstart.md`, then format actual changed files and run frontend lint, typecheck, the selected domain/provider/component/page/caller suites, and affected browser suites once after implementation; add a production build only for build/config changes, report exact blockers without bypassing checks, and do not run unrelated API checks or deliver remotely.
- [x] T040 Reconcile every FR/SC and measured role/focus/scroll outcome against `specs/016-challenge-activity-journey/contracts/challenge-journey-ui.md` and `docs/UI_GUIDELINES.md`, record exact validation results/blockers in `specs/016-challenge-activity-journey/quickstart.md`, and update `specs/016-challenge-activity-journey/tasks.md` only for evidenced completion; format and check diagnostics for Markdown edited in this step, then review the final intended source-control diff once without repeating successful checks on unchanged application files, claiming hosted/cloud acceptance, committing, pushing, or deploying.

## Dependencies and Execution Order

### Phase and Story Dependencies

```text
Setup T001-T002 and guard T003-T005
  |
  +-- US1 T006-T013 --+--> US2 integrated navigation/progress acceptance
  |                  |
  |                  +--> original-return regression in later story tests
  |
  +-- US2 arithmetic T014/T017 can be developed independently of US1
  +-- US3 award regression requires no new award implementation
  +-- US4 shared correction behavior is functionally independent of origin
  +-- US5 entry focus/Save reach is functionally independent of correction
  |
  +--> All story implementations/tests --> T035-T038 --> T039 --> T040
```

US2's full save/return acceptance and next-member origin integration require
US1. US3, US4, and US5 can be tested independently with existing data/entries;
they are not new functional dependencies on each other. The recommended serial
phase order avoids overlapping writes to the same editor/page/browser files.
Do not mistake disjoint test-writing opportunities for safe concurrent edits
of those shared files.

### Concrete Prerequisites

| Work                      | Prerequisites                                                                          |
| ------------------------- | -------------------------------------------------------------------------------------- |
| T002                      | T001 fictional data.                                                                   |
| T005                      | T003-T004 guard test contracts.                                                        |
| T006-T010                 | Setup and foundational gate complete; disjoint test files may be written concurrently. |
| T011                      | T006 origin contract.                                                                  |
| T012                      | T005, T008, T010, T011.                                                                |
| T013                      | T005, T007, T010, T011.                                                                |
| T017                      | T014 arithmetic contract.                                                              |
| T018                      | T015 and T017.                                                                         |
| T019                      | T011-T012, T015-T017; retain US1 navigation while adding next-member origin.           |
| T016 integrated execution | T012-T013 and T017-T019; test writing may precede these implementations.               |
| T020-T022 execution       | Current US1/US2 surfaces; no new award model required.                                 |
| T027                      | T023 raw-input validation contract.                                                    |
| T028                      | T024 and T027.                                                                         |
| T029                      | T024-T026 and T028.                                                                    |
| T033                      | T030-T031; serialize its editor/page writes after earlier changes to those files.      |
| T034                      | T032 measurement contract and T033 entry behavior.                                     |
| T035 / T036 / T037        | Relevant implemented progress / Waypoint / shared-form behavior.                       |
| T038 execution            | T002 and all applicable US1-US5 behavior; extend the same browser file serially.       |
| T039                      | T001-T038 implementation/test-writing/documentation complete.                          |
| T040                      | T039 results; fix change-caused failures before claiming completion.                   |

Tests are specified before implementation, but their executable acceptance
depends on the corresponding behavior. Independent story checkpoints describe
outcomes to prove; they do not require repetitive broad validation runs.

### Parallel Examples per Story

- **US1**: After foundations, write T006 origin tests, T007 Waypoint/App tests,
  T008 Challenge tests, T009 existing-destination tests, and T010 browser cases
  concurrently. T012 and T013 can then edit separate pages once their listed
  prerequisites are met.
- **US2**: Write T014 domain, T015 page, and T016 browser assertions in parallel.
  After T017, Dashboard adoption T018 and Challenge integration T019 use
  different production files.
- **US3**: T020 Waypoint, T021 Dashboard, and T022 award-browser regressions use
  different files and can be prepared concurrently.
- **US4**: T023 validator, T024 editor, T025 caller, and T026 browser tests use
  disjoint files. T028-T029 both edit the editor and must remain sequential.
- **US5**: T030 editor lifecycle, T031 Waypoint integration, and T032 browser
  measurement tests use separate files. Do not overlap T033/T034 with US4
  editor changes or US1 Waypoint changes.
- **Polish**: T035-T037 guidance and T038 browser matrix use separate files.
  Final validation waits for all of them.

## Requirement Traceability

| Requirement | Tasks                                  |
| ----------- | -------------------------------------- |
| FR-001      | T006-T013                              |
| FR-002      | T007, T010, T013                       |
| FR-003      | T008, T010, T012                       |
| FR-004      | T003-T008, T010-T013, T038             |
| FR-005      | T014-T019                              |
| FR-006      | T013-T019                              |
| FR-007      | T015-T016, T019                        |
| FR-008      | T006, T013, T015, T018-T019, T038      |
| FR-009      | T020-T022                              |
| FR-010      | T021-T022                              |
| FR-011      | T023-T029                              |
| FR-012      | T024-T029                              |
| FR-013      | T030-T034                              |
| FR-014      | T010, T016, T032-T034, T038, T040      |
| FR-015      | T007-T008, T010, T015, T020-T021, T038 |
| FR-016      | T003-T005, T009, T014, T020-T034, T039 |
| FR-017      | T035-T037                              |
| SC-001      | T007-T008, T010, T012-T013, T038       |
| SC-002      | T014-T019, T038                        |
| SC-003      | T015-T016, T019, T038                  |
| SC-004      | T020-T022                              |
| SC-005      | T023-T029                              |
| SC-006      | T030-T034, T038                        |
| SC-007      | T038                                   |
| SC-008      | T003-T013, T024-T029, T038             |

## Implementation Strategy

### MVP First

Complete T001-T013 and demonstrate US1's named return, guarded draft/save
behavior, success-container focus, and ordinary entry/navigation regressions.
This is a usable navigation increment, not full feature acceptance: the new
summary, correction feedback, and recording ergonomics are still pending.

### Incremental Delivery

1. Add US2's shared arithmetic, explanation, and next-member action.
2. Confirm US3 preserves the delivered awards behavior.
3. Add US4's shared validator and correction feedback.
4. Add US5's explicit entry focus and measured Save reach.
5. Finish guidance and the integrated matrix, then perform T039-T040.

Use the existing [validation guide](./quickstart.md) and
[constitution](../../.specify/memory/constitution.md). No API/schema work or
speculative abstractions are hidden prerequisites. A later push/PR request
changes the validation scope to the complete local CI sequence and requested
remote checks; it is not authorized by this task list.
