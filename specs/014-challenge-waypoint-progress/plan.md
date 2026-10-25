# Implementation Plan: Waypoint Progress on Challenge Details

**Branch**: `014-challenge-waypoint-progress` | **Date**: 2026-10-24 | **Spec**: [spec.md](spec.md)

**Input**: Feature specification from `specs/014-challenge-waypoint-progress/spec.md`

## Summary

Add completion information to each existing member card on Challenge details.
Reuse `waypointCompletionProgress` and `completionProgressLabel` from
`src/domain/visit.ts`; preserve single-source membership and existing card
navigation, ordering, route controls, and map behaviour.

Show `Completion: Done` or `Completion: Not done` for once-mode members.
For count-mode members, show the existing count label plus explicit completion
text, for example `Completion: 2 of 5 activities` and `Not done`. Colour can
reinforce but must not replace the textual state. Keep this additional state
local to Challenge details; do not change wording in other views.

## Technical Context

**Language/Version**: TypeScript ~6.0.2, strict mode; existing Node.js 24 validation environment.

**Primary Dependencies**: React 19, MUI 9, React Router 7; existing domain helpers
and Journey context. No new dependency.

**Storage**: Existing loaded Journey dataset only. No schema, API, Cosmos,
backup, browser-storage, or migration changes.

**Testing**: Vitest 4 + Testing Library; existing Playwright Chromium browser tests.

**Target Platform**: Existing authenticated web application, desktop and mobile;
explicit checks at 360 and 1280 CSS pixels.

**Project Type**: Frontend presentation enhancement.

**Performance Goals**: Derive from the already-loaded activities during rendering;
zero additional network requests or writes attributable to progress. No separate
cached state, subscriptions, polling, or speculative indexing.

**Constraints**: Preserve errors, roles, data modes, maps, routes, awards, and
single-source relationships. Follow `docs/UI_GUIDELINES.md` and shared theme.

**Scale/Scope**: One route-level presentation component, focused colocated tests,
existing domain regression tests where gaps exist, a focused browser flow, and
directly related documentation.

## Constitution Check

| Principle                                 | Pre-research gate                              | Post-design gate                                                      |
| ----------------------------------------- | ---------------------------------------------- | --------------------------------------------------------------------- |
| I. Small, Direct Changes                  | PASS: reuse existing page and helpers          | PASS: no new abstraction or dependency                                |
| II. Explicit Failures                     | PASS: no new error boundary or fallback        | PASS: existing load/failure states preserved                          |
| III. Typed Domain Rules and Consistent UI | PASS: domain rules stay outside presentation   | PASS: typed helpers and existing MUI/theme patterns                   |
| IV. Protected Access and Integrity        | PASS: no new service or mutation               | PASS: loaded dataset only; roles unchanged                            |
| V. Evidence-Based Validation              | PASS: measurable cases and controlled delivery | PASS: focused checks and browser viewport/no-write assertions planned |

No unresolved clarification or constitutional exception. Planning does not claim
implementation or runtime acceptance.

## Project Structure

### Documentation (this feature)

```text
specs/014-challenge-waypoint-progress/
  spec.md
  checklists/requirements.md
  plan.md
  research.md
  data-model.md
  contracts/challenge-member-progress.md
  quickstart.md
```

`tasks.md` is produced by the next workflow, not this plan.

### Impacted application surfaces

```text
src/
  pages/ChallengeDetails.tsx          # Existing member-card rendering
  pages/ChallengeDetails.test.tsx     # Main regression and integration assertions
  domain/visit.ts                    # Existing helpers, reuse without rule changes
  domain/visit.test.ts               # Extend only missing arithmetic edge cases
e2e/journey.spec.ts                  # Isolated browser/viewport acceptance
docs/waypoints-model.md              # Document member progress visibility
specs/004-challenge-progress/
  spec.md                           # Link new behaviour without rewriting history
  evidence.md                       # Distinguish baseline from Feature 014 evidence
```

**Structure Decision**: Change the existing member card directly. Do not introduce
a progress component, repository, context field, endpoint, or persisted model.
`Locations.tsx` and `LocationDetails.tsx` are reference consumers for consistent
labels, not planned production edits. `Dashboard.tsx`, `ChallengeRouteMap`,
`gpxMap`, and the API remain unchanged and have regression coverage.

## Phase 0: Research

[research.md](research.md) records verified helper semantics, presentation prior
art, dataset lifecycle, and validation environment. All decisions are resolved
using the existing source; no external integration or independent research agent
is necessary.

## Phase 1: Design and Contracts

- [data-model.md](data-model.md): existing entities and derived state.
- [UI contract](contracts/challenge-member-progress.md): exact labels, placement,
  accessibility, empty/error and permission preservation.
- [quickstart.md](quickstart.md): implementation acceptance and validation guide.

Implementation should first add focused card-scoped regressions, then wire
existing helpers into member rendering and add the isolated browser acceptance.
For count-mode cards, reuse the existing count label and derive the explicit
Done/Not done text from `progress.complete`; do not change the shared formatter.
Use the existing Stack/card rhythm and theme, avoiding duplicated styled blocks.
Ensure long titles wrap if the 360px test identifies overflow.

## Validation and Delivery Boundary

Trace the final imports and callers before selecting checks. For this frontend-only
scope, format changed files, run frontend lint/typecheck and directly relevant
tests, plus affected Playwright flows at both required widths. No API checks or
production build are required unless implementation expands into build/configuration.
Push/PR work later requires the complete local CI sequence by repository convention.
Run Linux tools from a WSL-native checkout, not the Windows-mounted OneDrive
directory; Feature 013 established worker and host failures in that arrangement.

No commit, push, merge, deployment, live-data action, or demo reseed is authorized
by this planning step. Future PR merges must use a regular merge commit, not squash.

## Complexity Tracking

No violations or additional complexity to justify.
