---
description: 'Implementation tasks for Activity-history search'
---

# Tasks: Search Activity History

**Input**: [spec.md](./spec.md), [plan.md](./plan.md),
[research.md](./research.md), [data-model.md](./data-model.md),
[UI contract](./contracts/ui-contract.md) and [quickstart.md](./quickstart.md).

**Branch**: `021-activity-history-search`

**Tests**: Required by the specification and design. Write new tests before their
corresponding implementation and establish feature-specific failure where the
runner permits it. Distinguish missing feature code from worker-startup failures;
an environmental failure does not prove an acceptance assertion ran.

**Organization**: Three independently verifiable user-story increments, with
shared test preparation and explicit file-order dependencies. All 20 tasks are
complete; executed evidence and limitations are recorded in [quickstart.md](./quickstart.md).

## Format and Path Conventions

- Task format: `- [ ] TNNN [P?] [USn?] Description with exact file paths`.
- Paths are repository-relative. Tests remain beside their source or in `e2e`.
- `[P]` means the task can run with a listed peer after its prerequisites finish.
  It does not authorize simultaneous edits to the same file.
- Do not add dependencies, infrastructure, providers, routes, schemas, caches or
  migrations. Use existing tools; install only after a missing-dependency failure.
- Do not fix #174 here, access real records, commit, push or deploy without a
  separate explicit request.

## Phase 1: Setup

**Purpose**: Confirm the existing boundaries rather than scaffold a new project.

- [x] T001 Confirm the clarified scope and current integration/test conventions in `specs\021-activity-history-search\spec.md`, `src\pages\Activities.tsx`, `src\domain\visit.ts`, `src\features\journey\JourneyContext.tsx`, `src\test\DataMemoryRouter.tsx`, `package.json` and `docs\UI_GUIDELINES.md`; preserve existing APIs, dataset guards and editor handlers, and keep #174 separate.

## Phase 2: Foundational Test Preparation

**Purpose**: Prepare reusable local harnesses before story-specific work.

- [x] T002 [P] Create the isolated browser fixture/harness in `e2e\activity-history-search.spec.ts`: 30 schema-valid fictional Activities, ordinary/award-enabled scopes, matching outside records, duplicate titles, notes beyond character 140, displayed postcode/coordinate locations, independent Activities, current Waypoints, multiple Ideas, ordered references/photos and a track; reuse existing per-context interception for roles, read/write counters, held operations, conflicts and explicit failures, within existing dataset limits and without real external evidence.
- [x] T003 [P] Extend `src\pages\Activities.test.tsx` with a real routed history/detail/other-page harness using `src\test\DataMemoryRouter.tsx` and the existing provider; support loaded-record replacement/reload, selected/effective mode transitions, guarded switches and write/load spies without introducing application infrastructure or changing existing test semantics.

**Checkpoint**: Both harnesses are ready. No new application behavior is implemented.

## Phase 3: US1 - Find a Remembered Experience (Priority: P1, MVP)

**Goal**: Find exact saved Activities by all supported fields while keeping scope,
chronology, record identity and existing card content.

**Independent Test**: Search title, full notes, displayed location and current
Waypoint title in ordinary/Challenge/recorded-award histories. Require every word,
compare exact IDs/order, and open both duplicate-title results.

### Tests

- [x] T004 [P] [US1] Add pure contract tests in `src\domain\activityHistory.test.ts` for empty/whitespace queries, mixed case, all-word matches across fields in either order, repeated/partial words, literal punctuation, notes beyond the displayed excerpt, formatted postcode/five-decimal locations, absent Waypoint links, excluded Idea/evidence/date/award/hidden-metadata text, unchanged input collections and preserved result object identity/order.
- [x] T005 [P] [US1] Add US1 page tests in `src\pages\Activities.test.tsx` for the labelled search control, no-submit updates, exact matching IDs, outside-scope exclusions for Challenge and each applicable recorded award, unchanged date/updated-time ordering, ordinary award applicability, independent Activities and retained card/Waypoint-link summaries; prove typing performs no writes, extra loads or dirty-draft registration.
- [x] T006 [P] [US1] Add US1 browser cases in `e2e\activity-history-search.spec.ts` for four-field and cross-field all-word lookup, reversed words, outside-scope exclusion, duplicate-title href/detail identity, independent records, native Waypoint links and unchanged detail breadcrumbs; use the foundational fixture, not real data or downloaded evidence.

