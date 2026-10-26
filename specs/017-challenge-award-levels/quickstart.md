# Validation Guide: Challenge Award Levels

This guide describes checks to run after implementation. It is not evidence
that those checks have already passed.

## Prerequisites

- Work on `017-challenge-award-levels`.
- Use Node.js 24 and the existing root/API dependencies. Run `npm ci` only when
  dependencies are missing or their lockfile changed.
- On this Windows machine, the existing toolchain and dependencies are in
  Ubuntu WSL, not Windows PowerShell. Run project commands in Ubuntu; a failed
  Windows `node` lookup is not evidence that this toolchain is missing.
  To invoke a root command from PowerShell, use:

  ```powershell
  wsl.exe --distribution Ubuntu --cd 'C:\Users\hllew\OneDrive\Documents\CodeProjects\Journey' --exec npm test -- src/domain/visit.test.ts
  ```

  For API commands, set `--cd` to the same repository's `api` directory.
  The shell command sequences below run inside Ubuntu from the repository root.
  PowerShell callers use the WSL invocation above with the appropriate `--cd`.

- Use fictional fixtures and an isolated Playwright context with intercepted
  same-origin Journey API responses. Never use real Production data.
- Install Playwright Chromium only when needed for the E2E run. API host smoke
  checks require Azure Functions Core Tools v4, as in the
  [existing CI workflow](../../.github/workflows/ci.yml).
- Existing local test-mode storage is for tests only. Do not introduce browser
  persistence for real records.

Contracts: [data model](./data-model.md), [API](./contracts/journey-awards.md),
[UI](./contracts/awards-ui.md).

## Acceptance Fixture

Prepare two award-enabled Challenges, A and B, each with explicit fictional
Bronze/Silver/Gold descriptions; an ordinary Challenge O; and an empty enabled
Challenge E.

- A contains W1, W2, and an unvisited W3.
- W1 is shared with B and O and has Bronze, Gold, Bronze Activities.
- W2 has one Silver Activity.
- W3 has no Activities.
- O also contains an ordinary unawarded visited member.

Expected A statistics: three members, four Activities; highest Waypoint buckets
Bronze 0, Silver 1, Gold 1, no award 1; Activity buckets Bronze 2, Silver 1,
Gold 1. W1 contributes once to each enabled Challenge and once globally.
O shows its completion/Activity totals but no award distributions.

## Focused Feedback During Implementation

Run only relevant tests when they provide useful feedback, combining selectors:

```sh
set -e
npm test -- src/domain/visit.test.ts src/domain/draftJsonImport.test.ts src/services/storage.test.ts
npm test -- src/components/ActivityEditor.test.tsx src/pages/ChallengeDetails.test.tsx src/pages/Dashboard.test.tsx
(
  cd api
  npm test -- src/lib/journeySchema.test.ts src/lib/journeyGraph.test.ts src/lib/cosmos.test.ts src/functions/journey.test.ts
)
```

Add tests alongside any extracted award fields and list-scope helpers.
Extend existing context, Locations, Activities, ActivityDetails, Map, Settings,
and service tests wherever behavior changes. Do not replace failed checks with
weaker assertions or treat test discovery failure as success.

## Browser Acceptance

Run every applicable scenario at 360x800 and 1280x800:

1. Create ordinary and enabled Challenges. Verify all descriptions are required
   only when enabled, no invented Silver definition, and no tier selected on a
   new Activity. Try enabling awards or adding an enabled membership over
   retained unawarded visits: reject without writes, identify the Activities,
   and explain that these actions cannot convert their history. Do not suggest
   assigning tiers while ineligible or offer automatic backfill.
2. Record/edit through Activities, Waypoint, Idea-origin, and existing-Activity
   entry. Check required eligible awards and forbidden ineligible awards.
   Apply valid/invalid JSON with the selected Waypoint context.
   Edit only an awarded Activity's title: its tier remains selected and saves
   unchanged. A move to another eligible Waypoint requires a fresh tier choice.
3. Confirm W1's highest remains Gold after its latest Bronze visit, while each
   Activity retains its actual level and completion remains independent.
