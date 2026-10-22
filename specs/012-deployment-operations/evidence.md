# Deployment and Operations Evidence

**Reviewed**: 2026-10-20
**Specification**: [Operations baseline](spec.md)

| Requirements   | Source reviewed                                                                                            | Existing evidence/tests                                                                                                                                                               |
| -------------- | ---------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| FR-001         | [Production wrapper](../../.github/workflows/azure-static-web-apps.yml)                                    | Non-main guard and full-stack inputs inspected; no dispatch executed                                                                                                                  |
| FR-002, FR-003 | [Test wrapper](../../.github/workflows/deploy-test.yml)                                                    | Trigger, plan, publication gates, and legacy-preview close path inspected; no Actions run executed                                                                                    |
| FR-004         | Both wrappers and [reusable workflow](../../.github/workflows/deploy-environment.yml)                      | Target checks, environment references, and concurrency inspected; hosted configuration/approvals unverified                                                                           |
| FR-005         | [Infrastructure](../../infra/main.bicep), [hosting config](../../staticwebapp.config.json)                 | [Access evidence](../001-access-roles/evidence.md); provisioning not executed                                                                                                         |
| FR-006, FR-007 | Reusable workflow's Demo seed, test lifecycle, and API deployment jobs                                     | Source-reviewed only; no seed, test partition, or temporary perimeter rule created                                                                                                    |
| FR-008, FR-009 | [CI](../../.github/workflows/ci.yml), reusable workflow, [verifier](../../api/scripts/verify-functions.ts) | [Verifier tests](../../api/scripts/verify-functions.test.ts), [built-host tests](../../api/smoke/host.test.ts), [browser smoke tests](../../e2e/journey.spec.ts) inspected, not rerun |
| FR-010, FR-011 | Workflow summary/checks and [operations guide](../../docs/operations.md)                                   | [Data lifecycle evidence](../002-data-modes-persistence/evidence.md); no recovery or hosted acceptance performed                                                                      |

## Trigger, Target, and Job Boundaries

- Every row is source-reviewed, not newly executed. No GitHub Actions dispatch,
  Azure inspection/mutation, browser probe, application test, backup, or restore
  was performed in this baseline. Earlier access-baseline evidence is not a new
  execution result or proof that the current local revision is deployed.
- Production uses manual dispatch, requires `refs/heads/main`, selects `hh-env`,
  `prod`, Production default data mode, and all three deployment components.
  It does not enable the isolated Cosmos test job.
- Test uses `hh-env-test`, `dev`, and Demo Cosmos startup. Pull-request opened/
  synchronize/reopened events invoke validation and optional infrastructure, not
  API/application publication. There is no base-branch filter. Closed events
  only invoke the legacy-preview cleanup path. Manual runs publish the primary
  application and optionally API/infrastructure; they do not create PR previews.
- Test automatic selection queries the latest successful `deploy-test.yml` run's
  head SHA and compares `last_success_sha...HEAD`. Infrastructure paths are
  `infra/` and the test/reusable workflows. API paths additionally include `api/`
  and hosting configuration. It does not distinguish a successful validation-only
  PR run from a successful manual publication when selecting that reference;
  therefore describe it as workflow history, not proof of last published API state.
- Target wrappers queue environment deployments (`cancel-in-progress: false`).
  Reusable CI separately cancels superseded validation within its workflow/ref
  group. Environment reviewers and OIDC federation are external setup, not
  certified by reading YAML.
- `infra` depends on both CI jobs via the reusable validation workflow.
  `deploy_api` and `test_cosmos` depend on infrastructure and can run independently.
  `verify_api` requires successful infrastructure and a successful or skipped API
  publication; application publication requires successful registration verification.
  `test_cosmos` is not an application-publication prerequisite.
- Infrastructure resolution publishes the site's URL before application
  publication. A summary URL alone is not a deployment-success or health signal.

## Provisioning and Data Side Effects

- Bicep provisions Standard Static Web Apps; Linux Consumption Functions with
  system identity, Functions v4 and Node 22; identity-backed host storage; an
  enforced Network Security Perimeter; Application Insights; Azure Maps Gen2;
  and Cosmos with the `journey` database and `production`/`test`/`demo` containers.
  CI uses Node 24, which must not be mistaken for the deployed host version.
