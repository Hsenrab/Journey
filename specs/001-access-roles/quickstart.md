# Validation Guide: Access and Roles Baseline

Use this guide after any later test/documentation implementation. No command below
is claimed to have run merely because it appears here.

See [the access contract](contracts/access-control.md) for expected outcomes and
[the data model](data-model.md) for identity and state definitions.

## Prerequisites and Safety

- Node.js 24+ and the existing package dependencies. Run `npm ci` in the relevant
  package only when dependencies need installation or its lockfile changes.
- Run commands from the repository root unless a section specifies `api`.
- Windows has no Node/npm on PATH. During implementation the owner approved
  installing Node.js 24/npm and validation tools in the existing Ubuntu WSL
  environment. Run the existing commands there; do not change manifests or build
  scripts to accommodate Windows. From a PowerShell repository-root prompt, for
  example: `wsl --distribution Ubuntu --cd (Get-Location).Path --exec npm run lint`.
  For API commands, first change the PowerShell working directory to `api`.
  See [evidence.md](evidence.md) for actual versions, results, and blockers.
- Existing API `build` uses `mkdir -p` and `cp`; execute its unchanged build/host
  checks in the existing Linux-compatible environment used by CI, not by claiming
  they work natively in PowerShell. Do not change the build to satisfy this plan.
- All role-matrix tests use mocked Cosmos/Maps. Do not point automated role tests
  at live production or copy real identities/data into fixtures.
- Planning does not authorize a push, CI dispatch, deployment, invitation, role
  replacement/revocation, or remote mutation. Obtain explicit approval before
  remote verification and any access-administration side effects.

## 1. Validate These Planning Documents

Use editor diagnostics and the installed formatter against the files changed in
this planning step:

```powershell
npx --no-install prettier --check .specify\memory\constitution.md specs\001-access-roles\plan.md specs\001-access-roles\research.md specs\001-access-roles\data-model.md specs\001-access-roles\contracts\access-control.md specs\001-access-roles\quickstart.md
```

This documentation-only planning step does not require application test suites.
Record an unavailable runtime as a blocker, not a successful formatting check.

## 2. Focused Local Feedback During Later Implementation

Use the editor test runner with the relevant colocated tests. The equivalent
commands below are bounded examples, not extra checks to repeat after a successful
final validation.

From the repository root:

```powershell
npm test -- src\staticwebapp.config.test.ts src\features\journey\JourneyContext.test.tsx src\components\Layout.test.tsx src\components\ReadOnlyNotice.test.tsx src\pages\Locations.test.tsx src\pages\Ideas.test.tsx src\pages\ChallengeDetails.test.tsx src\pages\Settings.test.tsx
```

From `api`:

```powershell
npm test -- src\lib\principal.test.ts src\functions\journey.test.ts src\functions\mapsToken.test.ts src\functions\mapsSearch.test.ts
```

Expected assertions:

1. All invalid principal categories fail with the existing principal error/handler
   denial; no downstream service operation runs.
2. Admin/viewer GETs over both mocked shared containers return the selected data
   and correct role: four read combinations.
3. Six viewer mutation categories over both mocked containers yield 403: twelve
   denial combinations, with no data-read/write or geocoding calls.
4. Viewer token/search reads succeed with mocked credentials/results.
5. All viewer context mutations, including restore/clear and saved-route updates,
   reject without a write fetch in remote mode; changing shared modes preserves
   the viewer restriction.
6. All six admin mutation categories (create, update, delete, import, replace, and
   clear) succeed over both mocked shared containers: twelve positive combinations.
   Import succeeds into an empty dataset in each container and returns 409
   `data_not_empty` into a nonempty dataset in each container. Existing success
   shapes/statuses and validation/concurrency checks remain intact.
7. Local-demo, loading, and failed-Production write restrictions remain valid.
   Viewer Settings allows loaded-data export while disabling restore/clear; the
   page/header assertions and applicable inventory checks below pass.

Do not use Vite's test-only local data path to prove remote-role enforcement.

### Route and Page Audit Inventory

This inventory follows the routes registered in [App.tsx](../../src/app/App.tsx).
SC-001 requires separately authorized hosted sign-in/return verification for every
row; local routing/configuration tests do not satisfy that acceptance criterion.
SC-005 requires a read-only explanation with a Settings link on all eight
collection/detail pages marked below, plus disabled viewer import/clear in Settings.

| Route                      | Hosted sign-in return target                        | Read-only UI audit                                                                  |
| -------------------------- | --------------------------------------------------- | ----------------------------------------------------------------------------------- |
| `/`                        | `/challenges` after the normal application redirect | Covered by the `/challenges` page.                                                  |
| `/challenges`              | Requested route                                     | Collection: notice, Settings link, and no viewer write controls.                    |
| `/challenges/:challengeId` | Requested detail deep link                          | Detail: notice, Settings link, and no viewer saved-route writes.                    |
| `/waypoints`               | Requested route                                     | Collection: notice, Settings link, and no viewer write controls.                    |
| `/waypoints/:id`           | Requested detail deep link                          | Detail: notice, Settings link, and no viewer write controls.                        |
| `/ideas`                   | Requested route                                     | Collection: notice, Settings link, and no viewer write controls.                    |
| `/ideas/:ideaId`           | Requested detail deep link                          | Detail: notice, Settings link, and no viewer write controls.                        |
| `/activities`              | Requested route                                     | Collection: notice, Settings link, and no viewer write controls.                    |
| `/activities/:activityId`  | Requested detail deep link                          | Detail: notice, Settings link, and no viewer write controls.                        |
| `/map`                     | Requested route                                     | Viewer can browse authorized map information; not a collection/detail notice check. |
| `/settings`                | Requested route                                     | Loaded-data export remains available; viewer import/clear remain disabled.          |

