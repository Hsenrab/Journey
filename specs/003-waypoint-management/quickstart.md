# Waypoint Location Save: Validation Guide

## Prerequisites and scope

Implementation must be authorized separately. Use the existing Node.js 24 setup
and installed project dependencies. On this Windows machine, project commands run
through Ubuntu WSL as documented by the existing project workflow.
Install dependencies only if missing or dependency manifests changed.

Use synthetic data and mocked Maps/Cosmos/API boundaries. Do not mutate hosted
Production/Demo data, seed a container, deploy infrastructure, or run a migration.
See [the contract](contracts/waypoint-location-save.md) and
[data-model.md](data-model.md) for exact outcomes.

## Required scenarios

1. Domain/editor matrix: new absent/text/coordinate locations; changed name or
   address with old coordinates; clearing both fields; explicit new coordinates
   including when text is empty; coordinate-only edit; metadata-only changes;
   trimmed equivalent text/numeric formatting; cleared pair; invalid/partial pair.
   Cover submission after loading JSON into the add form.
2. API replacement schema: accept unresolved searchable Waypoints only; reject
   partial pairs, metadata-only locations, invalid fields, and unresolved imported
   Waypoints. Activity replacement remains strict.
3. Handler: admin place-only replacement resolves before the batch; supplied valid
   pairs and absent locations cause no Maps request. With multiple unresolved
   Waypoints, a later failure produces zero writes, not a partial save.
   Verify final strict coordinate validation, graph errors, and stale ETags.
   Viewer/invalid principal produces no Maps or Cosmos write.
4. Client/provider: use the real `replaceJourney` request contract, adopt returned
   coordinates/ETags, preserve expected 400 text, and retain existing 409 semantics.
   Exercise the contract's browser error-response matrix: required 400/409 JSON,
   declared JSON on other statuses, non-JSON server failures, invalid JSON/error
   shapes, and known/unknown conflict codes. Parsing/validation errors propagate
   intact; ordinary non-JSON errors retain HTTP status context.
   During deferred resolution/save, direct mode switching remains blocked;
   success and failure both release pending tracking.
5. Page tests: actual add/edit submits the effective location, maintains identity,
   memberships and supporting links, and retains the form on expected failure.
   Failed saves show no success notification and still need draft-discard consent.
6. Chromium: choose mocked Demo Cosmos, create a text-only Waypoint, return resolved
   coordinates, edit its text, then test failed resolution and retry by an explicit
   user save. Verify no automatic retry, no legacy local-record persistence, and
   correct route/draft behaviour. Route interception proves browser/client
   behaviour, not actual server geocoding; API tests prove that boundary separately.

## During implementation

Run a focused command only when useful, for example:

```text
npm test -- src/domain/waypointLocation.test.ts src/components/WaypointEditor.test.tsx
npm test -- src/services/journeyApi.test.ts src/features/journey/JourneyContext.test.tsx src/pages/Locations.test.tsx src/pages/LocationDetails.test.tsx
```

From `api/`:

```text
npm test -- src/lib/journeySchema.test.ts src/lib/geocode.test.ts src/functions/journey.test.ts
```

Use one runner per relevant batch. Do not weaken timeouts or assertions to hide
environmental problems.

## Final pre-commit checks

Trace the final edited files to their callers/build/deployment consumers first.
Because this crosses frontend/API boundaries, run the complete local CI sequence
in `.github/workflows/ci.yml` once after implementation; do not repeat successful
unchanged checks. Format changed files, then:

```text
npm run lint
npm run typecheck
npm run format:check
npm run test:coverage
npm run build
npm run test:e2e
```

From `api/`:

```text
npm run lint
npm run typecheck
npm run test:coverage
npm run build
npm run test:smoke
```

Use installed Chromium and Functions Core Tools; install only when actually
missing and required. Run test processes without competing resource-heavy jobs
when this environment's WSL filesystem causes timing failures. Retain all results.
Record commands, counts, coverage thresholds, warnings, failures/resolutions, and
unrun hosted scenarios in [evidence.md](evidence.md). Update model/operations docs
only when implementation supports their claims.

GitHub Actions OIDC, environments, artifacts, and hosted Maps/Cosmos behaviour
cannot be claimed as local checks. Push, PR, merge, deployment, and hosted mutation
require explicit authorization. This planning phase runs no application tests.
