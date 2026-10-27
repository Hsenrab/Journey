# Implementation Plan: Complete the Challenge Activity Journey

**Feature**: `016-challenge-activity-journey` | **Date**: 2026-10-26

**Working branch**: `chore/ux-agent-and-journey-spec`

**Spec**: [spec.md](./spec.md), including four clarifications dated 2026-10-26.

Feature selection is pinned to 016 independently of the working branch. Planning
does not switch branches, implement application code, commit, push, or deploy.

## Summary

Complete Dashboard -> Challenge -> Waypoint -> record Activity -> return to
Challenge -> Dashboard. Add a validated, visit-scoped Challenge return; place
completion explanation and a next-incomplete-member action before route content;
update reported Activity field errors after corrections; and make entry and
successful-save focus deliberate.

Use existing React Router links, Journey provider data and mutation tracking,
MUI components, and once/count completion helpers. Generalize the provider's
existing Settings navigation guard rather than introduce a second dirty-state
registry. Keep new return context out of Activity details/edit navigation.
Preserve feature 017 awards as regression coverage, not new award work.

No persisted entity, backup, API, Cosmos, infrastructure, dependency, or route
schema changes are required. Decisions and alternatives are in
[research.md](./research.md).

## Technical Context

**Language/Version**: TypeScript strict mode, React 19; Node.js 24 for tooling.

**Primary Dependencies**: Existing React Router 7, MUI 9, Zod 4, and Vite 8;
no additions or upgrades.

**Storage**: Unchanged Cosmos-backed Journey datasets and existing Demo local
fixture. Return context, validation feedback, and save confirmation are transient
UI state, not new Journey records or browser record caches.

**Testing**: Existing Vitest 4, Testing Library, and Playwright Chromium.
Tests remain alongside source; browser scenarios use isolated fictional data.

**Target Platform**: Existing browser application at 360x800 and 1280x800,
including keyboard, admin, viewer, and read-only Demo use.

**Project Type**: Frontend feature in the existing Vite SPA.

**Performance Goals**: No progress-specific request on return. Each return leg
takes one application action. Required-field entry and Save satisfy the
specification's focus and one-viewport scroll criteria; no arbitrary latency
target or new performance infrastructure.

**Constraints**: Preserve existing entry destinations, conditional awards,
pending-save guards, explicit failures, protected data access, and completion
arithmetic. Do not infer an origin from membership, route history, or an
unfiltered Waypoints list.

**Scale/Scope**: Three primary pages, the shared Activity editor, its domain
validation, a small origin helper, and the existing provider/Layout guard.
No new application routes, backend endpoints, services, or persisted fields.

## Constitution Check

_GATE: Must pass before Phase 0 research. Re-check after Phase 1 design._

| Principle                                         | Before research | After design | Evidence                                                                                                                          |
| ------------------------------------------------- | --------------- | ------------ | --------------------------------------------------------------------------------------------------------------------------------- |
| Small, direct changes                             | PASS            | PASS         | Reuse Router links, one existing draft registry, completion helpers, and existing form sections; no generic navigation framework. |
| Explicit failures                                 | PASS            | PASS         | Separate invalid provenance from load/save failures; retain specific errors, drafts, and pending locks.                           |
| Typed rules and consistent UI                     | PASS            | PASS         | Typed origin and form validation, shared completion derivation, MUI headers/alerts and theme spacing.                             |
| Protected cloud access and integrity              | PASS            | PASS         | Existing API/role/data-mode boundary unchanged; provenance grants no authority and never crosses datasets.                        |
| Evidence-based validation and controlled delivery | PASS            | PASS         | Exact browser assertions, targeted caller tests, documented local limitation, and no authorized delivery side effects.            |

Governance: [constitution](../../.specify/memory/constitution.md),
[AGENTS.md](../../AGENTS.md), and [UI guidelines](../../docs/UI_GUIDELINES.md).
There are no exceptions, unresolved product decisions, or new service approvals.

## Project Structure

### Documentation (this feature)

```text
specs/016-challenge-activity-journey/
  spec.md
  checklists/requirements.md
  plan.md
  research.md
  data-model.md
  contracts/challenge-journey-ui.md
  quickstart.md
  tasks.md                         # Generated later by /speckit-tasks
```

### Source Code (repository root)

```text
src/
  domain/
    visit.ts                       # Shared completion summary; schemas unchanged
    visit.test.ts
    activityDraftValidation.ts     # New: existing field rules extracted once
    activityDraftValidation.test.ts
  features/journey/
    challengeJourney.ts            # New: typed ephemeral origin and resolver
    challengeJourney.test.ts
    JourneyContext.tsx             # Generalize existing navigation confirmation
    JourneyContext.test.tsx
  components/
    ActivityEditor.tsx
    ActivityEditor.test.tsx
    ActivityEditor.lifecycle.test.tsx
    Layout.tsx                     # Wire renamed guard for existing Settings link
    Layout.test.tsx
  pages/
    ChallengeDetails.tsx
    ChallengeDetails.test.tsx
    LocationDetails.tsx
    LocationDetails.test.tsx
    Dashboard.tsx
    Dashboard.test.tsx
    Activities.test.tsx             # Shared-form and entry-destination regressions
    ActivityDetails.test.tsx
    IdeaDetails.test.tsx
  app/App.test.tsx                  # Cross-page draft/pending navigation coverage
e2e/
  challenge-activity-journey.spec.ts # New: journey and measurable UX acceptance
  activity-recording.spec.ts        # Preserve existing recording destinations
  challenge-awards.spec.ts          # Preserve completed feature 017
  journey.spec.ts
docs/pages/
  dashboard.md
  locations.md
  visits.md
```

