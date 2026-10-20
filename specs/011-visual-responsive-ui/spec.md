# Feature Specification: Visual Design and Responsive UI Baseline

**Feature Branch**: `011-visual-responsive-ui`
**Created**: 2026-10-20
**Status**: Current-state baseline; source-reviewed, visual acceptance unexecuted
**Input**: Document the existing shared visual treatment and responsive layout,
referencing the UI guidelines without claiming every page complies with them.

## User Scenarios & Testing _(mandatory)_

### User Story 1 - Recognise a Consistent Application (Priority: P1)

As a user, I see a consistent visual hierarchy across application areas so that
titles, actions, fields, and records are recognisable.

**Why this priority**: Shared presentation makes existing features easier to understand.
**Independent Test**: Compare shared headings, fields, buttons, and cards on fictional
Waypoint, Idea, and Activity pages.

**Acceptance Scenarios**:

1. **Given** a standard application page, **When** it renders, **Then** the
   shared visual treatment uses a dark green primary accent, an earthy brown
   secondary accent, and stronger-weight headings and button labels.
2. **Given** a standard text field without a specific override, **When** it is
   displayed, **Then** it is compact, outlined, and fills its allocated width;
   a standard button is outlined and its label is not forced to uppercase.
3. **Given** a standard record card, **When** it is displayed, **Then** it has
   a flat outlined treatment rather than a raised shadow. Shared rounded shapes
   and a consistent title hierarchy remain recognisable.
4. **Given** a page header, **When** title and actions appear, **Then** they share
   a wrapping row and the page title is the primary heading. Action meaning and
   availability remain owned by the feature, not inferred from appearance.

### User Story 2 - Use the Same Features at Different Widths (Priority: P1)

As a user, I can use the application shell and shared filter controls at small
and large widths without a separate mobile product.

**Why this priority**: Layout must adapt to available space without redefining features.
**Independent Test**: Inspect the shell and a shared filter bar at representative
small, medium, and large widths.

**Acceptance Scenarios**:

1. **Given** a wide screen, **When** I view a page, **Then** content appears
   beside a persistent navigation drawer within a width-limited main area,
   below the fixed application bar.
2. **Given** a small screen, **When** I view that page, **Then** the permanent
   drawer is replaced by menu-driven temporary navigation and main content uses
   the available area. Navigation behaviour follows its separate baseline.
3. **Given** shared filter controls, **When** width increases, **Then** they
   progress from one column to two and then three, each filling its grid cell.
4. **Given** secondary Waypoint filters, **When** the list first appears,
   **Then** they are in a closed More filters section rather than all preceding
   the primary content. This does not imply every feature has the same filters.

### User Story 3 - Understand Visual Scope and Exceptions (Priority: P2)

As a maintainer, I can distinguish the current presentation from design guidance
and unverified visual or accessibility claims.

**Why this priority**: A baseline must not turn styling guidance into false acceptance.
**Independent Test**: Trace the shared presentation, map-specific appearance,
and guideline/acceptance boundaries through the evidence.

**Acceptance Scenarios**:

1. **Given** map popups, **When** they appear, **Then** they retain their own
   compact titles, metadata, links, constrained popup width, and scrollable list
   treatment rather than being described as standard application cards.
2. **Given** a loading, failure, empty, or read-only notice, **When** I review
   its visual treatment, **Then** its meaning follows the shared-interactions
   baseline rather than a new state definition here.
3. **Given** the UI guidelines, **When** they prescribe spacing, control
   consistency, or above-the-fold visibility, **Then** they remain linked design
   rules; source review alone does not certify page-wide visual compliance.

### Edge Cases

- Individual components can explicitly override shared defaults; this baseline
  does not claim every field, button, or card has identical styling.
- Compact header controls wrap; record titles, long error messages, translations,
  zoom, and extreme viewport sizes have not been exhaustively visually reviewed.
- Map popups use separate presentation rules. Map panels, geometry colours,
  selection, and framing remain in the Map feature.
- No user-selectable theme, dark-mode toggle, alternate branding, or new mobile
  layout is introduced by this baseline.
- Keyboard naming/focus evidence is limited; contrast, screen readers, touch
  targets, and complete accessibility compliance are not certified.

## Requirements _(mandatory)_

### Functional Requirements

- **FR-001**: Standard application presentation MUST retain the shared primary
  and secondary accents, stronger heading hierarchy, and natural-case button labels.
- **FR-002**: Standard fields, buttons, and cards MUST use their documented compact
  outlined or flat outlined defaults unless explicitly overridden.
- **FR-003**: The shared shell MUST keep content below the fixed application bar,
  constrain its main reading width, and adapt persistent navigation to temporary
  navigation on small screens.
- **FR-004**: Shared filter bars MUST adapt from one to two to three columns;
  shared page headings and action rows MUST allow wrapping.
- **FR-005**: The existing Waypoint secondary-filter presentation MUST remain
  distinct from the general shared filter layout.
- **FR-006**: Map popup styling MUST be documented separately from standard cards
  without redefining map behaviour.
- **FR-007**: Visual documentation MUST reference the existing UI guidelines
  and explicitly distinguish guidance, implemented defaults, and unexecuted
  visual/accessibility acceptance.

## Success Criteria _(mandatory)_

### Measurable Outcomes

- **SC-001**: The three standard control families (fields, buttons, and cards)
  and the shared heading/accent treatment each have a documented observable outcome.
- **SC-002**: All three shared filter layouts and both navigation layouts are
  described with their current width thresholds in supporting evidence.
- **SC-003**: Standard application surfaces and map popups have explicit ownership
  boundaries, with zero claims of newly executed screenshot or accessibility acceptance.
- **SC-004**: Every functional requirement maps to source evidence or an explicitly
  identified guidance boundary, without introducing new UI behaviour.

## Assumptions

- [UI guidelines](../../docs/UI_GUIDELINES.md) remain the authoritative design
  conventions. This specification is a current-state feature baseline, not a
  duplicate styling manual or a claim that the guideline checklist has passed.
- [Navigation and interactions](../010-navigation-interactions/spec.md) owns
  destinations, drawer interactions, headers/cards semantics, and feedback states.
- [Map browsing](../007-map-browsing/spec.md) owns map-specific layout and controls;
  entity baselines own form fields, validation, filtering, and actions.
- Shared visual defaults are not permission or validation rules.
- No application code, styling, tests, screenshots, deployment, or accessibility
  repair is authorized. Unverified acceptance does not block documentation.
