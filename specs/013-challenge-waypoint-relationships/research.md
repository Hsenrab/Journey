# Research: Single-Source Challenge-Waypoint Relationships

**Date**: 2026-10-23  
**Specification**: [spec.md](spec.md)

## 1. Keep the relationship on the Waypoint

- **Decision**: `Waypoint.challengeIds` is authoritative; Challenge members are
  derived by the existing `challengeWaypoints` helper.
- **Evidence**: `src/domain/visit.ts` currently unions both directions for display
  but checks only Waypoint assignments for category eligibility.
  `src/domain/gpxMap.ts` already consumes the membership helper.
- **Rationale**: This matches Waypoint editing and existing one-sided Idea/Activity
  relationships without adding a new mechanism.
- **Alternatives considered**: Synchronizing both lists retains unnecessary
  duplicated state. Keeping only Challenge-side links requires more changes to
  the existing editing and category-validation paths.

## 2. Simplify both mutation implementations

- **Decision**: Remove reverse-list maintenance from the frontend reducer and API
  graph plans, while preserving existing endpoint responses and transactions.
- **Evidence**: `JourneyContext.tsx` adds/removes Waypoint IDs on Challenges for
  Waypoint edits/deletion. API `journeyGraph.ts` does the same in `updatePlan` and
  Waypoint `deletionPlan`; `journey.ts` uses those plans.
- **Rationale**: The single-source rule must hold for full-dataset replacement and
  individual API mutations, not just the UI.
- **Alternatives considered**: Simplifying only the UI leaves API consumers writing
  the obsolete shape. Removing transactional helpers or changing response shapes
  would be unrelated API churn.

## 3. Reject old representations deliberately

- **Decision**: Strict Challenge validation with a specific obsolete-field error;
  Challenge document version 3; backup version 2; no old-version readers.
- **Evidence**: Browser `ChallengeSchema` is currently non-strict, so deleted
  fields would be stripped. API schemas are strict. `JourneyDocumentSchema`
  currently allows Challenge versions 1/2. `storage.ts` uses backup version 1.
- **Rationale**: The user explicitly selected failure rather than conversion.
  Version and field validation must prevent old data from being silently accepted,
  including old empty membership arrays or old fields inside a new envelope.
- **Alternatives considered**: Keeping envelope versions and relying only on
  missing fields obscures the break. A union reader, automatic merge, or migration
  violates the chosen scope.

## 4. Validate whole-dataset assignments on reads as well as writes

- **Decision**: Extend existing browser dataset validation for distinct/existing
  Challenge assignments. Reuse API graph integrity checks after Cosmos documents
  are assembled and before returning a dataset.
- **Evidence**: Browser `DataSchema` currently describes entity collections without
  cross-record assignment checks. API `referenceIntegrityError` already detects
  duplicate/dangling Waypoint Challenge links, but `loadDataset` currently validates
  documents individually without invoking the graph validator.
- **Rationale**: Valid entity shapes alone cannot prove a Challenge exists, and
  frontend import or API reads must not turn invalid assignments into accepted data.
- **Alternatives considered**: Trusting writes misses existing corrupted data.
  Building a new shared package is unnecessary for this bounded change.

## 5. Preserve category history and fail invalid edits

- **Decision**: Reject removal of the last category-enabled Challenge assignment
  when linked awarded Activities would become invalid. Retain draft and saved data.
- **Evidence**: Existing API graph validation already rejects categorized Activities
  whose Waypoint lacks an eligible Challenge.
- **Rationale**: Assignment removal must preserve Activity history and existing
  validation rules. Automatically clearing awards would violate the preservation
  requirement.
- **Alternatives considered**: Rewriting history loses data; grandfathering invalid
  awards changes category semantics beyond this feature.

## 6. Author new fixtures; do not migrate hosted data

- **Decision**: Update bundled Demo/test data to the target shape, verifying intended
  memberships first. Leave all hosted datasets untouched.
- **Evidence**: API build copies `src/data/demo.json`; Cosmos seeding parses that
  fixture. Production/Demo loading uses `loadJourney`. The context explicitly falls
  back only from Demo Cosmos to warning-labelled, read-only Demo local.
- **Rationale**: Fixtures must exercise the new contract without sneaking in a
  runtime conversion. Existing Production records may block release readiness
  until correction is separately arranged.
- **Alternatives considered**: A deployment repair script, auto-clearing datasets,
  or silently keeping a partial dataset is outside the approved scope.

## Research status

All technical choices are resolved using existing repository patterns. Source was
reviewed for planning; no tests or hosted data operations were executed. Existing
Feature004 and unrelated scratch files are not part of this feature's changes.
