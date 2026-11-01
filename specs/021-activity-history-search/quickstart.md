# Quickstart: Validate Activity History Search

**Status**: Implemented and locally validated on 2026-10-31. Hosted acceptance
and publishing have not run.

## Prerequisites

- Use `021-activity-history-search`, existing Node.js 24 tooling and installed
  dependencies. Install only after a missing-dependency failure or manifest change.
- Read [matching/lifecycle](./data-model.md) and [UI contract](./contracts/ui-contract.md).
- Use isolated fictional data only. Do not access Production Cosmos, import
  personal backups, dispatch deployment or visit real external evidence URLs.
- Follow the existing [browser fixture pattern](../../e2e/waypoint-discovery-return.spec.ts):
  typed intercepted data, explicit roles, held reads/writes and precise failures.
  Clean only task-owned fixtures/services.
- Reserve port 4173 for the owned preview; do not stop shared processes.
  Install Chromium only if the browser run needs it.

## Implementation checks

After implementation, run once for unchanged covered files:

```powershell
npm run lint
npm run typecheck
npm test -- src\domain\activityHistory.test.ts src\pages\Activities.test.tsx src\pages\ActivityDetails.test.tsx --maxWorkers=1
```

Use the existing isolated runner first. If WSL cannot start a worker, report the
exact invocation/file/error, not a passing full run. Do not repeat successful
suites merely for an unstarted file. The established VM-thread runner may run a
separately selected unstarted suite, but not be applied blindly across mock-heavy
suites or used to hide the failed command.

Format intended source/test/docs with existing Prettier after completing changes;
do not format unrelated files.

Run the new suite and directly affected browser regressions:

```powershell
$env:CI = '1'
npm run test:e2e -- activity-history-search.spec.ts activity-recording.spec.ts --workers=1 --retries=0 --reporter=line
npm run test:e2e -- journey.spec.ts --grep 'activity management flow' --workers=1 --retries=0 --reporter=line
```

Playwright owns its Vite test-mode build/preview in `dist-e2e`. This does not prove
hosted authentication/persistence or fix #174. No separate production build/API
suite is needed unless affected surfaces expand. Later publishing must follow
separate full-CI delivery rules; do not deploy automatically.

## Scenarios and evidence

### 1. Matching and scope

Prepare 30 schema-valid fictional Activities, ordinary/award-enabled Challenges,
duplicate titles, unique notes beyond character 140, displayed postcode/coordinate
locations, independent records and linked Waypoints. Include several Ideas,
references/photos and a recorded track within existing dataset limits.

- Search all fields, mixed case, whitespace, partial/repeated words and reversed
  order. Combine title/notes/Waypoint clues; require every word within one Activity.
- A single-term record must not match a two-word query. Idea/evidence text and
  hidden geographic metadata must not contribute.
- Compare exact hrefs/IDs and chronology for unscoped, Challenge and every
  applicable recorded-award group. Matching outside records must remain excluded.
- Open both duplicate-title records and verify identities, native Waypoint links,
  evidence summaries and existing breadcrumbs.

### 2. Recovery and precedence

- Search an absent term in a nonempty scope: query-specific no-match message
  and exactly one Clear search action.
- Clear with keyboard: query empty/focused, same scope parameters and original IDs/order.
- Independently verify empty dataset, empty valid scope, whitespace query,
  invalid scope, held loading and specific failed load. Zero results alone do
  not prove these states differ.
- Production failure precedence uses a routed component test with
  `MODE=production`; browser test mode uses local Production records.

### 3. Lifetime, modes and saved truth

- Retain query through award changes and Add/Cancel. Preserve ordinary save
  feedback and Idea-origin return; search must not discard or register a draft.
- Open a detail or go elsewhere, then Back/Forward: empty query, existing scope
  behavior unchanged. Refresh also resets.
- Accepted selected-mode changes clear; declined or blocked changes retain.
  Effective Demo fallback/recovery each clear permanently with truthful warnings.
- Same-mode reload retains query and recomputes saved Activity/Waypoint edits.
  Failed saves are not persisted search text; deleted records do not reappear.
