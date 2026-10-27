# Validation Guide: Waypoint Draft Protection

**Feature**: [spec.md](./spec.md) |
**Contract**: [waypoint-editor.md](./contracts/waypoint-editor.md)

The implementation adds the shared editor behavior and the focused browser test.
The scenarios below define acceptance; executed outcomes and limitations must be
reported separately rather than inferred from this guide.

## Prerequisites

- Work on `018-waypoint-draft-protection` with existing dependencies. Install only
  after a missing-dependency failure or manifest change.
- Use fictional fixtures and fresh isolated browser contexts. Do not use shared
  browser pages on port 4187, real Journey data or live Production writes.
- Use the existing Playwright Chromium/web-server configuration on port 4173.
  Verify any reused server belongs to this task and serves intended code; do not
  stop or change an unrelated process.
- Select remote data modes and intercept every Journey request with typed fixtures
  and a chosen role, following existing tests. Unexpected requests must fail the
  test rather than reach a real service.

## Implementation feedback and final checks

First add failing dirty-Cancel and deferred-save regression cases in
[WaypointEditor tests](../../src/components/WaypointEditor.test.tsx).
Run targeted cases only when useful while implementing.

After implementation is complete, format only changed implementation, test and
documentation files with installed Prettier, then run this final sequence once:

```powershell
npm run lint
npm run typecheck
npm test -- src/components/WaypointEditor.test.tsx src/pages/Locations.test.tsx src/pages/LocationDetails.test.tsx
npm run test:e2e -- e2e/waypoint-draft-protection.spec.ts
```

On this Windows workspace, Node/npm commands have previously used WSL:

```powershell
wsl.exe --distribution Ubuntu --cd 'C:\Users\hllew\OneDrive\Documents\CodeProjects\Journey' --exec npm test -- src/components/WaypointEditor.test.tsx src/pages/Locations.test.tsx src/pages/LocationDetails.test.tsx --pool=threads --maxWorkers=1
```

Use the same environment for other project commands if needed. Install Chromium
only if the browser run reports it missing. The existing Playwright server builds
an isolated test-mode bundle; a separate production build is not required for this
UI-only change.