4. Open A statistics and every bucket's drill-down, including zero and no-award
   results. Verify exact record counts, scope labels, and return navigation.
   In an applicable scope, select an award filter with no matches and combine
   it with another list filter. Retain award controls and active filter state
   with the empty result; clearing filters restores matching records.
5. Edit definitions after visits and verify recorded levels do not change.
6. Disable/delete B while W1 stays eligible through A: allow and retain awards.
   Remove W1's last enabled membership or delete W1: block with Activity IDs and
   no writes. If one member blocks a larger operation, none of it commits.
7. Explicitly correct/reassign an Activity and acknowledge award removal or
   choose the destination level. Cancel and fail a save; verify no lost records,
   false success, stale totals, or automatic retry.
8. Change/delete W1's sole Gold record and verify its highest and distributions
   recalculate. Add a low-tier Activity to a count-based member without meeting
   its target; confirm it remains incomplete.
9. Repeat browsing as viewer and Demo local. Verify equal readable information,
   no write controls, and zero writes. Inspect ordinary-only Dashboard, lists,
   Map, and Settings for inapplicable award UI.
10. Use keyboard-only input and long names/descriptions. Verify visible focus,
    field-associated errors, no clipped actions, overlap, or horizontal scrolling.

Use mocked API writes to count submissions and hold/reject pending saves.
These E2E fixtures verify client behavior, not server authorization or real
Cosmos concurrency.

## Backend Acceptance

Using existing unit fakes, exercise full replacement and raw entity operations
for missing/ineligible categories, old Challenge versions, invalid descriptions,
alternate membership, direct Challenge link detachment, and blocked award loss.
Attempt a replacement that strips categories during structural deletion.

Use controlled ETag races to prove that Activity creation and Challenge
disabling/deletion cannot both commit incompatible graph changes. Verify one
atomic batch, conflicts, unchanged authorization, and explicit operation-limit
failure. Keep integration tests in the approved isolated test container, with
unconditional cleanup and empty-dataset verification; never use Production.

## Final Implementation Validation

The implementation is cross-cutting. Run the complete local CI sequence once
after implementation and formatting, not repeatedly during editing:

```sh
set -e
npm run format
npm run lint
npm run typecheck
npm run format:check
npm run test:coverage
npm run build
npm run test:e2e
(
  cd api
  npm run lint
  npm run typecheck
  npm run test:coverage
  npm run build
  npm run test:smoke
)
```

Stop on a failed command and retain its exact failure; commands above are a
checklist, not permission to continue past a failed check. Format only intended
files if unrelated worktree changes would otherwise be rewritten. API build
must validate its copied Demo fixture and schema-version/seed expectations.

GitHub artifact uploads and hosted authentication/deployment checks are not
local steps. Do not dispatch deployment, push, or access cloud resources without
the required explicit request.

## Planning-Time Verification Limits

Earlier attempts used Windows PowerShell, where `node`, `npm`, and `npx` were
unavailable on PATH. This did not establish that Ubuntu WSL lacked the tools.
Those failed attempts establish no formatting or runtime acceptance.
The earlier UX browser-tool request timed out, and its targeted test request
found no discoverable tests; neither establishes browser/test acceptance.
Planning uses repository evidence and editor diagnostics only.

## Verified Implementation Setup

T001 was unblocked on 2026-10-25 by using the existing Ubuntu WSL environment:

- `wsl.exe --distribution Ubuntu --exec node --version` returned `v24.22.0`.
- `wsl.exe --distribution Ubuntu --exec npm --version` returned `11.19.1`.
- Ubuntu resolves this same repository and its existing Vitest, TypeScript, and
  Vite dependencies. The API's Azure Functions, Cosmos, Vitest, and TypeScript
  dependencies also resolve from its existing dependency directory.
- The earlier Windows `node --version` failure and user-profile installation
  attempt (`Access is denied. (os error 5)`) did not test the existing WSL
  toolchain. No new runtime, dependency installation, or system setting change
  was needed to unblock setup.
- No process was listening on port 4187 in Windows or Ubuntu when checked.
  Existing browser tabs do not establish that a development server is running.