- Use coordinate/already resolved maintenance fixtures. Any affected postcode-only
  save in #174 remains explicitly blocked, not passing feature evidence.

### 4. Roles, layout and actual latency

- Cover admin/viewer at both sizes, plus Demo local and warned fallback; record
  the tested role/data mode.
- Verify keyboard search, clear focus, award and exact links. Keep notices;
  search causes zero writes, additional loads or evidence requests.
- Intercept fictional external resources for evidence regressions. Separate
  normal detail/gallery requests from query-triggered requests.
- Inspect screenshots for alignment, visible focus, initial desktop results above
  800px and full wrapping. Assert page width and actual title/subtitle/notes/
  feedback widths; page overflow alone can miss internal clipping.
- Measure final input event to observed correct IDs/feedback with the browser
  monotonic clock. Assert at most 1,000 ms for matching/no-match/clear with 30
  loaded Activities at both sizes. A generous assertion timeout is not SC-006 proof.

## Completion record

During implementation record commands/results, failed or blocked checks, tested
roles/data modes, latency measurements and screenshot review here. Do not present
design descriptions as executed tests or claim hosted behavior without evidence.

### Impact trace

- `activityHistory.ts` is consumed only by `Activities.tsx`; it reads validated
  Activity/Waypoint fields and the existing domain formatters.
- Activities remains registered as its own route in `App.tsx`. Real departure
  unmounts the page. Search does not change the detail route or return contracts.
- The existing provider owns selected-mode remounts, saved records, mutation guards
  and loading/fallback transitions. Only Activities' mode/query pair handles
  effective-mode resets; no provider/service/API changes were needed.
- Search controls remain mounted during same-mode loading so a reload does not
  steal input focus; result loading/error precedence remains unchanged.
- Existing shared components, packages, Vite/Playwright configuration and deployment
  paths are unchanged. The selected checks are frontend lint/typecheck, the three
  relevant unit files and Activity search/recording/management browser flows.
- No unrelated API, standalone production build, full CI or deployment is selected.

### Execution environment and initial feedback

- Windows PowerShell has no native `npm`; commands use the installed WSL Node
  toolchain with `wsl --cd <Windows repository path> --exec bash -lc <command>`.
- The editor test runner returned `No tests found in the files` for the selected
  Activities test. The CLI was used instead.
- `npm test -- Activities.test.tsx -t 'matches full notes/current Waypoint text'
--maxWorkers=1` failed before running tests: `[vitest-pool]: Failed to start
forks worker`, caused by `Timeout waiting for worker to respond` (60 seconds).
  This was an environmental failure, not a red acceptance assertion.
- The same selector with `--pool=vmThreads --maxWorkers=1` ran one test and failed
  with `Unable to find a label with the text of: Search activities` before
  implementation. Twenty-seven unrelated cases were skipped.

### Final checks and corrections

| Check                                                                                                                         | Executed result                                                                                                                |
| ----------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------ |
| Changed-file Prettier                                                                                                         | Passed; source/test files formatted after each covered change, final evidence documents formatted separately.                  |
| `npm run lint`                                                                                                                | Passed, zero errors; four existing warnings in WaypointEditor, ChallengeAwardFields and JourneyContext remain untouched.       |
| `npm run typecheck`                                                                                                           | Passed after the final source change.                                                                                          |
| `npm test -- activityHistory.test.ts Activities.test.tsx ActivityDetails.test.tsx --pool=vmThreads --maxWorkers=1`            | Initially 73 passed and three new fixture cases failed. Unchanged filter (32) and detail (14) suites passed.                   |
| `npm test -- Activities.test.tsx --pool=vmThreads --maxWorkers=1`                                                             | All 30 passed after fixture correction; 76 distinct targeted unit cases passed across the runs.                                |
| Activities selector `-t 'clears only the query\|retains input focus/query'` with the same VM-thread flags                     | Two passed, 28 intentionally skipped, after the final clear-focus styling change.                                              |
| `CI=1 npm run test:e2e -- activity-history-search.spec.ts activity-recording.spec.ts --workers=1 --retries=0 --reporter=line` | Initially 20 passed and five new cases failed; all 11 existing recording regressions passed.                                   |
| New search suite with the same one-worker/no-retry flags                                                                      | After fixture/focus correction, 13 passed and one scope assertion failed; the subsequent exact five-case selector passed.      |
| New search selector `--grep 'keyboard, exact IDs\|four fields\|Demo local'` with the same flags                               | All seven passed after the final focus-ring change. All 14 distinct new search cases have passing evidence across scoped runs. |
| `CI=1 npm run test:e2e -- journey.spec.ts --grep 'activity management flow' --workers=1 --retries=0 --reporter=line`          | All three passed: linked creation, independent create/edit/delete and recorded-track navigation.                               |
| Editor diagnostics                                                                                                            | No errors in changed source, tests or completion documents.                                                                    |