Check changed-file editor diagnostics and the applicable
[UI self-review](../../docs/UI_GUIDELINES.md#self-review-checklist).
Do not rerun successful checks unless covered files change.

API/Cosmos integration checks, infrastructure validation and deployment are outside
this scope. Expand checks if dependency/build configuration changes. A later push
or PR requires the full local CI sequence; this guide does not replace that policy.

## Component and page scenarios

| Scenario                                                       | Expected evidence                                                                                |
| -------------------------------------------------------------- | ------------------------------------------------------------------------------------------------ |
| Untouched new/existing drafts                                  | Close once without prompt/submission.                                                            |
| Reverted values, tab-only or whitespace-only JSON              | Existing clean classification; no prompt.                                                        |
| Changed fields, membership, completion, location/evidence      | One prompt; decline preserves every value/position with no submit.                               |
| Invalid/unapplied JSON and loaded form changes                 | Both tabs/errors retained; clearing JSON does not hide applied changes.                          |
| Discard and reopen                                             | Correct parent context; saved values/new defaults replace abandoned work; no writes.             |
| Failed validation, location resolution or protected assignment | Existing message/draft remain; Cancel protects actual changes.                                   |
| Deferred save, repeated submits and Cancel attempts            | One callback/request, busy feedback, locked controls and no Cancel closure/prompt while pending. |
| Handled failure and deliberate retry                           | Lock released, draft/error retained, Cancel works; only explicit retry adds a write.             |
| Success                                                        | Parent performs existing success/close behavior once.                                            |
| Unexpected callback rejection                                  | Actual root `ApplicationError` displays exact original message, not fallback/success.            |

Use typed deferred promises, not sleeps. Update all Waypoint callbacks to the async
contract and await settlement where needed. Test the actual root error element
through a data router, as Activity lifecycle tests do, rather than expecting an
event-handler rejection to be caught automatically.

## Browser acceptance matrix

Use `e2e/waypoint-draft-protection.spec.ts`.

- At **360 by 800** and **1280 by 800**, cover admin add/edit in Production
  test-local and intercepted Demo Cosmos fixtures: unchanged Cancel, decline,
  discard and reopen. Compare saved data explicitly and count remote writes.
- At both sizes, hold a save request, verify disabled Cancel and single submission,
  then resolve with success or explicit failure. After failure verify retained
  fields/message and guarded Cancel.
- Cover intercepted Demo Cosmos viewers and Demo local read-only browsing,
  including direct `/waypoints?mode=add`. Assert no editor/mutation controls and
  zero writes. Cover Production viewers in page integration tests.
- Preserve the list URL's existing scope/query and the same edit detail URL.
  Do not invent new return-state behavior.
- Register native `dialog` listeners before Cancel. Verify the exact message and
  one dialog per dirty attempt; exercise acceptance and dismissal.
- Activate Cancel by keyboard, verify post-dismissal focus and reachable actions,
  and assert document width does not exceed the viewport while the add/edit
  Form and Paste JSON tabs are open and while a save is pending.
- Release held requests during fixture cleanup even after assertion failure.
  Do not mask failures or leave a pending route/server behind.

Playwright `dialog.accept()`/`dismiss()` checks application decision handling,
not native-dialog button keyboard behavior or visual layout. In an isolated
interactive browser, additionally focus Cancel, activate it with the keyboard,
decline using native controls and continue editing; repeat accepting discard.
Record browser/viewport and actual outcomes. If access is blocked, report that
coverage as blocked/unexecuted.

Mocks prove the frontend flow, not hosted Entra roles, Cosmos writes, ETag
enforcement or real geocoding. No backend behavior changes. Separate Activity
postcode-save defect #174 remains outside scope.

### Existing browser-harness boundary

The existing Playwright web server builds in Vite test mode. In that mode,
Production uses the legacy browser-local test path, not the Journey API, so a
Production browser fixture cannot exercise remote roles or delayed API saves.
Production cancellation/reopening is covered against isolated local test records;
remote pending/failure and viewer browser cases use intercepted Demo Cosmos.
The parent page tests explicitly select non-test mode and exercise mocked
Production and Demo Cosmos API failures and viewer restrictions. No alternate
test-server configuration, live-data write or service fallback is added.

## Implementation evidence

- The new dirty-Cancel and duplicate-submission regressions failed against the
  original runtime behavior as intended (three failures).
- The default Vitest fork worker could not start in this WSL/OneDrive workspace:
  `Failed to start forks worker`, caused by `Timeout waiting for worker to respond`.
  The bounded thread pool executes the focused tests without changing assertions.
- Interactive-browser access was attempted with a new isolated `about:blank`
  page. It failed with `browserType.connectOverCDP: Timeout 30000ms exceeded.`
  Actual native-confirmation keyboard/visual acceptance is blocked, not passed.
  Automated browser acceptance/dismissal does not remove this gap; T019 and T023
  remain incomplete until that interactive check is performed.
- Impact tracing confirms the only production change is the shared editor. Both
  page callers already await Journey mutations and own success/error presentation.
  Routing, API/schema/persistence, deployment configuration and existing
  navigation/unload safeguards are unchanged. Final checks are frontend-only.
- UI source self-review preserves theme spacing, MUI controls/tabs, field labels
  and the existing action row. Responsive overflow/focus checks belong to the
  automated browser run; native-dialog appearance remains unverified.

### Final executable results

| Check                                                                                   | Result                                                                                                                                |
| --------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------- |
| Changed-file Prettier and editor diagnostics                                            | Passed; no editor errors reported.                                                                                                    |
| `npm run lint`                                                                          | Exit 0; four warnings in unchanged logic: three Fast Refresh exports and the existing `defaultChallengeIds` dependency.               |
| `npm run typecheck`                                                                     | Passed after correcting the new test queries.                                                                                         |
| Component/page tests                                                                    | All 84 passed on the final source: 55 in the final combined run, then the remaining 29 in a focused run after a worker-start timeout. |
| `npm run test:e2e -- e2e/waypoint-draft-protection.spec.ts --workers=1 --reporter=line` | All 12 passed at 360 by 800 and 1280 by 800. The test-bundle build emitted a large-chunk warning.                                     |
| Interactive native-dialog keyboard/appearance                                           | Blocked by the CDP connection timeout above; not covered by automated dialog acceptance/dismissal.                                    |

The first complete combined unit run passed all 84 tests. After the final test
refinements, this command passed the editor/detail files (55 tests), but exited 1
before the list file could execute:

```powershell
npm test -- src/components/WaypointEditor.test.tsx src/pages/Locations.test.tsx src/pages/LocationDetails.test.tsx --pool=threads --maxWorkers=1 --reporter=dot
```

Its unhandled environment error was
`[vitest-pool]: Failed to start threads worker for test files .../src/pages/Locations.test.tsx`,
caused by `[vitest-pool-runner]: Timeout waiting for worker to respond`.
No assertion failed. The remaining file then passed all 29 tests with:

```powershell
npm test -- src/pages/Locations.test.tsx --pool=threads --maxWorkers=1 --reporter=dot
```

Two earlier implementation-check failures were fixed rather than bypassed:

- `npm run typecheck` reported `TS2769: No overload matches this call` because
  Testing Library role queries do not accept `exact`. Removing that unsupported
  option preserves their existing exact string-name matching; final typecheck
  passed.
- The focused browser command above initially failed eight cases with
  `locator.click: Test timeout of 30000ms exceeded`, waiting for a nonexistent
  `View waypoint` link name. The existing clickable cards were identified from
  the failure snapshot and their destination links selected instead. No timeout,
  application behavior or assertion was weakened; the final 12-case run passed.

### Executed requirement reconciliation

| Requirements                   | Executed evidence                                                                                                                                                                                | Status                                               |
| ------------------------------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ | ---------------------------------------------------- |
| FR-001, FR-002, FR-008; SC-003 | Shared-editor new/edit clean, reverted fields/evidence, JSON and validation-only cases; parent clean cancellation; browser unchanged/reverted cases with exact dialog counts.                    | Passed                                               |
| FR-003, FR-004, FR-006; SC-001 | Exact prompt, repeated declines, complete component snapshots including errors/JSON/ordered evidence; parent saved-data comparisons and zero browser cancellation writes.                        | Passed                                               |
| FR-005, FR-007; SC-002         | Add/edit discard and reopen, retained parent URLs, unchanged records, and discarding a failed protected-assignment edit.                                                                         | Passed                                               |
| FR-009, FR-013; SC-006         | Deferred lock and same-turn exclusion, failed-save retention/retry, parent-owned successful closure, root-error propagation and browser pending add/edit cases.                                  | Passed                                               |
| FR-010; SC-004                 | Both viewport sizes, keyboard activation of Cancel, post-dismissal focus and overflow assertions passed. Actual keyboard operation/appearance of the native confirmation could not be exercised. | Partial: T019/T023 open                              |
| FR-011; SC-005                 | Production/Demo Cosmos viewer and failure cases in page tests; intercepted Demo Cosmos viewers and Demo local direct-add/detail browser cases.                                                   | Passed within the documented mock/test-mode boundary |
| FR-012                         | Existing mode-switch/unload regressions passed; no new navigation blocker or hook changes; one native confirmation per dirty Cancel.                                                             | Passed                                               |

No hosted Entra, Cosmos, geocoding, deployment or live Production validation is
claimed. The unrelated UX backlog and shared browser pages were left untouched.

### Pull-request validation scope

The user explicitly limited publishing checks to impacted surfaces. The API has
no changed imports, callers, contracts, configuration or deployment behavior in
this feature; its local startup failure is outside the feature's validation scope.

A broader run had already executed before that clarification:

- The production frontend build passed.
- Repository formatting passed after formatting the ignored local Spec Kit
  feature pointer; that pointer is not part of the commit.
- The full browser run passed 73 of 74 cases. Its one failure was the existing
  Challenge-assignment test in `e2e/journey.spec.ts`: default dialog dismissal
  retained the changed editor, so the next `Edit waypoint` action timed out.
  That directly affected test now explicitly accepts the discard confirmation
  and is validated separately rather than rerunning unrelated browser flows.
  `npm run test:e2e -- e2e/journey.spec.ts --grep Challenge.assignments --workers=1 --reporter=line`
  passed its one selected case. An initial anchored selector returned `No tests
found`; it was replaced with the unique selector above.
- The full frontend coverage run was stopped; no passing full-suite coverage
  result is claimed.
- API lint/typecheck, 360 unit tests with coverage and build passed, but
  `npm run test:smoke -- --pool=threads --maxWorkers=1 --reporter=dot` failed during
  Functions host startup with `Value cannot be null. (Parameter 'provider')`.
  The isolated startup case reproduced that error. No API fix, bypass or
  successful complete API validation is claimed.

The existing GitHub CI workflow also runs the API job and has no path-scoped
input. Do not represent that full workflow as a feature-only check or trigger
deployment to obtain a preview.
