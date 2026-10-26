---
description: 'Implementation tasks for Challenge award levels and statistics'
---

# Tasks: Clear Challenge Award Levels and Statistics

**Input**: [plan.md](./plan.md), [spec.md](./spec.md),
[research.md](./research.md), [data-model.md](./data-model.md),
[API contract](./contracts/journey-awards.md), [UI contract](./contracts/awards-ui.md),
and [quickstart.md](./quickstart.md).

**Branch**: `017-challenge-award-levels`.

**Organization**: P1 stories US1, US2, and US5 precede P2 stories US3 and US4.
Story numbers retain their identity from the specification, not phase order.

**Tests**: Extend existing tests alongside their implementation as required by
the plan and contracts. No separate test-first workflow was requested. Targeted
tests may provide implementation feedback; formatting, static checks, builds,
coverage, and E2E execution belong to final validation, not every task.

## Format and Execution Rules

- Each checkbox uses `Tnnn`, optional `[P]`, and `[USn]` for story tasks.
- Paths below are repository-relative. New files are identified explicitly.
- `[P]` means disjoint-file work can run concurrently once its listed
  prerequisites are complete. It does not mean ignore prerequisites.
- Use the dependency table, not list order, to determine readiness.
- Shared-file work across stories is serialized; parallel examples below are
  the safe batches, not permission to edit the same file simultaneously.
- Preserve existing unrelated work and feature 016's separate navigation scope.
- No migrations, live-data correction, new dependencies/services, retry layers,
  automatic awards, deployment, push, or commit are authorized by this task list.

## Phase 1: Setup

**Purpose**: Confirm the existing project can be worked on without scaffolding
or installing unnecessary tools.

- [x] T001 Confirm branch, design inputs, Node.js 24/package-tool availability, and the existing root/API dependencies against `specs/017-challenge-award-levels/quickstart.md` and `.github/workflows/ci.yml`; record exact environmental blockers in the guide, preserve unrelated changes, and install dependencies only after a missing-dependency failure or changed manifest.

