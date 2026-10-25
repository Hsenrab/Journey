# Tasks: Clear and Reliable Activity Recording

**Input**: [spec.md](spec.md), [plan.md](plan.md), [research.md](research.md),
[data-model.md](data-model.md), [contract](contracts/activity-recording.md), and
[quickstart.md](quickstart.md).

**Branch**: `015-activity-recording-experience`

**Organization**: Three user-story increments with explicit prerequisites.
Tests implement the acceptance scenarios and measurable outcomes required by the
specification. Do not change application behavior during task generation.

## Format and execution rules

- All tasks use `- [ ] Tnnn [P?] [USn?] Description with exact paths`.
- `[P]` identifies disjoint work that may run concurrently once its listed
  prerequisites are done; it does not override the dependency graph.
- Paths are repository-relative. Keep tests alongside the code they cover.
- Add acceptance tests before the corresponding implementation. Run a focused
  test only when useful during development; perform formatting/static/full CI
  once after implementation, as required by repository conventions.
- No new dependency, service, local persistence, migration, hosted-data correction,
  push, or deployment. Preserve unrelated agent work.

## Phase 1: Setup

**Goal**: Confirm the precise impacted surfaces without adding infrastructure.

- [x] T001 Trace Activity constructors, editor hosts, import/export, test factories, routing consumers, API document versions and seed/integration consumers from `src/domain/visit.ts`, `src/components/ActivityEditor.tsx`, `src/features/journey/JourneyContext.tsx`, `src/app/App.tsx`, and `api/src/lib/journeySchema.ts`; record any additional concrete validation targets in `specs/015-activity-recording-experience/quickstart.md`, without dependency installation or application edits.

## Phase 2: Foundational UK Date Rules

**Goal**: Establish equivalent date rules within the separately compiled packages.

- [x] T002 [P] Add `src/domain/activityDate.ts` and `src/domain/activityDate.test.ts` for "Required `YYYY-MM-DD`, real calendar date, no later than current UK date"; derive `Europe/London` year/month/day through Intl parts, evaluate today per call, support a supplied test instant, and test malformed/impossible/leap dates, both sides of UK midnight, winter/BST transitions, and non-UK device zones using the contract matrix without shifting stored dates or freezing today at import.
- [x] T003 [P] Add equivalent package-local rules and the same boundary cases in `api/src/lib/activityDate.ts` and `api/src/lib/activityDate.test.ts`; keep the API build independent of frontend source, with no dependency, shared-package machinery, device-local cutoff or timezone fallback.

**Checkpoint**: Both packages can compute UK today and classify real non-future
calendar dates consistently. User-story work begins after both tasks complete.

## Phase 3: User Story 1 - Record a Valid, Named Activity (P1, MVP)

**Goal**: Enforce required title and non-future UK date everywhere, with clear
requirements and accessible correction.

**Independent test**: Create/edit an independent and linked Activity with valid
title/date/location; reject missing or invalid fields through form, structured
draft, import/replacement and API boundaries without writes; correct the draft
and save without losing content.

### Acceptance tests

- [x] T004 [P] [US1] Extend `src/domain/visit.test.ts`, `src/domain/draftJsonImport.test.ts`, `src/services/storage.test.ts`, and `src/services/journeyApi.test.ts` to assert "Required string, trimmed and nonempty; displayed as Activity title" for `name` and the UK date constraint; cover create/edit/load/import round-trips, explicit rejection of unnamed or future records, no generated titles, no write on invalid input, and legitimate duplicate title/date records.
- [x] T005 [P] [US1] Extend `api/src/lib/journeySchema.test.ts`, `api/src/lib/cosmos.test.ts`, and `api/src/functions/journey.test.ts` for required trimmed names, real/non-future UK dates, valid Activity version 5, explicit version-3/4 rejection, and validation-before-write for create/update/import/replace; assert zero Cosmos writes on invalid cases and retain authorization, ETag and whole-dataset integrity checks.

### Implementation and integration