### Implementation

- [x] T007 [US1] Implement `filterActivityHistory(records, waypointById, query)` in `src\domain\activityHistory.ts` with typed readonly Activity/map inputs; enforce "Use currently loaded, already validated saved records, never unsaved drafts" and "Resolve the optional Activity link by ID; no link contributes no title"; trim/lowercase/split whitespace, require every token within one Activity's supported fields, reuse `activityTitle`/`locationSummary`, search full notes, and preserve input order/entity identity without mutations, entity copies, new schemas or excluded-field matching.
- [x] T008 [US1] Wire the helper and compact labelled search into `src\pages\Activities.tsx` using the existing scoped records, Waypoint map, chronology comparator and shared FilterBar/applicable Recorded award selector; store string `query` under the constraint "Raw input for the mounted history visit only"; derive results synchronously without submission/debounce/requests, preserve real links, cards, alerts and editor handlers, and do not store query in URLs, history, browser storage or provider registries.

**Checkpoint**: US1 is a verifiable search MVP. This is an incremental review point,
not permission to publish the incomplete feature or skip the remaining safeguards.

## Phase 4: US2 - Recover Without Losing Scope (Priority: P2)

**Goal**: Recover from no matches in one action and distinguish query filtering
from empty data, empty scope, loading or failure.

**Independent Test**: Search an absent term in a nonempty scoped group, clear by
keyboard and verify focused empty input plus the exact original scoped IDs/order.
Exercise every state in the UI contract independently.

### Tests

- [x] T009 [P] [US2] Add US2 tests in `src\pages\Activities.test.tsx` for query-specific feedback, exactly one Clear search action in nonblank-query states, query-only clearing/input focus, unchanged scope parameters, empty versus whitespace queries, award-change query retention, and distinct empty dataset/empty scope/no-match/loading/invalid-scope/failed-load precedence; exercise specific Production failure with `MODE=production`, not browser test-mode storage.
- [x] T010 [P] [US2] Add US2 browser cases in `e2e\activity-history-search.spec.ts` for keyboard clear from matching and no-match states, exact scoped recovery, whitespace equivalence, retained query through recorded-award changes, and separate empty/scope/error/held-load feedback; do not present an intercepted Demo failure as Production-load proof.

### Implementation

- [x] T011 [US2] Implement recovery and precedence in `src\pages\Activities.tsx` using separate dataset/unsearched-scope/searched counts: existing failures/loading/invalid scope first, then `No activities logged yet.`, `No activities in this scope.`, or query-specific no-match text from the UI contract; use EmptyState.action for no-match Clear search and input end-adornment otherwise, with one shared query-only handler and real input ref, preserving URL scope and avoiding duplicate actions, catches, stale-result fallbacks or focus stealing.

**Checkpoint**: Search and recovery work as separate verified journeys. Ordinary,
award and zero-record scopes remain truthful.

## Phase 5: US3 - Inspect Current Evidence Without Changing Records (Priority: P2)

**Goal**: Preserve current-record truth, query lifetime, read-only browsing,
existing save/evidence flows, keyboard use and compact layout.

**Independent Test**: As admin/viewer at both sizes, search and inspect records,
revisit after supported saves/deletes, and verify reset/retention transitions,
evidence, permissions, focus, actual wrapping and the one-second threshold.

### Tests

