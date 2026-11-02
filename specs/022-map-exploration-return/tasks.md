# Tasks: Resume Map Exploration

**Feature**: [#192](https://github.com/Hsenrab/Journey/issues/192)
**Branch**: `022-map-exploration-return`
**Input**: [plan.md](plan.md), [spec.md](spec.md), [research.md](research.md),
[data-model.md](data-model.md), [UI contract](contracts/ui-contract.md) and
[quickstart.md](quickstart.md).

**Tests**: Required by the specification. Write the relevant failing tests before
the implementation they cover. All checkboxes below are implementation tasks;
none is complete merely because this task list was generated.

**Implementation status**: All implementation tasks are complete. Full frontend
and API local CI now pass after fixing the evidence test's query overhead without
changing its 10-second timeout. Live acceptance awaits publication and
authenticated access to the approved test environment.
See [validation evidence](quickstart.md).

**Format**: `- [ ] Tnnn [P?] [USn?] Description with repository-relative paths`.
`[P]` identifies independent files once the stated prerequisites are complete,
not permission to edit shared files concurrently.

## Phase 1: Setup

**Goal**: Prepare isolated, routed fixtures using existing tools.

- [x] T001 Prepare the routed Map/detail fixture arrangements in `src/pages/MapPage.test.tsx` using the existing data-router test harness for editor guards; include synthetic Waypoints/Activities, award and ordinary Waypoints, planned routes, tracks, dense clusters, long labels and missing coordinates. Extend the existing SDK substitute to expose non-default camera values and deferred readiness without adding dependencies, a browser SDK alias or production test hooks.

## Phase 2: Foundational Prerequisites

**Goal**: Establish typed navigation-only session ownership and safe dataset lifetime.

- [x] T002 Add failing metadata/registry tests in `src/features/journey/mapExploration.test.ts` for strict fields, optional camera before readiness, malformed ready-camera rejection, capture/lookup/exact kind-and-ID matching, explicit-return entry following, independent visits, session teardown and permanent invalidation, including recapture under a reused history key. Match origin hints by their non-secret live scope as well as entry key and opened record. Assert that entries contain no Journey entities, geometry, tokens, SDK/DOM instances or result-set snapshots.
- [x] T003 Implement `createMapExploration` and strict metadata/origin validation in `src/features/journey/mapExploration.ts`, following the existing Waypoint discovery pattern without a generic navigation framework. Preserve the model constraints verbatim: `mode`: "waypoints | activities"; `progressFilter`: "all | started | not-started"; `medalFilter`: "all | bronze | silver | gold"; `mobilePanel`: "map | list"; `originQuery`: "entered text, independent of the resolved origin"; `origin`: "optional validated latitude/longitude"; `originChoices`: "unchosen nearby-search choices, containing only displayed labels and coordinates"; `searchFeedback`: "handled no-match/failure message or no feedback"; `camera`: "optional finite SDK center/zoom and available bearing/pitch" with "Absence is valid before readiness; malformed ready-camera values fail explicitly"; `selectedRouteChallengeId`, `trackActivityId`: "optional current-data identifiers"; `selection`: "optional { kind: waypoint | activity, id }"; `openedRecord`: "{ kind, id }, distinct from selection"; `entryPath`: "nearby | marker | cluster"; `scope`: "live dataset generation". Use `mapExplorationOrigin` with `entryKey`, "exact opened record kind/ID" and the non-secret live `scope` identifier; retain invalidated origin provenance when a history key is reused. Expose capture, lookup, origin resolution, follow and selected/effective invalidation operations. Keep all metadata in memory and malformed supplied namespaces explicit failures.
- [x] T004 Add failing provider lifetime tests in `src/features/journey/JourneyContext.test.tsx` for accepted selected/effective dataset transitions, A -> B -> A, Demo Cosmos fallback to Demo local, cancelled switches, pending-write rejection, superseded loads and same-dataset reloads; verify the Map registry persists across route changes without weakening existing Waypoint discovery behavior.
- [x] T005 Own and expose the Map registry in `src/features/journey/JourneyContext.tsx` beside Waypoint discovery; invalidate selected mode only after accepted confirmation and effective mode only after the superseded-load check. Keep existing warnings, Production failure handling, draft/pending guards and real-data persistence unchanged.

**Checkpoint**: Typed metadata and provider lifetime are tested; all stories can
use the same stable contract. Dataset safety is foundational, not a post-MVP add-on.

## Phase 3: US1 - Return to the Same Geographic Exploration (P1)

**Goal**: Resume the originating Map visit through contextual return and browser Back.

**Independent test**: Both record types through nearby, marker and cluster entry
paths retain search, criteria, camera and mobile panel without a new origin lookup.

### Tests

- [x] T006 [P] [US1] Add failing routed round-trip tests in `src/pages/MapPage.test.tsx` for all six record-type/entry-path combinations through both contextual return and browser Back, independent history visits, explicit return followed by Back/Forward, entered text versus resolved origin, ambiguous/no-match/handled-failure search state, route choice and both mobile panels. Include modified/new-tab and default-prevented activations before wiring the new links. Assert zero additional origin searches/writes and camera equality after initial fit effects settle, including delayed readiness and SDK recreation during restoration.
- [x] T007 [P] [US1] Add failing Map-origin breadcrumb tests in `src/pages/LocationDetails.test.tsx` for matching origin hints and preservation of existing Waypoint-list/Challenge links; direct entry and mismatched origins must not invent a Map return. Before breadcrumb integration, cover dirty-draft decline/accept, pending-write blocking, ordinary modified links and exactly one discard confirmation.
- [x] T008 [P] [US1] Add failing Map-origin breadcrumb tests in `src/pages/ActivityDetails.test.tsx` for matching origin hints and retained existing Activity/Waypoint breadcrumbs, Waypoint chips, `backTarget` and deletion destinations; direct entry must remain unchanged. Before breadcrumb integration, cover dirty-draft decline/accept, pending-write blocking, ordinary modified links and exactly one discard confirmation.

### Implementation

- [x] T009 [US1] Implement the Map-local typed activation coordinator in `src/pages/MapPage.tsx`, reading current UI refs and available real SDK camera values immediately before accepted navigation. Reuse `isPlainDiscoveryActivation`; capture an immutable entry and namespaced hint only for ordinary accepted activation. Separate captured nearby-search choices/handled feedback from current token/render errors and exclude pending requests and entity content.
- [x] T010 [US1] Wire nearby links and all DOM popup/cluster anchors in `src/pages/MapPage.tsx` to the coordinator while retaining real hrefs and ordinary modified-link behavior. Add a direct Waypoint action to both empty/populated Waypoint popups; preserve their existing Activity links, Waypoints-mode selection for related Activities, cluster limits and stale-request protections. Cluster expansion/popup close alone must not capture navigation.
- [x] T011 [US1] Restore the correct history entry or explicit-return hint in `src/pages/MapPage.tsx`; follow explicit-return entries into their new keys and initialize mode, filters, origin text/resolution/choices/feedback, route/track intent and panel from valid metadata. Preserve independent visits and do not issue another origin lookup or infer successful resolution from text.
- [x] T012 [US1] Implement one-shot camera restoration in `src/pages/MapPage.tsx` after current data and SDK readiness; apply captured center/zoom and available bearing/pitch without invented values. Prevent initial route/track fits from overriding restoration, do not consume it on premature instances, and retain deliberate later selection and fresh direct-track fit behavior.
- [x] T013 [P] [US1] Add **Back to Map** ahead of existing breadcrumbs in `src/pages/LocationDetails.tsx` using `DetailPageHeader` and the origin helper; preserve Challenge and Waypoint discovery navigation, use the existing discard/pending-write guard once and resolve origin independently of record membership.
- [x] T014 [P] [US1] Add **Back to Map** ahead of existing breadcrumbs in `src/pages/ActivityDetails.tsx` using the same helper and existing guard; keep ordinary breadcrumb-derived `backTarget`, chips and deletion navigation independent of the additional Map breadcrumb.

**Checkpoint**: Stable-dataset Map/detail round trips work across all entry paths.
This is the demonstrable MVP, not permission to omit US2/US3 from delivery.

## Phase 4: US2 - Trust the Current Dataset (P1)

**Goal**: Restore navigation metadata, never stale record content.

**Independent test**: Edit/delete/change coordinates or filters while away, then
return; separately change datasets and confirm permanent reset with explicit feedback.

### Tests

- [x] T015 [P] [US2] Add current-data and reset tests in `src/pages/MapPage.test.tsx` for rename, moved/missing coordinates, changed progress/award filters, record deletion, removed route/track geometry, same-dataset reload, failed/loading data, accepted dataset changes and A -> B -> A. Assert current distances/positions/content, no stale popup/geometry, unchanged captured framing, bare `/map` on dataset reset and distinct loading/error/absence/reset feedback.
- [x] T016 [P] [US2] Extend `src/features/journey/mapExploration.test.ts` to prove expired or invalidated hints cannot revive an entry, record mismatch cannot authorize another detail origin, refresh ends lookup, and following a new history key preserves invalidation rather than adopting the new dataset's scope.

### Implementation

- [x] T017 [US2] Verify the advanced expired/invalidated-hint and entry-following cases from T016 against the complete core registry owned by T003 in `src/features/journey/mapExploration.ts`; adjust the helper only where those tests expose a gap. Preserve explicit malformed-input failures and permanent scope provenance; do not reimplement core lookup/invalidation, substitute defaults for malformed metadata or retain record copies.
- [x] T018 [US2] Resolve every restored selection, related popup action, route and track against current loaded data in `src/pages/MapPage.tsx`; update labels/positions/distances/progress/awards and rebuild current individual-record popups, not old cluster content. Clear unavailable selections/overlays with explanation, retain an independently valid Waypoint selection, preserve framing, reset invalidated criteria/track intent to bare `/map`, and give data failures priority over absence.
- [x] T019 [US2] Cover and complete missing/deleted-record contextual return in `src/pages/LocationDetails.test.tsx`, `src/pages/ActivityDetails.test.tsx`, `src/pages/LocationDetails.tsx` and `src/pages/ActivityDetails.tsx`; prove the live origin remains independently resolvable without exposing stale entity content or changing existing deletion destinations.

**Checkpoint**: Dataset changes and current-record changes cannot produce a stale
successful Map restoration.

## Phase 5: US3 - Predictable, Accessible Navigation (P2)

**Goal**: Preserve accessible focus, direct entry, read-only behavior and existing guards.

**Independent test**: Keyboard/mobile return and direct track navigation work at
360x800 and 1280x800 without hidden focus, write requests or altered existing journeys.

### Tests

- [x] T020 [P] [US3] Add focused regressions in `src/pages/MapPage.test.tsx` for one-shot List-link/current-popup/visible-panel/absence focus, hidden mobile panels, later updates not stealing focus, direct recorded-track entry, intentional later route fits and coexisting solid planned routes/dashed recorded tracks with unchanged wording and award/completion semantics. Retain the modified/new-tab activation coverage established by T006.
- [x] T021 [P] [US3] Add cross-journey compatibility regressions in `src/pages/LocationDetails.test.tsx` and `src/pages/ActivityDetails.test.tsx` for missing origin, existing Challenge/Waypoint-list return and Activity deletion/Waypoint-chip behavior. Retain the draft/pending/exact-once/modified-link coverage established by T007/T008. Do not introduce a new browser-Back draft guard.
- [x] T022 [P] [US3] Add controlled Playwright cases in `e2e/map-exploration-return.spec.ts` for nearby return through the breadcrumb and browser Back at 360x800/1280x800, admin/viewer and read-only Demo, long labels, empty/invalidated selections, accessible names, visible focus and no horizontal overflow. Mock protected APIs using synthetic fixtures, assert zero navigation writes/repeated origin searches, and report unavailable Maps rendering explicitly rather than add a fake browser SDK or claim camera/cluster rendering.

### Implementation

- [x] T023 [US3] Implement loaded/readiness-aware one-shot return focus in `src/pages/MapPage.tsx` on the current originating result/popup action or visible Map panel/absence explanation. Preserve theme focus indicators, full accessible labels, existing responsive Map/List controls and direct-track/route styling; never focus hidden panels or replay focus/framing on later updates.
- [x] T024 [US3] Complete any guard/compatibility integration required by T021 in `src/pages/LocationDetails.tsx` and `src/pages/ActivityDetails.tsx`; preserve ordinary modified links, exact-once existing confirmation, pending-write blocking, existing return origins and independent ordinary deletion targets without adding editor or global navigation infrastructure.

**Checkpoint**: All three stories satisfy the UI contract with controlled evidence;
live SDK acceptance remains separately identified.

## Phase 6: Polish and Cross-Cutting Validation

- [x] T025 Update `README.md`, `docs/pages/locations.md` and `docs/pages/visits.md` with Map-return lifetime, current-data reset, focus behavior, preserved direct-track navigation and the distinction between controlled and live Maps evidence. Do not create another Map guide or change unrelated operations guidance.
- [x] T026 Complete the UI self-review from `docs/UI_GUIDELINES.md` and the impacted frontend validation from `specs/022-map-exploration-return/quickstart.md`: editor diagnostics, formatting, lint, typecheck, relevant helper/provider/Map/detail tests and selected Playwright Map/Waypoint-list/Challenge regressions. Record exact commands, results, role/viewport coverage, zero-lookup/write assertions and camera restoration evidence in `specs/022-map-exploration-return/quickstart.md`; run final checks once after implementation, preserve failed checks and leave local coverage timeouts separate without pool/budget/threshold changes.
- [x] T027 Record the live-SDK acceptance status in `specs/022-map-exploration-return/quickstart.md`: if an approved authenticated environment is available, verify actual camera, marker/cluster actions, keyboard/touch and planned-route/track rendering for admin/viewer at both widths; otherwise record the precise blocked/unexecuted checks. Do not dispatch deployment, use real production fixtures, substitute mock evidence or claim live acceptance from completed controlled tests.
- [x] T028 Correct the cluster event representation exposed by live acceptance in `src/pages/MapPage.tsx`. First reproduce the missing popup using GeoJSON Feature-shaped Waypoint/Activity events in `src/pages/MapPage.test.tsx`, then support the SDK's Feature/Shape contract and verify popup position, contents, links and cluster detail-return behavior. Record correction validation separately from the earlier deployed commit and pending live checks.
- [x] T029 Unblock correction publication by reducing repeated DOM queries in the two timed-out ActivityEditor/IdeaEditor tests without changing user interactions, assertions, the 10-second limit, coverage thresholds or runner pools. Validate the full publication gate, then publish the correction to the approved test environment and record the actual outcome.

## Dependencies and Execution Order

### Phase graph

```text
Setup -> Foundation -> US1 -> US2 -> US3 -> Final validation
                         \-------> US3 tests can be prepared independently
```

US2 and US3 both depend on US1's working round trip, not on one another's logic.
Their implementation is scheduled serially because they share Map/detail files.
Provider invalidation is part of Foundation, so the US1 MVP is not scope-unsafe.

### Actual task prerequisites

| Task(s)          | Prerequisites                                                   |
| ---------------- | --------------------------------------------------------------- |
| T001             | None                                                            |
| T002             | T001                                                            |
| T003             | T002                                                            |
| T004             | T003                                                            |
| T005             | T004                                                            |
| T006, T007, T008 | T005                                                            |
| T009             | T006                                                            |
| T010             | T009                                                            |
| T011             | T010                                                            |
| T012             | T011                                                            |
| T013             | T007, T005                                                      |
| T014             | T008, T005                                                      |
| T015, T016       | T012, T013, T014                                                |
| T017             | T016                                                            |
| T018             | T015, T017                                                      |
| T019             | T018                                                            |
| T020             | T012, T013, T014, T015 (same test-file ordering)                |
| T021             | T012, T013, T014, T019 (same test-file ordering)                |
| T022             | T012, T013, T014                                                |
| T023             | T018, T020, T022                                                |
| T024             | T019, T021                                                      |
| T025             | T018, T023, T024                                                |
| T026             | T025 and all implementation/test-writing tasks                  |
| T027             | T026; approved environment required only to execute live checks |
| T028             | T027 live-check failure                                         |
| T029             | T028 correction publication gate                                |

Tests precede their implementation. Batch coherent changes to `MapPage.tsx`
within a phase; task boundaries do not require repeated small edits.

## Parallel Examples

- **Foundation**: Keep helper tests/model and provider tests/wiring in dependency
  order. Do not parallelize a test with the implementation it first needs to expose.
- **US1**: After T005, T006/T007/T008 write independent test files. T013 and T014
  can implement the two detail pages concurrently after their respective tests.
  MapPage implementation remains one sequential owner.
- **US2**: T015 (Map tests) and T016 (helper tests) can run independently; T017
  helper completion precedes T018 Map integration.
- **US3**: T020 (Map tests), T021 (detail tests) and T022 (new browser tests) use
  separate files. T023 Map implementation and T024 detail integration can run
  concurrently after their prerequisites; no shared-file editing.
- **Polish**: T025 documentation precedes T026 final validation so covered files
  stop changing before the final checks.
  Keep CPU-heavy local test/browser runs sequential to avoid competing timing.

## Implementation Strategy

1. Establish Foundation without changing persistence, services or deployment.
2. Demonstrate US1's stable-dataset round trip as the MVP.
3. Complete US2's current-data/reset feedback and US3's access/focus/compatibility
   before treating the requested feature as delivered.
4. Run scoped controlled validation and record actual outcomes. Recording an
   unavailable live environment completes the status-reporting action in T027,
   not the blocked live acceptance itself.

No migrations, dependencies, map-provider changes, storage caches, API/infra
changes, publish/deploy side effects or unrelated timeout fixes are authorized
by this task list. Subsequent explicit user approval authorized the evidence-test
timeout repair and frontend-only publication to the existing test environment;
the live-check outcomes and follow-up are recorded in `quickstart.md`.