- [x] T006 [US1] Require `name` in `ActivitySchema` and `createActivity` in `src/domain/visit.ts`, reuse `src/domain/activityDate.ts` for date validation, and replace date-as-title/optional-name subtitle branches; enforce "Required string, trimmed and nonempty; displayed as Activity title", retain calendar strings and existing relationships/evidence, and never invent a title or shift a date.
- [x] T007 [US1] Wire `api/src/lib/activityDate.ts` into `api/src/lib/journeySchema.ts`, require `name`, set Activity document version to 5 and remove obsolete Activity-version acceptance; trace `api/src/lib/cosmos.ts` and `api/src/functions/journey.ts` to enforce the same rule on stored loads and all write/import/replacement paths, retaining specific validation errors and rejecting old contracts without migration or changes to other entity versions.
- [x] T008 [US1] Make `ActivityDraft.name` required in `src/features/journey/JourneyContext.tsx` and the Activity JSON draft name required in `src/domain/draftJsonImport.ts`; use validated trimmed output, preserve complete validation before writing through `src/services/journeyApi.ts`, `src/services/storage.ts`, and `src/pages/Settings.tsx`, and remove optional-name casts/defaults rather than introducing compatibility paths.
- [x] T009 [US1] Update `src/components/ActivityEditor.tsx` and `src/components/ActivityEditor.test.tsx` to label "Activity title" and date as required, prefill UK today, reject missing/invalid/future dates with shared rules, explain location/optional fields and conditional "Award tier", associate postcode/latitude/longitude/award/reference/photo errors with controls, and focus the first invalid control in rendered reading order while retaining the draft; ensure native validation does not bypass the custom correction path.
- [x] T010 [US1] Update `src/domain/aiPrompts.ts`, its adjacent tests, `src/domain/draftJsonImport.test.ts`, and all affected Activity factories/callers found by T001 (including `src/app/App.test.tsx`, `e2e/journey.spec.ts`, and API fixtures) for mandatory titles and deterministic non-future dates; prove the complete `src/data/demo.json` fixture validates in frontend/API tests, preserving already-valid fictional content and restoring test clocks after boundary cases.
- [x] T011 [US1] Extend provider/page acceptance in `src/features/journey/JourneyContext.test.tsx`, `src/pages/Settings.test.tsx`, and `src/components/ActivityEditor.test.tsx` to verify named create/edit and imported data, invalid whole-import zero-write behavior, exact stored date/title, UK prefill near midnight, field focus/error associations, required award without completion coupling, and unchanged location prefill/linking; update any additional adjacent consumers identified by T001 rather than weakening validation.

**Checkpoint**: US1 works without optional-section or pending-save improvements.
For this increment, errors in currently expanded evidence remain accessible;
US3 adds reveal-before-focus when sections become collapsible.

## Phase 4: User Story 2 - Save Once with Clear Feedback (P1)

**Goal**: One accepted save per editor attempt, protected pending draft, exact
failure feedback, and correct confirmed success destinations.

**Independent test**: Hold each of the four save journeys pending, repeat pointer
and keyboard submission, attempt discarding navigation, then resolve/reject;
verify one mutation, correct destination or retained draft, and deliberate retry.

### Acceptance tests

- [x] T012 [P] [US2] Define typed expected input-rejection errors for HTTP 400 in `src/services/journeyApi.ts` and `src/services/journeyApi.test.ts`, preserving exact messages and conflict/import-not-empty distinctions while leaving network/server/response/programming failures unexpected; add deferred-promise and same-tick submission tests in `src/components/ActivityEditor.test.tsx` and saved-ID tests in `src/features/journey/JourneyContext.test.tsx` for one callback, visible/live Saving state, disabled conflicting controls, true/handled-false/unexpected-rejection outcomes, cleanup before success callback, pristine pending drafts, and identical allocated ID through computed next data and test-mode dispatch.
- [x] T013 [P] [US2] Extend `src/app/App.test.tsx`, `src/pages/Activities.test.tsx`, `src/pages/ActivityDetails.test.tsx`, `src/pages/LocationDetails.test.tsx`, and `src/pages/IdeaDetails.test.tsx` using memory data routers for delayed saves, blocked link/programmatic/history navigation, unchanged routes/provider lifetime, exact errors/conflicts, successful post-unlock navigation, Idea retained/unlinked destinations, actual saved Activity identity and one-shot confirmation.

### Implementation and integration

