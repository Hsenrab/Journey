# Validation Guide: Map Exploration Return

**Status**: Implementation and full local frontend/API CI complete. The evidence
test timeout is resolved with its 10-second limit unchanged. Live Azure Maps
acceptance awaits approved test publication and authenticated browser access;
controlled tests are not hosted acceptance.
See [spec.md](spec.md), [navigation model](data-model.md) and
[UI contract](contracts/ui-contract.md) for expected behavior.

## Prerequisites

- Node 24 with runtime/dependencies matching the checkout filesystem; follow README.
- Existing dependencies and Chromium. Install only if missing when validation needs them.
- Isolated synthetic fixtures with both record types, award/non-award Waypoints,
  planned routes, recorded tracks, dense clusters and missing coordinates.
- Data-router harness for routed editor guards. No production data or real credentials.

## Controlled test matrix

1. Both record types through nearby, marker and cluster paths; test contextual
   return and browser Back/Forward independently.
2. Compare every snapshot field, including resolved origin without a repeated
   search, non-default camera center/zoom/bearing/pitch and mobile panel.
3. Waypoint popup with zero Activities and with a related Activity action; confirm
   Waypoints mode survives the latter.
4. Independent history entries, explicit return into a new entry, refresh,
   direct detail, modified links and malformed hints.
5. Current-data rename, coordinate/filter change, deletion, missing geometry,
   same-dataset reload, failed load and accepted/cancelled/superseded dataset
   transitions, including A -> B -> A.
6. Deferred SDK readiness and instance recreation; verify final camera equals the
   captured camera after all initial fit effects settle. Fresh direct-track and
   deliberate route selections must still fit.
7. Dirty/pending editors, unchanged Challenge/Waypoint-list origins and unchanged
   Activity deletion destinations.
8. At 360x800 and 1280x800, admin/viewer and read-only Demo browsing: keyboard
   focus once, current absence explanation, full long-label names and no overflow.

## Executed validation

Executed on native Windows, Node 24.22.0/npm 11.19.1, with the existing dependencies
and Chromium. No dependency, timeout, worker-pool or coverage-threshold changes.

| Check                                                                      | Result                                                |
| -------------------------------------------------------------------------- | ----------------------------------------------------- |
| Editor diagnostics for helper/provider/Map/detail source and browser tests | No errors                                             |
| Prettier for changed source, tests and documentation                       | Passed                                                |
| Root lint, followed by scoped lint for subsequent changes                  | Passed; existing warnings listed below                |
| `npm.cmd run typecheck` after final source changes                         | Passed                                                |
| Historical six-file unit run after scope-provenance fix                    | 205/208 passed; three 10-second timeouts              |
| Historical detail-only run after long-title wrapping change                | 42/43 passed; evidence-save timeout remained          |
| New Map browser cases after fixture and wrapping fixes                     | 13/13 passed                                          |
| Existing Waypoint discovery/Challenge browser regressions in earlier run   | 42/42 passed                                          |
| Final full frontend coverage run after evidence-query fix                  | 792/792 passed across 44 files; all thresholds passed |
| Final production build                                                     | Passed; existing large-chunk warning                  |
| Final full browser suite, isolated preview                                 | 132/132 passed                                        |
| Final API lint/typecheck/coverage/build                                    | Passed; 383/383 tests across 11 files                 |
| Final built Functions host smoke tests                                     | 2/2 passed                                            |
| Hosted CI/test deployment/live SDK                                         | Pending authorized test publication                   |

The final combined helper/provider/Map/detail command was:

```powershell
npm.cmd test -- src\features\journey\mapExploration.test.ts src\features\journey\waypointDiscovery.test.ts src\features\journey\JourneyContext.test.tsx src\pages\MapPage.test.tsx src\pages\LocationDetails.test.tsx src\pages\ActivityDetails.test.tsx
npm.cmd run lint
npm.cmd run typecheck
```

The combined run passed all 65 Map cases and the helper, provider and Waypoint
discovery files. Its three failures were existing test cases:

