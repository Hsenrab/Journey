# Quickstart: Validate the Challenge Activity Journey

Use the
[UI contract](./contracts/challenge-journey-ui.md) for required outcomes and
[data model](./data-model.md) for scope/progress rules.

## Prerequisites

- Use the existing repository dependencies, Node.js 24, and npm.
- In the current Windows environment, Node/npm are available in Ubuntu WSL.
  Commands below run from the repository root in Windows PowerShell.
- Do not run `npm ci` unless dependencies are missing or a lockfile change
  requires it. No dependency or runtime changes are planned.
- Playwright's existing Chromium project is the browser target. Install
  Chromium only if an actual browser run reports it missing.
- Do not use live Production records, deploy Azure resources, or claim mocked
  tests prove hosted Entra authentication, RBAC, or real Maps rendering.

For manual work, `wsl.exe --distribution Ubuntu --cd
'C:\Users\hllew\OneDrive\Documents\CodeProjects\Journey' --exec npm run dev`
starts the existing development server. Real authenticated data still requires
the documented hosting boundary; do not introduce a local authentication bypass.
Prefer isolated browser fixtures for repeatable acceptance.

## Fixture setup

Extend existing [fictional builders](../../src/test/demoData.ts) and the
[award browser fixture pattern](../../e2e/challenge-awards.spec.ts):

- Use stable fictional IDs/names and a fixed date.
- Include zero/partial/complete/empty Challenges, a shared member, ordinary and
  award-enabled Challenges, once/count rules, and exact/above-target counts.
- Intercept existing identity/Journey APIs to provide admin or viewer roles
  and retain committed in-memory fixture state after writes.
- Mock the existing Maps boundary explicitly; Maps authorization/rendering is
  not this feature's acceptance target.
- Track Journey reads/writes, distinguishing existing unrelated Maps calls.
- Include same record IDs across different data modes to prove scope validation,
  not just ID mismatch. Simulate the documented Demo load exception and explicit
  Production failure separately.
- Keep each test isolated; do not create another committed Demo dataset.

## Checks after implementation

During implementation, use editor diagnostics and focused tests as useful.
Once implementation is complete, format changed files and run the impacted
frontend checks once. The following selectors include existing guard/caller
regressions and the new suites.

```powershell
wsl.exe --distribution Ubuntu --cd 'C:\Users\hllew\OneDrive\Documents\CodeProjects\Journey' --exec npm exec -- prettier --write src/domain/visit.ts src/domain/visit.test.ts src/domain/activityDraftValidation.ts src/domain/activityDraftValidation.test.ts src/features/journey/challengeJourney.ts src/features/journey/challengeJourney.test.ts src/features/journey/JourneyContext.tsx src/features/journey/JourneyContext.test.tsx src/components/ActivityEditor.tsx src/components/ActivityEditor.test.tsx src/components/ActivityEditor.lifecycle.test.tsx src/components/Layout.tsx src/components/Layout.test.tsx src/pages/ChallengeDetails.tsx src/pages/ChallengeDetails.test.tsx src/pages/LocationDetails.tsx src/pages/LocationDetails.test.tsx src/pages/Dashboard.tsx src/pages/Dashboard.test.tsx e2e/challenge-activity-journey.spec.ts docs/pages/dashboard.md docs/pages/locations.md docs/pages/visits.md
wsl.exe --distribution Ubuntu --cd 'C:\Users\hllew\OneDrive\Documents\CodeProjects\Journey' --exec npm run lint
wsl.exe --distribution Ubuntu --cd 'C:\Users\hllew\OneDrive\Documents\CodeProjects\Journey' --exec npm run typecheck
wsl.exe --distribution Ubuntu --cd 'C:\Users\hllew\OneDrive\Documents\CodeProjects\Journey' --exec npm test -- src/domain/visit.test.ts src/domain/activityDraftValidation.test.ts src/features/journey/challengeJourney.test.ts src/features/journey/JourneyContext.test.tsx src/components/ActivityEditor.test.tsx src/components/ActivityEditor.lifecycle.test.tsx src/components/Layout.test.tsx src/pages/ChallengeDetails.test.tsx src/pages/LocationDetails.test.tsx src/pages/Dashboard.test.tsx src/pages/Activities.test.tsx src/pages/ActivityDetails.test.tsx src/pages/IdeaDetails.test.tsx src/app/App.test.tsx --maxWorkers=1
wsl.exe --distribution Ubuntu --cd 'C:\Users\hllew\OneDrive\Documents\CodeProjects\Journey' --exec npm run test:e2e -- e2e/challenge-activity-journey.spec.ts e2e/activity-recording.spec.ts e2e/challenge-awards.spec.ts e2e/journey.spec.ts --project=chromium --workers=2 --reporter=line
```

Adjust the formatting selector to the actual changed files, including any
changed caller tests. Existing
[Playwright configuration](../../playwright.config.ts) builds the isolated test
application and starts preview on port 4173; do not start a second server or
reuse an unrelated server on that port. Test-mode fixtures are not a new
Production storage path.

