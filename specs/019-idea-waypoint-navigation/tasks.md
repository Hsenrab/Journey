# Tasks: Idea-to-Waypoint Navigation

**Branch**: `019-idea-waypoint-navigation`

**Input**: [spec.md](./spec.md), [plan.md](./plan.md),
[research.md](./research.md), [data-model.md](./data-model.md),
[UI contract](./contracts/ui-contract.md), and [quickstart.md](./quickstart.md).

**Tests**: Required by the feature's acceptance criteria. Write the story's tests
before its production change. A targeted unit-test red run is appropriate when
useful; reserve browser execution and formatting/static checks for the final
impact-scoped validation pass.

**Organization**: Three independently assessable user stories, ordered P1 then
P2. All tasks start unchecked; task generation is not implementation evidence.

## Format and Scope

- Each task has a sequential ID, optional `[P]`, a story label for story phases,
  and explicit repository-relative file paths.
- `[P]` means work can proceed alongside another eligible task in a different
  file, after the dependencies below are complete. It does not require agents.
- Never edit the same file concurrently. Reuse existing dependencies, test
  harnesses, types, routes, access gates, and error handling.
- Do not add models, migrations, APIs, shared components, navigation guards, a
  return action, or infrastructure. Do not fix #174 as part of this feature.

## Phase 1: Setup

**Purpose**: Confirm the agreed feature and its narrow integration boundary.

- [x] T001 Confirm `019-idea-waypoint-navigation` is active and review `specs/019-idea-waypoint-navigation/spec.md`, `specs/019-idea-waypoint-navigation/plan.md`, and the consumers in `src/pages/IdeaDetails.tsx`, `src/components/IdeaEditor.tsx`, `src/components/ReadOnlyNotice.tsx`, `src/app/App.tsx`, and `src/domain/visit.ts`; preserve existing editor callbacks, usage rules, routes, and access behavior, keeping the non-page integration files unchanged.

## Phase 2: Foundational Test Setup

**Purpose**: Reuse the current test approach without introducing infrastructure.

- [x] T002 Extend the route/fixture setup in `src/pages/IdeaDetails.test.tsx` and create the local fictional fixture/interception setup in `e2e/idea-waypoint-navigation.spec.ts`, using the existing Demo Cosmos response shape, explicit admin/viewer roles, controlled save responses, and write counters; support zero/one/many associations, coordinate-based Activities, and valid dataset replacement. Preserve the data-model constraints "Waypoint IDs on an Idea are distinct; titles need not be unique." and "An Activity can reference several Ideas independently of its optional Waypoint." Keep fixtures local to these files and put the new browser tests in an Idea-named describe block so the quickstart selection includes them.

**Checkpoint**: Both test surfaces can express the agreed scenarios without
real data, a new mock framework, or a new server configuration.

## Phase 3: User Story 1 - Open a Linked Destination (Priority: P1)

**Goal**: Open the right destination directly and suppress only the new links
while the Idea editor is open.

**Independent test**: For an Idea with no, one, or several destinations, verify
explicit none-linked text or independent identity-based targets. Follow both
duplicate-title links. Verify text/link transitions through editing, pending and
failed saves, successful saving, and accepted/declined existing Cancel.

### Tests

- [x] T003 [P] [US1] Add focused cases in `src/pages/IdeaDetails.test.tsx` for zero/one/many linked Waypoints, separate duplicate-title links and correct hrefs, association order, no browse-triggered writes, and existing missing-Idea/load-failure states; cover entering edit, pending/failed save with retained draft/error, successful save using current saved associations, and both outcomes of the editor's existing dirty-Cancel prompt, asserting plain-text destinations until editing actually ends.
- [x] T004 [P] [US1] Add browser cases in `e2e/idea-waypoint-navigation.spec.ts` that activate identity-based destinations, return using normal browser history, and exercise the admin edit/save/cancel transitions at both required viewports without a new warning; also replace the fixture with a valid dataset that removes the destination and detaches its references, reload that detail route, and assert explicit missing-record feedback rather than stale content.

### Implementation

- [x] T005 [US1] Replace the comma-joined destination text in `src/pages/IdeaDetails.tsx` with a labelled compact MUI list/Stack of individually named `MuiLink component={Link}` destinations keyed and targeted by `waypointId`, preserving association order and the explicit none-linked state; use the existing `editing` boolean to render the same saved names as plain text until editing ends, without changing save/cancel handlers, existing reference/Activity links, load/not-found handling, or adding another confirmation.

**Checkpoint**: US1 is the functional MVP and can be assessed without new
usage wording. Preserve baseline viewer access; the full role/layout acceptance
matrix is supplied by US3. Written tests are not a claim of passing validation.

## Phase 4: User Story 2 - Understand Associations and Actual Usage (Priority: P2)

