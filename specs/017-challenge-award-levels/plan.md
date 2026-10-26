# Implementation Plan: Clear Challenge Award Levels and Statistics

**Branch**: `017-challenge-award-levels` | **Date**: 2026-10-25 | **Spec**: [spec.md](./spec.md)

**Input**: [Clarified feature specification](./spec.md).

## Summary

Keep one mandatory Activity award when its Waypoint belongs to an award-enabled
Challenge, and keep highest-recorded aggregation. Add fixed-tier explanations,
accurate contextual presentation, distinct Waypoint/Activity statistics, scoped
drill-downs, and transactional protection against invalidating awards.

Extend the current schemas and Journey boundary rather than introduce a separate
award store or statistics service. Explanations are editable current guidance,
not versioned historical criteria. Preserve completion arithmetic and the separate
feature 016 navigation work.

## Technical Context

**Language/Version**: TypeScript strict mode; Node.js 24 in CI.

**Primary Dependencies**: React 19, MUI, React Router, Zod, Vite; existing Azure
Functions and Cosmos SDKs in the linked API. No new dependencies.

**Storage**: Existing Cosmos documents partitioned by `/datasetId`; separate
Production, Demo, and isolated test containers. Bundled Demo local remains read-only.

**Testing**: Vitest/Testing Library, API Vitest and Functions host smoke tests,
Playwright Chromium; existing format, lint, typecheck, and build commands.

**Target Platform**: Authenticated web application at 360x800 and 1280x800;
admin writes and viewer browsing.

**Project Type**: Existing frontend with a minimal linked Functions API.

**Performance Goals**: Compute statistics from loaded records, without additional
network calls or persisted rollups. Use ID sets/maps to scope and deduplicate
collections. No new performance SLA or background processing.

**Constraints**: One shared Bronze/Silver/Gold level; no migrations, legacy-data
repair, retries, cached real data, new services, generic backend framework, or
deployment. Existing atomic Cosmos batches have a 100-operation limit; exceeding
it must fail explicitly, never split a change into partial batches.

**Scale/Scope**: Lightweight personal datasets within the existing batch boundary.
Changes span schemas, graph mutations, recording, summaries, filters, statistics,
fixtures, seed/build consumers, and directly related guidance.

## Constitution Check

| Principle                                         | Before research                        | After design                                                               |
| ------------------------------------------------- | -------------------------------------- | -------------------------------------------------------------------------- |
| Small, direct changes                             | Pass: extend existing surfaces         | Pass: no new service, package, or statistics store                         |
| Explicit failures and deliberate breaking changes | Pass: no compatibility or migration    | Pass: strict schemas, explicit input/conflict/size failures                |
| Typed domain rules and consistent UI              | Pass: existing domain and MUI patterns | Pass: central calculations, typed forms, scoped query validation           |
| Protected cloud access and data integrity         | Pass: existing authenticated boundary  | Pass: admin enforcement and atomic ETag-protected graph changes            |
| Evidence-based validation and controlled delivery | Pass: documentation-only planning      | Pass: validation guide distinguishes planned checks from executed evidence |

No exceptions or constitutional amendments are required. Concurrency work is
limited to the mutation paths that can invalidate the new award invariants.

## Project Structure

### Documentation (this feature)

```text
specs/017-challenge-award-levels/
  spec.md
  plan.md
  research.md
  data-model.md
  quickstart.md
  contracts/
    journey-awards.md
    awards-ui.md
  checklists/requirements.md
```

Task generation follows separately; this command does not create `tasks.md`.

### Source Code (repository root)

```text
src/
  domain/visit.ts                  Schemas, eligibility, highest award, statistics
  domain/draftJsonImport.ts        Contextual validation when applying Activity JSON
  domain/aiPrompts.ts              Conditional-award instructions
  features/journey/JourneyContext.tsx
  components/ActivityEditor.tsx
  components/ChallengeAwardFields.tsx   New reusable award configuration fields
  pages/Dashboard.tsx
  pages/ChallengeDetails.tsx
  pages/Locations.tsx
  pages/LocationDetails.tsx
  pages/Activities.tsx
  pages/ActivityDetails.tsx
  pages/MapPage.tsx
  pages/Settings.tsx
  services/journeyApi.ts
  services/storage.ts
  data/demo.json
  test/demoData.ts
api/
  src/lib/journeySchema.ts
  src/lib/journeyGraph.ts
  src/lib/cosmos.ts
  src/functions/journey.ts
e2e/
  challenge-awards.spec.ts          New isolated award scenarios
docs/
  data.md
  waypoints-model.md
  operations.md
  pages/
```

**Structure Decision**: Reuse the current domain module, context, pages, and API.
Co-locate tests with changed files. Extract repeated rendered award definitions
or indicators only when actual shared markup warrants it; do not create an
award-management framework. Use existing list routes for drill-downs, so no new
top-level route or navigation item is needed.

## Phase 0 - Research

