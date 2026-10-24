# Quickstart: Validate Single-Source Challenge-Waypoint Relationships

This guide describes implementation validation. Results below distinguish completed
local checks from remaining validation and hosted acceptance.

## Prerequisites

- Existing frontend and API dependencies and the repository's CI Node.js version.
- For the complete local CI-equivalent run, Chromium and Azure Functions Core Tools.
- Install dependencies only if missing or manifests/lockfiles changed.
- No Azure credentials or live dataset access is required for mocked/local checks.

### Windows and WSL execution

When using Linux Node.js and Azure Functions Core Tools through WSL, keep the
checkout and its dependencies on WSL's native Linux filesystem, not the Windows
mount under `/mnt/c` (including OneDrive). Open that checkout with VS Code's WSL
integration. Do not move an existing dirty checkout without preserving its changes.
Microsoft recommends keeping files on the same operating system as the tools for
[filesystem performance](https://learn.microsoft.com/en-us/windows/wsl/filesystems).

This feature's Windows-mounted checkout caused Vitest worker-startup timeouts and
a Functions host failure after `WorkerInitRequest` reporting
`Value cannot be null. (Parameter 'provider')`. An isolated native-filesystem copy
of the same source, dependencies, and host/test configuration ran both Functions
smoke tests successfully in 10.73 seconds. No application fix, timeout increase,
retry setting, extension-bundle change, or Core Tools reinstall was needed.

## Focused implementation feedback

From the repository root, select the affected domain, context, API-client, storage,
page, and map tests with the existing Vitest runner. For example:

```powershell
npm test -- src/domain/visit.test.ts src/domain/gpxMap.test.ts src/features/journey/JourneyContext.test.tsx src/services/storage.test.ts src/services/journeyApi.test.ts src/pages/Dashboard.test.tsx src/pages/ChallengeDetails.test.tsx
```

From `api`, use the existing focused API suites:

```powershell
npm test -- src/lib/journeySchema.test.ts src/lib/journeyGraph.test.ts src/lib/cosmos.test.ts src/functions/journey.test.ts
```

Expected cases include:

1. Zero/multiple assignments, overlapping Challenges, exact member counts, unchanged
   progress and category rules, and tracks derived only through assigned Waypoints.
2. Add/remove/cancel assignment edits, preserving other assignments and history.
3. Reject removal that would invalidate awarded Activities; retain saved data/draft.
4. Reject duplicate/dangling assignments on reads, imports, and mutations.
5. Reject obsolete Challenge fields (including empty lists), Challenge document
   versions 1/2, version-1 backups, and obsolete fields inside version-2 backups.
6. Valid version-2 backup round trip preserves all records and canonical assignments.
7. Waypoint update/delete does not write Challenge documents; linked deletion stays
   atomic and preserves existing detachment/pruning and conflict handling.
8. Specific API validation errors and unchanged Production/Demo failure UX, roles,
   and read-only restrictions.

## Final implementation validation

Because this feature changes both frontend and API data contracts, run the complete
local sequence from `.github/workflows/ci.yml` once after implementation:

From the repository root:

```powershell
npm run lint
npm run typecheck
npm run format:check
npm run test:coverage
npm run build
npm run test:e2e
```

From `api`:

```powershell
npm run lint
npm run typecheck
npm run test:coverage
npm run build
npm run test:smoke
```

Install Playwright Chromium only if the user-flow run requires it. The current API
build uses POSIX copy commands, so use the existing supported Linux/WSL execution
environment for that build rather than changing scripts merely for this feature.
Run formatting on intended changed files before the final checks.

For local user-flow acceptance, cover Waypoint assignment changes reflected by
Challenge details/progress, cancellation, multi-Challenge preservation, and invalid
backup rejection using isolated test fixtures and mocked API boundaries. Never use
production records or a real import/clear action as a test.

## Release limitation

Old hosted Challenge documents and old backups are deliberately incompatible.
Separate correction must be arranged before using those records with the new app;
this guide does not authorize it. Demo reseeding remains part of the existing
deployment process, not a local validation step. Do not trigger deployments.

Local checks do not prove hosted Entra, Cosmos, or Maps acceptance. Actions
artifact uploads, credentials, OIDC, and hosted deployment checks are not local
steps and must not be reported as executed.

## Implementation validation results (2026-10-23)

Checks use the existing Node.js 24 installation through WSL; no dependencies,
browser binaries, or Azure resources were installed or changed for this feature.

- Frontend lint and typecheck passed. Lint retains three existing warnings
  (WaypointEditor hook dependencies and JourneyContext Fast Refresh exports).
- Production frontend build passed, with the existing large-bundle warning.
- Browser flows: the first full run passed two unchanged remote-editing flows.
  Its four failures exposed an obsolete authored Challenge fixture and a
  production-incompatible icon test ID in the new test. After correcting those
  tests, all four affected flows passed with
  `npm run test:e2e -- --grep 'Challenge assignments|activity management flow'`.
  This includes assignment add/remove/cancel, preserved second membership,
  Challenge-detail consistency, and version-1 backup rejection without writes.
- API lint, typecheck, coverage, and build passed: 203 tests across 10 files;
  coverage 90.01% statements, 81.61% branches, 92.53% functions, 92.8% lines.
- API `npm run test:smoke` initially failed twice on the Windows mount: the normal built package host exited
  after `WorkerInitRequest` with `Value cannot be null. (Parameter 'provider')`.
  The negative missing-routes test passed.
  no check or host configuration was weakened to bypass this error.
  A bounded follow-up found no new top-level provider initialization and unchanged
  Function registration metadata; Node imported all three compiled Function
  modules successfully. The host/worker indexing failure
  was isolated to cross-filesystem execution by the later native-filesystem
  run: both smoke tests passed with identical source and configuration. Source,
  manifest, lockfile, and host configuration contents were compared byte-for-byte.
- Full frontend `npm run test:coverage -- --pool=threads` on the Windows mount did not complete and
  was stopped after prolonged worker startup. Earlier targeted runs reported
  `[vitest-pool]: Failed to start ... worker` in both forks and threads. Full
  frontend coverage from those earlier attempts is not claimed.
  The native-filesystem full run completed without worker-startup timeouts and
  exposed three invalid map-test fixtures that removed Challenges while leaving
  Waypoint assignments to them. Those fixtures now retain referenced Challenges
  while isolating the planned routes under test. All 31 MapPage tests passed
  before the final full coverage run.
- The Settings version-error regression initially failed because the UI discarded
  validation details. The UI now displays specific expected parse/schema failures
  in its existing error alert. All 25 Settings tests passed in the final standalone
  run, including obsolete fields in a current-version backup.
- The final combined targeted run passed all 110 tests in domain, Dashboard,
  LocationDetails, and JourneyContext suites, but exited 1 because its Settings
  worker could not start. The standalone Settings rerun above passed without
  altering worker timeouts or tests.
- Final native-filesystem frontend coverage passed: 495 tests across 36 files
  in 238.73 seconds, with 90.86% statements, 86.31% branches, 87.76% functions,
  and 91.73% lines. All existing 80% thresholds passed. The runner command was
  `node node_modules/vitest/vitest.mjs run --coverage`, equivalent to the
  `test:coverage` script, with no pool or timeout override.
- The native-filesystem API was built with the existing TypeScript compilation
  and Demo-fixture copy steps, then checked with
  `node node_modules/vitest/vitest.mjs run --config vitest.smoke.config.ts`.
  Both smoke tests passed, including verification that every expected route
  rejects unauthenticated requests.
- After the final fixture correction, frontend typecheck and targeted MapPage
  lint/format checks passed. No production frontend/API code changed during
  this follow-up. Earlier successful builds, static checks, API coverage,
  and browser-flow results above remain applicable. T027 is now complete.

The diagnostic copies were temporary; the original dirty Windows checkout was
not moved. Future WSL runs should use a native Linux checkout as described above.
The test-copy archives contained two unreadable dependency CLI links
(`gl-style-format` and `is-docker`); the required Vitest/TypeScript entry points
were invoked directly with Node rather than relying on copied CLI links.
No application source, runtime validation, coverage threshold, or host
configuration was changed to obtain the passing results.

No commit, push, deployment, live-data read/write, migration, or record correction
was performed. Hosted Entra/Cosmos/Maps and Actions-only steps were not run.
