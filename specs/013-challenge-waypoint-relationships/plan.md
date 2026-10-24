# Implementation Plan: Single-Source Challenge-Waypoint Relationships

**Branch**: `013-challenge-waypoint-relationships` | **Date**: 2026-10-23 | **Spec**: [spec.md](spec.md)

**Input**: Feature013 specification and the decision to reject obsolete data without a migration.

## Summary

Keep `Waypoint.challengeIds` as the only stored Challenge-Waypoint relationship.
Remove `Challenge.waypointIds`, derive Challenge members from Waypoints, and remove
the frontend and API code that maintains the duplicate list. Retain the existing
Waypoint editing flow, completion rules, category eligibility, and track selection.
Apply the new contract to browser validation, API reads/writes, Cosmos documents,
backups, bundled Demo data, and test fixtures.

This is an intentionally breaking change. Obsolete data must fail explicitly,
including an empty obsolete membership list. No conversion, data repair, migration,
compatibility reader, or hosted mutation is part of this feature.

## Technical Context

- **Language/version**: TypeScript strict mode, React 19, Node.js 24 in CI.
- **Primary dependencies**: Zod 4, React Router, MUI, Azure Functions, Azure Cosmos
  SDK; existing Azure Maps rendering remains unchanged.
- **Storage**: Existing managed-identity Journey API and Cosmos containers,
  `/datasetId` partitioning, entity documents and ETags. Bundled
  `src/data/demo.json` supplies Demo local and the deployment seed.
- **Testing**: Vitest and Testing Library; Playwright user-flow tests; existing
  built Functions host smoke tests.
- **Target platform**: Azure Static Web Apps with linked Functions API.
- **Project type**: Browser application and purpose-specific backend API.
- **Performance goals**: Preserve the existing in-memory member filtering model;
  no new query, network request, cache, or performance target.
- **Constraints**: No migration or live data changes. Preserve role checks, data
  modes, ETag-checked transactions, isolated tests, and specific failure messages.
  Preserve the existing explicitly labelled Demo local fallback only.
- **Scale/scope**: One many-to-many relationship, its derived views, validation,
  mutation/deletion paths, fixtures, and directly related documentation.

## Constitution Check

**Pre-research gate: PASS.**

| Principle                        | Design constraint                                                                            |
| -------------------------------- | -------------------------------------------------------------------------------------------- |
| Small, direct changes            | Simplify existing helpers and graph plans; no new relationship service or storage.           |
| Explicit failures                | Reject obsolete fields and versions; never merge or discard old links. No migration.         |
| Typed rules and consistent UI    | Put validation and derivation in existing domain/API modules; keep existing editing UI.      |
| Protected data integrity         | Preserve backend authorization, managed identity, ETags, and atomic linked deletions.        |
| Evidence and controlled delivery | Test local boundaries explicitly; do not deploy, push, or touch hosted data during planning. |

**Post-design gate: PASS.** The design below stays within existing approvals.
The Demo fallback is the existing narrow exception, not permission to accept or
repair an incompatible Cosmos dataset. There are no unresolved technical choices.

## Project Structure

### Documentation for this feature

```text
specs/013-challenge-waypoint-relationships/
  spec.md
  plan.md
  research.md
  data-model.md
  contracts/relationship-data.md
  quickstart.md
  checklists/requirements.md
```

`tasks.md` is the next workflow output, not part of this planning step.

### Impacted existing surfaces

```text
src/
  domain/visit.ts                         # schemas and challengeWaypoints
  domain/gpxMap.ts                        # consumer of derived membership
  features/journey/JourneyContext.tsx     # create/update/delete and restoration
  services/storage.ts                     # backup contract and local test loading
  services/journeyApi.ts                  # API response validation
  pages/Dashboard.tsx                     # overview and creation consumer
  pages/ChallengeDetails.tsx              # details/map consumer
  data/demo.json                         # bundled fixture and API build seed
api/
  src/lib/journeySchema.ts                # entity/document and payload validation
  src/lib/journeyGraph.ts                 # relationship checks and mutation plans
  src/lib/cosmos.ts                       # loaded dataset validation and persistence
  src/functions/journey.ts                # expected validation error boundary
e2e/journey.spec.ts                       # existing user-flow suite
docs/
  data.md
  waypoints-model.md
  operations.md
```

