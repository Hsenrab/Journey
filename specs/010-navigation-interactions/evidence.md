# Navigation and Shared Interactions Evidence

**Reviewed**: 2026-10-20
**Specification**: [Navigation baseline](spec.md)

[Visual UI evidence](../011-visual-responsive-ui/evidence.md) owns shared styling,
width thresholds, and guideline-compliance boundaries. This evidence retains
navigation, naming, and feedback interaction semantics.

| Requirements          | Implementation reviewed                                                                                                                                                                                     | Existing tests reviewed                                                                                                                                                              |
| --------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| FR-001 through FR-005 | [Layout](../../src/components/Layout.tsx), [routes](../../src/app/App.tsx), [status rules](../../src/domain/dataMode.ts)                                                                                    | [Layout tests](../../src/components/Layout.test.tsx), [data-mode tests](../../src/domain/dataMode.test.ts)                                                                           |
| FR-006                | [Detail header](../../src/components/DetailPageHeader.tsx), [page header](../../src/components/PageHeader.tsx)                                                                                              | [Detail-header tests](../../src/components/DetailPageHeader.test.tsx), [page-header tests](../../src/components/PageHeader.test.tsx)                                                 |
| FR-007                | [Card link](../../src/components/ClickableCard.tsx)                                                                                                                                                         | [Card tests](../../src/components/ClickableCard.test.tsx)                                                                                                                            |
| FR-008                | [Loading](../../src/components/LoadingNotice.tsx), [failure](../../src/components/LoadFailureAlert.tsx), [empty](../../src/components/EmptyState.tsx), [read-only](../../src/components/ReadOnlyNotice.tsx) | [Empty-state tests](../../src/components/EmptyState.test.tsx), [read-only tests](../../src/components/ReadOnlyNotice.test.tsx); page consumers below provide loading/failure context |

## Current Behaviour and Consumer Trace

- All rows are source-reviewed, not newly executed. No viewport/keyboard/browser
  acceptance or application test run was performed during baseline creation.
- Routes register the root redirect and six navigation areas. Waypoints,
  Challenges, Ideas, and Activities also register detail routes. No catch-all
  route is present. Layout uses exact pathname or destination-plus-slash prefix
  selection, a permanent desktop drawer, and a temporary drawer below the shared
  `sm` breakpoint (600 CSS pixels in the current default theme).
- Layout tests assert destinations/title, mobile menu interaction, header
  viewer/fallback status, and absence of a header selector. They do not exhaustively
  assert every active subroute, history transition, or drawer-dismiss gesture.
- [Waypoint details](../../src/pages/LocationDetails.tsx),
  [Challenge details](../../src/pages/ChallengeDetails.tsx),
  [Idea details](../../src/pages/IdeaDetails.tsx), and
  [Activity details](../../src/pages/ActivityDetails.tsx) supply breadcrumb context.
  The shared component renders supplied links, not inferred browsing history.
- [Waypoints](../../src/pages/Locations.tsx),
  [Progress](../../src/pages/Dashboard.tsx),
  [Ideas](../../src/pages/Ideas.tsx), and
  [Activities](../../src/pages/Activities.tsx) use shared card and feedback surfaces.
  [Map](../../src/pages/MapPage.tsx) also distinguishes loading/failure from empty
  map data, while keeping its own map interactions.
- [Waypoint detail tests](../../src/pages/LocationDetails.test.tsx),
  [Idea detail tests](../../src/pages/IdeaDetails.test.tsx), and
  [Activity detail tests](../../src/pages/ActivityDetails.test.tsx) are the existing
  feature-level evidence for load/missing-record distinctions, not new shared tests.
- Loading exposes `role="status"` with progress/text. Failure shows message and
  contextual description in an error alert. EmptyState accepts an optional action.
  ReadOnlyNotice explains fallback, load error, viewer, or Demo local and links to
  Settings; it renders nothing for writable data or while a new load is pending.
- Card tests explicitly assert accessible title naming, keyboard focus, intended
  href, and unique title IDs. They do not establish a whole-application accessibility
  audit. Header tests assert title/actions/breadcrumb rendering, not visual wrapping.

## Known Dependencies and Gaps

- [#160](https://github.com/Hsenrab/Journey/issues/160) leaves hosted API acceptance
  incomplete. Shell/component evidence does not establish backend availability.
- Existing feature-specific deviations remain in their owning evidence documents.
  No new defect was confirmed in this bounded review.
- Responsive appearance, all keyboard activation paths, screen readers, route
  history, and hosted deep-link acceptance were not newly exercised.

The [quality checklist](checklists/requirements.md) records document quality only.
Completion does not trigger a redesign, repair, or implementation phase.