- [x] T014 [US2] Convert the existing route tree in `src/app/App.tsx` to `createBrowserRouter`/`RouterProvider` with an Outlet shell while retaining theme, Layout, redirects, paths and provider lifetime; migrate affected editor/page test wrappers to `createMemoryRouter` in the test files identified by T001/T013, without adding loaders/routes or silently disabling blocker behavior under unsupported routers.
- [x] T015 [US2] Return the actual created ID as `Promise<string>` from `addActivity` in `src/features/journey/JourneyContext.tsx`; allocate once before the add action, preserve it through reducer computation and test-mode dispatch, and make the tracking wrapper preserve operation return types while leaving unrelated mutations' returns unchanged; never infer identity from title/date/list position or add a confirmation-only read.
- [x] T016 [US2] Replace the shared editor's void callback with `onSubmit(draft): Promise<boolean>` and optional post-unlock `onSaved(draft)` in `src/components/ActivityEditor.tsx`, updating `src/pages/Activities.tsx`, `src/pages/LocationDetails.tsx`, and `src/pages/ActivityDetails.tsx` together; acquire a synchronous in-flight lock before callback execution, release it in finally, announce "Saving..." with busy/live semantics, and disable draft changes, GPX/mode changes, Cancel and Delete; return false only for fully displayed typed input-rejection/conflict errors, retain unexpected exceptions after cleanup and rethrow them during rendering into an explicit root route error element in `src/app/App.tsx` that shows the original message; extend `src/app/App.test.tsx` and `src/components/ActivityEditor.test.tsx` to assert that full root-failure path without generic fallback, success callback or unhandled promise rejection.
- [x] T017 [US2] Add supported pending navigation blocking to `src/components/ActivityEditor.tsx` and integrate existing draft/data-mode protection in `src/features/journey/JourneyContext.tsx` and `src/components/Layout.tsx` only where required; use the synchronous pending predicate for link/programmatic/Back/Forward attempts, reset blocked attempts without replay, register pending pristine drafts, retain before-unload warnings, and allow normal navigation after success/failure without custom history interception or offline recovery.
- [x] T018 [US2] Implement typed one-shot success state between `src/pages/Activities.tsx` and `src/pages/IdeaDetails.tsx` using the actual ID returned by addActivity; show "Activity saved.", updated derived usage and saved Activity link when the originating Idea remains linked, consume the history marker to prevent replay, retain Activities confirmation when unlinked, and keep Waypoint/edit success behavior without additional feedback-only reads.
- [x] T019 [US2] Complete provider-backed regression coverage in `src/features/journey/JourneyContext.test.tsx`, `src/pages/Activities.test.tsx`, `src/pages/ActivityDetails.test.tsx`, `src/pages/LocationDetails.test.tsx`, and `src/pages/IdeaDetails.test.tsx` for each pending/success/failure/retry journey, retained attachments/links, explicit conflict reload/discard, no false success or auto-retry, no notification replay, duplicate titles with correct saved ID, read counts and admin/viewer/Production/Demo Cosmos/Demo local/warned-fallback restrictions.
- [x] T020 [US2] Extend `e2e/journey.spec.ts` with controlled delayed-save browser flows for all four journeys: select Demo Cosmos, intercept `/api/journey/demo` with fictional initial data/admin role/valid ETags, hold the mutation response behind a test-controlled promise, and release with updated replacement data/ETags or real-format HTTP 400/conflict errors; verify repeated pointer/keyboard submit, desktop/mobile navigation and browser history while pending, post-settlement navigation, Idea confirmation and deliberate retry against retained mock state; preserve browser-unload warning coverage without claiming hard unload can be prevented, assert record/mutation counts and retained drafts, and add no production delay hooks or synchronous Production test-mode network assumptions.

**Checkpoint**: All save hosts use one lifecycle; navigation is guarded while
pending, success is explicit, and failures leave a usable draft.

## Phase 5: User Story 3 - Complete the Essentials without Optional Clutter (P2)

**Goal**: Keep optional evidence compact without hiding populated content,
validation errors or keyboard-accessible actions.

**Independent test**: Save a minimal Activity without opening evidence; add/edit
GPX, references and photos, collapse/reopen them, then correct an invalid hidden
field using only the keyboard at 360x800 and 1280x800.

### Acceptance tests and implementation

- [x] T021 [US3] Add accordion behavior tests to `src/components/ActivityEditor.test.tsx`: empty new evidence starts closed, initial/applied content opens, collapse retains values/order and track state, invalid summaries identify errors, submission reveals/focuses the first invalid field, and keyboard toggles preserve pending-save protections and GPX parse/replacement-error behavior.
- [x] T022 [US3] Wrap GPX, References and Photos in existing MUI Accordion patterns in `src/components/ActivityEditor.tsx`; maintain separate expanded flags initialized by content, reveal applied/error content before focus, keep essentials/notes/save accessible, preserve values without destructive unmounting, and use stable error associations plus visible keyboard focus and theme spacing from `docs/UI_GUIDELINES.md`.
- [x] T023 [US3] Extend `e2e/journey.spec.ts` for minimal and evidence-rich recording/edit/correction at 360x800 and 1280x800, long titles/errors, non-UK browser timezone with UK prefill, and keyboard-only expand/focus/save; assert no horizontal page overflow, unclipped actions, correct first focus, retained evidence, and no traps; complete the `docs/UI_GUIDELINES.md` self-review and record results in `specs/015-activity-recording-experience/quickstart.md`.

**Checkpoint**: Optional details are compact, discoverable and fully correctable;
US1 and US2 remain intact after adding section state.

## Phase 6: Cross-Cutting Documentation and Final Validation

