# Tasks: Single-Source Challenge-Waypoint Relationships

**Input**: Design documents in `specs/013-challenge-waypoint-relationships/`  
**Prerequisites**: [spec.md](spec.md), [plan.md](plan.md), [research.md](research.md), [data-model.md](data-model.md), [boundary contract](contracts/relationship-data.md), [quickstart.md](quickstart.md)  
**Branch**: `013-challenge-waypoint-relationships`

**Organization**: Shared contract prerequisites, then three P1 user stories, then
cross-cutting documentation and final validation. All tasks start unchecked.

**Validation**: Update existing tests alongside the behavior they cover, as
required by the plan and repository conventions. Add regression assertions before
the corresponding implementation where practical. Focused tests may provide
implementation feedback; run final formatting/static/full CI checks only after
implementation is complete. Do not create new test tooling.

## Format and scope

- `- [ ] Tnnn [P?] [USn?] Description with file paths`.
- `[P]` means a task can run beside another task in the same dependency-ready wave,
  with no shared edited files. It does not waive prerequisites.
- Paths are repository-relative. Colocated tests listed below already exist.
- Do not modify the unrelated Feature004 planning additions or scratch file.
- Do not remove `Idea.waypointIds`, redesign `Activity.challengeId`, migrate data,
  add Challenge CRUD, commit, push, seed hosted data, or deploy.

## Phase 1: Setup and impact tracing

**Purpose**: Locate all consumers without introducing infrastructure.

- [x] T001 Trace Challenge-shaped fixtures and consumers of `Challenge.waypointIds` and `Waypoint.challengeIds` from `src/domain/visit.ts`, `src/features/journey/JourneyContext.tsx`, `api/src/lib/journeySchema.ts`, and `api/src/lib/journeyGraph.ts` through their callers, tests, backup consumers, and build/deployment seed path in `api/package.json`; record any newly discovered affected paths in this task file and distinguish the unrelated `Idea.waypointIds` relationship.
- [x] T002 Audit every Challenge list against Waypoint assignments in `src/data/demo.json` before changing the fixture; verify intended membership and explicitly resolve any discrepancy rather than silently dropping a Challenge-only link, without touching hosted data.

**Checkpoint**: Impact scope and intended Demo memberships are understood. Existing
dependencies/tooling are reused; install nothing unless a validation command
actually reports a missing dependency or a manifest changes.

## Phase 2: Foundational entity contract and fixtures

**Purpose**: Establish the single-source shape used by every story. T003 and T004
may run in parallel after T001/T002. T005 follows both.

- [x] T003 [P] Replace the Challenge shape in `src/domain/visit.ts` and update entity regression assertions in `src/domain/visit.test.ts`: "Remove `waypointIds`; its presence is an explicit validation error, even empty", "Challenge objects use strict validation", and "Each identifier is nonempty, distinct, and refers to an existing Challenge"; implement the nonempty/distinct `Waypoint.challengeIds` constraint here and defer dataset-level existence checks to T016; retain all other Challenge/Waypoint fields and use a specific obsolete-field diagnostic rather than silently stripping it.
- [x] T004 [P] Apply the same strict Challenge shape and distinct nonempty Waypoint assignment constraints in `api/src/lib/journeySchema.ts` with regressions in `api/src/lib/journeySchema.test.ts`; "New Cosmos Challenge documents use schema version 3; versions 1/2 are rejected" and "Cosmos Waypoint document version remains 2 because its entity shape is unchanged"; preserve unrelated entity versions/compatibility and reject obsolete fields even on a version-3 document.
- [x] T005 Align authored fixtures and frontend writers with the new shape: update `src/data/demo.json` and Challenge-shaped fixtures in `src/**/*.test.ts`, `src/**/*.test.tsx`, `api/src/**/*.test.ts`, and `e2e/journey.spec.ts` identified by T001, preserving T002 memberships and unrelated records; in `src/features/journey/JourneyContext.tsx`, stop Challenge creation emitting `waypointIds` and remove reverse-list maintenance from Waypoint create/update/delete, retaining Idea/Activity detachment and orphan pruning; update shape-specific regressions in `src/features/journey/JourneyContext.test.tsx`, keep obsolete shapes only in explicit negative tests, and preserve the Demo fixture copy/seed path in `api/package.json`; leave new candidate-edit validation and category-history protection to T009/T010.

**Checkpoint**: Browser/API target entity shapes, authored fixtures, and frontend
writers agree. US1 component tests can create Challenges and Waypoints without
emitting obsolete fields. API graph callers are completed in US2; do not add
optional legacy fields merely to make old code compile.

