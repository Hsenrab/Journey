# Implementation Plan: Idea-to-Waypoint Navigation

**Branch**: `019-idea-waypoint-navigation` | **Date**: 2026-10-27 | **Spec**: [spec.md](./spec.md)

**Input**: Clarified specification for [#193](https://github.com/Hsenrab/Journey/issues/193).

## Summary

Replace the text-only linked destinations on Idea detail with individually named,
same-tab Waypoint links. Keep their names as plain text while the existing Idea
editor is open, including after a failed save. Restore links when editing ends.
Add concise wording separating planning associations from actual Activity usage.

Keep the feature rendering local to `IdeaDetails.tsx`. Reuse MUI links composed
with React Router, the current `editing` state, existing destination resolution,
and existing usage helpers. Preserve Activity recording, errors, access rules,
and other navigation. No new dependencies, shared abstractions, routes, APIs,
stored fields, return actions, or discard-confirmation flow.

Implementation exposed a coupled mobile sizing defect in the shared Layout.
Its main flex item also needs `minWidth: 0`; see the measured finding below.

## Technical Context

**Language/Version**: TypeScript 6.0, strict mode; React 19.

**Primary Dependencies**: Existing MUI 9, React Router 7, Vite 8, and Zod 4.
Use installed project dependencies without upgrades.

**Storage**: Unchanged Journey context and authenticated Journey API. Real data
remains Cosmos-only; bundled Demo local stays read-only. Browser-local record
fixtures are used only through the existing test-mode path.

**Testing**: Vitest 4 and Testing Library for the affected page; Playwright
Chromium for destination navigation, editing transitions, roles, keyboard focus,
and measured overflow. Existing Oxlint, TypeScript, and Prettier commands.

**Target Platform**: Existing authenticated browser application; acceptance at
360x800 and 1280x800.

**Project Type**: React single-page web application with an unchanged linked API.

**Performance Goals**: Open each destination in one activation using already
loaded data; introduce no lookup request or write before navigation.

**Constraints**: Viewer and read-only browsing must stay usable; no new write
capability, cache, fallback, migration, navigation guard, or deployment behavior.
Preserve specific failures and existing read-only notices.

**Scale/Scope**: One route-level presentation change, its page tests, one focused
browser suite, and the Ideas guide. No new volume limits or pagination.

## Constitution Check

Gate evaluated before research and re-evaluated after design against the
[constitution](../../.specify/memory/constitution.md).

| Principle                                         | Design evidence                                                                                          | Before research | After design |
| ------------------------------------------------- | -------------------------------------------------------------------------------------------------------- | --------------- | ------------ |
| Small, direct changes                             | Local rendering change; reuse links and `editing`; no shared helper or component                         | PASS            | PASS         |
| Explicit failures and deliberate breaking changes | Preserve load, missing-record, and save-error handling; no compatibility or recovery path                | PASS            | PASS         |
| Typed rules and consistent UI                     | Existing entity types and usage helpers; MUI layout and theme; no domain rules in new presentation logic | PASS            | PASS         |
| Protected access and data integrity               | No new endpoint or write operation; existing role/read-only gates and Cosmos boundary unchanged          | PASS            | PASS         |
| Evidence-based validation and controlled delivery | Focused page/browser checks; role, dataset, viewport, and mock limits recorded; no push or deployment    | PASS            | PASS         |

No constitutional exception or unresolved technical decision is required.

## Project Structure

### Documentation (this feature)

```text
specs/019-idea-waypoint-navigation/
  spec.md
  checklists/requirements.md
  plan.md
  research.md
  data-model.md
  contracts/ui-contract.md
  quickstart.md
```

`tasks.md` is intentionally not created by planning; it belongs to
`/speckit-tasks`.

### Source Code (repository root)

```text
src/pages/
  IdeaDetails.tsx                   # local rendering and explanatory wording
  IdeaDetails.test.tsx              # focused additions and existing regressions
src/components/
  Layout.tsx                       # coupled main flex-item minimum width fix
  Layout.test.tsx                   # explicit shell sizing contract
e2e/
  idea-waypoint-navigation.spec.ts  # new focused browser coverage
  activity-recording.spec.ts       # existing Idea-entry regression; no planned edit
  journey.spec.ts                  # existing four shell role/viewport smoke cases
docs/pages/
  ideas.md                         # destination navigation and editing behavior
```

**Structure Decision**: Keep this in the existing route component. Unchanged
integration surfaces are `src/app/App.tsx`, `src/components/ReadOnlyNotice.tsx`,
`src/components/IdeaEditor.tsx`, `src/features/journey/JourneyContext.tsx`,
`src/domain/visit.ts`, `src/pages/Activities.tsx`, and
`src/pages/LocationDetails.tsx`. They explain the behavior but do not require
changes merely because the new links reach them.

## Phase 0: Research

[research.md](./research.md) records repository evidence and decisions for link
composition, rendering during editing, explanatory copy, access, and validation.
All technical questions are resolved using existing code and conventions. No
external technology research or dependency selection is needed.

## Phase 1: Design

### Destination section

- Use a labelled, compact MUI `Stack` with a separate named link for each resolved
  Waypoint, in the existing association order and keyed by `waypointId`.
- Compose MUI `Link` with the existing React Router `Link`, following
  `ReadOnlyNotice`. Target `/waypoints/${waypoint.waypointId}` without new route
  state, a custom return action, or a mutation handler.
- Use the existing theme and spacing. Permit long labels, including unbroken
  names, to wrap with the existing `overflowWrap: 'anywhere'` convention.
  Keep the container shrinkable where needed; do not introduce fixed widths.
- When `editing` is true, render the same destination names as non-interactive
  text. Do not render disabled anchors or intercept clicks with a new guard.
- Preserve the explicit none-linked state and current available-record
  resolution. Do not invent placeholders for missing IDs, repair data, or
  reinterpret a failed load as an empty association list.
- Keep reference links, Activity-usage links, and the existing Idea editor
  submit/cancel/error lifecycle unchanged.

### Context and recording

Use concise wording such as "Linked waypoints are planning associations." and
"Usage counts activities that explicitly used this idea." Retain existing
planning-state labels, usage totals/cards, and the Activity recording action.
Do not duplicate usage calculations or change preselection and return behavior.

### Validation and documentation

Add focused coverage to the existing Idea detail test file, including route
targets, duplicate/long titles, no links, read-only access, editing transitions,
failed-save retention, and different-Waypoint usage. Retain its current
recording, load-failure, and missing-Idea tests.

Add a dedicated browser suite using isolated fictional data and the established
Demo Cosmos API interception pattern. Cover both viewports for admin/viewer
browsing, keyboard activation and visible focus, exact overflow measurements,
and the clarified edit lifecycle. Exercise Demo local as an additional read-only
case without adding another data harness. Run the existing Idea-entry Activity
browser cases rather than the unrelated journeys in that file.

Update the Ideas guide's detail behavior. Apply the UI guidelines' self-review
to the changed section.

## Validation Scope and Evidence

See [quickstart.md](./quickstart.md) for executable commands and acceptance steps.
Implement first, then run formatting, frontend lint/typecheck, the affected page
tests, and the focused browser selection once. Add a targeted test during
implementation only when it provides useful feedback.

Do not run API checks, broad coverage, all browser suites, or a separate
production build for this presentation-only change. Expand validation only if
the actual implementation changes an additional surface, build configuration,
or dependency.

### Implementation finding: shared main sizing

The mobile edit regression measured a 1659px page at a 360px viewport. Browser
inspection traced it to Layout's main flex item retaining its automatic minimum
width when the existing Autocomplete displayed long selected names. Setting
`minWidth: 0` on that main item produced equal scroll/client widths in inspection.
This is a root sizing correction, not hidden overflow or truncated test data.
It changes no editor callback or data behavior.

The impact scope therefore includes `Layout.tsx` and its tests. In addition to
the original checks, validate its page-content/navigation behavior and the four
existing Challenge-member shell smoke cases for admin/viewer at both viewports.
Unchanged Idea page tests need not be rerun solely for this shell-only edit:
their harness does not mount Layout.

[#174](https://github.com/Hsenrab/Journey/issues/174) remains OPEN as checked on
2026-10-27. Use coordinate-based fixtures for save-flow validation and label
intercepted API results as mocked. Do not claim that postcode-only saves or
backend authorization were validated by those results. No application tests or
browser acceptance were run during planning.
