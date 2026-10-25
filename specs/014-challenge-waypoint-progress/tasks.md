# Tasks: Waypoint Progress on Challenge Details

**Input**: Design documents in `specs/014-challenge-waypoint-progress/`

**Prerequisites**: [plan.md](plan.md), [spec.md](spec.md),
[research.md](research.md), [data-model.md](data-model.md),
[UI contract](contracts/challenge-member-progress.md), [quickstart.md](quickstart.md).

**Tests**: Focused regressions and browser acceptance are included as required by
the design's validation contract and repository conventions. Add regressions
before production changes; use targeted runs for useful implementation feedback.
Do not run broad/static/formatting checks repeatedly during implementation.

**Organization**: Setup, common foundation, prioritized user stories, then polish
and final scoped validation. Paths are relative to the repository root.

## Format: `[ID] [P?] [Story] Description`

- `[P]` means ready work in separate files can run in parallel, subject to the
  explicit dependency graph.
- `[US1]`, `[US2]`, and `[US3]` identify the specification's user stories.
- All checkboxes start unchecked and represent implementation work, not the
  separate requirements-quality checklist.

## Phase 1: Setup and impact tracing

**Purpose**: Confirm the existing presentation path and tooling without adding
infrastructure.

- [x] T001 Trace `src/pages/ChallengeDetails.tsx` through `src/domain/visit.ts`, `src/features/journey/JourneyContext.tsx`, its colocated tests, and `e2e/journey.spec.ts`; confirm existing member ordering, route/map controls, read-only/load states, and the planned frontend-only scope in `specs/014-challenge-waypoint-progress/plan.md`; reuse existing dependencies and use a WSL-native checkout for Linux test tooling as described in `specs/014-challenge-waypoint-progress/quickstart.md`.

## Phase 2: Foundational completion contract

**Purpose**: Establish arithmetic coverage shared by all stories without changing
existing domain semantics or persisted entities.

- [x] T002 Review and extend only missing cases in `src/domain/visit.test.ts` against `src/domain/visit.ts`: preserve "count: number of loaded Activities linked to the Waypoint", "target: one for once mode, otherwise the Waypoint's configured target", and "complete: count >= target"; verify zero, partial, exact-target, above-target, target-one singular wording, and uncapped counts; reuse existing helpers without adding state, changing schema/versions, or duplicating arithmetic.

**Checkpoint**: Existing domain rules cover all progress states needed by the page.

## Phase 3: User Story 1 - See Which Waypoints Are Complete (P1, MVP)

**Goal**: Identify once-mode completion directly within each existing member card.

**Independent test**: One Challenge with once-mode members having zero, one, and
multiple Activities shows the right Done/Not done text on the right cards, with
unchanged navigation and order.

- [x] T003 [US1] Add failing card-scoped assertions in `src/pages/ChallengeDetails.test.tsx` for once-mode zero/one/multiple linked Activities, explicit `Completion: Not done` or `Completion: Done`, and retained title, description, View waypoint destination, and ordering; retain the empty-member message and existing loading/failed-load/missing-Challenge distinctions, adding assertions only where coverage is missing.
- [x] T004 [US1] Update member rendering in `src/pages/ChallengeDetails.tsx` to derive progress with `waypointCompletionProgress` and format it with `completionProgressLabel` from `src/domain/visit.ts`; insert completion text after description and before View waypoint inside the existing card Stack, keeping `challengeWaypoints`, map/route rendering, and write controls unchanged; show no invented member progress for unavailable data or an empty list.

**Checkpoint**: US1 is independently useful and testable without count-specific
presentation or new infrastructure.

## Phase 4: User Story 2 - Understand Count-Based Progress (P1)

**Goal**: Show actual count, target, and explicit completion for count-mode members.

**Independent test**: Count-mode cards show zero, partial, exact-target,
above-target, and target-one values matching the data-model table.