**Goal**: Explain the relationship without changing usage or recording behavior.

**Independent test**: An Activity at another Waypoint, or without a Waypoint,
counts as Idea usage while the Idea's saved destinations and planning state stay
unchanged. Existing zero/one/many recording defaults and save-return rules hold.

### Tests

- [x] T006 [P] [US2] Extend `src/pages/IdeaDetails.test.tsx` with separately labelled planning/destination/usage copy and usage at an unassociated Waypoint or with no Waypoint, covering active/someday/rejected Ideas with zero and nonzero usage; retain or add assertions for zero/one/many Activity preselection, successful save retaining the initiating Idea, removal of that Idea before save, cancellation, and failure without false return-with-success feedback.
- [x] T007 [P] [US2] Add browser assertions in `e2e/idea-waypoint-navigation.spec.ts` for an Idea shared across destinations and used by an Activity elsewhere or without a destination: verify the explanatory labels, unchanged associations/planning state, correct usage, working Activity-detail navigation, and zero writes during browsing; leave the existing Idea-entry regression in `e2e/activity-recording.spec.ts` unchanged unless a directly coupled assertion requires updating.

### Implementation

- [x] T008 [US2] Add concise planning-association and explicit-Activity-usage wording to their respective sections in `src/pages/IdeaDetails.tsx`, retaining existing labels, `activitiesUsingIdea`/`ideaUsageCount` helpers, totals/cards, and the zero/one/many recording link construction; do not introduce new usage calculations, stored state, or Activity save/return behavior.

**Checkpoint**: US2 adds explanation without changing what counts as usage,
where an Activity can be recorded, or how successful recording returns.

## Phase 5: User Story 3 - Browse Accessibly Without Write Access (Priority: P2)

**Goal**: Keep destination browsing usable for viewers, narrow screens, and
keyboard users without exposing writes.

**Independent test**: Admin and viewer browsing at 360x800 and 1280x800 retains
named, operable links with visible keyboard focus and no horizontal page
overflow. Demo local remains read-only and navigable.

### Tests

- [x] T009 [P] [US3] Extend the existing viewer/read-only cases in `src/pages/IdeaDetails.test.tsx` to include linked destinations and Activity usage, asserting available read links and the existing notice/Settings link but no edit, delete, or recording actions; include Demo local coverage and preserve specific load-failure messages rather than substituting an empty state.
- [x] T010 [P] [US3] Add the admin/viewer by 360x800/1280x800 browsing matrix in `e2e/idea-waypoint-navigation.spec.ts`, with long and unbroken destination titles, keyboard Tab/Enter activation, visible focus, exact `scrollWidth <= clientWidth` page measurements, working Activity links, and zero browse-triggered writes; include a focused Demo local read-only case and check overflow while the admin editor remains open, not only after closing it.

### Implementation

- [x] T011 [US3] Complete the destination section's theme-based layout in `src/pages/IdeaDetails.tsx`, ensuring shrinkable containers, wrapping with the existing `overflowWrap: 'anywhere'` convention, individually focusable native links with visible focus, and no fixed-width/ad-hoc controls; correct the browser-confirmed main flex-item minimum width in `src/components/Layout.tsx` and cover that constraint in `src/components/Layout.test.tsx`, preserving role/read-only gates, editor behavior, and reference/Activity navigation.

**Checkpoint**: All three stories have implementation and acceptance coverage
ready for the final scoped validation pass.

## Phase 6: Documentation and Final Validation

**Purpose**: Update the guide, review the changed UI, and obtain actual scoped
validation evidence without unrelated checks.

- [x] T012 [P] Update `docs/pages/ideas.md` to describe named linked destinations, planning associations versus Activity usage, and plain-text destination names while editing, with links restored only after successful saving or completed Cancel; retain the editor's existing dirty-Cancel confirmation and other documented behavior.
- [x] T013 [P] Apply the self-review in `docs/UI_GUIDELINES.md` to the changed Idea detail section and record the actual visual/keyboard review in `specs/019-idea-waypoint-navigation/quickstart.md`, including visible focus, wrapping/overflow, both required viewports, the role/data mode supplied by the fixture or runtime, intercepted-API limits, and explicit failed/blocked/unexecuted cases; check #174's current status before any postcode-only save claim and do not touch real data or shared browser fixtures.
- [x] T014 Run the final impacted-file formatting and editor diagnostics, frontend `lint`/`typecheck`, `IdeaDetails.test.tsx` plus `Layout.test.tsx`, and the combined new-suite/existing-Idea-entry/four-shell-smoke browser selection exactly as scoped in `specs/019-idea-waypoint-navigation/quickstart.md` and `package.json`; record exact outcomes and blockers in the quickstart, format any subsequently updated evidence/task documents, and update completion markers in `specs/019-idea-waypoint-navigation/tasks.md` only for completed work. Do not run API/full-coverage/all-browser suites or an extra production build unless the changed scope requires them. Pushes and deployments always require an explicit user request.

