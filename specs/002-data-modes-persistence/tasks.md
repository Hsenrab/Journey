# Tasks: Safe Data-Mode Switching

**Input**: [Plan](plan.md), [specification](spec.md), [research](research.md),
[transient state](data-model.md), [UI contract](contracts/mode-switching.md),
and [validation guide](quickstart.md).

**Scope**: Only the newly approved FR-017/FR-018 and SC-007/SC-008 improvements.
They extend **US1 - Know Which Dataset Is Active (P1)**. US2, US3, and US4
remain existing behaviour to preserve, not separate reimplementation phases.
Tests below are required by the two new success criteria and project conventions.
All tasks below are complete under the separate implementation authorization.
The implementation phase did not include a commit, push, deployment, or hosted
mutation. The owner subsequently authorized committing, pushing, and opening a
pull request; see [the validation evidence](evidence.md).

## Phase 1: Setup

- [x] T001 Trace every mutation and mode-switch caller in `src/features/journey/JourneyContext.tsx` and `src/pages/Settings.tsx`, editor route exits through `src/components/Layout.tsx`, and the draft surfaces listed in `plan.md`; record the bounded surface inventory in `specs/002-data-modes-persistence/research.md` before editing runtime code. Preserve existing uncommitted review documents; create a dedicated implementation branch when implementation is authorized.

## Phase 2: Foundation

- [x] T002 Define minimal typed transient pending-operation and dirty-draft coordination in `src/features/journey/JourneyContext.tsx` following `specs/002-data-modes-persistence/data-model.md`; use a synchronous pending guard plus rendered state, support overlapping operations, and define a cancellation result distinguishable from switch success. Do not persist drafts, add dependencies, or change Cosmos/API schemas. Depends on T001.

## Phase 3: US1 - Know Which Dataset Is Active (P1)

**Goal**: Prevent mode changes during writes and prevent silent cross-dataset draft loss.

**Independent test**: With mocked remote API promises, switching cannot change
the preference or begin a load until all writes settle; dirty-draft cancellation
preserves route/mode/values and confirmation discards before switching. Both
success and failure paths work without any Azure resources.

### Increment A: Pending-operation protection (smallest deliverable)

- [x] T003 [US1] Add deferred-response regression cases in `src/features/journey/JourneyContext.test.tsx` for save, restore, and clear, each succeeding and failing; include delete, route saves, overlapping mutations, same-tick direct switch calls, and page unmount while pending. Assert no preference update/new load on blocked switches, original error preservation, and unlock only after the last operation settles. Use mocked remote mode, not legacy local-record persistence. Depends on T002.
- [x] T004 [US1] Wire every mutation in `src/features/journey/JourneyContext.tsx` into the pending guard before asynchronous work and release in `finally`; reject direct mode switches while pending, preserve the original dataset binding, and keep existing viewer/local/loading/failure guards. A failing or overlapping operation must not leave the selector locked or unlock it early. Depends on T003.
- [x] T005 [US1] Disable the mode selector during pending mutations in `src/pages/Settings.tsx` and cover it in `src/pages/Settings.test.tsx`; start shared restore participation at file acceptance before `file.text()` or validation, bind its destination, and release on every read/validation/write outcome without an early unlock or leaked participation across the provider restore call. Test delayed reads, read rejection, invalid JSON/schema, and delayed writes: no preference change or new mode load while pending, and release on success/failure. Await mode-switch results without hiding specific errors or reporting cancellation as success. Retain export and existing restore/clear behaviour. Depends on T004.

### Increment B: Unsaved-draft protection

