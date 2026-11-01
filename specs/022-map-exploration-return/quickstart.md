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

### Live acceptance status: pending test publication and authentication

Initially no approved usable authenticated Maps environment was supplied; the
user has now confirmed the test site and availability of admin/viewer access.
Live acceptance is still unexecuted until the feature is published and the browser
is authenticated. The controlled
token endpoint returns 404 and the UI explicitly reports unavailable rendering.
Actual SDK camera restoration, marker/cluster actions, touch/keyboard interaction,
and solid planned-route/dashed recorded-track rendering remain **unexecuted** for
admin/viewer at both widths. No browser SDK alias, token fallback, real Production
fixture, hosted/API validation or Azure deployment was introduced to approximate
these checks. T027 records this limitation; it does not mark live acceptance passed.