- `ActivityDetails > retains added and reordered evidence after saving and reopening from persisted data`
- `ActivityDetails > updates the map action as a recorded track is attached and removed`
- `LocationDetails > edits a waypoint`

Each failed with the specific error `Error: Test timed out in 10000ms.`
After changing only the detail pages' long-text wrapping, their required recheck was:

```powershell
npm.cmd test -- src\pages\LocationDetails.test.tsx src\pages\ActivityDetails.test.tsx
```

This passed 42/43 cases, including the track and Waypoint-edit cases. The evidence
save/reopen case still timed out at 10 seconds. These are pre-existing test cases,
but their independence from this change has not been conclusively established.
No checks were weakened or timeout infrastructure changed. This initially blocked
T026; the following repair and full CI run resolved the blocker.

### Evidence-test repair and final publication checks

Instrumentation showed repeated whole-document label queries consumed much of
the evidence test. A direct comparison on the same editor found a label query
took 604 ms versus 344 ms for an equivalent accessible textbox-role query, and
asserted both returned the identical input collection. The final test scopes
queries to the existing native editor form, uses accessible roles and retrieves
the reopened title collections once instead of querying them inside each
assertion. It retains every add/reorder/save/reopen persistence assertion and
adds exact input-count assertions. Temporary instrumentation was removed.

The final targeted test passed within the unchanged 10-second budget (9.12
seconds). The full final coverage run then passed all 792 tests, including this
case. Frontend coverage was 92.12% statements, 89% branches, 91.33% functions and
93.3% lines, above the unchanged 80% thresholds.

After the repair, the complete local CI sequence was executed:

```powershell
npm.cmd run lint
npm.cmd run typecheck
npm.cmd run format:check
npm.cmd run test:coverage
npm.cmd run build
npm.cmd run test:e2e -- --config .map-publish.playwright.config.ts --workers=1 --retries=0 --reporter=list
wsl --cd 'C:\Users\hllew\OneDrive\Documents\CodeProjects\Journey\api' --exec bash -lc 'npm run lint && npm run typecheck && npm run test:coverage && npm run build && npm run test:smoke'
```

The temporary publication-check Playwright config used the same isolated 4175
preview approach as below, with output `dist-e2e\map-publish-da0dd6a2`. All 132
browser tests passed. The API used its existing Linux dependencies and Functions
Core Tools, passing 383 unit tests plus both built-host smoke tests. API coverage
was 94.33% statements, 87.25% branches, 97.91% functions and 96.35% lines.
Functions unit tests emitted their expected runtime/test-mode warnings; the
separate smoke tests exercised the actual built host.

The first publication formatting check also found the generated, local
`.specify/feature.json` needed Prettier formatting. It was formatted without
changing its feature-directory value, and the repository-wide check then passed.
No dependencies were installed or test pools/thresholds altered.

### Approved test publication target

The user approved publishing this branch to the existing test environment:
`https://black-hill-086daf403.3.azurestaticapps.net`, resolved from successful
manual test deployment run `39839774063`. Dispatch `deploy-test.yml` for
`022-map-exploration-return` with `deploy_infra=false` and `deploy_api=false`;
the workflow still performs its normal CI and isolated Cosmos test lifecycle.
Production (`https://red-bay-05fd86403.6.azurestaticapps.net`) is not a target.
Hosted checks and live SDK acceptance must be recorded after they actually run.

Existing lint warnings concerned Journey context/Challenge award Fast Refresh
exports and the Waypoint editor's default Challenge-ID memo dependency. Scoped
lint after the final changes reported no issues. The test-mode Vite bundle emitted
the existing large-chunk warning; it built successfully.

Use the existing full CI sequence before publication when requested. Do not
repeat unchanged successful checks or claim GitHub-only steps ran locally.

## Browser evidence and live Maps

