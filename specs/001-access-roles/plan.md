# Implementation Plan: Access and Roles Baseline

**Branch**: `001-access-roles` | **Date**: 2026-10-17 | **Spec**: [spec.md](spec.md)

**Feature identifier**: `001-access-roles`. The dedicated branch was created from
`speckit` during task generation, preserving the existing uncommitted setup and
planning work. Each subsequent Spec Kit feature must start on its own new branch;
this does not change branching rules outside Spec Kit.

**Input**: [Existing-behavior specification](spec.md), including the clarification
that explicitly invited Entra work identities are eligible regardless of organization.

## Summary

Preserve the existing invitation-based access model. Do not rebuild authentication,
introduce roles, add an identity store, or redesign the API. Close bounded evidence
gaps with tests beside the existing implementation, align role-boundary wording,
and document hosted acceptance checks that cannot be proved by local tests.

The implementation is already present:

| Surface              | Existing behavior to preserve                                                       | Remaining work                                                                       |
| -------------------- | ----------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------ |
| Hosting entry        | Role-membership gates and Entra sign-in redirect with return location.              | Keep configuration and its assertions; verify actual redirects separately on Azure.  |
| Principal validation | Authenticated `aad`, nonempty user ID, exactly one distinct Journey role.           | Add explicit negative cases not independently covered, particularly empty user ID.   |
| Journey handler      | Shared reads and admin-only mutations for both supported containers.                | Complete role-by-container tests and assert rejected writes do not perform data I/O. |
| Maps handlers        | Same principal validator; both roles may request token/search reads.                | Add explicit viewer success and invalid-principal rejection coverage.                |
| Frontend context     | Backend role drives writability; local demo/loading/failed Production block writes. | Extend viewer mutation and mode-switch coverage using mocked remote mode.            |
| UI and export        | Existing read-only notices, hidden/disabled writes, loaded-data export.             | Fill collection, Settings, header, and saved-route viewer coverage gaps.             |
| Operations           | Invitations and session refresh are already documented.                             | Clarify organization eligibility, enforcement boundaries, and evidence limits.       |

Only tests and directly related guidance are anticipated in a later implementation.
A failing test that establishes an actual runtime mismatch must be reported for a
scoped correction; it is not permission to redesign behavior.

## Technical Context

**Language/Version**: Strict TypeScript; Node.js 24+; React 19.

**Primary Dependencies**: Vite, MUI, React Router, Zod; Azure Functions,
Azure Identity, Cosmos SDK, and Azure Maps. Reuse installed project dependencies.

**Storage**: Existing Cosmos Journey documents only. No new documents, schemas,
migrations, credential persistence, or role tables.

**Testing**: Vitest and Testing Library for principals, handlers, context, and UI;
existing Functions host smoke tests; existing Playwright application smoke tests.
Hosted Entra/invitation acceptance remains a separate operator procedure.

**Target Platform**: Browser application on Azure Static Web Apps with a linked
Node.js Functions backend; the repository's CI runs on Ubuntu with Node.js 24.

**Project Type**: Existing frontend plus minimal linked API; documentation and
verification changes, not a new feature service.

**Performance Goals**: Preserve the current request flow. No new polling, auth
round-trips, throughput targets, or performance infrastructure are required by this baseline.

**Constraints**: No production test mutations, synthetic hosted identity headers,
new infrastructure, new endpoints, new providers, or live role changes during planning.
Node.js/`npx` were unavailable in this execution environment during prior checks.
The API build script also uses POSIX `mkdir -p` and `cp`; its existing Linux CI
environment must not be represented as a native PowerShell build.

**Scale/Scope**: Small private shared application; two Journey roles, two API data
containers, two read-only Maps endpoints, and existing collection/detail/Settings views.
Local demo is not a third hosted role.

## Constitution Check

_GATE: Must pass before Phase 0 research. Re-check after Phase 1 design._

Assessed against [constitution v1.0.2](../../.specify/memory/constitution.md).
These gates apply its durable principles; role matrices and runtime details remain
in this feature's specification and contracts.

| Gate                                              | Pre-research                                                                                  | Post-design                                                                                                    |
| ------------------------------------------------- | --------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------- |
| Small/direct change; no speculative layers        | PASS: inspect and reuse existing boundaries.                                                  | PASS: tests and guidance only; no new auth abstraction.                                                        |
| Explicit failures and narrow demo exception       | PASS: preserve rejection/load behavior.                                                       | PASS: assertions distinguish forbidden, loading, failure, and local demo.                                      |
| Typed domain and consistent UI                    | PASS: existing types, schemas, notices, and theme remain.                                     | PASS: no UI redesign or duplicate role model.                                                                  |
| Protected access and data integrity               | PASS: existing backend authentication/authorization and approved persistence boundary remain. | PASS: no credential exposure, data-boundary expansion, or live production mutation; tests use mocked services. |
| Evidence-based validation and controlled delivery | PASS: no push/deploy or hosted changes requested.                                             | PASS: local, host-smoke, and Azure-only evidence are explicitly separated.                                     |

The owner confirmed the existing enforcement boundary: hosting checks membership
in either role; protected backend operations require an authenticated Entra principal
with exactly one role. That feature-specific rule is recorded in [spec.md](spec.md)
and [the access contract](contracts/access-control.md), not duplicated in the
streamlined constitution. No runtime change or constitutional exception is needed.
Align the corresponding AGENTS wording during the later documentation work.