**Structure Decision**: Keep feature-specific visit provenance in the existing
Journey feature folder. Keep reusable validation and completion calculations
framework-independent in `domain/`. Pages own rendering and local confirmation
focus. Existing test fixture builders remain the source for fictional data;
do not create another bundled Demo dataset.

## Phase 0: Research Outcome

[Research](./research.md) resolves navigation provenance, selected-versus-loaded
data identity, shared guard reuse, completion parity, error revalidation,
accessible focus, and validation scope using current repository evidence.
No new technology choice or external integration requires additional research.

## Phase 1: Design

### 1. Bound the originating Challenge to the visit

Pass a small typed origin through React Router link state from each Challenge
member link and the next-incomplete-member action. Include Challenge ID,
original Waypoint ID, selected and active data modes, and a document-lifetime
marker. Validate incoming state as unknown against the current route and loaded
data. Use current titles from that data, never stored display names.

The marker is created in memory once per document and rejects browser-retained
origin state after a full reload. It is not an authentication token, persisted
record, new provider, or cross-tab synchronization mechanism. Direct/list entry
without explicit origin retains ordinary Waypoints navigation.

Do not forward origin into Activity details/editing or infer it from a member's
other Challenges. Resolve it again after data changes; invalid context removes
the extra return action, not the explicit load/missing-record error state.

### 2. Reuse one navigation guard

Replace the Settings-specific confirmation API with a destination-aware
`confirmNavigation(destination)` using the existing draft registry and mutation
counter. Update Layout's Settings consumer and the provider's data-mode switch,
then wire the new Waypoint return and Dashboard action through the same guard.
Do not keep a compatibility wrapper or add another registry.

Check pending mutation state synchronously before accepting navigation, even if
the draft registry is empty. Preserve existing route/award draft registration,
dirty confirmation, pending-save blocking, and Settings/data-mode outcomes.
Do not accidentally confirm twice through Layout and page handlers.

### 3. Derive understandable progress

Extract the Dashboard's existing completed/total/rounded-percentage calculation
into a shared summary beside `completedWaypointCount`. Both pages use that
definition. Empty membership yields zero counts and percentage, never 100%.

Challenge details show summary, explanatory copy, first-in-existing-order
incomplete member action, and member progress before optional map/route
administration. Keep full member order and route capabilities unchanged.
Complete and empty states have no next-incomplete action.

Loaded provider data is authoritative. Add/delete/reassignment changes are
derived on render without a progress request, separate cache, or saved progress
value. Gate current progress and origin actions on successful loading;
loading, failed loading, missing records, and genuinely empty membership remain
distinct. Preserve the visibly warned read-only Demo local load exception.

### 4. Correct reported field feedback without hiding failures

Extract the current Activity editor field validator into one pure domain helper
with the same rules, messages, error keys, and normalized location result.
Submission and correction feedback call that helper; do not duplicate checks.
Give it a domain-owned typed input of raw form values and existing eligibility
context, not the already-normalized `ActivityDraft` submission type. It must not
import React, editor-local types, or the Journey provider.

Track previously reported fields or dependent field groups. Revalidate them on
blur and after requirement-changing selections. Preserve unrelated errors and
draft values; coordinate pairs, location-type changes, award eligibility/
acknowledgment, and indexed reference/photo changes need explicit group handling.
Reindex/revalidate reported collection errors after removal or reordering.

Correction alone neither writes nor moves focus. Existing submit-only
first-invalid-field focus remains submit-only. JSON application, GPX parsing,
server/conflict messages, and draft/pending tracking retain their existing
boundaries; a corrected field must not clear a save or GPX failure.

### 5. Make recording transitions observable

Opt into first-required-field focus/visibility only when opening the Waypoint's
recording form. Other Activity entry destinations and focus behavior remain
unchanged except for the shared correction feedback.

Capture the successful saved Activity ID and destination using the existing
`addActivity` result and `onSaved(draft)` callback. Close the form only after
success; focus and reveal the confirmation container once, not its return
button and not on unrelated rerenders or reloads. Stay on the Waypoint.

Keep the valid original Challenge return even when the saved Activity is
unlinked or belongs elsewhere, explicitly reporting lack of contribution.
When moved to another member of the same Challenge, show actual current
progress without falsely incrementing the original Waypoint.

Keep the existing collapsed-empty evidence sections. Verify Save reach in a real
browser before changing its action-row placement; do not add a speculative
sticky bar, duplicate Save action, or unrelated editor redesign.

### 6. Test and document the actual changes

The [UI contract](./contracts/challenge-journey-ui.md) maps all 17 requirements
to implementation boundaries and acceptance. The [data model](./data-model.md)
documents transient state and unchanged persisted entities.

The [quickstart](./quickstart.md) defines unit/caller/browser validation,
role/data-mode matrices, exact focus/scroll assertions, and full CI requirements
for any later requested push. Documentation-only planning does not run
application checks or establish implementation acceptance.

## Implementation Sequencing

1. Establish origin, shared completion, and extracted-validator contracts/tests.
2. Generalize the existing guard and prove existing Settings/data-mode parity.
3. Wire Challenge summary, member links, and guarded return navigation.
4. Wire Waypoint recording entry and successful-save feedback.
5. Add reported-field/group revalidation in the shared editor.
6. Complete browser acceptance, feature-017/recording regressions, and guidance.

This is design sequencing, not a generated task list. Use `/speckit-tasks` next.

## Complexity Tracking

No constitutional violations or complexity exceptions.
