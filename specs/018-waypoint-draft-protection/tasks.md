# Tasks: Waypoint Draft Protection

**Input**: Design documents in `specs/018-waypoint-draft-protection/`.

**Branch**: `018-waypoint-draft-protection`

**Prerequisites**: [spec.md](./spec.md), [plan.md](./plan.md),
[research.md](./research.md), [data-model.md](./data-model.md),
[editor contract](./contracts/waypoint-editor.md) and
[quickstart.md](./quickstart.md).

**Tests**: Required by the specification. Write regression tests before the
corresponding implementation, and confirm the new dirty-Cancel/pending-save cases
fail against the current behavior using focused component selectors. Existing
behavior tests may already pass; do not manufacture failures or weaken assertions.

**Organization**: Setup, a small shared contract prerequisite, three user stories
in specification priority order, then documentation and final validation.
Checkboxes record completed implementation work; blocked acceptance stays open.

**Execution status**: 21 of 23 tasks complete. T019 and T023 remain blocked on
interactive native-dialog keyboard acceptance. All 84 component/page tests and
12 browser cases passed; the final combined unit run required a targeted
remaining-file run after a worker-start timeout. See [quickstart.md](./quickstart.md)
for exact results, failures and the coverage boundary.

## Format: `[ID] [P?] [Story] Description`

- `[P]` means different files can be worked on concurrently within the stated
  ready group, after its prerequisites. It does not authorize parallel edits to
  the same file across story phases.
- `[US1]`, `[US2]` and `[US3]` match the specification's user stories.
- File paths in task descriptions are relative to the repository root.
- Keep changes direct. Do not add services, schemas, dependencies, migrations,
  autosave, draft persistence, confirmation abstractions or navigation protection.
- Do not modify the unrelated local `docs/ux-review-backlog.md`, shared browser
  pages on port 4187, or real Journey records.

## Phase 1: Setup

**Purpose**: Confirm the existing project context, not scaffold new infrastructure.

- [x] T001 Confirm branch `018-waypoint-draft-protection`, preserve existing uncommitted work, and review `specs/018-waypoint-draft-protection/spec.md`, `specs/018-waypoint-draft-protection/plan.md` and `specs/018-waypoint-draft-protection/contracts/waypoint-editor.md` for the Cancel-only scope, pending-save decision and unchanged access/navigation boundaries; do not install dependencies without a missing-dependency failure or manifest change.

## Phase 2: Foundational Callback Contract

**Purpose**: Make the actual asynchronous submission lifetime available to the
editor before implementing story behavior.

- [x] T002 Change `onSubmit` in `src/components/WaypointEditor.tsx` to `(draft: WaypointDraft) => Promise<void>` and update every Waypoint editor submission mock in `src/components/WaypointEditor.test.tsx` to return a typed promise; verify the existing async callbacks in `src/pages/Locations.tsx` and `src/pages/LocationDetails.tsx` already satisfy it, without introducing a compatibility union, boolean result or parent-success refactor.

**Checkpoint**: The callback contract is accurate; production save outcomes and
parent behavior remain unchanged. T002 is required before all story work.

## Phase 3: User Story 1 - Keep Work After an Accidental Cancel (Priority: P1)

**Goal**: Declining discard preserves a changed add/edit draft, including failed
saves. Cancel cannot close the editor while saving.

**Independent Test**: Change a new or existing Waypoint, decline Cancel repeatedly
and compare all values, errors, selections, tab/JSON state and evidence positions.
Hold a save promise and verify no Cancel closure or duplicate submission; settle
with a handled failure and verify the same draft becomes editable and protected.

### Tests for User Story 1