Cross-organization eligibility is application policy, not proof that every tenant's
external-access policies permit sign-in. No tenant allowlist exists in the reviewed
validator. Verify hosted eligibility with approved accounts; report a platform
restriction rather than adding custom identity infrastructure.

## Project Structure

### Documentation (this feature)

```text
specs\001-access-roles\
  spec.md
  evidence.md
  plan.md
  research.md
  data-model.md
  quickstart.md
  contracts\
    access-control.md
  checklists\
    requirements.md
```

Task generation is a separate `/speckit-tasks` step; no task file is created here.

### Source Code (repository root)

```text
staticwebapp.config.json
src\
  staticwebapp.config.test.ts
  services\journeyApi.ts
  features\journey\JourneyContext.tsx
  domain\dataMode.ts
  components\Layout.tsx
  components\ReadOnlyNotice.tsx
  pages\                         existing views and colocated tests
api\
  src\lib\principal.ts
  src\functions\journey.ts
  src\functions\mapsToken.ts
  src\functions\mapsSearch.ts
  smoke\host.test.ts
  scripts\verify-functions.ts
infra\main.bicep
.github\workflows\
  ci.yml
  deploy-environment.yml
  deploy-test.yml
  azure-static-web-apps.yml
```

**Structure Decision**: Keep tests beside existing files. Extend local test helpers
only where needed; do not introduce a shared policy framework or a second set of
runtime types. Infrastructure and workflow files are evidence/validation consumers,
not planned implementation targets.

## Phase 0: Research Conclusions

See [research.md](research.md) for decisions and alternatives. Investigation traced
the hosting gate through shared principal validation, all three handlers, role
loading, frontend guards, UI controls, existing tests, and deployment verification.
No unresolved architecture choice requires external research or new dependencies.

Existing Playwright smoke tests build in Vite test mode and therefore do not prove
hosted authentication. Existing Functions host tests prove route registration and
anonymous rejection, not successful Entra sessions. Deployment verification
explicitly reports that authenticated downstream calls remain unverified.

## Phase 1: Design and Remaining Work

1. **Preserve contracts**: Record current fields, authorization rules, response
   boundaries, and access states in [data-model.md](data-model.md) and
   [the access contract](contracts/access-control.md). Do not change public shapes.
2. **Complete API evidence**: Extend principal tests and parameterize Journey
   authorization over `production` and `demo` using mocked Cosmos. Cover both roles'
   reads and all six viewer write categories. Use valid representative payloads,
   check forbidden responses, and assert no downstream data read/write or geocoding.
   Invalid principals must not reach data access or Maps calls.
3. **Prove permitted Maps reads**: Add explicit viewer success cases to the existing
   token/search handler tests, and invalid-principal cases using existing mocks.
4. **Complete UI/context evidence**: Reuse existing fixtures with
   `vi.stubEnv('MODE', 'production')` and mocked API responses. Cover all exposed
   mutation methods for viewers, including restore/clear, saved-route edits, and
   switching shared datasets. Fill missing viewer assertions for Waypoints/Ideas
   collections, Challenge route controls, header status, and Settings export versus
   disabled restore/clear. Retain existing covered detail-page behavior.
5. **Align guidance**: Update AGENTS entry-versus-backend wording and relevant
   operations guidance for eligibility and fresh-session access checks. Do not
   promise immediate revocation, a tenant restriction, or a role-administration UI.
   The separate Copilot demo-fallback wording follow-up is not part of this role plan.
6. **Verify and report**: Follow [quickstart.md](quickstart.md). Local regression
   work and hosted acceptance results must have separate completion states.
   Lack of Azure identities, permissions, or a second resource is an explicit
   unverified acceptance item, not a simulated pass.

### Requirement Traceability

| Requirements           | Existing implementation                                             | Remaining verification                                                                                              |
| ---------------------- | ------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------- |
| FR-001, FR-002         | Hosting config and configuration test.                              | Preserve assertions; hosted redirects, denial, and return-route checks.                                             |
| FR-003                 | Shared principal validator used by all handlers.                    | Complete negative cases; verify no downstream I/O; hosted identity evidence.                                        |
| FR-004, FR-005, FR-006 | Journey handler and context write guards.                           | Two-container read matrix, 12 viewer-write combinations, direct context guard checks.                               |
| FR-007                 | Header, notices, page read-only conditions.                         | Missing collection, header, saved-route, and Settings viewer checks.                                                |
| FR-008                 | Settings export and role-neutral Maps reads.                        | Viewer export and explicit viewer success for both Maps endpoints.                                                  |
| FR-009, FR-010, FR-011 | Existing admin mutation paths, mode guards, import emptiness check. | Retain existing positive tests; add missing viewer mode-switch and guard assertions.                                |
| FR-012, FR-013         | Platform invitations and operator guide.                            | Clarify guidance; externally verify fresh sessions, resource isolation, and approved cross-organization invitation. |

## Completion and Validation

Planning is complete when these artifacts contain a coherent existing-behavior
design and distinguish known implementation from unexecuted verification.

Later local implementation is complete when the identified tests and role guidance
are updated and impacted checks pass. Overall acceptance remains pending for any
unperformed hosted scenario. Do not claim full SC-001 or SC-006 acceptance based on
mocked tests, configuration assertions, or the existing Playwright run.

This planning change is documentation/governance only: validate changed Markdown
with editor diagnostics and Prettier. Do not run application suites just to write
a plan. Later cross-package test changes require the complete locally executable
CI sequence once before final review/commit, subject to the environment limitations
and exact commands documented in the quickstart.