Colocated tests cover each affected source module. Find all Challenge-shaped
fixtures and field consumers before implementation; do not remove the distinct
`Idea.waypointIds` relationship merely because its field has the same name.

**Structure decision**: Reuse the current frontend and API domain split. Do not
introduce a shared package, generic graph abstraction, or new endpoint.

## Phase 0: Research

Completed findings and alternatives are in [research.md](research.md):

1. Existing domain display uses a union, while category eligibility already uses
   Waypoint-side membership.
2. Both the reducer and API update/deletion plans maintain Challenge-side lists.
3. Browser Challenge validation currently strips unknown fields; simply deleting
   the field would silently accept obsolete records.
4. Cosmos document versions and the backup envelope need deliberate breaking
   versions; dataset-level assignment validation must also run on loaded data.
5. Category-bearing Activity history constrains which membership edits are valid.

## Phase 1: Design

### Domain and validation

- Remove `Challenge.waypointIds`; make Challenge validation strict at browser and
  API boundaries. Give the obsolete field a specific diagnostic explaining that
  assignments now belong on Waypoints and correction is separate.
- Require distinct `Waypoint.challengeIds` and validate their existence against
  the complete dataset, including browser load/import and API reads/writes.
- Keep `challengeWaypoints` as the shared helper, filtering only
  `waypoint.challengeIds.includes(challenge.challengeId)`.
- Do not change progress math, Activity awards, Idea relationships, GPX parsing,
  direct `Activity.challengeId`, or planned-route behavior.

### Writes and linked deletion

- Remove reverse-list updates from Waypoint creation/editing and delete cleanup
  in `JourneyContext`; Challenge creation must no longer emit an empty list.
- Reduce the API Waypoint update plan to the Waypoint update alone, preserving
  its existing transactional and response contracts. Do not change endpoints or
  response shapes just because fewer documents need updating.
- Remove Challenge updates from Waypoint deletion. Preserve Activity detachment,
  Idea detachment, orphan pruning, and the ETag-checked transactional batch.
- Validate the resulting graph before commit. If removing an assignment would
  leave awarded Activities without a category-enabled Challenge, reject the edit
  specifically and retain the draft/data. Do not clear awards or rewrite history.
- Do not add Challenge deletion UI or expand its existing generic API behavior.

### Persistence, fixtures, and delivery boundary

- Write Challenge Cosmos documents at schema version 3 and reject versions 1/2.
  Keep unrelated document versions and unrelated compatibility behavior unchanged.
- Advance the backup envelope from version 1 to 2; accept only version 2 and
  reject obsolete Challenge fields even in a version-2 envelope.
- Update the checked-in Demo fixture and test fixtures directly to the new
  authored contract. Preserve intended Demo memberships by checking each old
  Challenge list against the Waypoint assignments before removing it; resolve
  any discrepancy explicitly rather than silently dropping links.
- Keep the existing API build copy of `src/data/demo.json` and seeding mechanism.
  No seeding or infrastructure deployment is executed by this plan.
- Validate loaded datasets before returning/using them. Report expected stored
  relationship incompatibility as a specific API error; unexpected failures still
  propagate. Production blocks writes, while Demo Cosmos may use its existing
  prominently warned, read-only local fixture fallback.
- Old hosted data will be unusable under this contract until corrected outside
  this feature. Document that ordinary load, import, or clear flows are not a
  repair tool; clear currently also loads and validates records.

### Documentation and verification

Update domain/data/operations guidance and the relevant repository conventions
with the canonical relationship and explicit breaking-data limitation. Link the
Feature004 membership rule to this superseding feature when implementation lands;
retain the historical baseline evidence and its original review status.

See [data-model.md](data-model.md), the
[boundary contract](contracts/relationship-data.md), and
[quickstart.md](quickstart.md). Implementation must cover zero/many assignments,
duplicate/dangling rejection, valid edit/cancel, category-invalidating rejection,
track/progress consistency, deletion integrity, obsolete records, and unchanged
access/conflict behavior.

This is cross-cutting implementation work, so final implementation validation must
run the complete local CI sequence once, including frontend/API checks and their
existing user-flow and host-smoke suites. Planning changes require only document
formatting and feature-path validation; no runtime behavior is changed now.
