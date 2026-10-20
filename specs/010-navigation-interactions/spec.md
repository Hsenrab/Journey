# Feature Specification: Navigation and Shared Interactions Baseline

**Feature Branch**: `010-navigation-interactions`
**Created**: 2026-10-20
**Status**: Current-state baseline; source-reviewed, not newly runtime-verified
**Input**: Document the existing application shell, navigation, detail headers,
card links, and shared feedback patterns without changing behaviour.

## User Scenarios & Testing _(mandatory)_

### User Story 1 - Move Between Application Areas (Priority: P1)

As a signed-in user, I can reach the six application areas from consistent
navigation on large and small screens.

**Why this priority**: Navigation connects the existing features into one application.
**Independent Test**: Follow every destination at large and small viewport sizes.

**Acceptance Scenarios**:

1. **Given** the application shell, **When** I inspect navigation, **Then**
   Waypoints, Progress, Ideas, Activities, Map, and Settings are available.
   Progress opens the Challenges overview.
2. **Given** the root address, **When** it opens, **Then** I reach Progress without
   retaining an extra root redirect entry in browser history. The Journey title
   also links to Progress.
3. **Given** a feature list or its detail address, **When** it is displayed,
   **Then** the matching navigation area is visibly selected.
4. **Given** a large screen, **When** I navigate, **Then** a persistent side drawer
   remains visible. On a small screen, an accessible menu button opens a temporary
   drawer; selecting a destination or dismissing that drawer closes it.
5. **Given** any area, **When** its data status changes, **Then** the header shows
   the shared status indication. Data-mode selection remains in Settings, not
   a selector in the header.

### User Story 2 - Follow Records and Understand Page Context (Priority: P2)

As a user, I can identify a page, use its actions, and follow record links without
depending on a mouse-only click target.

**Why this priority**: Shared interaction patterns reduce ambiguity across features.
**Independent Test**: Inspect a detail header and focus/follow a record card link.

**Acceptance Scenarios**:

1. **Given** a detail page using the shared header, **When** it appears, **Then**
   a labelled breadcrumb trail links to its supplied parent destinations, with
   the record title and available actions together below it.
2. **Given** a shared page header, **When** the available space narrows, **Then**
   title and controls can wrap rather than requiring a single unbroken row.
3. **Given** a shared record card, **When** I reach it by keyboard, **Then** it
   is a focusable destination link, named by its title or an explicit accessible
   label. Multiple cards retain distinct title associations.

### User Story 3 - Distinguish Feedback States (Priority: P2)

As a user, I can distinguish loading, failure, empty content, and read-only access.

**Why this priority**: Empty data must not disguise a failed load or access restriction.
**Independent Test**: Inspect shared feedback for each state using fictional data.

**Acceptance Scenarios**:

1. **Given** loading, **When** a shared loading notice is displayed, **Then**
   progress and explanatory text are exposed as a status.
2. **Given** a load failure, **When** a shared failure notice is displayed,
   **Then** an error shows its specific message and contextual description,
   rather than presenting it as an empty collection.
3. **Given** an empty collection or filtered result, **When** a shared empty
   state is displayed, **Then** it shows a descriptive message and decorative
   icon, with an action only when that page supplies one.
4. **Given** read-only data, **When** a page shows the shared read-only notice,
   **Then** it explains the applicable reason and links to Settings. Writable
   data has no read-only notice; a new load does not retain the previous explanation.

### Edge Cases

- A direct detail link still selects its parent navigation area.
- Unknown application addresses have no dedicated catch-all page in the current
  route inventory; this baseline does not introduce a not-found route.
- Breadcrumb destinations are explicit page context, not a general browser-history
  back action. Entity features own their exact parent/related links.
- Read-only, loading, and empty are different states. Which actions are available
  remains governed by access, data mode, and the owning feature.
- Shared-card keyboard evidence does not certify every map control, dialog, page,
  contrast combination, screen-reader interaction, or viewport.

## Requirements _(mandatory)_

### Functional Requirements

- **FR-001**: The shell MUST expose all six destinations and identify Progress
  as the Challenges overview.
- **FR-002**: Root entry MUST redirect to Progress with history replacement;
  the Journey title MUST link to Progress.
- **FR-003**: Navigation MUST visibly select exact destination and nested detail
  paths and use persistent versus temporary drawers according to screen size.
- **FR-004**: Small-screen navigation MUST provide a labelled menu control and
  close the drawer on selection or dismissal.
- **FR-005**: The header MUST show the shared data status while Settings retains
  the data-mode selector, following the data-mode baseline.
- **FR-006**: Shared headers MUST identify the page, keep its controls together,
  allow wrapping, and expose supplied detail breadcrumbs as links.
- **FR-007**: Shared record cards MUST expose named, keyboard-focusable links
  with distinct title associations.
- **FR-008**: Shared feedback MUST distinguish loading status, explicit load
  failures, empty content, and reasoned read-only notices with a Settings link.

## Success Criteria _(mandatory)_

### Measurable Outcomes

- **SC-001**: All six navigation destinations are reachable in both drawer modes;
  list and detail destinations select the matching area.
- **SC-002**: Root entry and the Journey title both lead to Progress, and selecting
  any small-screen destination leaves no open navigation drawer.
- **SC-003**: Shared cards can receive keyboard focus and expose their intended
  destination and name; two cards never share a generated title association.
- **SC-004**: Loading, load failure, empty, and read-only have four distinguishable
  feedback outcomes rather than one ambiguous empty-data presentation.

## Assumptions

- [Access](../001-access-roles/spec.md) governs hosted entry and roles;
  [data modes](../002-data-modes-persistence/spec.md) governs status/reasons.
  This baseline documents their shared presentation, not new permission rules.
- Entity baselines own record-specific breadcrumbs, action destinations, missing
  records, content, save errors, and conflict recovery.
- [Map](../007-map-browsing/spec.md) owns its responsive panels and map controls;
  [draft entry](../009-structured-draft-entry/spec.md) owns prompt/JSON dialogs.
- [Visual UI](../011-visual-responsive-ui/spec.md) owns shared visual defaults
  and responsive presentation; this feature retains interaction semantics.
- This is a bounded current-state baseline, not a redesign, comprehensive
  accessibility certification, new route, or universal error-handling system.
- No application changes, new tests, hosted checks, or deployment are authorized.
