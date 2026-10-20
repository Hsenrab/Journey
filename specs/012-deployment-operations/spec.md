# Feature Specification: Deployment and Operations Baseline

**Feature Branch**: `012-deployment-operations`
**Created**: 2026-10-20
**Status**: Current-state operational baseline; source-reviewed, deployment unexecuted
**Input**: Document existing environment selection, validation, publication,
infrastructure, verification, diagnostics, and recovery boundaries. Log defects
separately rather than changing deployment behaviour.

## User Scenarios & Testing _(mandatory)_

### User Story 1 - Select and Publish to the Intended Environment (Priority: P1)

As a maintainer, I can distinguish validation, test publication, and production
publication so that a branch review is not mistaken for a deployed application.

**Why this priority**: Target and trigger selection determine deployment side effects.
**Independent Test**: Review trigger/input combinations without dispatching them;
any runtime acceptance requires separately authorized isolated execution.

**Acceptance Scenarios**:

1. **Given** a production publication request, **When** it is dispatched from
   a non-main branch, **Then** the production guard fails before deployment.
   A permitted main dispatch requests infrastructure, API, and application publication.
2. **Given** an open or updated pull request, **When** test automation runs,
   **Then** it validates the code, may provision selected infrastructure, and
   exercises an isolated database test partition. It does not publish the API
   package or application and does not create a new per-request preview site.
3. **Given** a manual test dispatch, **When** it runs, **Then** it publishes
   the application to the shared test site's primary environment and independently
   selects whether infrastructure and API deployment are required.
4. **Given** automatic test deployment selection, **When** changes are compared
   with the most recent successful test-workflow revision, **Then** the decisions
   and changed paths are reported. Explicit true/false inputs override automatic
   decisions; absent or unreachable comparison history selects both deployments.
5. **Given** a deployment target, **When** cloud jobs begin, **Then** they use
   that target's configuration and any configured environment approvals, identify
   the selected subscription/resource group, and reject a mismatched or unreadable target.
6. **Given** concurrent publication runs for one target, **When** another run
   arrives, **Then** the environment deployment queue does not cancel an active
   deployment. Closing a pull request only requests cleanup of any legacy preview.

### User Story 2 - Provision and Operate the Approved Stack (Priority: P1)

As a maintainer, I can identify the resources and data side effects needed to
operate the existing application without adding services or exposing credentials.

**Why this priority**: Publication includes identity, network, and data operations,
not only copying static files.
**Independent Test**: Trace declared resources, role scopes, data seed, and cleanup
steps; cloud provisioning itself is not required for this documentation review.

**Acceptance Scenarios**:

1. **Given** infrastructure deployment, **When** it is selected, **Then** it
   provisions the approved hosted site, linked API, database containers, map
   account, host storage/network boundary, and diagnostics with ownership tags.
2. **Given** selected infrastructure deployment, **When** its data seed step runs,
   **Then** it replaces only Demo data from the bundled fixture, not Production.
   Application-only publication does not run that seed.
3. **Given** test database verification, **When** it runs, **Then** it creates
   a marker in a unique run/attempt test partition, unconditionally cleans that
   partition, and checks that nothing remains. It is not full authenticated
   application acceptance or a production-data test.
4. **Given** API package publication, **When** temporary runner network access
   is granted for host storage, **Then** it is limited to that runner address
   and cleanup is attempted even after deployment failure. Cleanup failures
   remain visible rather than being treated as success.
5. **Given** cloud service access, **When** the application operates, **Then**
   approved managed-identity and resource-scoped access rules apply. Deployment
   credentials remain within deployment tooling, not browser application code.

### User Story 3 - Interpret Verification and Recover Deliberately (Priority: P2)

As a maintainer, I can tell what a passing check actually proves and distinguish
application rollback from data recovery.

**Why this priority**: A sign-in redirect or deployment summary is not proof that
an authenticated user can use downstream data and map services.
**Independent Test**: Map each check and recovery instruction to its evidence,
without contacting services, restoring data, or republishing.

**Acceptance Scenarios**:

1. **Given** a publication run, **When** its initial validation fails,
   **Then** infrastructure resolution/deployment does not proceed. Validation
   covers both application and API packages and their existing smoke checks.
2. **Given** API or application publication, **When** registration verification
   runs, **Then** the expected enabled routes and exactly the intended primary
   linked backend are required before application publication proceeds.
3. **Given** application publication, **When** its hosted checks run, **Then**
   they inspect anonymous sign-in redirects, direct-host rejection, and diagnostics
   configuration. Their outcomes are not described as successful authenticated
   Journey or Maps operations.
4. **Given** a workflow summary containing an application URL, **When** I read
   it, **Then** it identifies the resolved site, not necessarily a newly published
   preview or a passing authenticated acceptance result.