- [x] T003 [P] [US1] Add new/edit regression cases in `src/components/WaypointEditor.test.tsx` for one exact `You have unsaved Waypoint changes. Discard them?` confirmation per dirty Cancel, repeated decline, zero submit/Cancel callback calls on decline, and exact preservation of fields, Challenge selections, completion, location, tags, current evidence order, active tab, JSON text and visible errors; enforce "Declining preserves every current value and position." and "Unapplied non-whitespace text contributes to dirtiness; comparison is unchanged." without adding reorder controls or changing evidence loading.
- [x] T004 [P] [US1] Extend `src/pages/Locations.test.tsx` to decline Cancel on a changed add draft and after a handled remote save failure, preserving the existing list/query context, field values and specific page error with no additional writes or success message.
- [x] T005 [P] [US1] Extend `src/pages/LocationDetails.test.tsx` to decline Cancel on a changed edit draft after location-resolution or protected-assignment failure, preserving selected Challenges, coordinates, the specific page message and saved records with no additional writes.
- [x] T006 [US1] After T003, add deferred-promise lifecycle tests in `src/components/WaypointEditor.test.tsx` for synchronous repeated submits, disabled Cancel/form controls, no pending Cancel prompt/callback, normal parent-owned successful closure, handled-failure fulfillment that does not reset or close the draft, unlock/retry, and an escaped rejection rendered by the actual `ApplicationError` from `src/app/App.tsx` with its exact original message.
- [x] T007 [P] [US1] Create `e2e/waypoint-draft-protection.spec.ts` with file-local typed fictional Journey responses, write counters and deferred-request cleanup following `e2e/journey.spec.ts` and `e2e/challenge-activity-journey.spec.ts`; add admin add/edit decline cases in Production test-local and intercepted Demo Cosmos fixtures, with remote pending-save success/failure cases in Demo Cosmos, at 360 by 800 and 1280 by 800, checking exact native-dialog count/message, keyboard activation, post-dismissal focus, retained errors/evidence, single writes only on explicit Save, and no horizontal overflow; intercept unexpected requests rather than contacting live services.

### Implementation for User Story 1

- [x] T008 [US1] After the US1 regression tests are written, implement local saving state/ref and awaited submission in `src/components/WaypointEditor.tsx`, preserving "Boolean state for rendering and ref for immediate exclusion" and "Valid submission until callback settlement."; validate before locking, guard same-turn duplicate submits, disable controls/Save/Cancel with the existing Activity fieldset pattern, expose `aria-busy` and `Saving...`, unlock in `finally`, and forward escaped errors using a "Nullable envelope containing the original `unknown` thrown value" that is thrown during render; do not infer success, clear the draft or add navigation blockers.
- [x] T009 [US1] Implement an explicit non-submit Cancel button and handler in `src/components/WaypointEditor.tsx`: return immediately while the saving ref is set; otherwise use the existing `dirty` value and native confirmation, invoking the parent callback only for clean drafts or confirmed discard; declining performs no state updates, and existing `useJourneyDraft(dirty)`, unload handling and global confirmation/navigation behavior stay unchanged.

**Checkpoint**: US1 is the MVP: accidental Cancel is safe, failed drafts remain
intact and pending saves cannot be mistaken for cancelled writes. US2 and US3
add focused verification of the other branches of this same small implementation.

## Phase 4: User Story 2 - Deliberately Abandon a Draft (Priority: P2)

**Goal**: Confirming discard closes the correct editor without saving and reopening
starts from the saved record or intended defaults.

**Independent Test**: Change an add/edit draft, accept discard, inspect the parent
URL/context and saved data, then reopen. Abandoned values, JSON and errors must
not return, and cancellation must add no writes.

### Tests and Integration for User Story 2

- [x] T010 [P] [US2] Extend `src/pages/Locations.test.tsx` to confirm discard from add mode, retain the existing list query/scope while removing only add mode, create no record, and reopen with intended new-record defaults rather than abandoned fields, evidence, JSON or errors; enforce "Cancel changes no saved record."
- [x] T011 [P] [US2] Extend `src/pages/LocationDetails.test.tsx` to confirm discard after ordinary edits and a retained failed edit, remain on the same saved Waypoint detail, leave the complete saved dataset unchanged and reopen from saved values without abandoned draft/errors; enforce "Cancel changes no saved record."
- [x] T012 [P] [US2] Add accepted-confirmation and absent-`onCancel` component cases in `src/components/WaypointEditor.test.tsx`, verifying one Cancel callback and zero submissions on acceptance, no callback before the decision, no extra navigation confirmation, and no Cancel control when the prop is absent.
- [x] T013 [P] [US2] Extend `e2e/waypoint-draft-protection.spec.ts` with admin accepted-discard/reopen cases for add/edit in Production test-local and intercepted Demo Cosmos fixtures and both target viewports, comparing saved snapshots/write counts and checking parent URLs plus native confirmation acceptance without inventing new discovery-state persistence.

**Implementation boundary**: T009 already supplies the confirmed branch.
These tasks verify the existing parent integration; no new reset protocol or
parent production-code rewrite is expected. Fix only an actual, directly related
failure exposed by these tests, not unrelated parent behavior.

**Checkpoint**: Intentional discard closes correctly and never masquerades as Save.

## Phase 5: User Story 3 - Cancel Without Unnecessary Warnings (Priority: P2)