[research.md](./research.md) records the source-grounded decisions, including
the difference between raw-entity writes and whole-dataset replacement, the
current deletion side effects, field/version choices, and schema consumers.

Research is complete with no unresolved product or technology decisions.
Repository-local research was sufficient; no external service integration is
introduced.

## Phase 1 - Design

### 1. Establish the strict award contract

Keep `supportsActivityCategories` and `Activity.category`; add a conditional
`Challenge.awardDescriptions` object. Extend frontend full-dataset validation
and API graph validation to enforce both required awards and forbidden awards.
Reject invalid IDs and report the relevant Activity and Waypoint in errors.

Increment the Challenge Cosmos document schema version from 3 to 4. Keep other
entity versions and backup envelope version 2 unchanged because their shapes
do not change. Incompatible existing documents or backup contents fail explicitly.
Update fictional fixtures rather than migrate persisted records.

See [data-model.md](./data-model.md).

### 2. Protect graph mutations

Reuse existing prospective-graph validation and `replaceDataset` for
award-sensitive raw create/update operations as well as the existing full
replacement path. Use one complete snapshot batch with current ETags, preserving
the raw operation's target `ifMatch` check and response shape.

Extend Challenge deletion to detach its ID from Waypoints and direct
`Activity.challengeId` references. The direct link is not award ownership.
Retain `Activity.category` unchanged and reject the entire candidate if any
awarded Activity loses its last eligibility. Reject awarded Waypoint deletion
before constructing a detachment plan; retain existing non-awarded deletion
behavior. Apply the same protection to disabling and membership changes.
Compare the original and prospective graph on full replacement too: stripping
awards from retained Activities must not disguise an invalidating structural
change. Correct those Activities explicitly before retrying the structural change.

All writers affecting eligibility must participate in this ETag boundary,
including creates; guarding only existing Activities would miss a concurrent
new visit. No new lock/guard documents or transactional infrastructure.

See [Journey contract](./contracts/journey-awards.md).

### 3. Wire authoring and recording

Reuse one set of typed award fields in Dashboard creation and a compact
Challenge-details award-settings editor. Add `updateChallengeAwards` and
`deleteChallenge` context actions, preserving route/location fields and existing
mutation/draft guards. No general Challenge CRUD redesign.

Show all named applicable definitions in Activity recording. New Activities
start with no tier selected; same-Waypoint edits preserve the recorded tier,
including unrelated field edits. Remove the current
effect that silently clears a tier on selection changes: make removal explicit
before saving and require deliberate destination-level selection when moving
an awarded Activity. Validate structured drafts against the form's current
Waypoint before applying them; JSON does not gain relationship-ID fields.

### 4. Wire summaries, statistics, and drill-downs

Retain highest-award calculation and independent completion helpers. Add typed
statistics returning both counts and the contributing record sets, so displayed
numbers and drill-downs cannot use different predicates.

Show statistics within Challenge details, not a new page. Use existing Waypoint
and Activity lists with validated `challenge` scope, the Waypoint list's existing
`status` filter, and an Activity `award` filter.
Keep global totals deduplicated by entity ID. Audit every current status-label
consumer, including Settings guidance and Map popups/filters, not just the two
surfaces mentioned by feature 016.
Resolve award-control applicability from the selected dataset or Challenge
scope before list filters and pagination. Empty filtered results retain
applicable controls, active filter state, and a clearing action.

See [UI contract](./contracts/awards-ui.md).

### 5. Update consumers and validate

Update Demo data, test builders, backup/import examples, JSON prompts, API fixture
data, and seed expectations. The API build copies the frontend fixture, so no
second hand-maintained Demo dataset or seed transformation is introduced.

Update the model, data, dashboard, locations, visits, settings, and operations
guides. Explicitly document breaking Challenge records, shared eligibility,
the statistical units, and the unmodified deployment boundary.

Follow [quickstart.md](./quickstart.md). Planning itself changes documentation
only; implementation is cross-cutting and requires the full local CI sequence
once after code completion, including affected E2E flows and API host smoke tests.

## Delivery Boundaries and Risks

- Feature 016 remains separate and unimplemented by this plan. Coordinate
  overlapping presentation changes without replacing its return-path contracts.
- Existing award-enabled persisted Challenges lack descriptions and all old
  Challenge documents use version 3. They will not load under the new contract;
  manual correction or migration requires a separate explicit request.
- Enabling awards for already visited, unawarded members is rejected rather
  than inventing historical awards; adding an enabled membership has the same
  constraint. Errors identify the blocking Activities and explain that these
  settings/membership actions do not convert unawarded history. Do not suggest
  assigning tiers while ineligible or add a conversion, backfill, or migration
  flow.
- Coarse snapshot batches deliberately reuse the current personal-project
  consistency model. Their operation limit is a hard restriction, not a reason
  to add chunking, retries, or infrastructure.
- No runtime acceptance is claimed by these design artifacts. Existing Node
  tooling and browser-access blockers remain documented in the validation guide.
