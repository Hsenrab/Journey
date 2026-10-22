# Implementation Plan: Waypoint Location Edits and Save-Time Resolution

**Feature**: `003-waypoint-management` | **Date**: 2026-10-21 | **Spec**: [spec.md](spec.md)

**Working branch at planning**: `main`. The feature-directory override makes
Spec Kit report `003-waypoint-management`; it does not create or switch Git branches.
Create a dedicated implementation branch when implementation is authorized.

## Summary

Implement the clarified US2 location behaviour in FR-005 and verify SC-005.
Repair the Waypoint portion of [#174](https://github.com/Hsenrab/Journey/issues/174)
as its prerequisite: actual form saves must resolve place-only locations through
the existing managed-identity Maps integration before any Cosmos write.
Preserve existing browsing, relationships, completion, deletion, and permissions.
This plan authorizes neither implementation nor delivery side effects.

## Technical Context

- **Language/runtime**: strict TypeScript, React 19; Node.js 24 for the API and CI.
- **Dependencies**: existing MUI, React Router, Zod, Azure Functions, Azure Identity,
  Cosmos SDK, and Maps Search. No new dependency or Azure service.
- **Storage**: existing Production/Demo Cosmos containers; same document versions,
  partition key, backup format, ETag checks, and 100-operation batch limit.
- **Platform/type**: authenticated browser application and linked Functions API.
- **Testing**: Vitest/Testing Library, API Vitest and built-host smoke tests,
  existing Playwright Chromium flows with mocked remote responses.
- **Performance/scale**: personal project; no new latency or throughput SLA.
  Already resolved locations cause no Maps call. Resolve each submitted unresolved
  Waypoint once per request; no retry, cache, queue, or background job.
- **Constraints**: expected resolution failure leaves stored data unchanged and
  retains the editor draft. Preserve specific errors; never omit a failed location.
  No migrations, bulk geocoding, offline storage, or compatibility layer.
- **Scope**: Waypoint create/edit and its shared replacement boundary only.
  Activity postcode-only replacement remains the separate unfinished portion of
  #174; do not close that issue as fully fixed.

## Constitution Check

Pre-research and post-design gates **PASS**:

1. Small/direct: retain the reducer and atomic replacement path rather than
   redesign entity CRUD and supporting-record writes.
2. Explicit failures: expected no-result errors reach the initiating editor;
   unexpected Maps/credential/Cosmos errors keep existing root propagation.
3. Typed domain/UI: isolate location-edit rules from presentation; distinguish
   unresolved request input from the strict persisted representation.
4. Protected cloud/data integrity: authenticate and authorize before resolution;
   reuse managed identity, purpose-specific Journey API, existing Maps RBAC,
   graph validation, and ETag-checked transactional batch.
5. Evidence/delivery: test the actual replacement path, record results honestly,
   and require separate permission for push/deployment/hosted mutations.

No exception, new integration, schema-version change, or infrastructure change.

## Project Structure

### Documentation

- [research.md](research.md): traced save path and design decisions.
- [data-model.md](data-model.md): transient input and unchanged persisted entities.
- [contracts/waypoint-location-save.md](contracts/waypoint-location-save.md):
  form rules and replacement boundary.
- [quickstart.md](quickstart.md): validation scenarios and commands.
- `tasks.md`: subsequent `/speckit-tasks` output; not created by planning.

### Impacted source and callers

- `src/domain/waypointLocation.ts` and colocated tests: small pure submission
  normalizer comparing an initial location and a validated current location.
- `src/components/WaypointEditor.tsx` and tests: call the normalizer after current
  field validation; retain values on failure and existing draft protection.
- `src/pages/Locations.tsx` and `src/pages/LocationDetails.tsx`: add/edit callers;
  tests prove actual saves and failed-save retention. Avoid edits unless required.
- `src/features/journey/JourneyContext.tsx` and tests: reducer forms the complete
  candidate dataset, `persist` invokes replacement, returned data replaces state.
  Keep pending tracking around resolution and persistence without a new write path.
- `src/services/journeyApi.ts` and tests: preserve expected API error detail in
  addition to HTTP status; keep conflict/non-empty-import classifications.
- `api/src/lib/journeySchema.ts` and tests: replacement-only Waypoint input
  allowance; strict saved/imported schemas remain unchanged.
- `api/src/functions/journey.ts` and tests, `api/src/lib/geocode.ts` and tests:
  resolve unresolved Waypoint inputs before final strict/graph validation and batch.
- `e2e/journey.spec.ts`: remote-mocked create/edit/failure journey.
- `docs/waypoints-model.md`, `docs/operations.md`, feature spec/evidence: update
  behaviour and validation status after implementation, not in advance.
- Build/deployment consumers: frontend Vite build and linked Functions build.
  No workflow, infrastructure, auth, map rendering, or deployment change planned.

## Phase 0: Research Outcome

All design questions are resolved in [research.md](research.md). No new technology
choice or external research is required; repository code establishes the relevant
interfaces. No speculative research agents or infrastructure are needed.

## Phase 1: Design

1. **Normalize the effective Waypoint location before submission.**
   Compare trimmed place/address values and numeric coordinate values against the
   initial location, not keystroke/touched flags. Validate partial, nonnumeric,
   and out-of-range explicit pairs before normalization; never discard invalid
   input to make a save succeed. Changed text plus an unchanged saved pair removes
   the pair from the submitted draft. If both previously supplied identifying
   fields are now empty and the pair is untouched, omit the entire location.
   Changed valid coordinates win, even when text is cleared. An unchanged
   coordinate-only location survives. Source/approximate changes alone do not
   invalidate coordinates. Apply the same final validation to JSON-loaded drafts.
2. **Admit unresolved Waypoints only at the replacement request boundary.**
   Reuse the entity field constraints, allowing either a complete valid pair or
   searchable place/address text without coordinates. Reject partial pairs and
   metadata-only locations. Keep every non-Waypoint collection, persisted document,
   import request, and schema version unchanged.
3. **Resolve then validate then write.**
   Authenticate/authorize and validate replacement input and its graph first.
   Resolve only Waypoints lacking a pair using the existing resolver. Validate
   the resulting complete dataset with `JourneyDataSchema` and graph rules before
   document conversion and `replaceDataset`. No Cosmos writes occur before every
   resolution succeeds. Preserve request ETags, relationship synchronization,
   supporting-reference edits/pruning, and atomic failure.
4. **Apply authoritative response and surface failure.**
   The provider adopts returned resolved coordinates/ETags; the browser must not
   keep its unresolved candidate as saved state. Follow the
   [browser error-response rules](contracts/waypoint-location-save.md#browser-error-response-rules):
   HTTP 400/409 always require JSON; other errors parse JSON only for a declared
   `application/json` or `application/*+json` media type (case-insensitive,
   parameters ignored). Validate an object with a nonblank `error` string and
   preserve specific text plus HTTP status context. Preserve the two existing
   typed 409 classifications; unknown valid codes remain ordinary errors.
   Other non-JSON errors retain status/status-text reporting without body parsing.
   Required JSON parsing/validation failures propagate intact, without a fallback.
   No result, invalid input, or failed batch yields no save-success notification.
5. **Wire and verify the real user paths.**
   Test add and edit through `replaceJourney`, not just the already-working entity
   endpoint. Preserve manual-coordinate authority, optional location, JSON review,
   access restrictions, pending mode guard, and failed-draft discard behaviour.

## Validation and Delivery

Follow [quickstart.md](quickstart.md). Use focused tests during implementation only
when useful; after implementation run the complete local CI sequence once because
the change crosses frontend/API boundaries. Add a remote-mocked browser journey;
it is not proof of hosted Cosmos/Maps behaviour. Keep all thresholds and failure
checks intact. No live reads/writes, deployment, migration, or seeding is needed
to implement or locally validate this plan.

## Complexity Tracking

No constitutional violations. No generic data-access abstraction, entity-save
rewrite, new endpoint, cross-package shared-schema framework, or migration.