**Goal**: Untouched and fully reverted drafts cancel immediately; viewers and other
read-only modes retain browsing without an editor or write access.

**Independent Test**: Cancel an untouched draft and one restored to its initial
values. Both close without prompting or writing. Browse as a viewer or in Demo
local, including a direct add URL, and verify mutation controls remain absent.

### Tests and Integration for User Story 3

- [x] T014 [P] [US3] After T012, extend `src/components/WaypointEditor.test.tsx` for untouched new/existing drafts, initial defaults/selections, fully restored fields/evidence, tab-only changes, whitespace-only JSON, and validation errors without meaningful changes: Cancel invokes its callback once with no prompt/submit; retain contrasting malformed/unapplied JSON and loaded-form-then-cleared-JSON cases that must still prompt.
- [x] T015 [P] [US3] After T010, extend `src/pages/Locations.test.tsx` to verify unchanged add cancellation retains current list context without writes/prompts and that viewer Production/Demo Cosmos, Demo local and existing load-blocked states cannot expose the editor, including `/waypoints?mode=add`; preserve existing read-only notices and Settings links.
- [x] T016 [P] [US3] After T011, extend `src/pages/LocationDetails.test.tsx` for immediate unchanged edit cancellation and viewer/read-only/failed-load browsing with no Waypoint editor or mutation controls, preserving the saved detail, notices and zero writes.
- [x] T017 [P] [US3] After T013, extend `e2e/waypoint-draft-protection.spec.ts` with clean/reverted Cancel and viewer/read-only cases at both target viewports, including intercepted Demo Cosmos viewers and Demo local direct-add URLs; cover Production viewers in page integration tests because the browser bundle uses the local Production test path; assert zero unwanted dialogs, zero cancellation writes, absent mutation controls and usable browsing.

**Implementation boundary**: T009's clean branch and existing page access gates
should satisfy these scenarios without another production abstraction.

**Checkpoint**: All three stories are independently verifiable. Existing JSON
dirtiness, navigation/mode-switch and unload tests must remain valid.

## Phase 6: Documentation and Final Validation

**Purpose**: Explain the changed behavior and execute the exact planned acceptance
checks once implementation is complete. These tasks do not authorize a commit,
push, PR, live-data write or deployment.

- [x] T018 [P] Update `docs/pages/locations.md` to document unchanged versus changed Cancel, both discard choices, reopening, the short pending-save control lock, unchanged read-only access and the Cancel-only scope without promising autosave, recovery or expanded navigation protection.
- [ ] T019 [P] Exercise the native confirmation using actual keyboard controls in an isolated interactive browser and apply `docs/UI_GUIDELINES.md` at 360 by 800 and 1280 by 800; verify both choices, post-decline focus, retained tab/errors and reachable non-overflowing actions, then record actual outcomes or the exact access blocker in `specs/018-waypoint-draft-protection/quickstart.md`, explicitly distinguishing native-dialog keyboard coverage from Playwright accept/dismiss coverage.
- [x] T020 Trace the final implementation's imports/callers and configuration consumers from `src/components/WaypointEditor.tsx`, `src/pages/Locations.tsx`, `src/pages/LocationDetails.tsx` and `playwright.config.ts`; confirm the frontend-only validation scope in `specs/018-waypoint-draft-protection/quickstart.md`, that routing/API/schema/deployment behavior is unchanged, and that unrelated local changes remain untouched; expand checks only if the actual changed surfaces require it.
- [x] T021 After code, tests and documentation are finalized, format only changed files and check their editor diagnostics as prescribed by `specs/018-waypoint-draft-protection/quickstart.md`, including `src/components/WaypointEditor.tsx`, its test, both parent test files, `e2e/waypoint-draft-protection.spec.ts`, `docs/pages/locations.md` and any changed feature documents; do not run repo-wide formatting or reinstall working dependencies.
- [x] T022 Run the final frontend sequence from `specs/018-waypoint-draft-protection/quickstart.md`: `npm run lint`, `npm run typecheck`, one combined Vitest invocation for `src/components/WaypointEditor.test.tsx`, `src/pages/Locations.test.tsx` and `src/pages/LocationDetails.test.tsx`, then `npm run test:e2e -- e2e/waypoint-draft-protection.spec.ts`; use the established WSL environment when needed, report exact failures, and repeat successful checks only if their covered files change.
- [ ] T023 Reconcile all FR-001 through FR-013 and SC-001 through SC-006 in `specs/018-waypoint-draft-protection/spec.md` with executed test and interactive evidence, using the coverage table below; update checkboxes in `specs/018-waypoint-draft-protection/tasks.md` only for completed work, leave blocked native-keyboard acceptance incomplete, report blockers/unexecuted coverage, and confirm no API/live-service or hosted-deployment validation is being claimed.