- [x] T012 [P] [US3] Add US3 routed tests in `src\pages\Activities.test.tsx` for departure and Back/Forward reset, same-route Add/Cancel/ordinary-save retention, Idea-origin save navigation, accepted selected-mode reset, declined/pending-blocked retention, effective fallback/recovery irreversible reset, same-mode reload/superseded-response retention, current Activity/Waypoint-title edits and deletion, and failed drafts never becoming persisted matches; preserve success/error messages and mounted editors, using coordinates/resolved saves rather than claiming #174 is fixed.
- [x] T013 [P] [US3] Add US3 browser cases in `e2e\activity-history-search.spec.ts` for genuine departure/Back/Forward/refresh reset, own-query continuations, selected/effective mode transitions, current saved edits/deletes/failures, admin/viewer plus Demo local/warned fallback, zero query-driven writes/loads/evidence requests, and preserved multiple-Idea/reference/photo order, no/several/broken-photo gallery behavior and recorded-track links using intercepted fictional resources.
- [x] T014 [US3] Extend `e2e\activity-history-search.spec.ts` with admin/viewer keyboard and actual layout cases at 360 by 800 and 1280 by 800: visible input/clear/link focus, first desktop browsing result above 800px, page and internal title/subtitle/notes/feedback width assertions, long unbroken fixtures and four review screenshots; measure final input event to correct result IDs/feedback using the same browser monotonic clock and assert at most 1,000 ms for matching/no-match/clear with 30 loaded Activities, not a proxy assertion timeout.

### Implementation

- [x] T015 [US3] Complete local query lifetime in `src\pages\Activities.tsx` by pairing query with `activeDataMode` under the constraint "Effective mode associated with query; detects dataset changes"; use guarded render-time adjustment and an empty effective query on mismatch, permanently replacing the old pair without remounting editors or modifying provider keys; rely on real route unmount/refresh and existing selected-mode remount, retain same-route award/Add/Cancel/save and same-mode reload query, and preserve declined/blocked/superseded outcomes without Router-entry keys or discovery state.
- [x] T016 [US3] Apply the minimum theme-consistent wrapping/layout refinements in `src\pages\Activities.tsx` to actual card and feedback content so long results/query text do not overflow or clip at either size; preserve shared component contracts, notices, evidence summaries, native links and editor behavior, with no hidden overflow, shortened fixtures, arbitrary widths or automatic result focus.

**Checkpoint**: All three journeys satisfy the complete specification. Saved versus
draft data, dataset transitions and evidence/access boundaries remain intact.

## Phase 6: Polish and Validation

- [x] T017 [P] Update the existing Activity-list section in `docs\pages\visits.md` with searchable fields/all-word semantics, scope preservation, query-only clear/focus, empty/error distinctions, reset-on-departure/refresh/dataset behavior and read-only browsing; keep #174 explicitly separate and do not rename or duplicate the guide.
- [x] T018 [P] Trace changed-file impacts through `src\domain\activityHistory.ts`, `src\pages\Activities.tsx`, `src\app\App.tsx`, existing provider/service consumers, `package.json` and `playwright.config.ts`, recording the bounded validation selection in `specs\021-activity-history-search\quickstart.md`; confirm no API/schema/dependency/build/deployment changes and verify all 14 FRs and six SCs have implementation/test evidence.
- [x] T019 After source and guide changes are complete, format intended files and run the selected frontend lint/typecheck, helper/Activities/ActivityDetails units, new search browser suite and directly affected Activity recording/management regressions from `specs\021-activity-history-search\quickstart.md`; use existing runners and no browser retries, report exact failures/worker blockers, do not repeat unchanged green checks, and do not run unrelated API/full CI/standalone build or deploy unless the actual impact or a later publishing request requires it.
- [x] T020 Review the four actual screenshots and measured IDs/focus/overflow/latency outcomes against `docs\UI_GUIDELINES.md` and `specs\021-activity-history-search\contracts\ui-contract.md`; record exact commands/results, roles/modes, one-second measurements and all failed/blocked/unexecuted checks in `specs\021-activity-history-search\quickstart.md`, correct any feature-caused failures with only affected revalidation, then format updated evidence/task documents and check their editor diagnostics without claiming hosted acceptance or a #174 fix.

## Dependencies and Execution Order

### Dependency graph

```text
T001
  -> T002 + T003
  -> T004 + T005 + T006
  -> T007 -> T008                         US1 MVP
  -> T009 + T010 -> T011                  US2
  -> T012 + T013 -> T014 -> T015 -> T016  US3
  -> T017 + T018 -> T019 -> T020          Completion
```

