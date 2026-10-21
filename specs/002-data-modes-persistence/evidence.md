# Data Modes and Persistence: Baseline Evidence

**Reviewed**: 2026-10-21

**Specification**: [Data modes and persistence](spec.md)

## Scope and Status

### Safe-Switch Implementation: 2026-10-21

The separately authorized implementation on `implement-data-modes-persistence`
supersedes the unimplemented status in the historical clarification below.
Existing uncommitted baseline reviews and planning artifacts were preserved.

- FR-017 / SC-007: all thirteen mutation methods participate in a synchronous,
  overlapping-operation-safe pending boundary. Settings restore joins before
  reading a file and stays joined through parsing and provider restore. Success,
  read/validation/write failure, and originating-page unmount release correctly.
  Direct switch rejection leaves the preference and load count unchanged.
- FR-018 / SC-008: transient dirty registration covers all three record editors,
  Challenge creation, and planned routes. Settings-link capture confirms before
  unmount; direct context calls use the same confirmation. Cancellation preserves
  values/route/mode; acceptance remounts mode-bound UI with no carried draft.
  Failed saves retain drafts; successful save/unmount clears registrations.
  Valid/invalid unapplied JSON is included, whitespace excluded, and clearing JSON
  does not clear applied form edits. Discarded GPX reads cannot resurrect drafts.
- The remote browser journey uses intercepted `/api/journey/demo` responses in
  Demo Cosmos, which uses the real API client even in Vite test mode. It verifies
  cancellation, single discard confirmation, fresh fields after switching,
  held-save selector disabling across page unmount, settlement, and absence of
  legacy browser records. No new Playwright project or dependency was needed.
- That journey exposed late list-editor save navigation after unmount. The three
  creation pages now leave the current route alone when their write finishes
  after unmount; provider settlement is unchanged.
- UI self-review: existing MUI selector/labels/spacing/layout are retained; disabled
  state uses MUI, Settings capture covers desktop/mobile navigation, and the native
  confirmation reuses the existing discard pattern. No new responsive layout,
  duplicated component, or styling system was introduced.

#### Local validation

Commands ran in the existing Ubuntu WSL installation from this repository, using
installed dependencies. Windows did not provide `node`; WSL provided Node
24.22.0/npm 11.19.1. No dependencies or browsers were installed.

- Changed source/test files were formatted with `npx prettier --write` after
  implementation; final documentation was formatted separately.
- `npm run lint`: passed, zero errors and three warnings (the existing
  `defaultChallengeIds` dependency pattern and the context module's two exported
  hooks/fast-refresh warnings).
- `npm run typecheck`: passed.
- The affected Vitest commands were:

  ```text
  npm test -- src/features/journey/JourneyContext.test.tsx src/pages/Settings.test.tsx src/pages/Settings.error.test.tsx src/app/App.test.tsx src/pages/ChallengeDetails.test.tsx src/pages/Dashboard.test.tsx src/components/WaypointEditor.test.tsx src/components/IdeaEditor.test.tsx src/components/ActivityEditor.test.tsx src/components/Layout.test.tsx src/components/ReadOnlyNotice.test.tsx --maxWorkers=1 --reporter=dot
  npm test -- src/app/App.test.tsx src/pages/Settings.error.test.tsx src/pages/Locations.test.tsx src/pages/Ideas.test.tsx src/pages/Activities.test.tsx --maxWorkers=1 --reporter=dot
  npm test -- src/app/App.test.tsx --maxWorkers=1 --reporter=dot
  ```

  **Final passing evidence: 248 distinct tests across 14 affected files.** The
  first batch's nine unchanged successful suites account for 186 tests. The
  second batch's four successful suites (Settings errors and the three creation
  pages) account for 39 tests. The final App-only run passed all 23 tests (115.69
  seconds). No failures or unhandled errors remain in those final relevant
  outcomes. Later commands cover changed source/tests rather than rerunning
  unchanged successful suites.

- `npm run test:e2e -- e2e/journey.spec.ts --grep=remote --workers=1`: **one
  Chromium test passed** (21.9 seconds), including the existing Vite test-mode
  build. The build reported a bundle-size/plugin-timing warning, not an error.
  Playwright configuration and the legacy smoke tests are unchanged; no separate
  production build was required.

Failures were investigated rather than bypassed:

- The initial eight-file development test run had three failed assertions and a
  worker-start timeout (`[vitest-pool-runner]: Timeout waiting for worker to
respond`). Assertions were corrected to match existing editor controls; subsequent
  focused runs used one worker. No timeout or retry setting was relaxed.
- Initial typechecking reported `TS2769` because Testing Library's role queries
  do not support Playwright's `exact` option. Those options were removed; the
  subsequent complete frontend typecheck passed.
