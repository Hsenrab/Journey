# Quickstart: Validate Challenge Member Progress

This is the validation guide and local execution record for this feature.
See [UI contract](contracts/challenge-member-progress.md) and
[data model](data-model.md) for exact outcomes.

## Prerequisites

- Existing Node.js 24 and frontend dependencies.
- Playwright Chromium only when the browser checks require it; install only if
  missing. Do not install dependencies unless a chosen check reports them missing
  or dependency manifests change.
- With Linux Node through WSL, use a native Linux checkout, not `/mnt/c` or the
  OneDrive checkout. Preserve unrelated dirty files; do not move/delete them.
- Synthetic fixtures and mocked APIs only; no Azure credentials or hosted
  mutations required.

## Focused implementation feedback

From the repository root:

```powershell
npm test -- src/pages/ChallengeDetails.test.tsx src/domain/visit.test.ts
```

Add missing regressions without duplicating existing rule coverage. Scope label
queries to each member card so identical labels cannot satisfy the wrong member.

## Acceptance scenarios

1. Use once-mode members with zero and multiple Activities, and count-mode members
   for every row in the data-model table. Verify count and explicit completion.
2. Assign a Waypoint to two Challenges. Confirm both and its detail page agree.
3. Include direct-Challenge-only and other-Waypoint Activities. Neither must
   contribute to the tested member; award categories/dates must not filter counts.
4. Through existing context/provider mechanisms, load added, deleted, and
   reassigned Activities. Verify old and new members reflect the loaded changes.
   Confirm a dataset switch does not retain previous progress.
5. Run viewer, Demo local, and existing warned Demo fallback cases without
   enabling writes. Compare progress with writable data of the same shape.
6. Preserve empty/loading/failure/missing-Challenge behaviour. Keep existing
   route/map regression tests passing.
7. In an isolated browser fixture with no map features, render multiple members,
   long titles, and count labels at 360x800 and 1280x800. Scope text checks to
   cards, inspect clipping/overlap, and assert document scroll width does not exceed
   viewport width. Follow View waypoint by keyboard and check its destination.
8. Spy on mutation requests and record writes during viewing/navigation; assert
   zero caused by displaying progress. Existing mode-preference writes are not
   entity mutations. Track Journey API reads as well: rendering or rerendering
   progress on an already-loaded page must not issue extra dataset requests.
   Distinguish existing provider loading, explicitly requested reloads, dataset
   switches, and full-page navigation loads from requests caused by progress.

## Final scoped validation

After implementation, format only intended changed files using existing Prettier.
Then run:

```powershell
npm run lint
npm run typecheck
npm test -- src/pages/ChallengeDetails.test.tsx src/domain/visit.test.ts src/pages/LocationDetails.test.tsx src/pages/Locations.test.tsx src/pages/Dashboard.test.tsx
npm run test:e2e -- --grep 'Challenge'
```

The implementation must give the new browser case a title containing `Challenge`
so this selector covers both new behaviour and existing Challenge flows. Exercise
both specified widths in the new case rather than assuming the default viewport.
Apply the UI guidelines self-review checklist to the changed member card.

No API checks or production build are necessary for presentation-only changes
with unchanged configuration. Escalate validation if actual impact expands;
push/PR work requires the full local CI sequence in `.github/workflows/ci.yml`.
Do not repeat successful checks unless their covered files change.

## Recording results and delivery

During implementation, record actual commands, test counts, viewport results,
and any precise blockers here or in execution evidence. Never substitute passing
unit tests for viewport acceptance, claim unexecuted hosted behaviour, or weaken
timeouts/assertions to obtain a pass.

Planning does not authorize commits, pushes, merges, or deployment. Future merges
use regular merge commits, not squash, per the user's preference.

## Local execution evidence (2026-10-24)

Validation used Node.js 24.22.0 on a temporary WSL-native copy with identical
application sources. The initial copied dependencies lacked `vitest/dist/cli.js`
(`ERR_MODULE_NOT_FOUND`), so `npm ci` restored dependencies in that copy only;
repository manifests and lockfile were unchanged. Installation reported eight
dependency vulnerabilities (three moderate, five high); no dependency upgrades
were attempted in this presentation-only feature.

### Implementation and regression results

- Before implementation, `npm test -- src/pages/ChallengeDetails.test.tsx -t
'shows once completion'` failed all three new cases because completion labels
  were absent. The corresponding `-t 'shows count'` run failed all five new count
  cases for the same expected reason.
- Formatted intended changed frontend and documentation files with the existing
  Prettier CLI.
- `npm run lint`: passed, zero errors and three existing warnings in
  `WaypointEditor.tsx` and `JourneyContext.tsx`. After the wrapping fix,
  `npm run lint -- src/pages/ChallengeDetails.tsx src/pages/ChallengeDetails.test.tsx`
  passed with zero warnings/errors.
- `npm run typecheck`: passed, including after the final page change.
- The five-file test command above exercised **108 tests**. Four files passed;
  one new Challenge-details assertion initially omitted the existing Production
  error prefix. The assertion was corrected to the complete, unchanged error
  message. The final affected-file rerun,
  `npm test -- src/pages/ChallengeDetails.test.tsx`, passed **34/34**. Together with
  the unchanged four files' **74/74**, all **108** scoped tests passed.
- `npm run test:e2e -- --grep Challenge`: final run passed **6/6** Chromium flows,
  including four new admin/viewer x 360x800/1280x800 cases, the existing
  single-source membership flow, and the linked-GPX Challenge flow.
