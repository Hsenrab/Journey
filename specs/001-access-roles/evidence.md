# Access and Roles: Baseline Evidence

**Reviewed**: 2026-10-21

**Specification**: [Access and roles baseline](spec.md)

This document records the baseline sources and implementation evidence. Reading
or adding tests is not the same as executing them. The implementation adds
regression tests and guidance, not runtime permission changes. Initial read-only
hosted checks were authorized on 2026-10-19; their partial results and remaining
blockers are recorded separately below.

## Review Conclusion: 2026-10-21

The feature review is complete; full hosted acceptance is not. The specification
is coherent with the implementation and proportionate to this personal project:
two roles, shared datasets, independent backend write authorization, and no
in-application role administration. No new runtime access defect was established
by this review. Existing tests cover the important permission matrices; adding
more mocked role tests is not the next priority.

The API blocker below is resolved by [PR #178](https://github.com/Hsenrab/Journey/pull/178).
[Issue #160](https://github.com/Hsenrab/Journey/issues/160) is closed after verified
test recovery and Production deployment. The older observations and test counts
in subsequent sections are historical; this section supersedes their outstanding
404 blocker and statements that no deployment or live mutation has been authorized.

### Executed Hosted Checks

The owner authorized one temporary Challenge in the shared test site's Demo
Cosmos dataset and a test-tab sign-out/sign-in. Only the current admin account was
available. No invitation or role changes were made.

| Check                             | Observed result                                                                                                                                                                                                         |
| --------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Fresh authenticated principal     | Sanitized `/.auth/me` confirmed `aad`, a nonempty user ID, `authenticated`, and `admin` without `viewer`; no identity details, cookies, or tokens recorded.                                                             |
| Admin Demo API mutation           | Created a uniquely identified temporary Challenge (201), updated it with its ETag (200), and read back the saved title (200).                                                                                           |
| Cleanup                           | Deleted only that Challenge with its current ETag (204), confirmed its absence, and compared the complete parsed dataset before/after: unchanged. Cleanup ran in `finally`; no clear/import/replace operation was used. |
| Admin detail controls             | After fresh sign-in, the Demo Waypoint detail displayed `Demo writable` and Log activity, Edit waypoint, Delete waypoint, and Add idea controls.                                                                        |
| Settings data-mode guard          | Loaded Demo Cosmos enabled export; switching to Demo local showed read-only status and disabled restore/clear while retaining export. Switched back to Demo Cosmos afterward. No restore/clear action was invoked.      |
| Sign-out                          | `/.auth/logout?post_logout_redirect_uri=/.auth/me` completed and `clientPrincipal` was null.                                                                                                                            |
| Sign-in return                    | Requested `/waypoints/demo-foxglove-manor` while signed out, reached Entra sign-in, and returned to that exact detail route after the owner completed sign-in. Fresh Demo API access returned admin/200.                |
| All eleven signed-out route gates | Independent anonymous HEAD requests to the route inventory returned 302 to Entra sign-in with each exact requested return path. This is a redirect check, not eleven completed interactive sign-in journeys.            |
| Successful protected services     | During the preceding approved repair, signed-in Demo Journey, Maps token, and Maps search returned 200 JSON with valid response shapes. Production equivalents also passed GET-only checks.                             |
| Authentication boundary           | Following repair, anonymous API access through each site returned 302; anonymous direct Function access returned 401.                                                                                                   |

Two initial attempts to click Add challenge on the existing test tab timed out
waiting for visibility/stability. The temporary record check therefore used the
authenticated same-origin Demo API, not the UI save form. Later Settings
interactions succeeded. A sign-in probe also encountered a navigation-destroyed
execution context; a subsequent check on the returned route succeeded. Neither
automation failure is counted as a passed assertion or an established app defect.

Deployment evidence:

- [Test recovery](https://github.com/Hsenrab/Journey/actions/runs/39566616783).
- [Test infrastructure redeployment with API publication skipped](https://github.com/Hsenrab/Journey/actions/runs/39586604538):
  package settings remained identical and authenticated routes remained callable.
- [Production deployment from merged main](https://github.com/Hsenrab/Journey/actions/runs/39589830073):
  CI, provisioning, API publication, route/link verification, and application
  publication passed. No Production records were mutated by acceptance checks;
  infrastructure seeding targets Demo only.

The latest completed local CI preceding the repair push passed 362 frontend tests,
144 API tests, 3 browser smoke tests, and 2 built-host smoke tests, plus formatting,
lint/type checks, and builds. After the Bicep module correction, focused template
regression/static checks and ARM validation passed; subsequent remote workflows
ran the full CI again. No application code changed for this review, so these
successful suites were not rerun merely to update evidence.

### Acceptance Still Not Certified

| Criterion | Current confidence and remaining gap                                                                                                                                                                                                                         |
| --------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| SC-001    | All signed-out redirect targets checked; interactive admin return observed for Challenges historically and a Waypoint detail now. The remaining per-route interactive sign-in journeys are not run.                                                          |
| SC-002    | Local twelve-case viewer denial matrix and direct context guards pass. Real hosted viewer mutation denials and unchanged-storage checks are not run: no viewer account available.                                                                            |
| SC-003    | Invalid-principal categories are covered locally; anonymous hosting/direct-host boundaries are verified live. No hosted uninvited or both-role session was exercised.                                                                                        |
| SC-004    | Hosted admin Demo create/update/read/delete and protected service success verified. Real viewer shared-data comparison/export and all hosted admin write categories are not certified. Export availability was observed, not a downloaded backup comparison. |
| SC-005    | Eight collection/detail notice checks and Settings restrictions are covered locally. No real hosted viewer UI audit was possible.                                                                                                                            |
| SC-006    | Cross-organization invitation acceptance, role replacement/revocation, and isolation using an account invited to only one site are not run. Fresh admin sign-in does not prove a role-change refresh.                                                        |

Do not fabricate principal headers, temporarily change the admin's role, or claim
an anonymous session substitutes for an authenticated uninvited user. Finish the
remaining role journeys when suitable accounts are available; they need no new
authentication infrastructure or speculative application changes. This review
does not certify all of SC-001 through SC-006 as passed.

## Baseline Completion and Defect Tracking

The owner confirmed on 2026-10-20 that discovered bugs must be logged separately,
not allowed to turn baseline creation into a repair project. The existing access
contract is documented and its local baseline tasks are complete. This does not
certify hosted acceptance or remove the failed/blocked checks below.

- [Issue #160](https://github.com/Hsenrab/Journey/issues/160) tracks the live API
  404 problem. The shared-test observations were added to the existing report;
  a common cause with Production has not been established.
- [Issue #173](https://github.com/Hsenrab/Journey/issues/173) tracks the
  primary-environment backend-link verifier defect. Its local correction is a
  separately approved repair, not a prerequisite for completing this specification.

On 2026-10-20 the owner approved committing that existing repair, while confirming
that further baseline creation is documentation-only. Application code, tests,
deployment configuration, defect repair, and hosted account administration require
a separate explicit request. Intended requirements stay intact: known defects are
not converted into accepted behavior, and pending acceptance is not marked passed.

## Current Validation Outcome

All locally executable validation is now passing. T022 is complete; the initial
failed attempts retained below are historical, not outstanding blockers.

| Check                                   | Final result                                                                                                                                                                                       |
| --------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Root lint and typecheck                 | Passed; two existing lint warnings remain.                                                                                                                                                         |
| Formatting                              | Repository-wide `npm run format:check` passed; subsequent test and report edits were formatted and checked separately.                                                                             |
| Root `npm run test:coverage`            | Passed with the normal command, without worker CLI overrides: 35 files, 362 tests. Coverage: 89.97% statements, 84.83% branches, 86.26% functions, 91.02% lines. All unchanged 80% thresholds met. |
| Root build and browser smoke            | Production build passed; 3 Playwright smoke tests passed. Existing bundle-size warning remains.                                                                                                    |
| API lint, typecheck, coverage           | Passed: 10 files, 142 tests. Coverage: 84.75% statements, 76.73% branches, 89.76% functions, 87.4% lines; configured thresholds met.                                                               |
| API build and Functions-host smoke      | Build passed; 2 built-host smoke tests passed.                                                                                                                                                     |
| Extension hooks                         | No `.specify/extensions.yml`; no hooks registered.                                                                                                                                                 |
| Hosted acceptance and GitHub-only steps | Partially run against the existing test site; Cosmos-backed acceptance is blocked by an API 404. No push, workflow dispatch, deployment, or invitation administration performed.                   |

### Approved Unblocking Changes

- Added [the LF text policy](../../.gitattributes) and applied Prettier across
  the repository. Existing tracked Git content was already LF-normalized, so
  the line-ending commit `284e613` contains only `.gitattributes`. Spec Kit and
  test/configuration changes remain outside that commit.
- Preserved all test inputs and assertions while replacing per-character entry
  with direct change events in slow value-validation cases in the Waypoint
  editor, Ideas, Activity details, and Activity editor tests. Clicks, selection,
  gallery keyboard/touch navigation, and save/error assertions remain covered.
- The four original failures passed in isolation, including the missing-waypoint
  option case. No selector or runtime permission change was needed. After the
  value-entry corrections, a single-worker diagnostic passed all 362 tests.
- Default parallel coverage still failed under contention: 327 passed, 35 failed.
  With explicit owner approval, [Vitest configuration](../../vite.config.ts)
  now uses `maxWorkers: 1`; the normal `npm run test:coverage` command needs no
  special flag. Two later runs each exposed a different existing slow activity
  test (361 passed, 1 timeout); their remaining bulk text entry was corrected.
  No timeout, retry, assertion, or coverage threshold was weakened.
- Final checks used a native WSL home-directory snapshot verified identical to
  the working tree before execution, excluding dependencies and generated
  outputs. After the last test-only edit, affected frontend static/coverage
  checks passed again; unchanged builds, API checks, and browser smoke results
  were retained rather than repeated. Final report edits require only formatting.

SC-001 and the hosted portion of SC-006 remain unverified. Local browser tests
use test-mode storage; Functions-host smoke proves route registration and
anonymous denial, not successful authenticated Azure operations.

## Hosted Acceptance: 2026-10-19

**Target**: Existing shared test site,
`https://black-hill-086daf403.3.azurestaticapps.net`.
All operations were read-only; no record writes, Production dataset reads,
invitations, role changes, sign-out, push, or deployment were performed.

### Observed Results

- A browser navigation to `/challenges` reached Microsoft Entra sign-in, then
  returned to `/challenges`. A sanitized `/.auth/me` check confirmed provider
  `aad`, a nonempty user ID, and `admin` plus `authenticated`, without `viewer`.
  No identity details, cookies, or tokens were recorded.
- Independent signed-out HTTP GET requests to all eleven routes below returned
  302 to `/.auth/login/aad`, with `post_login_redirect_uri` equal to the requested
  path. This proves the hosting gate and retained return target, not completion
  of sign-in for every route.
- An authenticated GET to `/api/journey/demo` returned **404**, with no
  `content-type`. The page visibly reported that Demo Cosmos could not load and
  showed read-only bundled Demo local fallback. That is not a successful Cosmos
  read and cannot establish loaded admin/viewer permissions.
- [The latest successful test publishing workflow](https://github.com/Hsenrab/Journey/actions/runs/37530065205)
  ran on 2026-10-06 from `main` at
  `0213df1ff2ca306ad33112ce0f13bc40104c8b47`. Its application deployment succeeded,
  but its Functions deployment was skipped.
  [A later successful test workflow](https://github.com/Hsenrab/Journey/actions/runs/37692763316)
  performed validation/infrastructure checks but skipped both application and
  Functions deployments. A green validation-only workflow does not prove a
  current working deployment; the exact backend cause of the 404 is not yet known.

### Read-Only API Diagnosis

The owner approved read-only diagnosis, not a repair or deployment.

- Azure control-plane inspection confirmed the test Function App is `Running`.
  Journey, Maps search, and Maps token are registered, enabled HTTP functions with
  the expected routes and methods.
- `az staticwebapp backends show --environment-name default` and the
  `builds/default/linkedBackends` ARM collection both show the intended test
  Function App linked to the primary test environment, with provisioning state
  `Succeeded`. The link is not simply absent.
- The legacy `userProvidedFunctionApps` ARM collection returns an empty array.
  At the time of diagnosis, the [deployment verifier](../../.github/workflows/deploy-environment.yml)
  read that legacy collection, rather than the current primary-environment link,
  so it can report `Incorrect linked backend` despite the actual link existing.
  The previously inspected production workflow failure used that assertion;
  no Production service endpoint or dataset was accessed.
- Authenticated same-origin GETs to `/api/journey/demo`, `/api/maps/token`, and
  `/api/maps/search?query=Oxford` all return **404** without a content type.
  Anonymous requests directly to all three test Function routes return **401**,
  consistent with their platform authentication boundary, not successful
  handler execution.
- Explicit `authsettingsV2` inspection shows platform authentication and required
  authentication enabled, with the Azure Static Web Apps provider enabled and
  associated with the correct test site hostname.
- The primary static environment is `Ready`, but reports source branch
  `162/merge`, not `001-access-roles`. Workflow success alone cannot certify the
  exact currently published application revision.
- An aggregate test Application Insights request query for the preceding
  30 minutes returned no rows. That is inconclusive: it does not establish
  handler invocation or exclude telemetry delay/upstream authentication failure.

The confirmed verifier defect is separate from the live 404: neither missing
role assignment, absent function registration, nor an absent primary-environment
link has been established as its cause. Do not claim that correcting the verifier
alone repairs forwarding, or that a redeployment is guaranteed to fix it.

Microsoft documents that linked Functions receive the full `/api` path and must
retain that prefix; the local host configuration preserves the default prefix.
The documented linked-backend resource requires the backend ID and region; the
observed null optional routing field is not evidence of a defect by itself.
See [linked Functions guidance](https://learn.microsoft.com/en-us/azure/static-web-apps/functions-bring-your-own)
and [linked-backend resource reference](https://learn.microsoft.com/en-us/azure/templates/microsoft.web/2023-12-01/staticsites/builds/linkedbackends).

No service setting, backend link, application code, or workflow was changed during
the read-only diagnosis. A local verifier correction was subsequently approved
and is recorded below. Changing or redeploying the shared test environment still
requires separate approval. Hosted Cosmos/Maps acceptance remains blocked at the
linked API boundary.

### Local Verifier Correction: 2026-10-20

The shared deployment workflow now reads
`builds/default/linkedBackends?api-version=2023-12-01` and selects
`value[].properties.backendResourceId`. Its existing verification helper still
requires exactly the intended Function App, compares resource IDs
case-insensitively, and rejects missing, incorrect, or multiple backends.
A focused regression test checks the workflow's collection and selected property.
No legacy-query fallback, weaker assertion, or cloud configuration change was
introduced. This corrects the management-plane verification query, not the live
same-origin 404; hosted API acceptance remains blocked until separately verified.

Local validation passed: all 9 verifier tests, API lint and typecheck, changed-file
formatting (including workflow YAML parsing), and editor diagnostics. The editor
test runner could not discover these tests; the existing API Vitest npm command
ran them successfully. No GitHub Actions OIDC step, workflow dispatch, deployment,
or hosted API retest was performed for this local correction.

### Per-Route Hosted Sign-In Evidence

| Route checked                                  | Signed-out gate and return parameter | Completed sign-in/return                         |
| ---------------------------------------------- | ------------------------------------ | ------------------------------------------------ |
| `/`                                            | Passed: 302, return `/`              | Not run                                          |
| `/challenges`                                  | Passed: 302, return `/challenges`    | Passed with admin; Cosmos load separately failed |
| `/challenges/national-trust`                   | Passed: 302, same return path        | Not run                                          |
| `/waypoints`                                   | Passed: 302, same return path        | Not run                                          |
| `/waypoints/demo-foxglove-manor`               | Passed: 302, same return path        | Not run                                          |
| `/ideas`                                       | Passed: 302, same return path        | Not run                                          |
| `/ideas/demo-idea-railway-picnic`              | Passed: 302, same return path        | Not run                                          |
| `/activities`                                  | Passed: 302, same return path        | Not run                                          |
| `/activities/activity-demo-thistledown-autumn` | Passed: 302, same return path        | Not run                                          |
| `/map`                                         | Passed: 302, same return path        | Not run                                          |
| `/settings`                                    | Passed: 302, same return path        | Not run                                          |

**Blocked**: Loaded Demo Cosmos admin/viewer browsing and export, authenticated
Maps success, and loaded admin editing controls. Resolve the test API 404 before
using fallback presentation as permission evidence.

**Not run**: Viewer and unassigned-identity sessions, remaining completed sign-in
return journeys, cross-organization invitation acceptance, role refresh, and
per-resource isolation. No account-switch or invitation-administration action
was performed. SC-001 and hosted SC-006 remain incomplete.

## Evidence Map

| Specification area                             | Repository evidence                                                                                                                                                                                                                                                                                                                                                                                                                   | What it establishes                                                                                                                                                             |
| ---------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Application entry and return route             | [Hosting configuration](../../staticwebapp.config.json), [configuration tests](../../src/staticwebapp.config.test.ts)                                                                                                                                                                                                                                                                                                                 | Application and API routes accept `admin` or `viewer`; authentication endpoints remain reachable; the 401 override starts Entra sign-in with a return location.                 |
| Protected identity validation                  | [Principal validation](../../api/src/lib/principal.ts), [principal tests](../../api/src/lib/principal.test.ts)                                                                                                                                                                                                                                                                                                                        | Entra provider, authenticated role, nonempty user ID, and exactly one distinct Journey role are required. Missing and malformed principal data is rejected.                     |
| Shared reads and admin-only writes             | [Journey handler](../../api/src/functions/journey.ts), [handler tests](../../api/src/functions/journey.test.ts)                                                                                                                                                                                                                                                                                                                       | Both roles can read; non-admin mutations are rejected before processing the requested change. The same authorization branch handles production and demo.                        |
| Protected map reads                            | [Token handler](../../api/src/functions/mapsToken.ts), [token tests](../../api/src/functions/mapsToken.test.ts), [search handler](../../api/src/functions/mapsSearch.ts), [search tests](../../api/src/functions/mapsSearch.test.ts)                                                                                                                                                                                                  | Both handlers apply the shared role validator without requiring admin. Tests now include explicit admin/viewer success and invalid-principal rejection before downstream calls. |
| Frontend write guards and dataset restrictions | [Journey context](../../src/features/journey/JourneyContext.tsx), [context tests](../../src/features/journey/JourneyContext.test.tsx)                                                                                                                                                                                                                                                                                                 | Viewer writes are rejected even through direct mutation-method calls; local demo, loading, and failed Production states block changes.                                          |
| Read-only presentation                         | [Header](../../src/components/Layout.tsx), [read-only notice](../../src/components/ReadOnlyNotice.tsx), [notice tests](../../src/components/ReadOnlyNotice.test.tsx), [access-status rules](../../src/domain/dataMode.ts)                                                                                                                                                                                                             | Loaded viewers see read-only status; notices explain viewer access or the higher-priority fallback/error state.                                                                 |
| Collection and detail controls                 | [Activities tests](../../src/pages/Activities.test.tsx), [Activity details tests](../../src/pages/ActivityDetails.test.tsx), [Ideas tests and controls](../../src/pages/Ideas.tsx), [Idea details tests](../../src/pages/IdeaDetails.test.tsx), [Waypoint details tests](../../src/pages/LocationDetails.test.tsx), [Dashboard tests](../../src/pages/Dashboard.test.tsx), [Challenge controls](../../src/pages/ChallengeDetails.tsx) | Representative viewer tests and page conditions hide mutation actions; challenge route editing is guarded by read-only state.                                                   |
| Export, import, and clear                      | [Settings](../../src/pages/Settings.tsx), [Journey handler](../../api/src/functions/journey.ts)                                                                                                                                                                                                                                                                                                                                       | Export depends on loaded data, not admin access. Import and clear controls depend on writability; restore checks dataset emptiness on the server.                               |
| Invitations and session refresh                | [Operations guide](../../docs/operations.md#sign-in-and-role-assignment)                                                                                                                                                                                                                                                                                                                                                              | Documents per-resource invitations, acceptance, auditing, role replacement/revocation, and sign-out/sign-in. This is an operator procedure, not application code.               |
| Approved policy                                | [Agent conventions](../../AGENTS.md), [README](../../README.md), [constitution](../../.specify/memory/constitution.md)                                                                                                                                                                                                                                                                                                                | Current project policy approves admin/viewer shared access and the existing data-mode restrictions.                                                                             |

## Distinctions and Review Gaps

1. **Entry gate versus service validation**: The hosting route configuration accepts
   either listed role; it does not express an exclusive-or check. A principal with
   both roles may pass that gate, but the data and map handlers reject it. The
   specification deliberately does not promise that such a principal cannot load
   the application shell.
2. **No single-user allowlist**: Principal validation does not compare the user ID
   or email with one configured work identity. Access relies on the hosting
   invitation/role boundary plus provider and principal validation. No live
   invitation inventory was inspected.
3. **Session changes**: The frontend learns the role from dataset loading, not from
   a continuously refreshed role feed. Immediate revocation and instantaneous UI
   changes in an already-open tab are not established. The operations guide
   instructs users to sign out and back in after an assignment change.
4. **Regression matrices added**: Journey tests now cover four role/container
   reads, twelve viewer mutation denials, twelve admin mutation successes, and
   nonempty import denial in both containers. Invalid-principal tests cover all
   three handlers and the shared validator, including empty user IDs. Context
   tests exercise every viewer mutation and shared-mode transitions. Execution
   status is recorded below; these are mocked boundaries, not live service proof.
5. **Hosted checks remain external**: Sign-in redirects, invitation acceptance,
   per-resource isolation, and assignment replacement/revocation require hosted
   verification with appropriate identities. Local configuration assertions do not
   prove those platform flows ran successfully.
6. **Acceptance, not deployment certification**: Success criteria describe how
   to verify the approved baseline. They are not claims that the current
   deployment has passed every scenario.

## Requirement-to-Test Mapping

| Requirements           | Local evidence                                                                                                                                                                                                                                                                                                                                                                 | Hosted evidence still required                                                                             |
| ---------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ | ---------------------------------------------------------------------------------------------------------- |
| FR-001, FR-002; SC-001 | Existing [hosting configuration assertions](../../src/staticwebapp.config.test.ts) retained without duplication.                                                                                                                                                                                                                                                               | Sign-in/return for every route below; authenticated unassigned-user denial.                                |
| FR-003; SC-003         | [Principal cases](../../api/src/lib/principal.test.ts), [Journey](../../api/src/functions/journey.test.ts), [Maps token](../../api/src/functions/mapsToken.test.ts), [Maps search](../../api/src/functions/mapsSearch.test.ts): malformed/incomplete, wrong field types/provider, empty ID, missing authentication, no role, and both roles. No downstream calls after denial. | Actual platform identity forwarding is not proved by synthetic local headers.                              |
| FR-004; SC-004         | Journey GET matrix: admin/viewer by production/demo, identical fixture graph and complete response envelope.                                                                                                                                                                                                                                                                   | No hosted shared-data comparison performed.                                                                |
| FR-005, FR-006; SC-002 | Journey viewer matrix: six categories by two containers, 403 before body processing or data/geocoding I/O. [Context tests](../../src/features/journey/JourneyContext.test.tsx): all exposed mutations, including route removal, restore, and clear.                                                                                                                            | No live mutation probes are authorized or supported by an isolated API dataset.                            |
| FR-007; SC-005         | Eight collection/detail viewer notice/link checks below; [header](../../src/components/Layout.test.tsx) and [Settings](../../src/pages/Settings.test.tsx).                                                                                                                                                                                                                     | Read-only browsing checks require separately approved identities.                                          |
| FR-008; SC-004         | Both-role Maps success and viewer export for both shared modes; exported JSON contains the active fixture.                                                                                                                                                                                                                                                                     | Successful authenticated downstream service calls remain unverified.                                       |
| FR-009, FR-010; SC-004 | Journey admin matrix, ETag conflict/integrity tests, empty/nonempty imports; context and Settings admin/availability guards.                                                                                                                                                                                                                                                   | No live mutations attempted.                                                                               |
| FR-011                 | Context tests switch both directions between shared modes without elevating viewer access, then verify the local sentinel remains read-only. Settings mode selection remains usable.                                                                                                                                                                                           | No hosted mode-switch acceptance run.                                                                      |
| FR-012, FR-013; SC-006 | [Operations](../../docs/operations.md#sign-in-and-role-assignment) and [agent conventions](../../AGENTS.md) align eligibility, per-resource invitations, fresh-session checks, and hosting/backend boundaries.                                                                                                                                                                 | Approved external-organization identity, assignment refresh, and a second existing resource for isolation. |

## Route and Page Audit

The inventory and expected outcomes are defined in
[quickstart.md](quickstart.md#route-and-page-audit-inventory).
Local entries below identify tests added or retained and their observed results.
The hosted column preserves the initial local-signoff state; it is not implied
by local results. See the current per-route hosted evidence above for the
2026-10-19 partial checks and the API blocker.

| Route                      | Local test evidence                                                                                                                                                                 | Local execution                                          | Hosted at local signoff |
| -------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------- | ----------------------- |
| `/`                        | [App routing](../../src/app/App.tsx) reviewed; hosting configuration assertions retained. Root redirects to `/challenges`; no new dedicated root redirect test.                     | Configuration assertions passed; redirect reviewed only. | Not run                 |
| `/challenges`              | [Dashboard](../../src/pages/Dashboard.test.tsx): retained viewer browsing/write denial; added Settings-link assertion.                                                              | Passed                                                   | Not run                 |
| `/challenges/:challengeId` | [Challenge details](../../src/pages/ChallengeDetails.test.tsx): saved/no-route viewer browsing, map, notice/link, absent route controls and file input.                             | Passed                                                   | Not run                 |
| `/waypoints`               | [Waypoints](../../src/pages/Locations.test.tsx): viewer browsing, notice/link, hidden add controls.                                                                                 | Passed                                                   | Not run                 |
| `/waypoints/:id`           | [Waypoint details](../../src/pages/LocationDetails.test.tsx): retained viewer write denial; added notice/link assertions.                                                           | Passed in the single-worker run.                         | Not run                 |
| `/ideas`                   | [Ideas](../../src/pages/Ideas.test.tsx): viewer browsing, notice/link, no editor through normal or add-query entry.                                                                 | Passed, including editor and conflict cases.             | Not run                 |
| `/ideas/:ideaId`           | [Idea details](../../src/pages/IdeaDetails.test.tsx): retained viewer write denial; added notice/link assertions.                                                                   | Passed                                                   | Not run                 |
| `/activities`              | [Activities](../../src/pages/Activities.test.tsx): retained viewer write denial; added notice/link assertions.                                                                      | Passed                                                   | Not run                 |
| `/activities/:activityId`  | [Activity details](../../src/pages/ActivityDetails.test.tsx): retained viewer write denial; added notice/link assertions.                                                           | Passed in the single-worker run.                         | Not run                 |
| `/map`                     | [Map page tests](../../src/pages/MapPage.test.tsx) retained for map browsing; explicit viewer authorization is covered at the two Maps handlers, not by a new viewer map-page test. | Map page and handler tests passed.                       | Not run                 |
| `/settings`                | [Settings](../../src/pages/Settings.test.tsx): loaded viewer exports both modes, disabled writes, usable mode selection, admin controls and load guards.                            | Passed                                                   | Not run                 |

## Implementation Environment and Validation

- Windows has no Node/npm on PATH. The approved existing Ubuntu WSL environment
  initially also returned `node: command not found` and `npm: command not found`.
  Docker was unavailable: its Linux-engine named pipe did not exist.
- With owner approval, checksum-verified official Node.js 24.22.0 and npm 11.19.1
  were installed in Ubuntu. Root/API dependencies were restored with
  `npm ci`; no dependency manifests, lockfiles, or build scripts were changed.
- The Ubuntu 26.04 Microsoft feed returned
  `E: Unable to locate package azure-functions-core-tools-4`.
  Microsoft's npm distribution installed Core Tools 4.16.0 successfully after
  explicit install-script approval. Playwright Chromium and its host libraries
  were installed in the same Ubuntu environment.
- Existing ignore files were reviewed: dependency/build/coverage directories are
  excluded, packages are private, no Docker setup is present. `.env*` was added
  to Git ignores to exclude local environment secrets.
- Runtime review found no access-contract mismatch requiring a behavior change.
  Hosting membership and backend exact-one-role checks remain distinct.

### Initial Validation Attempts (Historical)

These results preceded the approved unblocking changes. Current results above
supersede their failed/blocked status.

| Check                                          | Result                                                                                                                                                                                                                                                                                                  |
| ---------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Requirements-quality checklist                 | 16/16 checked; implementation is not implied.                                                                                                                                                                                                                                                           |
| Editor diagnostics                             | No errors reported for the implemented test and guidance changes.                                                                                                                                                                                                                                       |
| Focused API feedback                           | Initial run: 102 passed, 1 failed during a cold dynamic import. Module setup was corrected without increasing timeouts; final API coverage passes all 142 tests.                                                                                                                                        |
| Focused frontend feedback                      | The twelve-file focused run initially had 144 passed and 7 failed: new admin fixtures had an invalid empty challenge description, and exact notice matchers did not account for adjacent link text. Both test defects were corrected. The seven affected cases then passed in a filtered four-file run. |
| Changed-file formatting                        | Passed for implemented tests, AGENTS, operations, and feature documents. Final evidence/task status updates are formatted separately.                                                                                                                                                                   |
| Root lint and typecheck                        | Passed. Lint retains two existing warnings.                                                                                                                                                                                                                                                             |
| Root `npm run format:check`                    | Failed: 140 files reported before the last changed context formatting correction. Untouched files include CRLF/LF differences; no repository-wide rewrite performed.                                                                                                                                    |
| Root `npm run test:coverage`                   | Failed in the verified native Ubuntu copy: 345 passed, 17 failed across 35 files, mostly existing editor interaction timeouts.                                                                                                                                                                          |
| Root `npm run test:coverage -- --maxWorkers=1` | Failed: 358 passed, 4 failed across 35 files. Every new access-and-roles case passed; see exact remaining failures below. No thresholds, assertions, or timeouts were changed.                                                                                                                          |
| API lint, typecheck, `npm run test:coverage`   | Passed: 10 files, 142 tests; 84.75% statements, 76.73% branches, 89.76% functions, 87.4% lines.                                                                                                                                                                                                         |
| Root and API `npm run build`                   | Passed. Existing frontend bundle-size warning remains.                                                                                                                                                                                                                                                  |
| Root `npm run test:e2e`                        | Passed: 3 Chromium smoke tests. Uses the existing test-mode local dataset, not hosted authentication.                                                                                                                                                                                                   |
| API `npm run test:smoke`                       | Passed: 2 built-host tests after installing missing `libicu78`. Compiled route registration and anonymous rejection only, not authenticated Azure service success.                                                                                                                                      |
| Hosted acceptance and GitHub-only steps        | Not run; no push, dispatch, deployment, or invitation administration authorized.                                                                                                                                                                                                                        |

### Initial-Validation Findings

- Root `npm run lint` passed with two existing warnings in WaypointEditor and
  JourneyContext; root `npm run typecheck` passed.
- Root `npm run format:check` failed:
  `Code style issues found in 140 files. Run Prettier with --write to fix.`
  An untouched App source file was confirmed to differ only by CRLF versus LF.
  Unrelated files are not reformatted to hide this repository-wide failure.
  The remaining formatting difference in the changed context test was corrected;
  targeted formatting checks now pass.
- The first API CI attempt passed lint/typecheck, then coverage reported 140
  passed and 2 failed: cold dynamic imports in the first Journey and Maps search
  cases exceeded the unchanged 5000ms test timeout. Those two test modules now
  use normal module imports with hoisted mocks so dependency loading is setup,
  not part of an individual authorization assertion.
- The frontend coverage attempt on the Windows-mounted OneDrive workspace hit
  timeouts in existing editor interactions, including ActivityDetails and
  IdeaEditor cases, and was stopped. No test timeout, retry, or assertion was
  weakened.
- Validation used the existing Ubuntu native filesystem: all 184 copied
  source/configuration files had identical SHA-256 hashes to the working tree.
  Missing snapshot dependencies were restored from the existing npm cache using
  unchanged lockfiles. No test input, configuration, or application code was
  modified in the copy. The initial system-temporary snapshot was removed by
  WSL between invocations; the remaining checks used an owner-home snapshot.
- Single-worker coverage reduced contention but did not make the suite pass.
  The following existing cases still fail and are not marked complete or
  silently skipped:
  - [WaypointEditor tests](../../src/components/WaypointEditor.test.tsx):
    `validates required fields, completion, coordinates, references and photos`
    and `submits trimmed fields with a valid count completion and coordinates`
    each report `Error: Test timed out in 10000ms.`
  - [Ideas tests](../../src/pages/Ideas.test.tsx):
    `validates idea location coordinates and reference https URLs` reports
    `Error: Test timed out in 10000ms.`
  - [Ideas tests](../../src/pages/Ideas.test.tsx):
    `offers to reload the latest ideas after a save conflict` reports
    `Unable to find role="option" and name "Foxglove Manor (Demo)"`.
- The first built-host smoke attempt reported
  `Couldn't find a valid ICU package installed on the system.`
  Installing Ubuntu's `libicu78` resolved that dependency; both unchanged smoke
  tests then passed. Globalization-invariant mode and compatibility switches
  were not used.
- At the end of the initial attempt, T022 was blocked by repository-wide formatting
  and full frontend coverage failures. The approved follow-up resolved those
  blockers as recorded above. SC-001 and hosted SC-006 remain not run.

Dependency installation reported existing audit advisories: frontend 6 (3 moderate,
3 high), API 4 (3 moderate, 1 high). No audit fix, dependency update, or vulnerability
assessment is included in this access-baseline task.