Use mocked fixture IDs for local detail-page tests and approved demo fixture IDs
for hosted deep links. Do not record real entity IDs or personal records.
In [evidence.md](evidence.md), map each applicable UI check to retained or newly
added tests and their execution status; record hosted sign-in acceptance separately
for each route. An unexecuted hosted check remains not-run or blocked, even when
its local routing or UI tests pass. T021 consolidates this inventory mapping;
existing passing coverage need not be duplicated.

## 3. Final Validation for Later Cross-Package Test Changes

Run the complete locally executable sequence from
[CI](../../.github/workflows/ci.yml) once after implementation, before final
review/commit. Do not run this sequence now merely to generate planning documents.

Root package sequence:

```powershell
npm run lint
npm run typecheck
npm run format:check
npm run test:coverage
npm run build
npm run test:e2e
```

Install Playwright Chromium only if the end-to-end run requires it. CI's browser
installation uses `npx playwright install --with-deps chromium` on Ubuntu; report
platform-specific installation limits rather than pretending that Linux package
installation ran on Windows.

API package sequence, from `api`, in the compatible existing build environment:

```text
npm run lint
npm run typecheck
npm run test:coverage
npm run build
npm run test:smoke
```

Host smoke requires Azure Functions Core Tools 4. It starts the built package,
verifies registered functions, and expects anonymous handler denial. It does not
prove successful Entra sign-in or user access to Cosmos/Maps.

Actions checkout, Azure/OIDC/environment configuration, and artifact uploads are
not local checks. Do not claim they ran. The existing Playwright smoke build uses
test-mode storage and is not a substitute for the hosted checks below.

## 4. Hosted Acceptance, Only When Explicitly Authorized

Use an already deployed test resource and approved work identities with known
`admin`, `viewer`, and unassigned states. Use a second existing approved
nonproduction resource for isolation if available. Do not provision one merely
for this baseline. Never store session cookies, tokens, personal details, or real
Journey records in source or reports.

| Scenario                       | Procedure and expected outcome                                                                                                                                                                                                                                                     | Evidence boundary                                                                               |
| ------------------------------ | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------- |
| Signed-out deep link           | Open every route in the route and page audit inventory in a clean signed-out session, using approved demo fixture IDs for detail deep links; sign-in starts and returns an invited user to the requested route. For `/`, the normal app redirect ends at `/challenges` (Progress). | Requires Azure; record each route separately. Local routing/config assertions are insufficient. |
| Unassigned identity            | Sign in without a Journey role; application/protected access is denied.                                                                                                                                                                                                            | Authentication/consent alone is not role assignment.                                            |
| Viewer browsing                | Load Demo Cosmos as viewer, browse lists/details/map, export loaded demo data, and inspect disabled/absent writes.                                                                                                                                                                 | Read-only checks; do not perform remote mutation attempts.                                      |
| Admin availability             | Load Demo Cosmos as admin and verify expected editing controls are available; select Demo local and verify they are not.                                                                                                                                                           | This does not prove an actual stored mutation.                                                  |
| Cross-organization eligibility | With separate approval for invitation administration, invite an approved work identity from another organization, accept it, and sign out/in. Confirm ordinary role-based access or record the exact external restriction.                                                         | No local header or mocked principal proves this.                                                |
| Assignment refresh             | With approval, follow the existing role replacement/revocation procedure; sign out/in and check access with the fresh session.                                                                                                                                                     | No promise of immediate change in an already-open tab.                                          |
| Per-resource isolation         | Use an identity invited on only one of two existing approved resources; the other denies access.                                                                                                                                                                                   | Without a second suitable resource, record this as unverified; do not deploy a substitute.      |

Malformed/ambiguous-principal cases belong in local handler tests. Do not forge
principals or assign both roles on a hosted resource just to reproduce a case.

### Live Mutation Limitation

The API exposes only fixed Production/Demo datasets, not a unique `test` partition.
Consequently this plan does not provide isolated hosted mutation testing.
Do not send mutation probes to production, silently reuse shared Demo Cosmos as
isolated test data, or add an endpoint/dataset override. The existing direct Cosmos
`test`-partition lifecycle validates storage isolation, not invited-user authorization.

## 5. Record Results Without Overstating Completion

For each scenario record: requirement/scenario ID, test or hosted resource category,
expected result, observed result, and passed/failed/blocked/not-run status.
Use non-personal descriptions; retain exact command/errors for local blockers.

SC-001 and the hosted parts of SC-006 remain unverified until the relevant hosted
scenarios run. Local mock matrices support SC-002 through SC-005 but do not certify
live deployment behavior. Planning completion, local regression completion, and
hosted acceptance are separate states.