- The first browser run incorrectly expected `/ideas` without its existing
  `?mode=add` query. It now asserts that the complete pre-cancellation URL remains.
- The next browser run timed out after settlement because the old Idea callback
  navigated away from Settings. The post-unmount creation-page fix and regressions
  described above resolve that failure; the browser journey subsequently passed.
- The first eleven-file validation run had 205 passing tests, one failure, and one
  unhandled rejection: the isolated Settings error-test mock lacked `runMutation`.
  The mock now implements the new contract; its subsequent suite passed.
- The five-file follow-up initially had 56 passing and six failing tests: a broad
  `/saved\./` absence assertion matched Settings' explanatory “before they can be
  saved” text. The assertion now targets only entity save-success notifications;
  runtime pending/route assertions already passed. The final App run passed all
  23 tests, including those six regressions.

No backend/API/schema/infrastructure changes, dependency installs, commits, pushes,
deployments, or hosted reads/writes were performed. The 100-operation limit and
all unrelated hosted/validation acceptance gaps remain.

### Implementation review correction: applied JSON

All three entity editors now remember the last successfully applied JSON text.
That text does not independently mark a draft dirty; changed form values still
do. Subsequent nonwhitespace JSON edits, including invalid JSON, remain unapplied
and trigger draft protection. Failed validation does not update the applied text.

Regression tests in each editor apply valid JSON, restore the form to its initial
values, verify the draft is clean while retaining the JSON text, then verify that
invalid JSON edits and failed application make it dirty again.

`npm test -- src/components/WaypointEditor.test.tsx src/components/IdeaEditor.test.tsx src/components/ActivityEditor.test.tsx`:
**69 tests passed across three files**. The editor test tool found no tests, so
the repository's Vitest command was run through WSL instead. Editor diagnostics
reported no errors in the six changed source/test files.

Changed-file Prettier formatting and frontend typechecking passed. Frontend lint
passed with zero errors and the same three warnings recorded above. The browser
journey and hosted checks were not rerun for this editor-only correction; no
commit, push, deployment, or hosted data mutation was performed.

### Pull-request preparation: 2026-10-21

The owner subsequently authorized committing, pushing, and opening a pull request.
The complete local CI sequence was checked using installed dependencies/tools:

- Frontend lint: zero errors, three warnings as recorded above; typecheck passed.
- Repository formatting check passed after formatting the generated, ignored
  `.specify/feature.json` metadata.
- Frontend coverage: **432 tests passed across 35 files**. Statements 90.57%,
  branches 85.82%, functions 87.10%, lines 91.46%; all configured thresholds passed.
- Production build passed with the existing bundle-size warning.
- Full Chromium suite: **four tests passed**, including the remote mode-switch
  journey. The test-mode build also reported bundle-size/plugin-timing warnings.
- API lint/typecheck/build passed; coverage: **144 tests passed across ten files**.
- Built Functions-host smoke suite: **two tests passed**.

The first parallel API coverage attempt timed out in the unchanged geocoding
test at 5000 ms; the complete coverage rerun with one worker passed. The first
Functions-host smoke attempt exited with `Value cannot be null. (Parameter
'provider')`; rerunning the unchanged suite passed both cases.
The first frontend coverage attempt had 430 passes and two App failures: a
10000 ms journey timeout and a save-button-removal wait timeout. All 23 App tests
then passed in isolation, followed by the complete uncontended coverage run
passing all 432 tests. No assertions, timeouts, retries, or coverage thresholds
were weakened to obtain these results.

No dependencies or browsers were installed. GitHub-only Actions contexts,
environments, OIDC, artifact uploads, and Cosmos integration are not local checks.
No deployment workflow was manually dispatched and no hosted acceptance or
Production mutation is claimed by these local results.

### Pre-merge review correction: navigation outside the current tab

Review found that modified Settings clicks could confirm discard and clear draft
registration without leaving the original tab. The Settings capture guard now
follows same-tab navigation semantics: it ignores modified/non-primary clicks,
already-prevented clicks, and links targeting another browsing context.
Six regression cases cover Ctrl, Meta, Shift, Alt, middle-button, and `_blank`
clicks, then verify that normal navigation still requires confirmation.
The focused Layout suite passed all twelve tests; editor diagnostics were clear.

Final frontend validation passed: lint (zero errors, the same three warnings),
typecheck, formatting, **438 tests across 35 files with coverage thresholds met**,
production build (existing bundle-size warning), and **four Chromium tests**.
The initial typecheck caught `TS2345` in the regression table's optional `target`;
an explicit undefined guard corrected the test without a cast. The unchanged API
retains the successful full checks recorded in pull-request preparation above.

### Clarification Review: 2026-10-21