## Phase 3: User Story 1 - See Accurate Challenge Membership (P1)

**Goal**: Derive member views, completion, category eligibility, and tracks from the
same Waypoint-side assignments. Maps and progress math remain unchanged.

**Independent test**: For zero, one, and multiple assignments, verify exact member
sets without duplicates; changing assignment changes the applicable views, while
direct Activity Challenge IDs never select tracks.

- [x] T006 [US1] Add membership regressions and simplify `challengeWaypoints` in `src/domain/visit.ts` and `src/domain/visit.test.ts` to filter only `waypoint.challengeIds.includes(challenge.challengeId)`; cover no assignments, overlapping Challenges, exact member counts, once/count completion, and unchanged category semantics without introducing a second membership implementation.
- [x] T007 [P] [US1] Update overview assertions in `src/pages/Dashboard.test.tsx` against `src/pages/Dashboard.tsx` for zero/partial/full progress derived only from Waypoint assignments and unchanged dataset-wide award summaries; remove union-membership expectations and change production code only if necessary to retain the shared helper.
- [x] T008 [P] [US1] Update membership and track regressions in `src/pages/ChallengeDetails.test.tsx`, `src/domain/gpxMap.test.ts`, and `src/components/ChallengeRouteMap.test.tsx` against `src/pages/ChallengeDetails.tsx` and `src/domain/gpxMap.ts`; verify exact displayed members, tracks through their Waypoints rather than direct `Activity.challengeId`, and unchanged route/track visibility and GPX lifecycle behavior.

**Checkpoint**: US1 reading/derivation behavior is testable using valid canonical
fixtures. Obsolete input must be rejected, never rendered as an alternate member
source; US3 completes the read/import error boundaries.

## Phase 4: User Story 2 - Maintain Challenge Assignments (P1)

**Goal**: Keep existing Waypoint editing while eliminating reverse-list writes and
preserving data, authorization, concurrency, and linked-deletion guarantees.

**Independent test**: Add/remove/cancel one of several assignments; verify other
links/history remain unchanged. Reject removal of the last category-enabled
assignment when awarded Activities would become invalid.

- [x] T009 [P] [US2] Add/update regressions in `src/features/journey/JourneyContext.test.tsx` for Challenge creation without a member list, Waypoint add/edit/remove/cancel semantics, unchanged unrelated Challenge records, retention of other assignments/Activities/Ideas, category-invalidating edit rejection without award loss, and existing persistence-failure/conflict/read-only behavior.
- [x] T010 [US2] Complete candidate-edit validation in `src/features/journey/JourneyContext.tsx` after the T005 writer-shape changes: validate before persistence/dispatch, reject category-invalidating assignment edits with a specific explanation, retain their drafts and saved data, never clear awards or rewrite Activity history, and preserve unrelated assignments, Idea/Activity links, and existing failure/conflict behavior (FR-011).
- [x] T011 [P] [US2] Add/update graph regressions in `api/src/lib/journeyGraph.test.ts` for a Waypoint-only update plan, no Challenge updates during Waypoint deletion, preserved Idea/Activity detachment and orphan pruning, and rejection of duplicate/dangling assignments and category-invalidating candidate edits.
- [x] T012 [US2] Simplify `JourneyGraphData`, `referenceIntegrityError`, `updatePlan`, and Waypoint `deletionPlan` in `api/src/lib/journeyGraph.ts` to remove Challenge-side membership maintenance/validation while retaining Waypoint assignment checks, category integrity, unrelated graph rules, and all existing linked-deletion semantics.
- [x] T013 [US2] Update transaction/API assertions in `api/src/lib/cosmos.test.ts` and `api/src/functions/journey.test.ts`, adjusting `api/src/lib/cosmos.ts` or `api/src/functions/journey.ts` only as needed, to prove Waypoint update/delete never writes a Challenge document, retains the existing Waypoint dataset response, rejects invalid candidate edits before writes, and preserves ETag conflicts and atomic rollback without partial data loss.
- [x] T014 [US2] Exercise existing assignment controls and error/draft retention in `src/pages/LocationDetails.test.tsx` against `src/pages/LocationDetails.tsx`, then add isolated assignment add/remove/cancel and multi-Challenge preservation coverage to `e2e/journey.spec.ts`; preserve existing roles/read-only rules, change the UI only if needed to surface the specific validation failure, and use no live datasets.

**Checkpoint**: US2 works through both context/full-replacement and individual API
mutation paths. Stored Activity awards are never automatically cleared to permit
an otherwise invalid assignment edit.