The initial three unit failures were invalid test responses, not hidden application
failures: 503 responses omitted the JSON content type, and the 409 fixture did not
use the existing `conflict` code. Fixtures now follow the API contract and assert
its specific load errors or existing conflict message. No service catch/fallback
was added.

The initial browser failures exposed the same invalid conflict fixture plus an
outline-only assertion for MUI's normal card focus highlight. Corrected checks
verify actual keyboard focus and the visible MUI highlight. A later award-change
case sampled DOM IDs before Router committed its update; it now waits for the
exact expected identities rather than a proxy count.

One attempted browser command failed with `unexpected EOF while looking for
matching '"'` before tests ran. Another quoted-regex invocation lost its trailing
CLI flags at the Windows/WSL boundary and ran four matrix cases with defaults;
that is not the final one-worker/no-retry evidence. Subsequent selectors use
Bash single quotes and their echoed invocations confirm all flags.

### Literal SC-006 measurements

Final browser-monotonic event-to-correct-ID/feedback durations, milliseconds,
rounded to one decimal, with 30 loaded fictional Activities:

| Viewport    | Role   | Matching input | No-match input | Clear action |
| ----------- | ------ | -------------- | -------------- | ------------ |
| 360 by 800  | Admin  | 9.9            | 6.6            | 47.4         |
| 360 by 800  | Viewer | 31.0           | 6.5            | 83.4         |
| 1280 by 800 | Admin  | 13.1           | 5.6            | 49.9         |
| 1280 by 800 | Viewer | 8.0            | 3.9            | 47.0         |

Every measured transition satisfied the literal 1,000 ms limit. Matching and
no-match timing starts at the final input event; clear timing starts at its click
event. Each finishes only when both exact ordered IDs and corresponding feedback
are correct. Clear also restores input focus. These are not default assertion
timeouts presented as performance measurements.

### Visual review and evidence boundaries

- Reviewed all four final admin/viewer screenshots at the specified sizes:
  aligned small controls, visible labels, explicit clear focus ring, retained
  viewer notice and wrapped long titles/subtitles/notes/Waypoint actions.
- Page and internal text-width checks passed, including a long echoed no-match
  query. Initial desktop results were above the fold; long mobile records remain
  naturally scrollable instead of clipped or shortened.
- The initial screenshot review found the new clear icon's focus too subtle.
  Both new clear controls now reuse the existing Locations-style inset themed
  ring. Keyboard tests explicitly assert the matching-state ring and exercise
  no-match clear recovery/input focus.
- Final screenshots and raw timing JSON are preserved in the session's `files`
  directory as `activity-history-search-<width>-<role>.png` and `.json`.
- Matrix role tests use intercepted Demo Cosmos data. Separate unit/browser
  evidence covers viewer Production reads, Demo local, warned fallback/recovery,
  genuine navigation resets, reload/superseded data, saved edits/deletes, failed
  drafts and existing evidence/gallery/track behavior.
- Maintenance saves use coordinates or already resolved fictional records. No
  affected real postcode-only save was executed: #174 remains a separate blocked
  maintenance surface, not passing evidence of a fix.
- Unexpected worker failures and failed commands above remain recorded. No API
  tests, standalone production build, full CI, hosted authentication/Cosmos
  acceptance, push, commit, deployment or production preview were performed.