`+` identifies independent tasks within a ready group, not omitted prerequisites.
Both foundational tasks block story work. US2 and US3 build on US1's search;
US3 follows US2 because they edit the same page/test files. Their acceptance
journeys are independently verifiable, not separate applications.

### Direct prerequisites

| Task(s)          | Prerequisites    | Reason                                                              |
| ---------------- | ---------------- | ------------------------------------------------------------------- |
| T001             | None             | Existing-project setup.                                             |
| T002, T003       | T001             | Shared harness preparation.                                         |
| T004, T005, T006 | T002, T003       | Foundation barrier; write US1 tests first.                          |
| T007             | T004, T005, T006 | Test-first domain implementation.                                   |
| T008             | T007             | Integrate tested helper and page behavior.                          |
| T009, T010       | T008             | US1 search exists; separate page/browser files.                     |
| T011             | T009, T010       | Implement tested recovery.                                          |
| T012, T013       | T011             | Recovery complete; serialize shared story files.                    |
| T014             | T013             | Same browser file; add matrix/measurement after other US3 cases.    |
| T015             | T012, T014       | US3 tests written before lifetime implementation.                   |
| T016             | T015             | Same page file; refine verified layout next.                        |
| T017, T018       | T016             | Implementation complete; distinct documentation outputs.            |
| T019             | T017, T018       | Final formatting/checks cover completed changes and traced impacts. |
| T020             | T019             | Review executed visual/measurement evidence and record outcomes.    |

### Parallel examples per story

- **US1**: After T002/T003, write T004 (domain tests), T005 (page tests) and T006
  (browser cases) in parallel. Then complete T007 and T008 in order.
- **US2**: After T008, write T009 and T010 in parallel. T011 waits for both.
- **US3**: After T011, write T012 and T013 in parallel. T014 shares the browser
  file with T013 and must follow it; T015 waits for page and browser coverage.
- **Shared/final**: T002/T003 can run together after setup. T017/T018 can run
  together after T016; formatting/validation waits for both documentation outputs.

Do not assign parallel workers to different tasks editing the same file. These
opportunities do not require delegation; direct sequential execution is valid.

## Requirement Coverage

| Requirement/outcome            | Primary tasks                      |
| ------------------------------ | ---------------------------------- |
| FR-001, FR-003, FR-004, FR-005 | T005, T006, T008                   |
| FR-002, FR-014                 | T004, T006, T007                   |
| FR-006, FR-007, FR-008         | T009, T010, T011                   |
| FR-009                         | T007, T012, T013, T015             |
| FR-010, FR-011                 | T005, T006, T012, T013, T018, T019 |
| FR-012                         | T014, T016, T020                   |
| FR-013                         | T012, T013, T015                   |
| SC-001                         | T004, T005, T006, T019             |
| SC-002, SC-003                 | T009, T010, T019                   |
| SC-004                         | T014, T016, T019, T020             |
| SC-005                         | T012, T013, T019, T020             |
| SC-006                         | T014, T019, T020                   |

## Implementation Strategy

1. Complete setup and harness preparation without new infrastructure.
2. Deliver US1's pure filter and scoped page search as the smallest reviewable MVP.
   Use targeted test feedback only when useful; do not run broad validation during
   implementation.
3. Add US2's truthful recovery and US3's lifetime/current-data/access/layout
   safeguards in order. Retain existing behavior outside the specified changes.
4. Complete user documentation and impact trace, then run the selected final
   formatting/static/unit/browser checks once for unchanged covered files.
5. Review actual evidence and record results. Stop here unless publishing is
   separately requested; MVP checkpoints never authorize deployment.

## Notes

- All 20 tasks are complete: US1 has five, US2 three, US3 five, and seven are
  shared setup/foundation/polish tasks.
- No test-mode save, browser interception or local runner outcome proves hosted
  authentication, Cosmos persistence, deployment or resolution of #174.
- Preserve specific errors. Fix feature-caused failures, but do not weaken checks,
  suppress worker failures, add retries/fallbacks or fix unrelated defects.
- During implementation, mark tasks complete only after their actual outcome
  is verified. Requirements-quality checklists remain reviewer/workflow-owned.
