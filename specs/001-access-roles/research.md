# Research: Access and Roles Baseline

**Date**: 2026-10-17
**Related artifacts**: [Specification](spec.md), [plan](plan.md), [baseline evidence](evidence.md).

This research uses repository implementation, tests, and deployment configuration.
It does not claim tests were executed or Azure configuration was inspected.

## 1. Preserve the Existing Enforcement Boundaries

**Decision**: Reuse the hosting role gate, the shared principal validator, the
Journey admin-only write check, and the existing frontend guards.

**Rationale**: [Hosting configuration](../../staticwebapp.config.json) requires role
membership. [Principal validation](../../api/src/lib/principal.ts) requires `aad`,
`authenticated`, a nonempty `userId`, and exactly one distinct Journey role.
[Journey](../../api/src/functions/journey.ts), [Maps token](../../api/src/functions/mapsToken.ts),
and [Maps search](../../api/src/functions/mapsSearch.ts) already use it.
The owner confirmed the shell-entry versus backend distinction. The feature spec
and contract record it; constitution v1.0.2 keeps only the durable requirement for
backend authentication/authorization, not this feature's role matrix.

**Alternatives considered**: Replacing sign-in, adding middleware, choosing a
winning role when both are assigned, or adding a second authorization service.
These would change the baseline or introduce unsupported infrastructure.

## 2. Keep Invitations as the Identity Boundary

**Decision**: Any explicitly invited Entra work identity is eligible regardless
of organization; add no organization/user/email allowlist.

**Rationale**: The clarified requirement approves this policy. The validator checks
provider, user ID, authentication, and Journey roles, not tenant or email.
[Operations guidance](../../docs/operations.md#sign-in-and-role-assignment)
already manages invitations per Static Web App resource. Azure/tenant policies
and fresh-session behavior must be verified externally with approved identities.

**Alternatives considered**: A tenant restriction, a local identity table,
in-application role administration, or personal-account support. None is in scope.

## 3. Extend Existing Tests Instead of Reimplementing Access

**Decision**: Add focused cases to colocated tests and retain existing fixtures/mocks.

**Rationale**: [Journey tests](../../api/src/functions/journey.test.ts) already verify
viewer rejection for six production mutation categories and selected admin paths.
[Principal tests](../../api/src/lib/principal.test.ts) cover valid roles, provider
rejection, no role, and both roles, but not every independent missing-field case.
Maps success tests currently use admin identities. Context tests cover a direct
viewer activity mutation, not every mutation or viewer mode transition.
Page coverage includes several detail pages but not every viewer collection,
Settings, header, or Challenge route scenario.

**Alternatives considered**: Marking every acceptance criterion complete because
the guard exists, copying a new permission engine into tests, or rebuilding all
covered tests. These would overstate evidence or duplicate existing work.

## 4. Use the Remote Frontend Path for Permission Tests

**Decision**: Follow existing remote-mode tests: set `MODE` to `production`, mock
Journey responses with explicit roles, and use existing deterministic entity fixtures.

**Rationale**: [JourneyContext](../../src/features/journey/JourneyContext.tsx)
has a test-only local path. In that path, restore and clear dispatch directly.
The [Playwright configuration](../../playwright.config.ts) deliberately builds in
test mode. Those smoke tests prove application flows, not authenticated hosted access.
The backend role is obtained from dataset GET responses; writes reuse the loaded
role in frontend state rather than continuously refreshing identity.

**Alternatives considered**: Relying on the `local` sentinel as an admin substitute
in permission tests, adding auth polling, or replacing existing smoke-test setup.
These either test a proxy for authorization or change runtime behavior.

## 5. Separate Local, Functions-Host, and Hosted Evidence

**Decision**: Keep three evidence levels explicit; do not add an automated Entra
login harness or a new Azure validation workflow.

**Rationale**: [CI](../../.github/workflows/ci.yml) runs frontend and API checks.
[Functions host smoke tests](../../api/smoke/host.test.ts) verify compiled route
registration and anonymous rejection. [Deployment verification](../../api/scripts/verify-functions.ts)
checks registrations/backend linkage and explicitly does not prove authenticated
invocation. [Infrastructure](../../infra/main.bicep) uses the existing linked
backend and managed-identity service boundaries. An `anonymous` Functions trigger
is not an invitation to bypass the hosted proxy/principal contract.

**Alternatives considered**: Claiming a local principal-header test proves platform
sign-in, sending synthetic principals through a hosted boundary, or treating
resource metadata as successful downstream service access. These are invalid evidence.

## 6. Do Not Route Automated Tests Through Live Production

**Decision**: Prove the production/demo role matrix using mocked handler tests.
Keep hosted role acceptance read-only; live mutations are outside this baseline
verification plan.

**Rationale**: The Journey route supports only `production` and `demo` and selects
their configured fixed dataset IDs. A `test` route is explicitly rejected.
The [deployment workflow](../../.github/workflows/deploy-environment.yml) separately
uses direct Cosmos access for a unique isolated `test` partition; this does not
exercise user authorization through the Journey API.

The current API cannot provide isolated live mutation testing against the `test`
container. Document that limitation. Do not add a generic container selector,
test-only hosted API, dataset override, or new deployment merely to approximate it.

**Alternatives considered**: Destructive tests against production, silently using
the shared demo partition as isolated test data, or expanding the backend's data
boundary. All violate existing isolation or scope constraints.

## 7. Preserve Explicit Failure and Availability Semantics

**Decision**: Do not add retries, fallback authentication, session polling, or
claims of instantaneous role revocation. Preserve the approved demo-only fallback.

**Rationale**: Frontend read-only status combines loading, viewer role, local demo,
and failed Production load. Header/notices prioritize fallback or failure where
appropriate. An admin role does not override those state restrictions.
Role refresh/revocation timing depends on the platform session; the operator
procedure requires sign-out/sign-in.

**Alternatives considered**: Treating a local demo as an authenticated role,
allowing writes after failed loads, or promising real-time revocation.
None matches current behavior or the approved baseline.

## Research Outcome

No unresolved technical design choices remain. Hosted eligibility, invitations,
redirects, session refresh, and per-resource isolation are explicitly unverified
acceptance checks, not missing architecture decisions.
The known local tooling blocker is unavailable Node.js/`npx`; the existing API
build script also expects POSIX commands. Report these constraints without adding
tooling or changing the build as part of a baseline plan.