5. **Given** an incident, **When** I review diagnostics and recovery guidance,
   **Then** application revision, infrastructure/API state, and database recovery
   are treated separately. A site redeploy does not restore deleted real records.
6. **Given** conflicting recovery instructions, **When** they are discovered,
   **Then** they are linked as documentation defects, not accepted as supported
   procedures or used to justify an unrequested deployment.

### Edge Cases

- A pull-request run can change infrastructure and reseed Demo despite not
  publishing the branch application. Documentation-only review must not trigger it.
- Test partition verification is a separate job, not currently a dependency of
  application publication; a failed job can fail the overall run without being
  a pre-publication gate.
- A reported test URL is the shared primary site, not an isolated preview.
  Current test-workflow pull-request triggers have no base-branch filter.
- Skipping infrastructure/API publication requires the expected existing resources;
  missing resources cause a failure rather than a new local-data deployment mode.
- Existing deployment steps include bounded propagation/readiness waits; this
  baseline neither adds retries nor changes their current behaviour.
- Main-only production dispatch, full-stack provisioning, and Demo reseeding must
  not be described as arbitrary-ref or static-assets-only rollback.
- Managed database backup configuration is not evidence of a successful recovery
  drill. Current recovery-time and recovery-point outcomes have not been measured.

## Requirements _(mandatory)_

### Functional Requirements

- **FR-001**: Production dispatch MUST reject non-main refs and retain its existing
  full-stack publication scope for permitted dispatches.
- **FR-002**: Test automation MUST distinguish pull-request validation/provisioning
  from manual API/application publication to the shared primary site.
- **FR-003**: Test deployment selection MUST report independent infrastructure/API
  decisions, explicit overrides, and the comparison-history outcome.
- **FR-004**: Deployment MUST identify and check its selected cloud target, use
  target-specific configuration/approvals, and queue environment publication runs.
- **FR-005**: Infrastructure MUST stay within the approved hosted/API/database/map/
  storage/diagnostics boundary and declared identity/network restrictions.
- **FR-006**: Demo reseeding MUST occur only in selected infrastructure deployment;
  isolated test cleanup MUST remain separate from Production records.
- **FR-007**: API publication MUST retain bounded temporary runner-storage access
  and unconditional cleanup attempts with visible failures.
- **FR-008**: Both package validations MUST precede infrastructure jobs;
  route/backend registration verification MUST gate application publication.
- **FR-009**: Verification MUST distinguish local package callability, deployed
  metadata/link registration, hosting access checks, and authenticated service use.
- **FR-010**: Published site URLs and job outcomes MUST NOT be represented as
  per-request previews or stronger acceptance than the performed checks support.
- **FR-011**: Operations documentation MUST distinguish diagnostics, application/
  infrastructure recovery, user exports, and managed database backup/restore.
  Known documentation contradictions MUST remain separately tracked deviations.

### Key Entities

- **Deployment target**: Selected site/resources and the environment configuration
  governing a run, not a browser data-mode choice.
- **Publication run**: Source revision, trigger, selected components, job results,
  resolved site URL, and associated evidence.
- **Isolated test partition**: Temporary run/attempt data with unconditional cleanup.
- **Recovery evidence**: What was restored and checked, distinct from merely having
  a configured backup or a previously built artifact.

## Success Criteria _(mandatory)_

### Measurable Outcomes

- **SC-001**: Production dispatch, manual test dispatch, and pull-request execution
  each have an explicit component-publication and target outcome.
- **SC-002**: All four evidence levels (local package, registration/link, hosting
  boundary, authenticated service acceptance) are distinguishable; no unexecuted
  cloud check is marked passed by this baseline.
- **SC-003**: Demo seed, isolated test data, and persistent Production data have
  three distinct documented lifecycle boundaries.
- **SC-004**: Each requirement has mapped source/evidence or an explicitly linked
  known deviation, without requiring a new deployment or defect repair.

## Assumptions

- This operational feature complements [access](../001-access-roles/spec.md),
  [data modes/persistence](../002-data-modes-persistence/spec.md), and
  [Map browsing](../007-map-browsing/spec.md); it does not redefine those contracts.
- [Operations guide](../../docs/operations.md) remains the detailed runbook,
  subject to the contradictions linked in evidence. Cloud platform constraints
  and environment approval settings cannot be established from local code alone.
- A known-good revision and valid access are prerequisites for any separately
  authorized recovery. No automatic rollback or verified disaster-recovery service
  is implied by existing workflow artifacts.
- Baseline completion is documentation readiness, not release approval. No
  workflow dispatch, code/configuration change, push, deployment, resource
  mutation, backup restore, or authenticated hosted probe is authorized.