- [x] T024 Update `docs/waypoints-model.md`, `docs/operations.md`, and the supersession notes in `specs/006-activity-recording/spec.md` and `specs/009-structured-draft-entry/spec.md` to document mandatory title/non-future UK date, version-5 Activity incompatibility, explicit old-data failure without migration, Saving protections, optional details and Idea confirmation; preserve historical baseline context and link to Feature 015 rather than rewriting history.
- [x] T025 Review changed imports/callers, build/deployment consumers and acceptance coverage against `specs/015-activity-recording-experience/quickstart.md` and `.github/workflows/ci.yml`; format intended changed files and run the complete local root/API CI sequence once after implementation (lint, typecheck, formatting, coverage, both builds, Chromium flows and Functions-host smoke), fixing change-caused failures and reporting exact unrelated/environment blockers without suppressing or claiming hosted-only checks.
- [x] T026 Record actual commands, outcomes and remaining hosted-only limitations in `specs/015-activity-recording-experience/quickstart.md`, re-evaluate `specs/015-activity-recording-experience/checklists/requirements.md`, and inspect final source-control diff/status once; mark only verified tasks complete, preserve unrelated work and leave committing/pushing/deployment to explicit user authorization.

## Dependencies and Execution Order

### Task prerequisites

The table is authoritative; numeric order alone does not imply an extra dependency.
Every task is listed, including independently executable branches.

| Task       | Prerequisites |
| ---------- | ------------- |
| T001       | None          |
| T002, T003 | T001          |
| T004, T005 | T002, T003    |
| T006       | T004          |
| T007       | T005          |
| T008       | T006, T007    |
| T009       | T008          |
| T010       | T009          |
| T011       | T010          |
| T012, T013 | T011          |
| T014       | T013          |
| T015       | T012          |
| T016       | T014, T015    |
| T017       | T016          |
| T018       | T017          |
| T019       | T018          |
| T020       | T019          |
| T021       | T020          |
| T022       | T021          |
| T023       | T022          |
| T024       | T023          |
| T025       | T024          |
| T026       | T025          |

### Story graph

```text
Setup T001
  -> Foundations T002 + T003
  -> US1 T004-T011 (P1, independently useful MVP)
  -> US2 T012-T020 (P1)
  -> US3 T021-T023 (P2)
  -> Documentation/validation T024-T026
```

US2 relies on US1's valid typed drafts; US3 extends US1's focus/error logic and
US2's disabled/pending controls in the same editor. Serialize shared-file changes.
This is execution coupling, not a requirement to withhold US1 until all stories
are implemented.

## Parallel Execution Examples

### User Story 1

After foundations, T004 frontend contract tests and T005 API contract tests can
run in parallel. After their respective tests, T006 frontend schema and T007 API
schema work have disjoint files; join both before T008.

### User Story 2

T012 editor/context tests and T013 page/router tests can run concurrently after
US1; service error classification is included in T012. T014 routing/test-wrapper work and T015 context identity work can then run
in parallel after their respective prerequisites. T016 is a joint integration
point: do not split editor callback changes from its page consumers.

### User Story 3

T021 and T022 share editor test/implementation concerns, so keep them sequential.
After T022, the browser acceptance work in `e2e/journey.spec.ts` can be split
between narrow and desktop scenarios only with coordinated, non-overlapping
edits; the default is one T023 task, not competing writers. No unconditional
parallel marker is applied to this story.

## Requirement Coverage

| Requirement                                         | Tasks                                   |
| --------------------------------------------------- | --------------------------------------- |
| FR-001 required title/date across boundaries        | T002-T011                               |
| FR-002 required/optional guidance                   | T009, T022                              |
| FR-003 Award tier clarity                           | T009, T011                              |
| FR-004 accessible correction                        | T009, T011, T021-T023                   |
| FR-005 one pending submission                       | T012, T016, T019, T020                  |
| FR-006 pending draft/navigation protection          | T013, T014, T017, T019, T020            |
| FR-007 exact failure/deliberate retry               | T012, T016, T019, T020                  |
| FR-008 Idea-origin confirmation                     | T013, T015, T018-T020                   |
| FR-009 optional sections                            | T021-T023                               |
| FR-010 responsive keyboard flows                    | T020, T023                              |
| FR-011 preserved relationships/permissions/evidence | T005, T011, T019-T023                   |
| FR-012 fixtures/prompts/guidance                    | T010, T024                              |
| FR-013 UK calendar consistency                      | T002, T003, T006, T007, T009-T011, T023 |

Success criteria SC-001/009 map to US1 and UK browser cases; SC-002/003/005 to
US2; SC-004 spans US1 and US3; SC-006/007 map to US3; SC-008 spans provider and
browser regressions. T025 validates the full changed surface before completion.

## Implementation Strategy

1. Finish setup and package-local date foundations.
2. Deliver US1 as the MVP: valid named history across all ingestion boundaries,
   accessible correction, explicit incompatible-data failures.
3. Add US2 as one coordinated editor/host/router increment; verify all four
   journeys with deferred success/failure, not just a happy-path save.
4. Add US3 without regressing existing focus, track or pending protections.
5. Update directly related documentation, run final cross-cutting validation and
   record evidence. Task completion is not authorization to commit, push or deploy.