Use the verified WSL environment for the remaining implementation tasks.
Version and dependency-resolution checks establish setup only, not application
test, build, browser, or hosted acceptance.

## Implementation Validation Evidence (2026-10-25)

Implementation now includes strict award explanations, contextual mandatory
Activity levels, deliberate corrections, highest-versus-recorded labels,
exact scoped statistics, and protected transactional maintenance.
Challenge documents use schema version 4; no version-3 migration, live-data
correction, or deployment was performed. After implementation, the user authorized
committing, pushing, creating a pull request, and merging after checks pass.

Verified in the existing Ubuntu WSL toolchain:

- Root `npm run lint`, `npm run typecheck`, and `npm run build` pass. Lint
  reports four warnings (Fast Refresh exports and an existing Waypoint editor
  dependency); build reports its large-bundle warning.
- Root `npm run format:check` passes. The user explicitly authorized formatting
  the two previously failing feature-016 documents without changing their
  requirements or checklist markers. Those separate, untracked feature artifacts
  remain outside the awards commit.
- The complete default-pool `npm run test:coverage` passes: 564 tests across
  39 files, with 90.51% statements, 86.27% branches, 89.02% functions, and
  91.57% lines. It completed in 1662.26 seconds against the Windows-mounted
  repository without changing test timeouts, worker configuration, or assertions.
- API lint, typecheck, coverage, and build pass. API coverage ran
  `npm run test:coverage -- --reporter=dot`: 360 tests passed, with 94.28%
  statement coverage and 87.10% branch coverage.
- The complete final browser suite passed all 37 tests in one invocation:
  `npm run test:e2e -- --workers=1 --reporter=line` (1.5 minutes, no local
  retries). This supersedes the earlier 35-test run and overlapping focused
  revalidations after the two scheme/JSON cases were added.
- Browser checks use 360x800 and 1280x800, isolated fictional datasets, mocked
  Journey responses, and an explicit protected Maps failure boundary. They
  verify exact drill-down counts, clearable empty filters, keyboard activation,
  associated acknowledgment errors, safe shared deletion, blocked writes,
  failed/cancelled corrections, and reader access. They do not validate hosted
  Microsoft Entra authorization or real Azure Maps rendering.
- Earlier unit/component attempts exposed obsolete assertions, invalid strict
  award/membership fixtures, worker-startup timeouts, and long filesystem waits.
  Corrected the feature-caused fixtures and assertions, then verified all
  affected suites with `--pool=threads`. The final default-pool coverage run
  above supersedes those incomplete attempts; no production validation was
  weakened.

### Outstanding Local Validation Blockers

- API `npm run test:smoke` reports one passed and one failed test. The built
  Functions host exits with `Value cannot be null. (Parameter 'provider')`
  immediately after `WorkerInitRequest`. Both current code and baseline
  `716d248` reproduce it with `func start --port 7079 --verbose` in the existing
  smoke environment. Core Tools is
  `4.16.0+ff7b011b5f26de583a53044c7fdd3b26b7229c1d`; runtime is
  `4.1054.250.26428`. Debug and temporary Trace logging show
  `StartHostAction.RunAsync():489`, but no preceding startup exception. The
  underlying readiness failure remains unidentified; baseline reproduction
  does not establish an unfixable external cause. No configuration bypass
  was applied, and diagnostic scratch files and processes were removed.

T041 remains unchecked until the remaining host-smoke requirement is satisfied.
The other 41 tasks are complete; implementation is not blocked, but full CI
sign-off remains blocked. Final intended changes were reviewed and the
remaining evidence was recorded; unrelated UX-agent changes remain untouched.
GitHub-only artifact services, hosted authorization, Azure deployment, and
preview validation were not executed.

### Approved Pull Request Validation Gate

The same built-host smoke step passed in GitHub CI run `40198951147` for baseline
`716d248`. The user explicitly approved committing and pushing with the local
host limitation documented, then running the full unchanged CI workflow on the
feature branch. Merge is permitted only after that GitHub CI run passes,
including the built Functions host smoke tests. This does not claim the local
host failure was resolved, skip a check, or authorize Azure deployment.