- Initial browser acceptance demonstrated long unbroken title overflow
  (1040px document width at 360px; desktop title text outside its card).
  Inherited `overflowWrap: anywhere` on the existing member Stack fixed it.
  Final geometry checks confirmed no title/label clipping or overlap and
  document width no greater than either required viewport. Desktop completion
  was visible above the fold; keyboard focus and Enter followed View waypoint.
- Browser viewing and client-side Waypoint navigation used one dataset GET;
  deliberate full-page navigation to the second Challenge used one more.
  No mutation requests or persisted entity records resulted from viewing.
  Component rerenders added no reads; explicit reloads reflected Activity
  addition, reassignment, and deletion for both admin and viewer.
- Empty, missing, loading, and failed Production states produced no invented
  completion. Demo local and the explicit Demo Cosmos fallback remained
  read-only, with the fallback notice preserved.

### Impact and UI review

Only Challenge member rendering changed in production code. Its existing route
in `App.tsx`, loaded context, membership ordering, shared helper arithmetic,
Waypoint views, planned routes/maps, schemas, services, and deployment paths
are unchanged. Domain additions are tests only. No API checks or standalone
production build were needed; Playwright built its test-mode frontend.

The changed card retains theme Stack spacing, uses textual completion rather
than colour, adds no form/tabs/control variants, duplicates no shared component,
and preserves existing empty/loading/error handling. Browser checks cover
wrapping and desktop above-the-fold content.

No outstanding local validation blocker. Vite emitted its existing large-chunk
warning during the browser build. Coverage collection and hosted/Azure acceptance
were not run or claimed. No commit, push, merge, deployment, or hosted data
mutation was performed.

## Pre-push full local CI (2026-10-25)

After explicit authorization to commit and push, the complete local command
sequence from `.github/workflows/ci.yml` passed on a WSL-native source copy:

- Frontend lint, typecheck, repository formatting check, coverage tests,
  production build, and all browser tests.
- **510/510 frontend tests** across 36 files; coverage: statements **90.86%**,
  branches **86.46%**, functions **87.76%**, lines **91.73%**. All 80% thresholds passed.
- **10/10 Chromium browser flows**, including both widths and roles for member
  progress, passed using the existing installed browser.
- API lint, typecheck, coverage tests, build, and built Functions-host smoke tests.
- **203/203 API tests** across 10 files; coverage: statements **90.01%**,
  branches **81.61%**, functions **92.53%**, lines **92.8%**. All thresholds passed.
- **2/2 Functions-host smoke tests** passed with Core Tools 4.16.0.

Missing dependencies in the isolated copy were restored using `npm ci` after
the initial commands reported `vitest: not found`. Both package installs reported
eight dependency vulnerabilities (three moderate, five high); manifests and
lockfiles were not changed. The three pre-existing frontend lint warnings and
Vite large-chunk warnings remain non-failing.

Actions artifact uploads and GitHub environment/OIDC/secret-dependent operations
were not executed locally. No deployment workflow was triggered. This section
records pre-push local validation, not a claim of remote CI or hosted acceptance.

## Convergence follow-up evidence (2026-10-25)

Completed T015 and T016 with test-only changes in
`src/pages/ChallengeDetails.test.tsx`; application code and configuration remain
unchanged.

- Admin and viewer lifecycle cases now navigate within one provider to both
  overlapping Challenges and both affected Waypoint detail pages at each stage:
  zero Activities, five linked Activities reaching the target, one reassigned
  Activity leaving four on the count-mode member and completing the other member,
  then deletion of the Activities. Exact member labels and count-mode completion
  are checked on both Challenges; Waypoint labels must agree at every stage.
- Each lifecycle case asserts exactly one initial GET plus three explicitly
  requested reloads, no extra reads from navigation/rerendering, no storage
  writes before switching mode, and no entity-record writes afterward.
- The Demo parity case loads identical bundled data as writable admin and viewer,
  then uses Demo local and the warned Demo Cosmos fallback. For every Challenge,
  it checks the member count and compares every member's exact completion/count
  text and explicit count-mode state with the captured writable-admin baseline.
  Read-only route controls remain absent, read-only/fallback notices remain
  visible, and each remote mode makes one GET (Demo local makes none). No writes
  occur while viewing or navigating.

Validation used Node.js 24.22.0 on a task-owned WSL-native source copy. The first
test command reported `sh: 1: vitest: not found`; `npm ci` restored dependencies
only in that copy. It reported the same eight dependency vulnerabilities noted
above; no dependency manifests or lockfile changed.

Final checks:

```powershell
npm run lint -- src/pages/ChallengeDetails.test.tsx
npm run typecheck
npm test -- src/pages/ChallengeDetails.test.tsx
```

All passed: lint had zero warnings/errors, TypeScript passed, and **33/33 tests**
passed. Two former Demo cases were replaced by one stronger all-mode comparison,
so the affected file now has 33 rather than 34 tests. The focused implementation
feedback selector `-t 'recalculates loaded progress|identical per-member Demo progress'`
also passed all three selected cases.

The initial typecheck caught two unsupported Testing Library `exact` role-query
options (`TS2769`); these were removed because role-name string matching is already
exact. It also reported `TS2307` for a configuration file omitted from the temporary
copy; the unchanged repository `staticwebapp.config.json` was copied in before the
successful final typecheck. No check was suppressed or weakened.

No browser flows, API suites, coverage collection, or hosted acceptance were
rerun for these test-only changes. The earlier browser evidence remains historical
and application code is unchanged. No commit, push, deployment, or hosted data
mutation was performed.