The browser runner used an isolated preview at `http://localhost:4175` and the
ignored bundle `dist-e2e\map-return-da0dd6a2`, leaving the shared 4173 preview alone.
Its temporary `.map-return.playwright.config.ts` imported the standard config and
overrode `baseURL`, the web server URL/strict port, `reuseExistingServer: false`,
and the Vite build/preview output directory. The temporary config and task-owned
bundle were removed after validation; recreate those overrides before repeating
the commands below.

Playwright CLI file selectors are regexes: use basenames, not Windows backslash
file paths (which initially produced `No tests found`).

```powershell
npm.cmd run test:e2e -- map-exploration-return.spec.ts waypoint-discovery-return.spec.ts challenge-activity-journey.spec.ts --config .map-return.playwright.config.ts --workers=1 --retries=0 --reporter=list
npm.cmd run test:e2e -- map-exploration-return.spec.ts --config .map-return.playwright.config.ts --workers=1 --retries=0 --reporter=list
```

The first browser run passed all 42 existing regressions but failed all 13 new
cases on an invalid empty synthetic Challenge description. After correcting the
fixture, eight cases exposed actual long-title overflow in the detail pages.
Both detail pages now wrap unbroken text without truncating accessible names;
the final Map-only browser run passed all **13/13** in 53.5 seconds.

Verified controlled coverage:

- 360x800 and 1280x800, both admin/viewer, both record kinds, keyboard Enter,
  breadcrumb return and browser Back.
- Read-only Demo local at both widths, with no editing actions.
- Captured mode, edited unresolved origin text, the originating result's focus
  and viewport visibility, full accessible link names and measured
  `scrollWidth <= clientWidth` on both Map and detail pages.
- Exactly one initial origin lookup and zero record writes throughout the normal
  round trips; accepted dataset away-and-back permanently resets exploration.
- Empty current data stays distinct from explicitly unavailable Maps rendering.

Viewer Waypoint-return screenshots were reviewed at both widths:
`test-results\map-exploration-return-Map-e549b-breadcrumb-and-browser-Back-chromium\map-return-360.png`
and
`test-results\map-exploration-return-Map-8a867-breadcrumb-and-browser-Back-chromium\map-return-1280.png`.
They show the visible List result/focus treatment and unavailable-Maps warning.
Visual labels may ellipsize in the nearby list; their accessible names remain full.

UI self-review: existing theme spacing, MUI controls and shared detail header were
retained; labels/tabs align, errors use Alert, primary Map content is above the
fold at 1280x800, and neither width overflows. No shared component was copied and
no shared theme or form infrastructure was changed.

SDK-substitute unit cases cover both record kinds through nearby/marker/cluster
paths, exact non-default center/zoom/bearing/pitch after all fit effects settle,
delayed readiness and recreation, current-data geometry/selections, one-shot
focus and preserved fresh-track/deliberate-route fitting. Helper regressions cover
scope invalidation and old-hint reuse after a new capture/provider restart.
These are controlled contracts, **not actual SDK rendering evidence**.

### Live acceptance status: published to test; partial admin evidence

