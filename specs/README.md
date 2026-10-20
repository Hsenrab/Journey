# Journey Current-State Feature Baselines

These specifications document the existing application as coherent features.
They are not a roadmap, a request to implement new functionality, or proof that
every documented behaviour works in a hosted environment.

## Feature Inventory

| Feature                           | Specification                                        | Supporting evidence                                 | Scope                                                                                                        |
| --------------------------------- | ---------------------------------------------------- | --------------------------------------------------- | ------------------------------------------------------------------------------------------------------------ |
| 001 - Access and roles            | [Specification](001-access-roles/spec.md)            | [Evidence](001-access-roles/evidence.md)            | Hosted sign-in, invited roles, protected operations, and read-only access                                    |
| 002 - Data modes and persistence  | [Specification](002-data-modes-persistence/spec.md)  | [Evidence](002-data-modes-persistence/evidence.md)  | Source selection, startup, loading/fallback, persistence, export, restore, and clear                         |
| 003 - Waypoint management         | [Specification](003-waypoint-management/spec.md)     | [Evidence](003-waypoint-management/evidence.md)     | Discovery, details, create/edit/delete, supporting links, membership, and completion                         |
| 004 - Challenges and progress     | [Specification](004-challenge-progress/spec.md)      | [Evidence](004-challenge-progress/evidence.md)      | Challenges overview, creation, membership, progress summaries, and planned GPX routes                        |
| 005 - Idea planning               | [Specification](005-idea-planning/spec.md)           | [Evidence](005-idea-planning/evidence.md)           | Planning states, research, difficulty, discovery, derived usage, and Activity handoff                        |
| 006 - Activity recording          | [Specification](006-activity-recording/spec.md)      | [Evidence](006-activity-recording/evidence.md)      | Independent/linked history, create/edit/delete, photos/references, and recorded GPX tracks                   |
| 007 - Map browsing                | [Specification](007-map-browsing/spec.md)            | [Evidence](007-map-browsing/evidence.md)            | Point modes, nearby search, filters, clusters/popups, route/track display, and responsive panels             |
| 008 - GPX import and geometry     | [Specification](008-gpx-import-geometry/spec.md)     | [Evidence](008-gpx-import-geometry/evidence.md)     | Shared file acceptance, validation/limits, segment preservation, and saved route/track representation        |
| 009 - Structured draft entry      | [Specification](009-structured-draft-entry/spec.md)  | [Evidence](009-structured-draft-entry/evidence.md)  | Form/Paste JSON, examples, validation, review-before-save, and external prompt help                          |
| 010 - Navigation and interactions | [Specification](010-navigation-interactions/spec.md) | [Evidence](010-navigation-interactions/evidence.md) | Application shell, responsive navigation, headers/breadcrumbs, card links, and shared feedback               |
| 011 - Visual and responsive UI    | [Specification](011-visual-responsive-ui/spec.md)    | [Evidence](011-visual-responsive-ui/evidence.md)    | Shared visual defaults, responsive layout, map-popup styling boundaries, and design-guideline ownership      |
| 012 - Deployment and operations   | [Specification](012-deployment-operations/spec.md)   | [Evidence](012-deployment-operations/evidence.md)   | Environment/trigger selection, provisioning, publication, verification, diagnostics, and recovery boundaries |

The current [route registration](../src/app/App.tsx) maps its feature pages to this
inventory: Challenges overview/details, Waypoint list/details, Idea list/details,
Activity list/details, Map, and Settings. GPX, structured draft entry, navigation,
and visual UI are shared capabilities rather than new application pages.
Deployment and operations is a maintainer-facing operational capability.

## Reading the Baselines

- The specification describes user-visible behaviour and existing approved
  constraints. Evidence maps that contract to implementation and existing tests.
- A checked requirements checklist certifies document quality, not execution
  or hosted acceptance.
- The access baseline includes earlier local test execution and partial hosted
  observations. Features 002 through 012 were created by source/test review,
  without new application test runs or hosted acceptance.
- Known deviations are linked as defects rather than silently accepted as desired
  behaviour. Missing evidence remains unverified, not a passing result.
- General persistence and access rules are shared dependencies. Individual
  feature documents describe their own user journeys instead of redefining roles
  or authorizing new infrastructure.
- [GPX](008-gpx-import-geometry/spec.md) is the single source for shared file and
  geometry rules. Challenges retain planned-route workflows, Activities retain
  recorded-track workflows, Map retains display/selection/framing, and persistence
  retains dataset backup actions. GPX is a shared capability, not a new route/page.
- [Draft entry](009-structured-draft-entry/spec.md) owns shared JSON validation,
  examples, load/review, and external prompt help. Entity features retain their
  field contracts, editor availability, relationship selection, and save actions.
- [Navigation](010-navigation-interactions/spec.md) owns the application shell and
  shared interaction/feedback patterns. Features retain their own destinations,
  state transitions, and controls. Its evidence is not a full accessibility audit.
- [Visual UI](011-visual-responsive-ui/spec.md) owns shared presentation and
  responsive defaults, while [UI guidelines](../docs/UI_GUIDELINES.md) retain
  design conventions. Source review is not page-wide visual/accessibility acceptance.
- [Deployment and operations](012-deployment-operations/spec.md) owns publication
  and operational boundaries. The [operations guide](../docs/operations.md) retains
  detailed procedures, with known contradictions linked below. Neither proves
  the current local revision is deployed or that a recovery drill has passed.

## Known Cross-Feature Defects

- [#160](https://github.com/Hsenrab/Journey/issues/160): hosted API 404 observations;
  live shared-data and Maps acceptance remains incomplete.
- [#169](https://github.com/Hsenrab/Journey/issues/169): real-calendar date validation
  missing at the API boundary.
- [#170](https://github.com/Hsenrab/Journey/issues/170): duplicate imported/replaced
  identities can discard records.
- [#171](https://github.com/Hsenrab/Journey/issues/171): Challenge relationship
  update/deletion inconsistencies.
- [#173](https://github.com/Hsenrab/Journey/issues/173): primary backend-link
  verification correction committed locally, not certified deployed.
- [#174](https://github.com/Hsenrab/Journey/issues/174): Waypoint and Activity
  form saves bypass save-time geocoding via dataset replacement.
- [#175](https://github.com/Hsenrab/Journey/issues/175): Activity detail/gallery
  and reopened editor ignore saved supporting-entry ordering.
- [#176](https://github.com/Hsenrab/Journey/issues/176): operations guide contains
  stale backup/data-mode wording and contradictory publication/rollback instructions.

## Workflow Boundary

Creating these baselines is documentation-only. Defects do not block documenting
a feature, and baseline completion does not authorize fixes, new tests, resource
changes, pushes, deployment, or live data mutation.

Clarification is available if the documented current scope is ambiguous.
Planning/tasks/implementation are not automatic next steps; any future change
needs its own explicit request.

Each numbered feature has a corresponding local feature branch. The document's
branch metadata identifies its creation context, not an independently committed
or deployed revision. The local active-feature pointer selects one feature for
subsequent Spec Kit commands and does not replace this multi-feature inventory.