The isolated browser build uses Vite test mode, whose selected Production mode
loads the existing browser-local test fixture rather than the Production API.
An intercepted Production API failure therefore cannot validate that boundary.
Production-mode component/provider tests cover explicit Production load failure
and suppression of retained progress; browser tests cover the visibly warned
Demo Cosmos fallback. No extra server or alternate persistence path is added.
The pending-write guard also intentionally blocks Settings after its editor has
unmounted, until the mutation settles; no delayed navigation occurs.

Run a separate production build if build/configuration files change. API
checks are not required for the planned frontend-only implementation. A later
explicit push/PR request instead requires the complete local sequence in
[ci.yml](../../.github/workflows/ci.yml), followed by the requested remote checks.
The known local Functions host failure, `Value cannot be null. (Parameter
'provider')`, was reproduced on baseline; earlier GitHub CI success does not
mean this local limitation was fixed. Report any blocker exactly; never bypass it.
No push, deployment workflow, or Azure change is authorized by this guide.

## Core acceptance matrix

Use both exact viewports: **360x800** and **1280x800**.

| Role   | Starting progress | At each viewport                                                                                     |
| ------ | ----------------- | ---------------------------------------------------------------------------------------------------- |
| Admin  | Zero              | Discover Challenge, inspect summary, open next member, record, inspect confirmation, return twice.   |
| Admin  | Partial           | Record a partial count increment and a threshold crossing; verify their different aggregate effects. |
| Viewer | Zero              | Same discovery/navigation/progress explanation; no editor/route-write controls or writes.            |
| Viewer | Partial           | Same accurate counts and return actions; read-only explanation and Settings link.                    |

These four cases at two sizes are eight combinations. Read-only Demo local
needs additional parity coverage; viewer is not a substitute for testing it.

### Main writable journey

1. Open Dashboard, then the selected Challenge. Verify completed/total/percentage,
   the completed-Waypoint explanation, and next-member action before route
   administration. Do not open every member to discover overall progress.
2. Open a member and verify `Back to [original Challenge]` names that Challenge,
   even if another Challenge shares the Waypoint.
3. Open Log activity. Assert the title field is the active element and visible.
4. Submit invalid data, then correct reported title/date/location and conditional
   award/evidence cases. Assert visible errors and `aria-invalid` update by
   blur/selection completion, still-invalid errors remain, and correction
   causes no write or focus jump.
5. Save once. Assert one write, retained Waypoint route, mounted confirmation
   container as active element, and confirmation visible without user scrolling.
   The return button must not receive automatic focus.
6. Use the named return once. Assert actual member counts/aggregate match the
   committed fixture with no reload or extra progress-specific Journey read.
7. Use page-level Back to Dashboard once. Assert identical completion percentage
   and preserved Recently visited completion/award distinctions.

### Measure Save reach and responsive behavior

For ordinary and award-required minimal drafts at each viewport:

1. Keep empty optional evidence collapsed and make the last applicable required
   field visible, as when completing it.
2. Record that position's scroll offset. Reveal Save using no more than the
   actual viewport height of additional downward scrolling.
3. Assert Save's full bounding box is in the usable viewport, not covered by
   headers/overlays, and actionable, without expanding optional content or
   traversing Waypoint history.
4. Assert document width does not exceed viewport width. Repeat with long
   names/wrapped feedback and keyboard activation. Inspect visible focus,
   not just `document.activeElement` or a screenshot.

### Negative and regression acceptance

- Direct/list/reloaded visits do not invent a Challenge return; Activity
  details/edit destinations and Idea-origin successful returns remain unchanged.
- Shared membership returns to the selected origin, not the first Challenge.
  Deleted Challenge, removed membership, malformed state, different selected or
  active mode, and stale document marker remove the invalid return.
- A draft moved/unlinked retains a valid original return. Confirmation clearly
  reports non-contribution; moving to another member uses actual progress.
- Dirty return: decline preserves the draft; accept navigates without saving.
  Pending mutation blocks navigation/duplicates; failure/conflict preserves
  draft/error. None of these produces a success transition.
- Success followed by loaded deletion/reassignment does not preserve invented
  progress or a stale contribution message.
- Verify once, count target one, exact/above-target, and empty behavior; empty is
  not 100%. Loading/failure never looks like zero progress or stale success.
- Ordinary/eligible/unrecorded/highest award states retain feature 017 behavior,
  exact statistics, and history protections.
- Verify coordinate-pair and requirement-changing corrections, indexed evidence
  removal/reordering, JSON/GPX error independence, attachments, and page-level
  save-error retention across every shared Activity entry/edit surface.
- Settings/data-mode guard behavior still passes after its API is generalized;
  read-only notices and all existing route capabilities remain available.

## Completion evidence