- [x] T005 [US2] Add failing card-scoped count-mode cases in `src/pages/ChallengeDetails.test.tsx` for `0 of 5 activities`, `2 of 5 activities`, `5 of 5 activities`, `7 of 5 activities`, and `0 of 1 activity`, each with explicit Done/Not done text; prove above-target counts remain visible and each label belongs to the correct member.
- [x] T006 [US2] Complete count-mode presentation in `src/pages/ChallengeDetails.tsx`: retain the existing formatter's `Completion: {count} of {target} activity/activities` label and add explicit Done/Not done text from the same `progress.complete` result, local to Challenge details; do not cap counts, alter the shared formatter or other views, use colour as the sole state, or add award-tier displays.

**Checkpoint**: Once and count-mode cards meet the full textual UI contract.

## Phase 5: User Story 3 - Trust Consistent Progress Across Views (P2)

**Goal**: Preserve membership, loaded-data consistency, permissions, and zero-write
viewing across datasets.

**Independent test**: The same Waypoint agrees across two Challenges and its own
details before/after loaded Activity changes; viewer and read-only cases show
correct progress without enabling mutations.

- [x] T007 [US3] Add consistency regressions in `src/pages/ChallengeDetails.test.tsx` using the existing provider and scoped member queries: overlapping Challenge assignments and Waypoint-detail labels agree; direct-Challenge-only and other-Waypoint Activities do not contribute; linked Activities count regardless of award category/date/direct Challenge ID; use valid synthetic relationships and existing `src/pages/LocationDetails.tsx` as an unchanged reference consumer.
- [x] T008 [US3] Extend lifecycle and access regressions in `src/pages/ChallengeDetails.test.tsx` for loaded Activity addition, deletion, and reassignment affecting both members; dataset switching must drop previous progress; cover writable admin, viewer, Demo local, and the existing warned Demo fallback, comparing equivalent records and spying on mutation requests/entity-record writes to prove viewing does not write or enable controls. Assert that rendering or rerendering progress does not issue additional dataset requests beyond existing provider loading; distinguish explicitly requested reloads and dataset switches. If failures reveal newly introduced page-local state, remove it in `src/pages/ChallengeDetails.tsx` rather than adding refresh/polling/context infrastructure.
- [x] T009 [P] [US3] Add isolated mocked browser acceptance named with `Challenge` in `e2e/journey.spec.ts`, using synthetic members without map features at 360x800 and 1280x800: verify card-associated completion/count labels, overlapping Challenge and Waypoint-detail consistency, long-title/label readability without clipping or overlap, document scroll width no greater than viewport width, keyboard-operable View waypoint destination, and zero mutation requests from viewing/navigation; include viewer read-only behaviour and preserve existing browser flows. Track Journey API reads as well as mutations; assert no extra reads while inspecting progress on an already-loaded page, treating existing full-page navigation loads separately.
- [x] T010 [US3] Apply `docs/UI_GUIDELINES.md` self-review to the changed member card in `src/pages/ChallengeDetails.tsx` after browser acceptance exists: fix only demonstrated label/title wrapping or layout issues at the required widths using existing MUI Stack/theme conventions, keep text understandable without colour, preserve existing spacing rhythm, and do not create a shared component or redesign maps/controls.

**Checkpoint**: All three stories work with current loaded data, permissions, and
responsive presentation; route/map and failure behaviour remain intact.

## Phase 6: Documentation and final validation

- [x] T011 [P] Update `docs/waypoints-model.md` to describe per-member completion/count visibility on Challenge details, uncapped actual counts, and separation from award tiers; preserve existing relationship and completion rules.
- [x] T012 [P] Add Feature 014 supersession/extension links in `specs/004-challenge-progress/spec.md` and `specs/004-challenge-progress/evidence.md` without rewriting historical evidence or unrelated untracked planning files; distinguish planned new acceptance from historical source review.
- [x] T013 Trace final imports/callers and affected flows from `src/pages/ChallengeDetails.tsx`, `src/domain/visit.ts`, and `e2e/journey.spec.ts`; format intended changed files and execute the scoped frontend validation in `specs/014-challenge-waypoint-progress/quickstart.md` once after implementation: lint, typecheck, relevant domain/page tests, and Challenge-selected browser flows including both required widths. Do not run unrelated API checks/builds unless actual impact expands; a later explicit push/PR request requires the full `.github/workflows/ci.yml` local sequence. Report precise failures without weakening assertions/timeouts.
- [x] T014 Record actual commands, test counts, viewport/keyboard/no-write results, and any blockers in `specs/014-challenge-waypoint-progress/quickstart.md`; mark only verified completed tasks in `specs/014-challenge-waypoint-progress/tasks.md`, keep unexecuted hosted acceptance explicit, and do not commit/push/merge/deploy without a new explicit request.