**Setup verified (2026-10-25)**: The existing Ubuntu WSL environment provides
Node.js 24.22.0, npm 11.19.1, and resolving root/API dependencies. Windows
PowerShell was the wrong environment for the earlier checks; no installation
was needed. See [setup evidence](./quickstart.md#verified-implementation-setup).
Implementation and affected-surface checks are complete. Checked tasks below have
focused/API/browser evidence; T041 remains blocked at the cross-cutting validation
gate documented in the quickstart.

## Phase 2: Foundational Contracts

**Purpose**: Establish the common schema, validation, fixtures, and atomic write
boundary before implementing user-facing stories.

- [x] T002 Extend `ChallengeSchema` and inferred types in `src/domain/visit.ts`, with cases in `src/domain/visit.test.ts`: `awardDescriptions` is an "Object with exactly `bronze`, `silver`, `gold` string keys", "Required when awards enabled; absent when disabled"; each value is a "Trimmed nonblank string", "User supplied, not inferred"; reject partial, unknown-key, blank, or disabled-but-present objects without defaults.
- [x] T003 [P] Mirror T002's exact description constraints in `api/src/lib/journeySchema.ts` and `api/src/lib/journeySchema.test.ts`; set Challenge document `schemaVersion` to 4 replacing 3, retain Activity version 5 and all other versions, and reject older Challenge versions without migration or a compatibility reader.
- [x] T004 Update fictional enabled Challenges and consistent Activity awards in `src/data/demo.json` and `src/test/demoData.ts`; reuse them where appropriate for ordinary, shared-enabled, repeated Bronze/Gold/Bronze, unvisited, and empty cases, and update inline fixtures alongside each owning task rather than introduce a second Demo dataset or live-data repair.
- [x] T005 Add reusable enabled-membership resolution and complete Activity award validation to `src/domain/visit.ts`, covering `DataSchema`, API load consumers, and `src/services/storage.ts` with `src/domain/visit.test.ts` and `src/services/storage.test.ts`: an eligible linked Activity requires "Exactly one fixed level"; no/ineligible Waypoint permits "Absent only"; missing references fail, Waypoint membership IDs "remain distinct and must resolve", and `Activity.challengeId` never owns the award; test rejection of enabling or enabled-membership changes that leave retained Activities unawarded, identifying their IDs without backfill.
- [x] T006 [P] Enforce the same required-versus-forbidden award rule in `api/src/lib/journeyGraph.ts`, `api/src/lib/journeyGraph.test.ts`, and load/import/replace consumers in `api/src/functions/journey.ts`; validate complete prospective graphs, preserve existing title/UK-date/location/reference rules, and identify offending Activity/Waypoint IDs without partial writes, including enabling or enabled-membership changes that leave retained Activities unawarded.
- [x] T007 Reuse complete-snapshot `replaceDataset` transactions for award-sensitive raw create/update/delete paths in `api/src/functions/journey.ts` and `api/src/lib/cosmos.ts`, with tests in `api/src/functions/journey.test.ts` and `api/src/lib/cosmos.test.ts`; retain target `ifMatch`, caller snapshot ETags, retained-document ETag guards, existing response envelopes, and the one-partition 100-operation limit, with explicit conflict/oversize failure and no retries or chunking.

**Checkpoint**: Ordinary and enabled fixtures validate through both boundaries.
All award-sensitive writers, including Activity creation, use the same atomic
snapshot protection. No story may bypass these rules.

## Phase 3: US1 - Explain and Record the Visit Level (P1, Functional MVP)

**Goal**: Configure the three explanations, show their named Challenge context,
and require one deliberately chosen level only for eligible Activities.

**Independent test**: Create ordinary and enabled Challenges; record and edit
Activities through ordinary, single-enabled, and shared-enabled Waypoints.
Reject missing eligible tiers and supplied ineligible tiers. Change explanations
after recording and verify Activity levels remain unchanged.

- [x] T008 [P] [US1] Create reusable typed award configuration fields in `src/components/ChallengeAwardFields.tsx` and `src/components/ChallengeAwardFields.test.tsx`; default disabled, require all three explanations only when enabled, omit persisted descriptions when disabled, and use existing labelled MUI fields, error associations, and draft-preserving interaction.
- [x] T009 [P] [US1] Extend Challenge creation and add `updateChallengeAwards` in `src/features/journey/JourneyContext.tsx` with `src/features/journey/JourneyContext.test.tsx`; persist explanations through existing mutation tracking/ETags, preserve unrelated Challenge route/location fields, allow current-guidance edits after Activities exist, and validate candidates without changing recorded levels.
- [x] T010 [US1] Integrate T008/T009 into `src/pages/Dashboard.tsx` and `src/pages/Dashboard.test.tsx`; ordinary Challenges default to disabled, enabled submission requires three user-written explanations, and expected input/conflict failures retain specific messages and entered content.
- [x] T011 [P] [US1] Show current named definitions to readers and add the compact admin-only award-settings editor in `src/pages/ChallengeDetails.tsx` and `src/pages/ChallengeDetails.test.tsx`; preserve route controls, read-only notices, unsaved/pending protection, and successful explanation edits without historical snapshots; when enabling would leave retained Activities unawarded, identify the blocking Activities, explain that the action cannot convert history, preserve the draft, and do not suggest assigning tiers while ineligible.
- [x] T012 [P] [US1] Update eligible recording in `src/components/ActivityEditor.tsx` and `src/components/ActivityEditor.test.tsx` to show every named enabled Challenge's explanations and require one Bronze/Silver/Gold choice shared by all; new Activity drafts start without a tier selected, same-Waypoint edits preserve the recorded tier through unrelated field edits and saves, and a changed eligible destination requires a deliberate choice; hide the selector when ineligible and explain that awards do not determine completion while preserving existing entry/save flows.
- [x] T013 [US1] Add selected-Waypoint context validation before applying JSON in `src/domain/draftJsonImport.ts` and `src/components/ActivityEditor.tsx`, updating `src/domain/draftJsonImport.test.ts`, `src/components/ActivityEditor.test.tsx`, `src/domain/aiPrompts.ts`, and `src/domain/aiPrompts.test.ts`; reject missing/ineligible tiers before replacing the draft, preserve existing values on rejection, and keep relationship IDs out of the JSON shape.
- [x] T014 [US1] Create `e2e/challenge-awards.spec.ts` with isolated intercepted Journey fixtures covering US1 creation, required/forbidden tiers, shared definitions, JSON application, and editable guidance at 360x800 and 1280x800; include Activities, Waypoint, Idea-origin, and edit entry points without remote data access; assert that new drafts have no tier selected, an unrelated same-Waypoint edit preserves Gold, and blocked enabling over unawarded history identifies Activities, explains the conversion limitation, preserves the draft, and submits zero writes.

**Checkpoint**: US1 is demonstrable with safe local fixtures. This is a functional
MVP, not permission to deploy before the P1 history-protection story is complete.

## Phase 4: US2 - Highest Achievement and Individual Visits (P1)

**Goal**: Preserve the maximum recorded level and clearly distinguish it from
each visit's level, date, and independent completion.

**Independent test**: Bronze, Gold, Bronze yields Gold on Waypoint/member
summaries and three unchanged Activity levels. Changing/deleting/reassigning
the sole Gold recalculates both affected Waypoints; Gold at 1 of 3 Activities
does not imply completion.

- [x] T015 [US2] Preserve the maximum calculation and add shared, correctly scoped highest-award labels in `src/domain/visit.ts` and `src/domain/visit.test.ts`; use fixed Bronze < Silver < Gold over currently linked Activities, retain uncapped independent once/count completion, show "No award recorded" only when eligible, and retain internal sentinels without leaking award "Not Started" wording.
- [x] T016 [US2] Wire labelled highest awards into `src/pages/Locations.tsx`, `src/pages/LocationDetails.tsx`, and `src/pages/ChallengeDetails.tsx` with their colocated tests; ordinary Challenge members show no awards even when eligible elsewhere, global eligible Waypoints explain their enabled context, and completion remains separately labelled.
- [x] T017 [P] [US2] Label each visit's own level as recorded, not highest, in `src/pages/Activities.tsx` and `src/pages/ActivityDetails.tsx` and their colocated tests; preserve Activity navigation, dates, evidence, editing/deletion feedback, and absence of award indicators on ordinary records.
- [x] T018 [US2] Update Recently visited in `src/pages/Dashboard.tsx` and `src/pages/Dashboard.test.tsx` to separate completion, highest award, and explicitly labelled latest-visit date; extend `e2e/challenge-awards.spec.ts` with repeated-visit, sole-highest edit/delete/reassignment, and incomplete-count cases from US2.

## Phase 5: US5 - Correct Records without Accidental Award Loss (P1)

**Goal**: Make corrections deliberate, block actual loss of eligibility, and
allow valid shared-Challenge removal without erasing recorded levels.

**Independent test**: Block awarded Waypoint deletion and loss of the last
enabled membership with no writes; permit removing/disabling/deleting one of
several eligible Challenges. Test deliberate Activity correction, cancellation,
failed save, and a concurrent new Activity versus Challenge disabling/deletion.

- [x] T019 [US5] Add frontend structural-transition checks in `src/domain/visit.ts` and `src/domain/visit.test.ts`; compare original/candidate graphs, identify awarded Activities invalidated by Waypoint deletion or last-eligibility removal, reject replacement that disguises structural loss by simultaneously stripping categories from retained Activities, and permit deliberate separate Activity corrections.
- [x] T020 [P] [US5] Extend deletion/update/transition planning in `api/src/lib/journeyGraph.ts` and `api/src/lib/journeyGraph.test.ts`; block awarded Waypoint deletion, allow Challenge removal/disabling only when every affected award remains eligible, detach deleted Challenge IDs from Waypoints and direct `Activity.challengeId` links atomically, preserve all categories, and retain non-awarded detachment/orphan pruning.
- [x] T021 [US5] Integrate T020 with raw and full-replace handlers in `api/src/functions/journey.ts`, `api/src/lib/cosmos.ts`, and their tests; enforce original-to-candidate checks before writes, preserve expected 400/403/409 behavior, and prove concurrent awarded Activity creation versus disabling/deletion cannot both commit incompatible graphs or partially detach records.
- [x] T022 [US5] Apply T019/T020 semantics to reducer and mutation paths in `src/features/journey/JourneyContext.tsx` and `src/features/journey/JourneyContext.test.tsx`, adding `deleteChallenge` through `src/services/journeyApi.ts`; remove implicit category stripping, preserve local-test/API behavior parity, use existing tracked writes/reload, and keep explicit whole-dataset Clear separate from relationship repair.
- [x] T023 [US5] Replace the automatic category-clearing effect in `src/components/ActivityEditor.tsx` and `src/components/ActivityEditor.test.tsx`; explain and acknowledge removal before saving an ineligible/no-Waypoint destination, require deliberate tier selection for a changed eligible destination, and preserve original records/drafts on cancellation or failure without bypassing pending-save guards.
- [x] T024 [P] [US5] Add minimal confirmed Challenge deletion and specific blocked-disabling/deletion feedback in `src/pages/ChallengeDetails.tsx`, and awarded-Waypoint deletion feedback in `src/pages/LocationDetails.tsx`, with their tests; explain membership/direct-link consequences, identify Activities needing handling, preserve failed drafts, and expose no viewer mutations.
- [x] T025 [US5] Extend `e2e/challenge-awards.spec.ts` with valid shared-Challenge removal, last-eligibility/awarded-Waypoint blocking, deliberate destination correction, cancelled/failed saves, and unchanged records at both viewport sizes; assert request counts and zero writes for frontend-blocked operations, while server conflicts remain covered by T021's backend tests.

## Phase 6: US3 - Challenge Totals and Drill-Downs (P2)

**Goal**: Present exact-tier Waypoint and Activity distributions with matching,
scoped record lists and no duplication from shared memberships.

**Independent test**: For one member with Bronze/Gold/Bronze and one with Silver,
highest-Waypoint buckets are 0/1/1 and Activity buckets are 2/1/1. An additional
unvisited member adds one no-award Waypoint, not an Activity. Every drill-down
returns exactly its labelled count.

- [x] T026 [US3] Add typed scoped record groups, derived counts, and validated filter predicates in `src/domain/visit.ts` and `src/domain/visit.test.ts`; return distinct current member Waypoints and linked Activities, use exact-tier rather than cumulative buckets, include no-award/empty states, and deduplicate global eligible records by ID rather than sum memberships.
- [x] T027 [P] [US3] Extend `src/pages/Locations.tsx` and `src/pages/Locations.test.tsx` with validated `challenge` plus existing `status` scope from `specs/017-challenge-award-levels/contracts/awards-ui.md`; filter exact highest tiers and eligible `not-started` records, label the current unit/scope, link back to Challenge Statistics, retain filter URLs, and distinguish invalid scope from valid empty results.
- [x] T028 [P] [US3] Extend `src/pages/Activities.tsx` and its colocated tests with validated `challenge` and `award=bronze|silver|gold` filters using T026's same grouped records; expose matching recorded-visit results, active scope, navigable records, and return links while preserving editor/Idea parameters and failure/empty states.
- [x] T029 [US3] Add the Statistics section and matching accessible drill-down links to `src/pages/ChallengeDetails.tsx` and `src/pages/ChallengeDetails.test.tsx`; ordinary Challenges keep completion/member/Activity totals, enabled Challenges additionally show both distributions and no-award members, and zero counts remain explicit with no single invented overall trophy.
- [x] T030 [P] [US3] Replace Dashboard's mislabelled global category rollup in `src/pages/Dashboard.tsx` and `src/pages/Dashboard.test.tsx` with correctly named eligible Waypoint/Activity award totals and matching list links from T026; globally deduplicate shared memberships and hide award distributions in ordinary-only datasets.
- [x] T031 [US3] Extend `e2e/challenge-awards.spec.ts` with the acceptance fixture from `specs/017-challenge-award-levels/quickstart.md`; assert all displayed totals against exact drill-down records, zero/no-award/empty buckets, ordinary shared members, global deduplication, and scoped return navigation at both viewport sizes.

## Phase 7: US4 - Ordinary Browsing without Award Clutter (P2)

**Goal**: Make award applicability and wording consistent across every existing
surface, including Map and Settings, without changing completion semantics.

**Independent test**: Browse ordinary-only and mixed datasets at both viewport
sizes as admin, viewer, and Demo-local reader. Ordinary contexts show no award
chips/distributions/filter/sort controls; eligible contexts remain informative.
Viewer/Demo-local browsing produces no mutation controls or writes.

- [x] T032 [US4] Hide inapplicable award filtering/sorting and finish highest-versus-completion terminology in `src/pages/Locations.tsx` and `src/pages/Locations.test.tsx`; determine applicability from the selected dataset or Challenge scope before list filters and pagination, test that zero-match award filters alone or combined with other list filters retain controls/active state and can be cleared to restore records, preserve free-text Waypoint categories and all unrelated search/area/date behavior, and do not turn invalid filter input into a successful unfiltered list.
- [x] T033 [P] [US4] Update `src/pages/MapPage.tsx` and its colocated tests so eligible Waypoint metadata uses highest-award wording, Activity popups use recorded levels, and ineligible contexts omit empty award/medal/category labels and controls; preserve existing map completion icons, filtering, routes, and protected Maps boundary.
- [x] T034 [P] [US4] Replace universal award-status rules in `src/pages/Settings.tsx` and `src/pages/Settings.test.tsx` with accurate conditional mandatory/shared/highest-award guidance; ordinary-only data exposes no inapplicable tier-status UI, and completion/Waypoint category terminology remains distinct.
- [x] T035 [US4] Finish the applicability audit in `src/pages/Dashboard.tsx`, `src/pages/ChallengeDetails.tsx`, `src/pages/LocationDetails.tsx`, `src/pages/Activities.tsx`, and `src/pages/ActivityDetails.tsx` with their tests; remove remaining award "Not Started", "Activity categories", and empty "Uncategorised" wording, preserve read-only notices, and verify ordinary Challenges stay award-free even with shared eligible members.
- [x] T036 [US4] Extend `e2e/challenge-awards.spec.ts` with ordinary-only, mixed, viewer, and Demo-local browsing across Dashboard, Waypoints, Challenges, Activities, Map, and Settings at 360x800/1280x800; use isolated mocks for external boundaries, assert no award clutter where inapplicable and zero reader write requests, verify that zero-match award filters retain controls and can be cleared to restore records, and make no hosted-authorization claim.

## Phase 8: Documentation and Cross-Cutting Validation

**Purpose**: Complete all direct consumers and verify the finished feature once
with the checks required for this cross-cutting implementation.

- [x] T037 [P] Update `docs/data.md`, `docs/waypoints-model.md`, `docs/pages/dashboard.md`, `docs/pages/locations.md`, `docs/pages/visits.md`, `docs/pages/settings.md`, and `docs/operations.md` for fixed explanations, shared mandatory levels, highest versus individual statistics, protected maintenance, and schema-version-4 incompatibility; do not document a migration, automatic repair, or executed deployment.
- [x] T038 [P] Update seed/build and host-smoke fixture expectations in `api/src/lib/cosmos.test.ts`, `api/src/lib/journeySchema.test.ts`, and `api/smoke/host.test.ts` as actually affected by the new shape; verify `api/package.json` still copies `src/data/demo.json` as the single Demo source and keep malformed seed data an explicit failure without infra or package changes unless required.
- [x] T039 [P] Update remaining inline fictional fixtures and affected navigation regressions in `src/app/App.test.tsx`, `src/services/storage.test.ts`, `e2e/activity-recording.spec.ts`, and `e2e/journey.spec.ts`; preserve backup envelope version 2, mandatory title/UK-date rules, explicit incompatible-import failures, existing entry destinations, and the separate feature 016 return-path contract.
- [x] T040 Apply the self-review checklist in `docs/UI_GUIDELINES.md` to changed views and `e2e/challenge-awards.spec.ts`; verify long explanations, keyboard focus, associated errors, reader access, and no clipped/overlapping/horizontally scrolling content at both specified viewports, fixing only feature-caused failures.
- [ ] T041 Format intended changed files and execute the complete local CI sequence documented in `.github/workflows/ci.yml` and `specs/017-challenge-award-levels/quickstart.md` once after implementation: root lint/typecheck/format check/coverage/build/E2E, API lint/typecheck/coverage/build/Functions host smoke; stop and report exact failures, install only missing required dependencies/browsers, and do not simulate GitHub artifact/auth/deployment steps.
- [x] T042 Review the final intended diff against `specs/017-challenge-award-levels/spec.md`, both contracts, and the requirement map below; record actual evidence and remaining environment/hosted blockers in `specs/017-challenge-award-levels/quickstart.md`, run documentation diagnostics on that update, and report completion without committing, pushing, deploying, migrating, or claiming unexecuted checks.

## Dependencies and Execution Order

### Phase and Story Graph

```text
Setup -> Foundation
Foundation -> US1, US2, US5, US3, US4
US1 -> US2 -> US5 -> US3 -> US4   (shared-file integration order)
All stories -> documentation/fixture closure -> UI review -> final CI -> evidence
```

Foundation supplies the actual shared behavioral prerequisites. The story chain
is also required to serialize integration into the same pages, context, domain,
and E2E files. It is not a claim that highest-award behavior conceptually depends
on award configuration or that ordinary browsing needs statistics to be useful.
Each story has its own acceptance fixture and independent test above.

### Explicit Task Prerequisites

Every task has only the prerequisites listed here; transitive dependencies need
not be repeated. Earlier-phase/story completion gates are explicit.

| Task(s)          | Prerequisites    |
| ---------------- | ---------------- |
| T001             | None             |
| T002, T003       | T001             |
| T004             | T002, T003       |
| T005, T006       | T004             |
| T007             | T006             |
| T008, T009       | T005, T007       |
| T010, T011, T012 | T008, T009       |
| T013             | T012             |
| T014             | T010, T011, T013 |
| T015             | T014             |
| T016, T017       | T015             |
| T018             | T016, T017       |
| T019, T020       | T018             |
| T021             | T020             |
| T022             | T019, T021       |
| T023, T024       | T022             |
| T025             | T023, T024       |
| T026             | T025             |
| T027, T028       | T026             |
| T029, T030       | T027, T028       |
| T031             | T029, T030       |
| T032, T033, T034 | T031             |
| T035             | T032, T033, T034 |
| T036             | T035             |
| T037, T038, T039 | T036             |
| T040             | T037, T038, T039 |
| T041             | T040             |
| T042             | T041             |

T006 and T007 are ordered because they share the API handler. T005 may run
alongside the backend work; both frontend validation and the backend transaction
boundary must be complete before US1 begins.

### Safe Parallel Examples

| Scope      | Ready parallel batch                 | Why safe                                                            |
| ---------- | ------------------------------------ | ------------------------------------------------------------------- |
| Foundation | T002 + T003 after T001               | Frontend versus API schema/test files                               |
| Foundation | T005 + T006 after T004               | Frontend validation versus API graph files                          |
| US1        | T008 + T009; then T010 + T011 + T012 | Shared fields/context first, then separate page/editor integrations |
| US2        | T016 + T017 after T015               | Waypoint/Challenge summaries versus Activity surfaces               |
| US5        | T019 + T020; then T023 + T024        | Frontend/API transition rules, then editor versus detail-page UI    |
| US3        | T027 + T028; then T029 + T030        | Separate list pages, then Challenge versus Dashboard                |
| US4        | T032 + T033 + T034 after T031        | Waypoints, Map, and Settings own separate files                     |
| Closure    | T037 + T038 + T039 after T036        | Guidance, API fixtures, and frontend/E2E legacy fixtures            |

Tests in a parallel batch must not edit a shared fixture file at the same time.
T004 owns shared fixture changes; later tasks amend local scenarios or wait for
that file's owner. E2E additions to `e2e/challenge-awards.spec.ts` are sequential.

## Requirements and Acceptance Coverage

| Requirement(s)         | Primary tasks                         |
| ---------------------- | ------------------------------------- |
| FR-001, FR-002         | T002-T004, T008-T013                  |
| FR-003, FR-004         | T005-T007, T012-T014                  |
| FR-005, FR-006, FR-007 | T015-T018                             |
| FR-008, FR-009, FR-010 | T026-T031                             |
| FR-011                 | T016-T018, T030, T032-T036            |
| FR-012, FR-013         | T019-T025                             |
| FR-014                 | T015, T018, T026                      |
| FR-015, FR-016         | T011-T014, T024-T025, T031-T036, T040 |
| FR-017                 | T013, T034, T037                      |
| SC-001                 | T002-T014                             |
| SC-002, SC-008         | T015-T018, T025-T026                  |
| SC-003, SC-004         | T026-T031, T035-T036                  |
| SC-005                 | T019-T025                             |
| SC-006                 | T032-T036                             |
| SC-007                 | T014, T025, T031, T036, T040-T041     |

All acceptance coverage remains planned until execution. A failed or blocked
check is not a completed task merely because its test code exists.

## Implementation Strategy

1. Complete Setup/Foundation and US1 for the smallest local demonstration of
   configuration, shared explanations, and correct required recording.
2. Complete the other P1 increments, US2 then US5, before treating the feature as
   safe for release. Keep current-guidance edits permitted and protect actual
   stored awards rather than freezing explanation wording.
3. Add US3 statistics/drill-downs, then finish US4's full-surface applicability
   and role review. Do not ship a partial two-page terminology fix.
4. Close fixtures/docs, review UI, and run the full cross-cutting validation
   once. Re-run a successful check only when its covered files subsequently
   change. Existing unavailable Node/browser tooling is a blocker to report,
   not a reason to claim validation or add a workaround.
5. Continue on the same feature branch. No production record changes, schema
   migration, commit, push, or deployment follows automatically.