Record exact commands/results, browser matrix outcomes, measured focus/scroll,
and any blockers. Complete the
[UI self-review](../../docs/UI_GUIDELINES.md) and update
[Dashboard](../../docs/pages/dashboard.md),
[Waypoints](../../docs/pages/locations.md), and
[Activities](../../docs/pages/visits.md) guidance. Do not mark feature acceptance
complete from planning, unit tests alone, or mocked hosted-service claims.

### Recorded implementation results

Validation ran in Ubuntu WSL with Node 24.22.0 and npm 11.19.1. The impacted
surface is the root frontend: shared completion/validation helpers, provider and
Settings/data-mode guard, Activity editor and its callers, Dashboard, Challenge
and Waypoint details, test setup/fixtures, and the four browser suites above.
There are no dependency, persisted-schema, API, infrastructure, or build-config
changes. No production build, API checks, hosted authentication, deployment, or
real Cosmos/Maps acceptance is claimed.

| Check              | Final evidence                                                                                                                                                                                       |
| ------------------ | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Formatting         | Explicit changed-file Prettier selectors passed; final evidence/task Markdown formatted separately.                                                                                                  |
| Lint               | Root `npm run lint`: 0 errors, 4 existing warnings; subsequent changed-test Oxlint selectors: 0 errors/warnings.                                                                                     |
| TypeScript         | `npm run typecheck` passed after correcting the new test types.                                                                                                                                      |
| Unit/component     | 310 distinct tests across the 14 selected suites passed across the main run and targeted reruns.                                                                                                     |
| Chromium           | 60 distinct cases across the four selected suites passed across the main run and targeted reruns, including all eight viewport/role/starting-progress combinations.                                  |
| Origin/loaded data | Shared/direct/reloaded origins, matching IDs across data modes, removed membership, deleted records, reassigned/deleted Activities, and warned read-only fallback passed.                            |
| Failure/guard      | Dirty accept/decline, pending saves after editor unmount, conflict/error retention, cancelled drafts, and Production failure without stale progress passed.                                          |
| Focus/keyboard     | Recording-entry and success-container focus, visible targets, reported correction without refocusing, keyboard Save/Cancel with the existing discard prompt, and keyboard membership removal passed. |

The full 14-suite run initially had 306 passes and 3 failing new assertions.
The corrected three-page rerun had 70 passes and one failing test-only draft
construction; the final Waypoint suite passed all 16 tests after preserving
its reference/photo draft fields. Unique successful coverage is 239 unchanged
tests plus 37 Challenge, 18 Dashboard, and 16 Waypoint tests, not a claim that
one uninterrupted 310-test run was green.

The final four-file browser run had 56 passes and four failing new cases.
Correcting the isolated delete mock and existing deletion destination/read
expectations produced passing targeted cases. The extended keyboard Cancel
case required accepting its existing dirty-discard prompt; both viewport cases
then passed. Successful cases were retained rather than rerun without a
relevant change. The existing Activity-details delete explicitly reloads once;
save/reassignment/return introduce no extra progress-specific read.

Targeted follow-up commands, using the same WSL prefix as above:

```text
npm test -- src/pages/Dashboard.test.tsx src/pages/ChallengeDetails.test.tsx src/pages/LocationDetails.test.tsx --maxWorkers=1
npm test -- src/pages/LocationDetails.test.tsx --maxWorkers=1
npm run test:e2e -- e2e/challenge-activity-journey.spec.ts --project=chromium --workers=2 --reporter=line --grep "loaded Activity reassignment|loaded membership and record deletion"
npm run test:e2e -- e2e/challenge-activity-journey.spec.ts --project=chromium --workers=2 --reporter=line --grep "loaded Activity reassignment|long recording, correction"
npm run test:e2e -- e2e/challenge-activity-journey.spec.ts --project=chromium --workers=2 --reporter=line --grep "long recording, correction"
```

| Viewport | Ordinary minimal draft: extra Save scroll | Award-required minimal draft: extra Save scroll |
| -------- | ----------------------------------------- | ----------------------------------------------- |
| 360x800  | 0 px                                      | 627 px                                          |
| 1280x800 | 0 px                                      | 627 px                                          |

Both are below the 800 px limit. Ordinary Save was fully visible below the
header, empty optional evidence stayed collapsed, and long titles/descriptions
plus 40 historical Activities caused no horizontal overflow. Existing action
placement meets the criterion, so no sticky or duplicate Save action was added.
Populated/expanded evidence remains covered by the existing editor and Activity
recording regressions. UI self-review passed for theme spacing, shared
components, field labels, explicit states, wrapped actions, and above-the-fold
Challenge progress/next action before member progress and route administration.

One early concurrent Vitest feedback run failed to start an App worker:
`[vitest-pool-runner]: Timeout waiting for worker to respond`.
Subsequent bounded single-worker runs completed without increasing timeouts or
weakening assertions. The browser build retained its existing bundle-size
warning. No unresolved implementation validation failure remains; the
Production browser-harness and local Functions-host limitations described above
remain explicit. No commit, push, or deployment was performed.