The original baseline and source mappings below remain historical evidence.
The owner approved two target improvements during this review:

- FR-017 / SC-007: block data-mode switching during save, restore, or clear;
  release the restriction on either success or failure.
- FR-018 / SC-008: confirm before discarding changed drafts on a mode switch;
  cancellation preserves mode/draft, confirmation discards without transfer.

At clarification time these were documentation decisions only, not implemented or tested guarantees.
The then-current [context](../../src/features/journey/JourneyContext.tsx) changed the
mode without tracking in-flight writes, and mutation responses call `apply`
without the load-generation guard used by `loadMode`. Consequently the
load-order protection does not establish protection against late write responses.
Unsaved-draft handling at the mode-switch boundary was also unverified.
The separately authorized implementation above supersedes that status.

SC-002 now enumerates the required load/failure/reload cases instead of measuring
only whichever cases happen to be reviewed. No new product tests or hosted
operations were executed during clarification.

The former API blocker is resolved: [PR #178](https://github.com/Hsenrab/Journey/pull/178)
was merged and deployed. [Access review evidence](../001-access-roles/evidence.md#review-conclusion-2026-10-21)
records the subsequent approved hosted admin Demo create/update/read/delete
check with cleanup and unchanged original contents, Demo local write restrictions,
fresh sign-in, and successful protected reads. The
[Production deployment](https://github.com/Hsenrab/Journey/actions/runs/39589830073)
also verified authenticated Production GETs; no Production mutation was performed.
These checks do not certify viewer journeys, restore/clear, conflict recovery,
all startup cases, or the new mode-switch rules.

Remaining limitations are deliberate or separately tracked, not reasons to add
speculative infrastructure:

- The 100-operation atomic-change limit can prevent whole-dataset saves, restores,
  or clears once their generated operation list exceeds that limit, even though
  export remains possible. This feature makes no unlimited backup round-trip or
  growth guarantee; capacity expansion/chunking remains outside scope.
- Known validation/data-integrity issues linked below qualify the complete-validation
  requirement; they are implementation defects, not ambiguous permission to accept
  malformed backups.
- Export checks must inspect the active dataset, including labelled local fallback;
  a successful download alone does not prove restore capability or a Cosmos read.

### Original Baseline Review: 2026-10-20

This baseline was created by reading the current implementation, tests, and
deployment configuration. No application code, tests, workflow, or infrastructure
was changed. No application tests, live data reads, writes, deployment, or hosted
acceptance were run for this specification. Documentation checks are recorded
separately from product acceptance.

The feature branch `002-data-modes-persistence` was created from the completed
local access-baseline branch, retaining its commits. The branch is not a deployment.

## Requirement Evidence Map

| Requirements          | Sources reviewed                                                                                                                                                                                                                                                            | What the sources establish                                                                                                                                                       | Execution status                                           |
| --------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------- |
| FR-001, FR-002        | [Settings](../../src/pages/Settings.tsx), [storage](../../src/services/storage.ts), [storage tests](../../src/services/storage.test.ts), [test workflow](../../.github/workflows/deploy-test.yml), [production workflow](../../.github/workflows/azure-static-web-apps.yml) | Settings contains all three choices; valid preferences/defaults and the nonproduction Production override; workflows select Demo Cosmos vs Production defaults.                  | Reviewed; not newly executed                               |
| FR-003, FR-004        | [Journey context](../../src/features/journey/JourneyContext.tsx), [context tests](../../src/features/journey/JourneyContext.test.tsx)                                                                                                                                       | Selected and active modes, generation-checked load settlement, mode switches, stale/superseded responses. Selection itself does not copy records.                                | Reviewed; not newly executed                               |
| FR-005 through FR-009 | [Context](../../src/features/journey/JourneyContext.tsx), [status rules](../../src/domain/dataMode.ts), [status tests](../../src/domain/dataMode.test.ts), [Settings tests](../../src/pages/Settings.test.tsx), [access evidence](../001-access-roles/evidence.md)          | Loading/read-only guards; warning-labelled Demo fallback; failed Production disables writes/export; viewer restrictions; retained memory after a failed refresh is still failed. | Reviewed; hosted shared success blocked by known API issue |
| FR-010, FR-011        | [Context](../../src/features/journey/JourneyContext.tsx), [Journey client](../../src/services/journeyApi.ts), [handler](../../api/src/functions/journey.ts), [Cosmos boundary](../../api/src/lib/cosmos.ts), [storage](../../src/services/storage.ts)                       | Shared same-origin writes, dataset routing, validation and conflict responses; browser record load/save invoked by the context only in test-mode Production.                     | Reviewed; not newly executed                               |
| FR-012                | [Settings](../../src/pages/Settings.tsx), [backup utilities](../../src/services/storage.ts), [Settings tests](../../src/pages/Settings.test.tsx), [storage tests](../../src/services/storage.test.ts)                                                                       | Loaded-state export guard, active dataset/fallback file naming, version 1 envelope and timestamp; viewer exports for both shared modes; route/track backup round trip.           | Reviewed; not newly executed                               |
| FR-013                | [Settings](../../src/pages/Settings.tsx), [Journey client](../../src/services/journeyApi.ts), [handler](../../api/src/functions/journey.ts), [handler tests](../../api/src/functions/journey.test.ts)                                                                       | Backup parsing precedes restore; server validates complete import and relationships, rejects nonempty targets in both shared containers.                                         | Reviewed; not newly executed                               |
| FR-014, FR-015        | [Settings](../../src/pages/Settings.tsx), [error tests](../../src/pages/Settings.error.test.tsx), [Cosmos boundary](../../api/src/lib/cosmos.ts), [Cosmos tests](../../api/src/lib/cosmos.test.ts)                                                                          | Confirmation/cancel/failure handling; conditional atomic record operations and explicit rejection over 100 operations.                                                           | Reviewed; not newly executed                               |
| FR-016                | [Seeding workflow](../../.github/workflows/deploy-environment.yml), [infrastructure](../../infra/main.bicep), [operations](../../docs/operations.md)                                                                                                                        | Separate production/demo/test containers; workflow seeds demo only when infrastructure deployment is selected, using the bundled fixture.                                        | Reviewed; no deployment or seeding executed                |

## Important Boundaries

- Shared route/track validation and representation evidence is maintained in the
  [GPX baseline](../008-gpx-import-geometry/evidence.md). The backup tests referenced
  here establish dataset export/restore behaviour, not a separate geometry contract.

- The mode selector is in Settings. The header displays active data/access status;
  this baseline does not promise a second header selector.
- A saved Production preference is overridden at startup on test deployments,
  not prohibited from being selected explicitly during a session.
- Missing/unknown saved mode preferences use the deployment default. This is an
  existing preference rule, not permission to recover invalid persisted records.
- Demo fallback remains selected as Demo Cosmos but active as Demo local; exports
  contain loaded local fixtures, never unavailable Cosmos records.
- Failed Production refresh retains existing in-memory records in the context,
  while marking the load failed and preventing writes/export. It does not reload
  a local cache or report successful stale data.
- Portable backups contain version, timestamp, and data, not the destination mode,
  identity, or authorization. The active writable dataset is the destination.
- The ordinary test-mode browser persistence path bypasses shared-service loading
  and some restore/clear guards. Its fixture successes do not certify hosted
  permissions, persistence, or empty-dataset enforcement.
- Current whole-dataset replacement creates/replaces every submitted record and
  deletes omitted records represented by known concurrency tokens. The 100-operation
  limit applies to the generated operation list, not merely changed UI fields.
  Oversized operations fail; no chunking or capacity expansion is approved.
- The original baseline did not establish guarantees for mode switches during
  writes or for drafts across mode changes. The clarification above specifies
  desired behaviour separately; it does not establish implementation or acceptance.

## Known Defects and Acceptance Gaps

The API/verifier entries below describe their status at baseline creation; the
2026-10-21 update above supersedes those deployment/blocker statements.

- [Issue #160](https://github.com/Hsenrab/Journey/issues/160): existing hosted API
  404 report, with shared-test observations recorded in
  [the access baseline](../001-access-roles/evidence.md). The observed Demo fallback
  does not prove working Demo Cosmos persistence. This issue does not block
  specification creation.
- [Issue #173](https://github.com/Hsenrab/Journey/issues/173): separately approved
  verifier correction is committed locally as `973112c`, not deployed. It does
  not establish a fix for the live API failure.
- No additional bug was confirmed in the initial bounded persistence review.
  Subsequent entity baselines link existing validation defects
  [#169](https://github.com/Hsenrab/Journey/issues/169) and
  [#170](https://github.com/Hsenrab/Journey/issues/170), plus the newly identified
  form-save geocoding bypass [#174](https://github.com/Hsenrab/Journey/issues/174).
  These qualify claims about complete validation and resolution across write paths;
  the approved contract is not changed to accept the defects. Unexecuted
  scenarios and unproven concurrency guarantees remain evidence gaps, not invented
  bug findings or successful acceptance.

## Safe Next Phase

FR-017/FR-018 implementation was separately authorized and is documented above.
Further application work or hosted verification still requires its own explicit
request; preserve the historical baseline and unrelated acceptance gaps.

Production mutations, shared Demo resets, and deployment-driven seeding must not
be used as baseline probes. No new endpoint, test partition override, migration,
offline cache, or compatibility layer is authorized.