Test deployment [41356102484](https://github.com/Hsenrab/Journey/actions/runs/41356102484)
succeeded for commit `2c3226e96a89bda8a8f6a4be7b21ee5ab3aa7baf` at
`https://black-hill-086daf403.3.azurestaticapps.net`. Hosted frontend/API CI,
isolated Cosmos verification and backend-link verification passed. Infrastructure
and API deployment were disabled; Production was not deployed.

The authenticated browser was verified as `aad` with the `admin` invited role.
The existing Demo Cosmos load returned HTTP 500 and visibly fell back to
read-only Demo local. Demo local was then selected explicitly. Live checks used
its synthetic records and the real protected Maps token/search APIs and SDK.
No role, Maps response or SDK was mocked.

Admin nearby-list returns passed for both Waypoints and Activities, using
breadcrumb and browser Back, at 360x800 and 1280x800. Mode, mobile List panel,
edited origin text and originating-result focus were restored without overflow,
additional return searches or record writes. Stable desktop round trips matched
the SDK's public Feedback center/zoom values. An initial comparison sampled
interrupted camera animations and failed; subsequent stable returns matched
without drift. This does not independently measure numeric bearing/pitch.
Real touch pan/pinch changed Feedback center and zoom after touch emulation was
enabled before SDK initialization; initial incorrect gesture setup failed.

After a fresh hosted Map reload, a manual marker/cluster click produced no popup.
The cluster handler rejected GeoJSON Features by requiring editable Shape
methods, although the installed SDK's `MapMouseEvent` contract explicitly returns
Features for cluster points. New Feature-shaped Waypoint and Activity tests both
failed before the correction: `getClusterLeaves` was never called. The handler
now reads Feature properties and Point coordinates, as well as the SDK's Shape
representation. Cluster return fixtures also use actual Feature-shaped events;
both representations assert popup content, links and position.

The first correction typecheck failed because the SDK geometry classes do not
form a discriminated TypeScript union. Point coordinates are now narrowed after
the explicit `geometry.type === 'Point'` check; later CI steps did not run after
that failure.

Correction validation:

- `npm.cmd run lint`, `npm.cmd run typecheck` and `npm.cmd run format:check`
  passed; lint retained the existing four warnings.
- `npm.cmd run test:coverage` passed 792/794 tests, including all 67 Map tests
  and the Feature/Shape popup and Feature-based return regressions. It failed
  on unchanged editor tests `keeps the first reference and photo in place when
moving up or down` and `validates coordinate pairs and ranges`, both exceeding
  the unchanged 10-second limit. Coverage was not accepted as a passing gate.
- Isolated diagnosis with `npm.cmd test -- src/components/ActivityEditor.test.tsx
src/components/IdeaEditor.test.tsx -t 'keeps the first reference and photo in
place when moving up or down|validates coordinate pairs and ranges'` passed
  both without edits. This does not erase the full-suite failure.
- A subsequent coverage-enabled diagnostic run of those same two tests used
  temporary cumulative phase timings, removed afterward. Idea completed in
  6,138ms: render 574ms, pair validation 2,670ms, numeric validation 3,260ms,
  latitude validation 4,518ms and longitude validation 6,123ms. Activity completed
  in 6,190ms: render 934ms, References opened 1,442ms, reference actions 2,858ms,
  first photo 3,922ms, photo actions 5,909ms and final assertions 6,182ms.
  Both progressed throughout; neither isolated run showed a stalled wait.
  This supports substantial interaction cost and timing sensitivity, but does
  not establish the full-suite slowdown's cause or a justified 20-second budget.
  The diagnostic command exited 1 because selecting only two tests left global
  coverage below the unchanged 80% thresholds (statements 6.99%, branches 8.78%,
  functions 6.55%, lines 7.22%); it was not a passing coverage gate.
- Follow-up changes preserve the same user-event clicks, typing, clearing and
  assertions. Activity queries are scoped to the existing reference/photo
  containers and reuse their Add buttons; the repeated Photos-open check was
  removed because that section is already open. Idea resolves its stable
  title/coordinate inputs and Save button once instead of repeatedly scanning
  all labels/buttons after each render. Both targeted tests passed afterward
  (Activity 4,790ms, Idea 6,870ms without coverage). These separate runs are not
  a controlled performance comparison; full-suite validation was still required.
  The first follow-up typecheck caught an unsupported `exact` option on a role
  query; it was removed (string role names already match exactly). Coverage and
  later publication checks did not run in that attempt.
- The subsequent full coverage run passed both optimized editor tests and
  793/794 tests overall, but the ActivityDetails persisted-evidence test exceeded
  10 seconds (10,483ms). Its reference/photo interactions were then scoped to
  their existing evidence containers instead of searching the full editor.
  The same add/reorder/save/reopen and persisted-order assertions remain.
  The targeted test passed in 5,441ms without coverage; the previous failure
  remains recorded rather than being treated as a successful gate.
- `npm.cmd run build` passed with the existing large-chunk warning.
- `npm.cmd run test:e2e -- map-exploration-return.spec.ts --config
.map-cluster.playwright.config.ts --workers=1 --retries=0 --reporter=list`
  passed all 13 affected browser tests. The temporary config used isolated port
  4175 and `dist-e2e\map-cluster-da0dd6a2`; both were cleaned up afterward.

The final correction publication gate passed after the scoped-query changes:

- All **794/794** frontend tests in 44 files passed with coverage. Statements
  92.13%, branches 88.98%, functions 91.33% and lines 93.3% exceed the unchanged
  80% thresholds. All tests retain the 10-second limit and existing runner pool.
- The complete browser suite passed **132/132**, using isolated port 4175 and
  the temporary config described above. The successful production build remains
  applicable: subsequent source changes only affected tests and evidence docs.
- API lint, typecheck, **383/383** tests with coverage, build and **2/2** built
  Functions host smoke tests passed using the existing WSL tooling. Coverage was
  94.33% statements, 87.25% branches, 97.91% functions and 96.35% lines.
- Frontend lint, typecheck and formatting passed. After the final test-only edit,
  its formatting/lint and frontend typecheck were revalidated without repeating
  unchanged successful checks. No dependencies were installed.

The earlier failed attempts remain recorded above; they were not bypassed.
Only test-query costs were reduced; production editor code, interactions,
assertions, timeout, pool and thresholds were not weakened.

Correction commit `d4214eb8088d9bfd68c0255f71d384fd07061529` was pushed to
`022-map-exploration-return` and successfully published to the same test site in
[run 41371523651](https://github.com/Hsenrab/Journey/actions/runs/41371523651).
Hosted frontend/API validation, isolated Cosmos verification, backend-link
verification and application deployment passed for that exact SHA. Infrastructure
and API deployment were disabled; Production was not deployed. The shared hosted
Map was reloaded afterward: Demo local remained selected, the loading indicator
cleared and the real interactive Map became visible.

Publication is unblocked. The follow-up live recheck below supersedes the earlier
unverified cluster status. Stale hidden SDK popup DOM and inconclusive
projected-coordinate clicks were not counted as passes. T027 records limitations;
it does not mark all live acceptance passed.

### Live cluster recheck: 2026-11-02

The user activated a real numbered Waypoint cluster in the hosted shared browser.
A visible six-Waypoint popup appeared; its SDK container did not have the
`hidden-accessible-element` class. Opening Foxglove Manor succeeded, but the
first return could not reload Maps: `/api/maps/token` redirected to Microsoft
sign-in and the cross-origin fetch failed. That attempt was not counted as a
return pass. After the user signed in again, `/.auth/me` confirmed `aad` and
exactly the invited `admin` role. Only provider/role results were inspected.

All subsequent checks used explicit read-only Demo local data, the deployed
correction and the real SDK without mocks or data writes:

| Entry and record                                                 | Width     | Return                 | Result |
| ---------------------------------------------------------------- | --------- | ---------------------- | ------ |
| Visible Waypoint cluster -> Foxglove Manor                       | 360       | Back to Map breadcrumb | PASS   |
| Restored Waypoint popup -> Foxglove Manor                        | 360, 1280 | Browser Back           | PASS   |
| Related Activity link in Waypoint popup -> Spring orangery tour  | 360, 1280 | Browser Back           | PASS   |
| Visible Activity cluster -> Autumn cloister visit                | 1280      | Back to Map breadcrumb | PASS   |
| Restored Activity popup -> Autumn cloister visit, keyboard Enter | 360, 1280 | Browser Back           | PASS   |

The Activity cluster was manually activated in Activities mode and visibly
listed four Activities before navigation. On cluster returns, the current
record's individual popup was restored and focus went to `View waypoint` or
`View details`, rather than retaining the original cluster list. Related
Activity return restored focus to `Spring orangery tour`.

All successful round trips retained the SDK Feedback center/zoom, the expected
mode and mobile Map panel, with no horizontal overflow. The keyboard Activity
cases restored `:focus-visible`. Request listeners recorded zero additional Maps
searches and zero Journey writes throughout these successful checks.

Viewer live checks remain blocked: the user could not switch to a viewer account
during this recheck. Native individual-marker clicks, solid planned-route/dashed
recorded-track styling and independent numeric bearing/pitch remain unverified.
This is not a blanket live acceptance pass for both roles or all entry paths.
The SDK continued to emit its vector-tile warnings; one mobile Activity return
also emitted an `activity` image-loading warning. That warning's visual impact
was not independently established. The synthetic photo URL's ORB-blocked request
is separate from Maps navigation. No application changes, deployment or CI rerun
were needed for this recheck.

### Admin check completion; viewer deferred by request

The user explicitly deferred viewer checks and requested completion of the
remaining admin check. The same authenticated test session and read-only Demo
local fixtures were used; no Production data or write operations were needed.

- Opened Bramblewick Gate Walk through its real detail page's `View recorded
track on map` link. The resulting URL retained
  `?activityId=activity-demo-cotswold-midway`, selected Activities mode, fitted the
  recorded track and displayed the matching track notice.
- Reviewed actual SDK canvas screenshots at desktop and mobile widths. The
  recorded track rendered as a dashed blue line with a light outline. Selecting
  `Cotswold Way Explorer (Fictional Demo)` added the visually distinct solid
  orange planned route with a light outline. Both overlays were visible together
  at 1280x800 and 360x800. Deliberately toggling the route after resizing fitted
  it to the mobile viewport, rather than suppressing a fresh user-requested fit.
- Applied native keyboard rotation and pitch shortcuts, letting each action
  settle. The SDK announced `Map heading 30 degrees` before navigation.
  Screenshots before and after the return showed the same rotated/oblique view.
  A subsequent right/left rotation check announced 40 degrees then 30 degrees.
  These are public, rounded SDK announcements and visual evidence, not precise
  independent measurements of bearing/pitch.
- The user clicked a real individual Activity marker and opened the visible
  `Working mill day` popup. Its `View details` link opened the correct Activity;
  breadcrumb return passed at desktop and mobile widths. Explicit browser-Back
  checks then passed at both widths. The route remained selected, the original
  Bramblewick track context/notice remained active, and focus returned to
  `View details`, without horizontal document overflow.
- The first desktop return's Feedback center differed slightly:
  `51.79607941397518~-2.3396634668889646` before versus
  `51.795788659253304~-2.3400724111408855` after, at unchanged zoom
  `9.803947863482405`. Later stable returns at both widths matched the latter
  center and zoom exactly, without accumulating drift. This does not establish
  whether the first discrepancy came from actual camera movement or SDK Feedback
  sampling/quantization. Do not describe that first return as an exact numeric
  camera pass. Exact camera fields remain covered by controlled tests.
- One combined automated loop timed out after resizing. Its detail wait could
  also match the same heading in the Map popup rather than uniquely confirming a
  detail route, so the cause was ambiguous and its partial results were not
  counted. Separate checks explicitly
  waited for the Activity URL, then verified the restored Map and popup.
  Successful instrumented round trips recorded zero additional Maps searches
  and zero Journey writes.

The previously observed SDK sprite warnings recurred transiently during Map
recreation. Actual individual markers and clusters were visible and the native
individual Activity marker was clickable; a persistent missing-marker defect
was not established. No speculative SDK initialization change was introduced.

**Disposition**: the requested admin check is complete with the evidence and
measurement limits above. Both cluster types, a native individual Activity
marker, related-Activity navigation and route/track preservation were exercised.
A separate native individual-Waypoint click was not exercised; its Waypoint
cluster and restored-popup navigation were exercised. Viewer live acceptance is
explicitly deferred, not passed. Independent exact live pitch/bearing and the
initial Feedback-center discrepancy remain documented measurement limits, not
silently replaced with mock evidence.