- Cosmos uses `/datasetId`, Session consistency, disabled local authentication,
  a single configured region, and periodic local-redundancy backup every 240
  minutes with 8 hours retention. Its region can be configured separately from
  the site. The template supports free-tier or serverless; the reusable workflow
  supplies no `cosmosMode`, so the current default is serverless.
- Function identity has container-scoped Production/Demo data roles and
  account-scoped Maps render/search access. Deployment principal roles include
  Demo seeding and isolated test data plus storage package upload. Host storage
  disables shared-key/public-blob access and uses identity credentials.
  Detailed access semantics remain in the access/persistence baselines.
- The template declares the Functions link through `userProvidedFunctionApps`.
  Verification intentionally reads the primary build's `linkedBackends`; these
  are distinct provisioning/inspection surfaces, not interchangeable inventories.
- Demo is replaced from the bundled fixture only when `deploy_infra` is true.
  The test job creates one `isolation-check` marker in a unique
  `ci-<run_id>-<run_attempt>` partition, cleans in `finally`, and verifies count zero.
  This is a lifecycle check, not full entity CRUD or authenticated proxy testing.
- API publication obtains the runner IPv4, opens a unique inbound `/32` perimeter
  rule, waits for authenticated storage access, publishes the package, and runs
  rule deletion under `always()`. Bounded propagation waits already exist; this
  baseline adds no retry behaviour and does not certify cleanup after forced
  runner termination.
- Azure login uses OIDC. Static-site publication retrieves and masks its deployment
  token at runtime; this pipeline credential is not a browser Maps/database key.
  No secret values or returned user data were read or copied during this review.

## What Verification Proves

1. **Local validation**: CI installs dependencies, lints, typechecks, checks
   formatting, runs frontend/API coverage tests, builds, and runs browser and
   built-Functions smoke checks. Reports/build output have 7-day artifact
   retention. These commands were not rerun for documentation-only work.
2. **Built package**: Host smoke tests launch the compiled package with Core Tools,
   require the expected HTTP registrations, and require JSON 403 for anonymous
   Journey/Maps routes without Azure credentials. A package registering no routes
   must fail with the observed 404. This is not hosted service health.
3. **Deployed metadata**: Verification requires enabled Journey, Maps search,
   and Maps token HTTP triggers with exact routes/methods and anonymous Functions
   auth level, plus exactly the intended primary linked backend. It does not
   invoke those functions through an authenticated browser session.
4. **Hosting checks**: Application root and anonymous Maps-token requests must
   return 302. The direct Function-host check fails only for HTTP 200; do not
   describe every accepted result as proof of a specific authorization rejection.
   Diagnostics checks require the Insights component and nonempty connection
   setting, not successful telemetry ingestion.
5. **Authenticated acceptance**: Read-only Journey/Maps checks require an invited
   browser session and remain separate. No token, session cookie, Journey body,
   or location data should be copied into logs or baseline evidence.

## Recovery, Guidance, and Known Deviations

- The operations guide supplies diagnostic/cost review and backup/recovery
  guidance; Bicep declares backup settings and Insights wiring. No new alerting,
  on-call process, restore automation, retention guarantee beyond declared
  settings, or measured recovery target is introduced.
- Source and application artifacts can support application recovery, while JSON
  exports and managed Cosmos backup concern data recovery. Current import still
  requires an empty writable active dataset as specified in
  [persistence](../002-data-modes-persistence/spec.md). No restore drill was run.
- **[#176](https://github.com/Hsenrab/Journey/issues/176)** records confirmed
  runbook contradictions: browser-only backup text despite Cosmos, header mode
  selector wording, unqualified PR publication steps, and rollback guidance
  inconsistent with the main-only/full-stack production wrapper. The guide is
  linked as existing guidance, not certified correct in those sections.
- **[#160](https://github.com/Hsenrab/Journey/issues/160)** retains hosted API
  404 observations with no established root cause.
- **[#173](https://github.com/Hsenrab/Journey/issues/173)** tracks the local
  primary-backend verifier correction; source presence does not certify deployment.
- **[#174](https://github.com/Hsenrab/Journey/issues/174)** qualifies the guide's
  save-time geocoding claims for ordinary form saves. It is not repaired here.

The [quality checklist](checklists/requirements.md) reviews documentation only.
Current live revision/resource drift, environment approvals, successful publication,
authenticated service use, telemetry ingestion, cleanup in Azure, and recovery
remain unverified by this task. Defect repair is not a baseline prerequisite.
