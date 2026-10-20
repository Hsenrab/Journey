# Data Modes and Persistence: Baseline Evidence

**Reviewed**: 2026-10-20

**Specification**: [Data modes and persistence](spec.md)

## Scope and Status

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
- This review does not establish guarantees for mode switches during in-flight
  writes or editor drafts across mode changes. Do not invent those guarantees or
  silently repair related behaviour while documenting the baseline.

## Known Defects and Acceptance Gaps

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

Clarify this specification before planning additional evidence review. Any plan or
task list for this baseline must remain documentation-only: inventory existing
tests and known gaps, log independently confirmed defects, and preserve explicit
acceptance status. Adding tests, changing application behaviour, repairing bugs,
or deploying resources requires a separate explicit request.

Production mutations, shared Demo resets, and deployment-driven seeding must not
be used as baseline probes. No new endpoint, test partition override, migration,
offline cache, or compatibility layer is authorized.