## Phase 5: User Story 3 - Reject Obsolete or Invalid Relationship Data (P1)

**Goal**: Enforce the breaking contract at every load/import/write/export boundary,
with explicit errors and no conversion or data repair.

**Independent test**: Attempt obsolete fields/versions, duplicate assignments, and
unknown Challenge IDs through each boundary; verify specific errors, no writes, and
unchanged saved records. Round-trip a valid version-2 backup.

- [x] T015 [US3] Complete browser dataset regression coverage in `src/domain/visit.test.ts` for "Zero, one, or many Challenge assignments are allowed", distinct/nonempty/existing IDs, valid empty datasets, and obsolete Challenge fields including empty lists; explicitly assert that no defaults, deduplication, unknown-reference dropping, or Activity-field reinterpretation repairs invalid input.
- [x] T016 [US3] Add dataset-level assignment-existence validation to `DataSchema` in `src/domain/visit.ts`, reusing existing domain checks where appropriate, so API response parsing, Demo initialization, imports, and test-only local loads reject invalid assignments rather than accepting partially valid data; preserve unrelated validation semantics.
- [x] T017 [US3] Update `src/services/storage.ts` and `src/services/storage.test.ts`: "Backup envelope becomes version 2, with the existing `exportedAt` and `data` fields. Version 1 is rejected, not converted"; test valid round trips and obsolete fields in a version-2 envelope, validate data before export, and reject obsolete test-only local data without deleting or rewriting browser records.
- [x] T018 [P] [US3] Update `api/src/lib/cosmos.ts` and `api/src/lib/cosmos.test.ts` to validate assembled datasets and assignment integrity before returning them; add regressions for obsolete Challenge document versions/fields, dangling/duplicate assignments, and valid version-3 Challenge loads; classify only expected stored relationship incompatibility with a narrowly typed error retaining its specific message, with no automatic rewrites or repair via clear.
- [x] T019 [US3] Handle the T018 expected stored relationship error in `api/src/functions/journey.ts` and test it in `api/src/functions/journey.test.ts` as HTTP 422 `{ "error": "<specific validation message>" }`; retain HTTP 400 for invalid client payloads, 403/409 behavior, and propagation/logging of unexpected exceptions; verify rejection precedes any write and messages identify the invalid field/version/link without exposing record contents.
- [x] T020 [US3] Complete import/replace/create/update validation regressions in `api/src/lib/journeySchema.test.ts` and `api/src/functions/journey.test.ts` for obsolete fields, duplicate/dangling assignments, no-write failures, and unchanged response shapes; ensure the existing validation paths in `api/src/lib/journeySchema.ts` and `api/src/functions/journey.ts` reject invalid client data with an actionable HTTP 400 error.
- [x] T021 [P] [US3] Add API-response and load-failure regressions in `src/services/journeyApi.test.ts` and `src/features/journey/JourneyContext.test.tsx`, changing `src/services/journeyApi.ts` or `src/features/journey/JourneyContext.tsx` only if needed: specific incompatibility messages survive, Production fails closed and blocks writes without substituting stale/demo data, and Demo Cosmos retains only the existing prominently warned read-only Demo local fallback.
- [x] T022 [US3] Add obsolete/version-1 backup rejection and valid version-2 import/export UI regressions in `src/pages/Settings.test.tsx` and `e2e/journey.spec.ts`, adjusting `src/pages/Settings.tsx` only if needed to retain the specific failure; verify existing empty-writable-dataset import restrictions and unchanged records after rejection using isolated/mocked data.

**Checkpoint**: No boundary silently strips the obsolete field, converts an old
version, drops invalid links, or reports rejected data as accepted.

## Phase 6: Documentation and final validation