## Dependencies and execution order

```text
T001 -> T002
T002 -> T003 -> T004                       US1 / MVP
T004 -> T005 -> T006                       US2
T006 -> T007 -> T008                       US3 component/lifecycle checks
T006 -> T009                               US3 browser acceptance
T008 + T009 -> T010                        US3 responsive follow-through
T010 -> T011 || T012                       Documentation
T011 + T012 -> T013 -> T014                Validation and evidence
```

T007/T008 and T009 may run concurrently after T006 because they edit different
test files. No two tasks may edit the same file concurrently. T010 follows both
branches because browser evidence determines whether layout changes are needed.
T011 and T012 are independent documentation work after story acceptance is ready.

## Parallel execution examples by story

- **US1**: T003 and T004 are sequential: establish page regressions before editing
  its rendering. No artificial parallel task is needed for this small story.
- **US2**: T005 then T006 are sequential for the same reason; retain T002 domain
  coverage rather than duplicating its work.
- **US3**: Execute T007 then T008 in the component-test file alongside T009 in
  the browser-test file; join before T010.
- **Polish**: T011 model-guide text and T012 historical baseline links can run
  concurrently; final validation/evidence remain sequential.

## Requirement and outcome coverage

| Requirement / outcome  | Tasks                  |
| ---------------------- | ---------------------- |
| FR-001, FR-002; SC-001 | T003, T004, T009       |
| FR-003, FR-004; SC-002 | T002, T005, T006, T009 |
| FR-005; SC-003         | T007, T009             |
| FR-006; SC-003, SC-005 | T008, T009             |
| FR-007                 | T003, T004, T009, T013 |
| FR-008; SC-005         | T008, T009             |
| FR-009; SC-004         | T009, T010             |
| FR-010                 | T001, T004, T013       |

T013 includes existing Challenge-details route/map/draft tests and relevant
Waypoint/Dashboard tests from quickstart. New tests need not duplicate already
covered unchanged behaviour.

## Implementation strategy

1. Establish the existing domain contract and valid synthetic fixtures.
2. Deliver US1 as the smallest independently testable increment.
3. Add US2 without changing global formatter behaviour.
4. Verify US3 through existing context and mocked browser boundaries, correcting
   only demonstrated issues in the changed surface.
5. Finish directly related docs, run selected validation once, and record actual
   results. A completed checklist is not a claim that hosted checks ran.

No new packages, endpoints, schemas, persistence, migrations, filters, sorting,
aggregates, award displays, or map redesign are part of these tasks.

## Phase 7: Convergence

- [x] T015 Extend `src/pages/ChallengeDetails.test.tsx` to verify the same loaded dataset across both overlapping Challenges and Waypoint details before and after Activity addition, reassignment, and deletion; assert card-associated counts and completion for affected members, retain no-extra-read/no-write assertions, run the affected tests, and record actual results in `specs/014-challenge-waypoint-progress/quickstart.md` per SC-003, US3 independent test, and T007-T008 (partial). Static cross-view agreement and first-Challenge-only reload assertions do not yet cover the combined acceptance case.
- [x] T016 Strengthen `src/pages/ChallengeDetails.test.tsx` using identical bundled Demo records in writable admin, viewer, Demo local, and warned Demo Cosmos fallback cases; compare every member's exact completion/count labels with the writable baseline, retain permission, explicit fallback notice, request-count, and no-entity-write assertions, run the affected tests, and record actual results in `specs/014-challenge-waypoint-progress/quickstart.md` per SC-005 and T008 (partial). The existing Demo assertion proves only that at least one member is Done, not equivalent per-member progress across modes.