- [x] T006 [US1] Add cancel/confirm, unchanged-draft, failed-save retention, and registration-cleanup cases in `src/features/journey/JourneyContext.test.tsx` and `src/app/App.test.tsx`. Exercise both direct context switches and the actual editor-to-Settings route transition before editor unmount; cancellation retains route, preference, and values, while confirmation discards once without carrying state to the next dataset. Depends on T005.
- [x] T007 [US1] Implement the minimal shared draft-discard coordination in `src/features/journey/JourneyContext.tsx` and connect it to mode selection in `src/pages/Settings.tsx` and the Settings navigation path in `src/components/Layout.tsx` where needed. Confirm before a changed editor unmounts on navigation to Settings even if no mode is subsequently selected; cancel preserves route/mode/draft, confirm discards once with no later selection prompt. Extend `src/app/App.test.tsx` for that no-switch journey. Prevent pending-write attempts from discarding drafts. Preserve `BrowserRouter`; do not add a general guard for unrelated navigation, unsupported router hooks, or a navigation framework. Depends on T006.
- [x] T008 [P] [US1] Connect existing dirty comparisons in `src/components/WaypointEditor.tsx`, `src/components/IdeaEditor.tsx`, and `src/components/ActivityEditor.tsx` to the shared discard boundary; extend their colocated `.test.tsx` files for changed/unchanged drafts, cancel/confirm, successful/failed save, and unregister on unmount. Count non-whitespace unapplied JSON as dirty even if invalid; test valid/invalid text, whitespace-only text, cancel retaining text, confirm discarding it, and clearing text without clearing dirty applied form edits. Include references/photos and GPX changes where applicable; preserve existing automatic Activity location-prefill dirty semantics. Depends on T007.
- [x] T009 [P] [US1] Integrate Challenge creation state in `src/pages/Dashboard.tsx` and planned-route draft state in `src/pages/ChallengeDetails.tsx`; extend their colocated `.test.tsx` files for the same discard lifecycle, including pending route parsing results that must not resurrect a discarded draft. Do not change GPX representation or add draft persistence. Depends on T007.
- [x] T010 [US1] Add the actual editor-to-Settings-to-mode-switch journey in `e2e/journey.spec.ts` with intercepted authenticated remote responses; verify cancelled discard preserves entered fields and route, confirmed discard does not prompt twice, and a held save disables switching until settlement. Do not use the legacy browser-record path as proof of pending remote writes. If needed, add a narrowly scoped Playwright project/configuration in `playwright.config.ts` for this remote-mode journey while preserving existing smoke tests. Depends on T005, T008, and T009.

## Phase 4: Polish and Verification

- [x] T011 Validate the impacted frontend once after implementation using `specs/002-data-modes-persistence/quickstart.md`: format changed files, run frontend lint/typecheck, directly affected Vitest tests, and the affected Playwright journey. Preserve existing load-order, viewer, local-demo, export, and failed-load assertions. If T010 changes `playwright.config.ts`, also run the affected configuration/build path. Record actual commands, outcomes, and blockers in `specs/002-data-modes-persistence/evidence.md`; do not claim hosted acceptance. Depends on T010.
- [x] T012 Update `specs/002-data-modes-persistence/spec.md`, `specs/002-data-modes-persistence/evidence.md`, `specs/009-structured-draft-entry/spec.md`, and `docs/operations.md` only where the implemented behaviour changes their statements. Mark FR-017/FR-018 and SC-007/SC-008 implemented/executed only when supported by T011; retain the 100-operation limit and unrelated acceptance gaps. Review changed UI against `docs/UI_GUIDELINES.md`; format/check the final documentation without rerunning unchanged successful application checks. Depends on T011.

## Dependencies and Execution Order

```text
T001 -> T002 -> T003 -> T004 -> T005 -> T006 -> T007
                                               |-> T008 --|
                                               |-> T009 --|-> T010 -> T011 -> T012
```

- T010 also requires T005's pending selector integration.
- T008 and T009 are the only planned parallel implementation opportunities:
  after T007 fixes the shared contract they touch disjoint editor/page files.
- Shared provider edits T002-T007 are sequential; do not run concurrent writers.
- No work on existing US2-US4 or capacity expansion is required to finish these tasks.

## Parallel Example: US1

After T007, one implementation thread can wire the three reusable editors (T008)
while another handles Challenge creation/planned routes (T009). Each owns its
colocated tests. Integrate both before the cross-page journey (T010).

## Implementation Strategy

Deliver Increment A (T001-T005) first as the smallest independently testable
safeguard. Complete Increment B and T010-T012 to satisfy the full request.
Do not mark the feature complete after only disabling the selector: direct calls,
draft unmount, failed saves, and overlapping operations are required surfaces.
This is a task backlog, not evidence that implementation or validation has run.
No push, commit, invitation administration, or deployment is included.
