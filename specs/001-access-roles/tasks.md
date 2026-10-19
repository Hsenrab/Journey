# Tasks: Access and Roles Baseline

**Input**: [Specification](spec.md), [plan](plan.md), [research](research.md),
[data model](data-model.md), [contract](contracts/access-control.md), and
[validation guide](quickstart.md).

**Branch**: `001-access-roles`

**Organization**: Remaining verification and guidance work, grouped by existing
user story. Authentication, authorization, data loading, and write guards already
exist; do not rebuild them. Tests are included because the plan explicitly requires
closing evidence gaps. A new regression test may pass immediately against the
existing implementation; do not change correct behavior merely to make a test fail.

## Format and Path Conventions

Tasks use `- [ ] Tnnn [P] [USn] Description with exact file paths`.
`[P]` indicates independent files after stated prerequisites. Paths are relative to
the repository root. No new runtime entities, infrastructure, dependencies, role
store, or authentication helpers are required by this task list.

The feature branch is already created. Keep all work for this feature on it.
New Spec Kit features get new branches, not individual tasks or user stories.
This does not change branching rules for work outside Spec Kit.

## Phase 1: Setup

**Goal**: Establish a usable existing validation environment without changing the stack.

- [x] T001 Check Node.js 24+, npm, and existing root/API dependencies against `package.json`, `api/package.json`, and `specs/001-access-roles/quickstart.md`; resolve missing tooling through an approved existing environment, install dependencies only if missing, and record exact unresolved errors in `specs/001-access-roles/evidence.md` without changing manifests or build scripts.

## Phase 2: Foundational

**Goal**: Confirm the boundaries that all story tests must exercise.

- [x] T002 Compare `specs/001-access-roles/contracts/access-control.md` with `staticwebapp.config.json`, `api/src/lib/principal.ts`, all three handlers in `api/src/functions/`, and `src/features/journey/JourneyContext.tsx`; reuse their existing test fixtures and mocks, identify the missing cases below, and record any actual mismatch in `specs/001-access-roles/evidence.md` before proposing runtime changes.

**Checkpoint**: Tests use mocked Cosmos/Maps and remote frontend mode
(`vi.stubEnv('MODE', 'production')`), not the legacy local test path.
No broad new test infrastructure is needed.

## Phase 3: US1 - Enter the Private Application (Priority: P1)

**Goal**: Prove the existing identity rejection contract and preserve the hosting gate.

**Independent test**: Principal/handler tests reject invalid identities before
downstream I/O, and the hosting configuration assertions retain sign-in and return
location behavior. Actual Entra redirects remain a separate hosted acceptance check.

- [x] T003 [P] [US1] Extend `api/src/lib/principal.test.ts` with missing independent malformed/incomplete cases, including empty `userId`, absent `authenticated` despite a Journey role, and incorrect required-field types; preserve the model constraints "`identityProvider` must equal `aad`", "`userId` must be nonempty", and "`userRoles` must contain `authenticated` and exactly one distinct supported Journey role"; retain existing valid-role and both-role tests without adding tenant/email restrictions.
- [x] T004 [P] [US1] Extend `api/src/functions/journey.test.ts` to reject missing, malformed, incomplete, unsupported-provider, empty-user-ID, unassigned, and both-role principals with 403 `{"error":"forbidden"}` for both mocked supported containers; assert no Cosmos data operation or geocoding runs, reusing existing local request builders.
- [x] T005 [P] [US1] Extend `api/src/functions/mapsToken.test.ts` with the missing invalid-principal categories from FR-003 and assert 403 `{"error":"forbidden"}` without token acquisition; preserve existing explicit configuration-failure behavior.
- [x] T006 [P] [US1] Extend `api/src/functions/mapsSearch.test.ts` with the missing invalid-principal categories from FR-003 and assert 403 `{"error":"forbidden"}` without token acquisition or downstream fetch; retain the existing query constraint "trimmed and constrained to 2-200 characters" without expanding search behavior.
- [x] T007 [P] [US1] Review `src/staticwebapp.config.test.ts` against `staticwebapp.config.json`, retain its existing full assertions for auth endpoints, role-membership gates, fallback exclusions, and sign-in return location, and record their evidence boundary in `specs/001-access-roles/evidence.md`; add assertions only for a genuinely missing contract, not duplicate coverage or exact-one-role shell enforcement.

**Checkpoint**: Invalid protected operations are denied locally; no claim is made
that a both-role identity is rejected before the application shell loads.

## Phase 4: US2 - Browse Shared Data as a Viewer (Priority: P1)

**Goal**: Prove shared reading, backend write rejection, read-only controls, and export.

**Independent test**: Four mocked read combinations (two roles by two containers)
succeed; twelve viewer mutation combinations fail without data I/O; remote-mode
context/page tests preserve browsing and export while blocking all writes.

