# Research: Idea-to-Waypoint Navigation

**Date**: 2026-10-27
**Feature**: [spec.md](./spec.md)

Repository-local source and test definitions were reviewed. This is design
evidence, not a claim that the tests or browser acceptance have run. There are no
unresolved technical questions or new integration choices.

## 1. Reuse an ordinary named destination link

**Decision**: Compose MUI `Link` with React Router `Link` inside the existing
Idea detail page. Use `waypointId` for both the target and rendering key, and
preserve the existing association order.

**Evidence**:

- [IdeaDetails.tsx](../../src/pages/IdeaDetails.tsx) already resolves
  `idea.waypointIds` to available records, but joins their titles as plain text.
- [ReadOnlyNotice.tsx](../../src/components/ReadOnlyNotice.tsx) already uses
  `MuiLink component={Link}` for an internal, keyboard-operable link.
- [App.tsx](../../src/app/App.tsx) already registers `/waypoints/:id`.
- [LocationDetails.tsx](../../src/pages/LocationDetails.tsx) already links back
  to associated Ideas and uses wrapping for long contextual navigation labels.

**Rationale**: This supplies native link semantics and existing navigation without
introducing cards, a picker, a route, or a new shared component for one section.

**Alternatives considered**: Reusing full clickable cards would give this small
association list unnecessary visual weight. A title-based lookup breaks duplicate
titles. New-tab-only navigation or a dedicated return action changes the agreed
scope.

## 2. Derive interactivity from the existing editing state

**Decision**: Render linked names as plain text while `editing` is true.

**Evidence**: The Idea detail page sets `editing` on entry, clears it after a
successful `updateIdea` or `onCancel`, and retains it after a failed save.
The [Idea editor](../../src/components/IdeaEditor.tsx) already owns its current
dirty Cancel confirmation.

**Rationale**: The single existing state covers editing, an in-flight save, and
failed-save retention. It directly implements the user's clarification without
adding another state flag, confirmation handler, or editor callback contract.
Declining the existing Cancel confirmation naturally leaves the names as text.

**Alternatives considered**: Active links without a warning risk abandoning the
draft. A new navigation guard expands scope. Disabled anchors retain misleading
link semantics for names that are not currently navigable.

## 3. Preserve domain meaning and access boundaries

**Decision**: Add explanatory text only; keep planning state, associations, usage,
and mutation gates unchanged.

**Evidence**: [visit.ts](../../src/domain/visit.ts) derives usage from
`Activity.ideaIds` independently of `Activity.waypointId`. Idea detail already
uses these helpers and only offers mutation/recording actions when writable.
Its zero/one/many destination Activity preselection is already tested.

**Rationale**: Opening a destination is a read operation and is not proof of
completion, usage, or a request to change associations. Viewers need the same
navigation without access to mutations.

**Alternatives considered**: Deriving usage from linked Waypoints would change
domain behavior. Adding stored usage or destination metadata is unnecessary.
Gating links behind admin access would incorrectly restrict browsing.

## 4. Validate the actual change without broad unrelated checks

**Decision**: Extend [IdeaDetails.test.tsx](../../src/pages/IdeaDetails.test.tsx),
add one focused Playwright suite, and rerun only the existing Idea-entry cases
from [activity-recording.spec.ts](../../e2e/activity-recording.spec.ts).

**Evidence**:

- Page tests already cover role restrictions, load failure, missing Ideas,
  zero/one/many preselection, successful Activity return, removed Idea links,
  and failed Activity saves.
- Existing browser suites isolate fictional data by intercepting Demo Cosmos
  responses with explicit `admin` or `viewer` roles.
- [playwright.config.ts](../../playwright.config.ts) builds in Vite test mode.
  Browser-local Production fixtures do not prove the real Production API path.
- [UI guidelines](../../docs/UI_GUIDELINES.md) require MUI/theme layout,
  consistent spacing, and mobile/desktop overflow review.

**Rationale**: Page tests prove identity and state behavior; real browser
measurements prove layout and keyboard behavior. Explicit API interception
exercises frontend access presentation without touching real data.

**Alternatives considered**: Source assertions alone cannot prove focus or
overflow. Full frontend/API coverage is not justified by this local rendering
change. A new test server, mock framework, or dependency is unnecessary.

## Known independent limitation

[#174](https://github.com/Hsenrab/Journey/issues/174), the postcode-only Activity
save defect, was still OPEN on 2026-10-27. Navigation is not blocked by it.
Use coordinate-based fictional records for the relevant save regressions and
record any postcode save limitation separately. A mocked save is not evidence
that the actual API defect is fixed.

## Implementation finding: mobile editor overflow

**Decision**: Set `minWidth: 0` on the existing Layout main flex item.

**Evidence**: The 360px browser edit case measured 1659px of horizontal content.
Inspection showed that the main item's automatic minimum width propagated the
long selected Autocomplete labels outward. Applying the zero minimum in the
browser reduced scroll width to client width without hiding content.

**Rationale**: Correct the responsible flex constraint rather than weakening the
long-label regression, adding a fixed screen width, or changing the editor.
Include Layout unit tests and the existing four shell role/viewport smoke cases
in the expanded impact-scoped validation.

**Alternatives considered**: A zero minimum or full width on the Autocomplete
alone did not correct the overflow in inspection. Hidden overflow would mask
the sizing defect and could clip controls.