## Dependencies and Execution Order

### Task dependencies

Only direct prerequisites are shown; their prerequisites are transitive.
File-write ordering is intentional even when two stories have no product-level
dependency.

| Task | Prerequisites    | Reason                                                       |
| ---- | ---------------- | ------------------------------------------------------------ |
| T001 | None             | Establish the agreed scope and active feature                |
| T002 | T001             | Prepare the two existing-style test surfaces                 |
| T003 | T002             | Page tests need their route/fixture setup                    |
| T004 | T002             | Browser tests need their local fixture setup                 |
| T005 | T003, T004       | Author US1 tests before the rendering change                 |
| T006 | T003             | Serialize additions to the same page test file               |
| T007 | T004             | Serialize additions to the same browser test file            |
| T008 | T005, T006, T007 | Explain the linked section after US1 rendering and US2 tests |
| T009 | T006             | Serialize additions to the same page test file               |
| T010 | T007             | Serialize additions to the same browser test file            |
| T011 | T008, T009, T010 | Serialize production edits and author US3 tests first        |
| T012 | T011             | Document the complete intended presentation                  |
| T013 | T011             | Review the complete changed UI                               |
| T014 | T012, T013       | Validate the completed source, tests, guide, and UI review   |

### Story completion graph

```text
T001 -> T002 -> (T003 || T004) -> T005 [US1 / MVP]
T003 -> T006
T004 -> T007
(T005, T006, T007) -> T008 [US2]
T006 -> T009
T007 -> T010
(T008, T009, T010) -> T011 [US3]
T011 -> (T012 || T013) -> T014 [validated feature]
```

US2 and US3 have separate acceptance criteria and neither requires the other's
new behavior. Their production edits are sequenced because both use the same
page; US3's navigation acceptance uses the US1 links.

### Parallel examples

- **US1**: After T002, author T003 page tests and T004 browser tests concurrently.
  Complete both before T005.
- **US2**: Once their respective earlier-file tasks finish, author T006 page
  regressions and T007 browser regressions concurrently. T008 waits for both
  and for T005.
- **US3**: Once T006/T007 finish, author T009 page-access tests and T010 browser
  access/layout tests concurrently. T011 follows T008 and both test tasks.
- **Final phase**: After T011, T012 edits the Ideas guide while T013 records the
  UI review in the quickstart. T014 runs after both.

Do not parallelize T003/T006/T009, T004/T007/T010, or T005/T008/T011: each
group edits the same file.

## Requirement Coverage

| Requirements/outcomes                                                    | Tasks                        |
| ------------------------------------------------------------------------ | ---------------------------- |
| FR-001, FR-002; SC-001: independent identity-based links                 | T003, T004, T005             |
| FR-003: explicit empty, missing-record, and failure states               | T003, T004, T005, T009       |
| FR-004: planning associations versus actual usage                        | T006, T007, T008             |
| FR-005; SC-003: unchanged records, usage, and planning state             | T003, T004, T006, T007       |
| FR-006: existing recording defaults and return rules                     | T006, T014                   |
| FR-007; SC-004: viewer and other read-only browsing                      | T009, T010, T011             |
| FR-008, FR-009; SC-002: keyboard, focus, wrapping, measured overflow     | T010, T011, T013             |
| FR-010: preserved capture/search/difficulty and usage navigation         | T001, T006, T008, T009, T014 |
| FR-011: plain text throughout editing, restored links after editing ends | T003, T004, T005             |
| SC-005: actual role/dataset/viewport evidence and honest limits          | T013, T014                   |

## Implementation Strategy

### MVP first

Complete T001-T005 to deliver direct destination navigation with the clarified
editing behavior. This is the smallest functional slice, not permission to
silently omit the P2 stories or skip appropriate validation. If the user chooses
an MVP-only delivery, select only that slice's tests and explicitly leave the
remaining story tasks unchecked.

### Full feature

1. Reuse the existing test setup and author story tests before production edits.
2. Deliver US1, then add US2 wording/regressions and US3 accessibility/access
   acceptance, respecting same-file ordering.
3. Keep feature rendering local to `IdeaDetails.tsx`, with the documented
   one-property main sizing correction in `Layout.tsx`; leave APIs, schemas,
   editor callbacks, other pages, dependencies, and deployment settings alone.
4. Update the guide and review the UI; run the selected final checks once.
   Repeat a successful check only if a file it covers changes afterward.
5. Record failures honestly and complete only verified tasks. A passing mocked
   save does not prove #174, hosted authorization, Cosmos persistence, or a real
   deployment. Task completion does not authorize committing, pushing, or
   deploying.