## Dependencies & Execution Order

### Phase Dependencies

1. T001 precedes T002; T002 blocks story work.
2. US1 tests T003, T004, T005 and T007 can be authored concurrently after T002.
   T006 follows T003 because they edit the same component test file.
3. T008 follows T004, T005, T006 and T007, completing the tests-first preparation.
   T009 follows T008 and reuses its synchronous saving guard.
4. US2 and US3 require T009's shared behavior, not separate services or models.
   Prefer US2 then US3; same-file serialization requires T012 before T014,
   T010 before T015, T011 before T016, and T013 before T017.
5. After T010 through T017 are complete, T018 and T019 may proceed in parallel.
   T020 follows T018 and the completion of T019's result/blocker documentation,
   not a passing native-keyboard outcome. Serialize both tasks' edits to the
   validation guide. T021 follows T020 and final edits; T022 follows T021.
6. Attempt T019 before final formatting where possible. It is an acceptance gate,
   not a reason to skip executable static/unit/browser checks if interactive
   access is blocked. T023 requires both T019's acceptance and T022's passing
   results; if native-keyboard acceptance is blocked, leave T019/T023 incomplete
   and report it rather than claiming success.

### Dependency Graph

```text
T001 -> T002 -> T003 -> T006
             -> T004
             -> T005
             -> T007
{T004,T005,T006,T007} -> T008 -> T009
T009 -> {T010,T011,T012,T013}
T012 -> T014
T010 -> T015
T011 -> T016
T013 -> T017
{T010..T017} -> T018 -> T020 -> T021 -> T022
{T010..T017} -> T019
T019 result/blocker documentation finished -> T020
{T019,T022} -> T023
```

### User Story Dependencies

- US1 is the first deliverable and includes the shared saving/Cancel implementation.
- US2 independently verifies deliberate discard against the shared US1 behavior.
- US3 independently verifies clean cancellation/access gates against that same
  behavior; its ordering after US2 is file ownership, not a functional dependency.
- Do not run full story phases concurrently against the same test files.

## Parallel Examples

### User Story 1

After T002, author T003 in the component test, T004 in the list test, T005 in the
detail test and T007 in the new browser file concurrently. T006 must wait for
T003. Keep T008/T009 production edits sequential.

### User Story 2

After US1, T010 (list), T011 (detail), T012 (component) and T013 (browser) can be
authored in parallel because each owns a different file.

### User Story 3

After the corresponding US2 file owner finishes, T014 (component), T015 (list),
T016 (detail) and T017 (browser) can proceed independently. T018 documentation
and T019 interactive review can overlap after story work, but not final formatting.

## Requirement Coverage

| Requirements and outcomes                     | Tasks                              |
| --------------------------------------------- | ---------------------------------- |
| FR-001, FR-002; SC-003                        | T003, T009, T014, T015, T016, T017 |
| FR-003, FR-004, FR-006; SC-001                | T003, T004, T005, T007, T009, T012 |
| FR-005, FR-007; SC-002                        | T010, T011, T012, T013             |
| FR-008                                        | T003, T009, T014                   |
| FR-009, FR-013; SC-006                        | T002, T004, T005, T006, T007, T008 |
| FR-010; SC-004                                | T007, T013, T017, T019             |
| FR-011; SC-005                                | T015, T016, T017                   |
| FR-012                                        | T003, T009, T012, T014, T022       |
| Documentation and honest acceptance reporting | T018, T019, T020, T021, T022, T023 |

## Implementation Strategy

### MVP First

Complete T001 through T009. This delivers US1: meaningful draft protection and
pending-save safety, with parent failure retention and exact unexpected errors.
Use focused component selectors for useful implementation feedback. The MVP is
not a claim that the full feature's remaining acceptance matrix has passed.

### Incremental Delivery

1. Establish the callback contract and deliver US1's shared implementation.
2. Verify deliberate discard and reopening through US2.
3. Verify clean cancellation and unchanged read-only boundaries through US3.
4. Complete documentation, interactive acceptance and the selected final checks.
5. Report verified outcomes and any remaining blockers; do not commit, push or
   deploy without an explicit request.

The recommended pre-implementation next step is `speckit-analyze`. Task generation
does not execute tests, implement code, mark acceptance complete or authorize
delivery side effects.