- [x] T008 [US2] After T004, extend `api/src/functions/journey.test.ts` with the four admin/viewer-by-production/demo GET combinations asserting the same fixture graph and `{ data, etags, datasetId, role }`; parameterize all six viewer mutation categories over both containers with valid representative payloads, assert 403 and no body processing, Cosmos data operation, or geocoding, and distinguish container-client construction from data I/O.
- [x] T009 [US2] After T005, add explicit viewer token-read success to `api/src/functions/mapsToken.test.ts`, asserting the existing `{ token, expiresOn, clientId }` shape and managed-identity helper invocation with fake token data only.
- [x] T010 [US2] After T006, add explicit viewer search-read success to `api/src/functions/mapsSearch.test.ts`, asserting `{ results }` and the existing downstream authentication call with a valid query and mocked response.
- [x] T011 [P] [US2] Extend `src/features/journey/JourneyContext.test.tsx` in remote mode to exercise every viewer mutation method (challenge creation/route update; waypoint, activity, and idea create/update/delete; restore; clear) over both mocked shared modes, asserting rejection and no write fetch; switch between modes and verify viewer restrictions persist, while `local` remains a nonassignable sentinel rather than a third Journey role.
- [x] T012 [P] [US2] Add remote-mode viewer assertions to `src/pages/Locations.test.tsx` proving waypoint browsing still works, add controls are absent, and the read-only notice explains access and links to Settings.
- [x] T013 [P] [US2] Add remote-mode viewer assertions to `src/pages/Ideas.test.tsx` proving ideas remain browsable, add/query-driven edit entry cannot expose mutation controls, and the existing notice links to Settings.
- [x] T014 [P] [US2] Add remote-mode viewer saved-route assertions to `src/pages/ChallengeDetails.test.tsx`, proving existing route/map information remains visible while attach, replace, remove, and save controls are unavailable and the read-only reason is shown.
- [x] T015 [P] [US2] Add remote-mode viewer header assertions to `src/components/Layout.test.tsx`, proving the loaded shared-data status identifies viewer read-only access without breaking navigation; preserve existing error/fallback status precedence rather than adding a second status model.
- [x] T016 [P] [US2] Extend `src/pages/Settings.test.tsx` with loaded viewer responses for both shared modes, asserting export downloads the active fixture while restore/clear stay disabled, mode selection remains usable, and loading/failed loads continue disabling export; reuse the existing download mocks and assert no write request.

**Checkpoint**: Preserve already-covered detail-page and read-only notice behavior;
do not rewrite existing successful tests merely to increase the task count.

## Phase 5: US3 - Manage Shared Data as an Administrator (Priority: P1)

**Goal**: Show the new viewer evidence does not remove valid admin operations or data guards.

**Independent test**: Valid mocked admin mutations still use the intended container,
nonempty imports fail, and local-demo/loading/failed-Production states block editing.

- [x] T017 [US3] After T008, verify admin success coverage in `api/src/functions/journey.test.ts` for all six mutation categories (create, update, delete, import, replace, and clear) over both mocked containers (`production` and `demo`): twelve positive operation/container combinations. Retain existing cases and add only missing combinations; import must succeed into an empty dataset in each container and return 409 `data_not_empty` into a nonempty dataset in each container. Preserve supported success shapes/statuses and validation/concurrency checks without using live data.
- [x] T018 [US3] After T011 and T016, review existing remote admin/loading/local-demo/failure cases in `src/features/journey/JourneyContext.test.tsx` and `src/pages/Settings.test.tsx`, extend only missing FR-009/FR-010 assertions, and preserve the constraints "Loading, viewer, local demo, and failed Production are read-only" and "Normal remote writes additionally require admin".

**Checkpoint**: The role baseline is unchanged. If a test exposes a runtime mismatch,
report the exact mismatch before expanding the approved test/documentation scope.

## Phase 6: US4 - Assign Access Outside the Application (Priority: P2)

**Goal**: Align the operator procedure with the approved invitation-based model.

**Independent test**: Guidance clearly covers per-resource invitations, cross-organization
eligibility, fresh-session role changes, and the distinction between local evidence
and hosted verification. No access administration is performed by these tasks.

- [x] T019 [P] [US4] Update the access sections of `docs/operations.md` to state that any explicitly invited Entra work identity is eligible regardless of organization, without adding a tenant/email allowlist; retain per-resource invitations, audit/replacement/revocation and sign-out/sign-in procedures, distinguish platform-policy restrictions from application policy, and do not promise immediate open-session revocation.
- [x] T020 [P] [US4] Align the access paragraph in `AGENTS.md` with `specs/001-access-roles/contracts/access-control.md`: hosting checks membership in either supported role, while protected backend operations require authenticated `aad` and exactly one Journey role; preserve existing approvals and development rules without adding general branching requirements or role matrices to the constitution.

**Checkpoint**: The documented procedure is executable by an authorized operator,
but invitation acceptance, resource isolation, and session-refresh timing remain
unverified until separately approved hosted checks run.

## Phase 7: Polish and Cross-Cutting Validation