- [x] T023 [P] Update `docs/data.md` and `docs/waypoints-model.md` for Waypoint-only Challenge assignments, derived Challenge members, category-history edit constraints, Challenge document version 3, and backup version 2 while retaining Idea/Activity relationship rules.
- [x] T024 [P] Update `docs/operations.md` to state that old Challenge records/backups are deliberately incompatible and require separately authorized correction, that normal load/import/clear is not a repair tool, and that this feature neither migrates hosted data nor authorizes deployment; preserve the existing Demo fallback/reseed explanation.
- [x] T025 [P] Align relationship conventions in `AGENTS.md` and any duplicated relationship-specific guidance in `.github/copilot-instructions.md`; add supersession links from `specs/004-challenge-progress/spec.md` and `specs/004-challenge-progress/evidence.md` to Feature013 without rewriting historical evidence or editing the unrelated untracked Feature004 planning additions.
- [x] T026 Trace final changed-file callers, configuration consumers, API build seed copying, and deployment impact from `src/domain/visit.ts`, `api/src/lib/journeySchema.ts`, `src/data/demo.json`, and `api/package.json`; finish any remaining affected authored fixture/consumer updates identified in T001, verify the `docs/UI_GUIDELINES.md` checklist if UI changed, and confirm no runtime path still stores Challenge membership lists.
- [x] T027 Format intended changed files and run the complete local CI sequence from `.github/workflows/ci.yml` once using `specs/013-challenge-waypoint-relationships/quickstart.md`: frontend lint/typecheck/format check/coverage/build/E2E and API lint/typecheck/coverage/build/host smoke; install dependencies or Chromium only when required, use the supported Linux/WSL environment for the current POSIX API build, and report exact failures without bypassing them or claiming Actions-only steps ran locally.
- [x] T028 Record actual validation results and any release/environment blockers in `specs/013-challenge-waypoint-relationships/quickstart.md` and mark only completed tasks in this `tasks.md`; distinguish local checks from hosted acceptance, keep live-data correction separately blocked, and do not commit/push/deploy without a new explicit request.

## Dependencies and execution order

```text
T001 -> T002
T001 + T002 -> T003 || T004
T003 + T004 -> T005
T005 -> T006 -> (T007 || T008)                    US1
T005 -> (T009 || T011)                            US2 tests
T006 + T009 -> T010                               US2 frontend
T011 -> T012 -> T013                              US2 API
T007 + T008 + T010 + T013 -> T014                  US2 flow
US1 + US2 -> T015 -> T016 -> (T017 || T018)        US3 boundaries
T018 -> T019 -> T020
T010 + T016 + T019 -> T021
T014 + T017 + T020 + T021 -> T022
US1 + US2 + US3 -> (T023 || T024 || T025)
T023 + T024 + T025 -> T026 -> T027 -> T028
```

The default phase order is Setup -> Foundation -> US1 -> US2 -> US3 -> Polish.
The graph explicitly permits ready, disjoint US2 regression work alongside US1;
otherwise follow the phase order. Never edit a shared file concurrently, even if
tasks belong to different stories. US3 follows US1/US2 because it verifies the
completed candidate-data and mutation contracts, not just the standalone schemas.

## Parallel execution examples

- **Foundation**: T003 browser schemas/tests and T004 API schemas/tests after the
  Demo membership audit; join before T005 fixture and frontend writer-shape updates.
- **US1**: After T006, T007 overview tests and T008 detail/map tests use disjoint
  files.
- **US2**: After T005, T009 context regressions and T011 API graph regressions
  can run together. Then the T010 frontend branch and T012 -> T013 API branch
  can proceed independently once T006/T009 and T011 respectively are done.
- **US3**: After T016, T017 backup code/tests and T018 Cosmos validation/tests can
  run together. T021 may run alongside T020 after T019, with disjoint files.
- **Polish**: T023 domain docs, T024 operations docs, and T025 conventions/baseline
  links are disjoint. Final impact review and CI are sequential.

## Requirement coverage

| Requirement     | Main tasks                                 |
| --------------- | ------------------------------------------ |
| FR-001 / FR-002 | T003-T008, T012                            |
| FR-003          | T006-T008, T014                            |
| FR-004 / FR-005 | T009-T014                                  |
| FR-006          | T003-T004, T011-T012, T015-T016, T018-T020 |
| FR-007 / FR-008 | T003-T005, T015-T022                       |
| FR-009          | T009-T014, T018-T022                       |
| FR-010          | T006-T008, T013-T014, T019-T022            |
| FR-011          | T009-T014                                  |
| SC-001 / SC-002 | T006-T008, T014                            |
| SC-003          | T009-T014                                  |
| SC-004 / SC-005 | T015-T022                                  |

## Implementation strategy

1. Finish the shared schema/fixture and frontend writer-shape work without adding
   compatibility shims.
2. Use **US1 as the smallest demonstrable increment**: correct membership and
   derived views on canonical data. This is not a deployable partial release.
3. Complete US2 edits/deletion, preserving history and transaction behavior.
4. Complete US3 boundary enforcement, backup/version rejection, and failure UX.
5. Update guidance, trace all impacted surfaces, and run final CI once.

All three stories are required for release: shipping the schema/helper change
without matching writers and obsolete-data rejection would be incomplete.
Deployment and correction of existing hosted data remain separately authorized
work, not implied follow-ups to task completion.