- [x] T021 Consolidate the implemented test-to-requirement mapping and remaining hosted checks in `specs/001-access-roles/evidence.md`; map every route and applicable read-only UI check in the route and page audit inventory in `specs/001-access-roles/quickstart.md` to retained or newly added test coverage and its execution status, and record hosted sign-in acceptance separately for every route as passed/failed/blocked/not-run. Update that inventory if registered routes change, and correct commands or prerequisites where needed; distinguish tests read from tests executed and do not store identities, tokens, credentials, or real records.
- [x] T022 After all selected local changes, run formatting for changed files and the complete locally executable root/API CI sequence from `.github/workflows/ci.yml` once as described in `specs/001-access-roles/quickstart.md`; include existing Playwright and built Functions-host smoke checks in their compatible environments, report exact blockers without bypassing them, and record outcomes in `specs/001-access-roles/evidence.md`.
- [x] T023 After T022, review requirement coverage and task completion in `specs/001-access-roles/tasks.md` against `specs/001-access-roles/spec.md`, record local passed/failed/blocked and hosted not-run states in `specs/001-access-roles/evidence.md`, and report remaining acceptance gaps without marking failed or unexecuted work complete; if a commit is requested, inspect final diff/status and stage only intended files after applicable checks pass.

**Validation status**: All 23 tasks are complete. Root/API static checks,
formatting, 362 frontend tests, 142 API tests, both builds, 3 Playwright tests,
and 2 Functions-host smoke tests pass. Final report edits are formatted separately.
The owner-approved single-worker Vitest configuration preserves all timeouts,
assertions, and coverage thresholds. The separate line-ending commit `284e613`
contains only `.gitattributes`; Spec Kit and test/configuration changes are separate.
See [evidence.md](evidence.md) for results and historical failures. Hosted
acceptance remains not run; no push, workflow dispatch, or deployment occurred.

## Dependencies and Execution Order

- T001 precedes T002. They are readiness/review tasks, not new infrastructure.
  If tooling remains unavailable, non-executing documentation review may continue,
  but affected validation and completion stay blocked.
- T002 precedes all user-story work.
- US1 and US2 test increments do not require new production code. Within shared
  API test files: T004 -> T008 -> T017; T005 -> T009; T006 -> T010.
- Within shared frontend test files: T011 -> T018 and T016 -> T018.
- Other `[P]` story tasks have no dependencies beyond T002 and touch separate files.
  Do not run edits to a shared file concurrently.
- US4 is independent of US1-US3 after T002.
- T021 follows the selected story tasks. T022 follows T021 and all local edits;
  T023 follows T022. Updating results after checks does not authorize skipping
  formatting of a newly changed report or repeating unrelated successful suites.

Story-level graph:

```text
Setup -> Foundation -> US1 identity/config evidence
                    -> US2 viewer evidence (API files follow relevant US1 edits)
                    -> US3 admin evidence (follows relevant US2 shared-file edits)
                    -> US4 operator guidance
Selected stories -> evidence consolidation -> final checks -> completion report
```

## Parallel Execution Examples

- **US1**: T003 principal tests, T004 Journey rejection tests, T005 token rejection
  tests, T006 search rejection tests, and T007 configuration-evidence review can run
  independently after T002.
- **US2**: After their predecessors, T008, T009, and T010 touch separate handlers'
  test files. T011-T016 touch separate frontend files and can run independently.
- **US3**: T017 API admin tests and T018 frontend guards touch different packages
  after their respective shared-file predecessors finish.
- **US4**: T019 operations guidance and T020 agent guidance touch separate files.

Parallel markers describe safe work separation, not a requirement to launch agents.

## Implementation Strategy

1. Deliver the US1 verification increment first: it establishes the local identity
   boundary without rebuilding sign-in. Hosted login is not certified by this MVP.
2. Add US2's viewer matrix, Maps reads, context guards, and visible controls/export.
3. Preserve and complete US3's admin and availability regressions.
4. Align US4 guidance independently; keep platform-managed assignments external.
5. Run final impacted validation once and report remaining acceptance honestly.

No new persisted model, schema migration, contract, provider, workflow, or hosted
test endpoint is planned. Existing tests need not be duplicated when they already
prove a required behavior.

## Separately Authorized Hosted Acceptance

The procedures already in [quickstart.md](quickstart.md#4-hosted-acceptance-only-when-explicitly-authorized)
cover actual sign-in/return routes, unassigned-user denial, viewer read-only browsing,
cross-organization invitation eligibility, session refresh, and resource isolation.
They are not authorization to push, dispatch, deploy, invite, revoke, or mutate data.

Do not execute them automatically during implementation. Without explicit approval,
identities, and existing suitable resources, record them as not run/blocked.
SC-001 and hosted SC-006 acceptance remain pending; local checks cannot certify them.
All production/demo mutation matrices above use mocks. The API has no isolated
`test`-container route; do not create one or substitute shared live demo data.
