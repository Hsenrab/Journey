# Feature Specification: Challenges and Progress Baseline

**Feature Branch**: `004-challenge-progress`
**Created**: 2026-10-20
**Status**: Current-state baseline; source-reviewed, not newly runtime-verified
**Input**: Document existing Challenge creation, membership, progress overview,
detail pages, and planned-route handling without adding functionality.

## User Scenarios & Testing _(mandatory)_

### User Story 1 - Understand Progress Across Challenges (Priority: P1)

As a user, I can browse goal-based collections of Waypoints and understand their
completion without confusing activity awards with completion milestones.

**Why this priority**: The overview explains progress across the user's goals.
**Independent Test**: Review empty, partly completed, and completed fictional collections.

**Acceptance Scenarios**:

1. **Given** loaded Challenges, **When** I open Challenges, **Then** each card shows
   its title, description, completed Waypoint count, total count, and rounded
   completion percentage.
2. **Given** a Challenge with no Waypoints, **When** progress is calculated,
   **Then** it shows zero percent rather than a division error or completion.
3. **Given** once/count Waypoints, **When** progress is calculated, **Then**
   completion uses their linked Activity counts, irrespective of Activity awards
   or linked Ideas.
4. **Given** Activities with awards, **When** I inspect the overview's Bronze,
   Silver, and Gold summaries, **Then** each counts Waypoints whose highest award
   is exactly that tier and links to the corresponding filtered Waypoint list.
   These summaries are dataset-wide, not Challenge completion percentages.
5. **Given** linked Activities, **When** I inspect Recently visited, **Then**
   up to three Waypoints with the newest Activity dates appear, with localized
   dates and links to their details.
6. **Given** an empty, loading, or failed dataset, **When** I open the overview,
   **Then** each state is distinguishable and failure is not described as no Challenges.

### User Story 2 - Create and Explore a Collection (Priority: P1)

As an administrator, I can create a Challenge; as a user, I can explore its linked Waypoints.

**Why this priority**: Grouping existing Waypoints gives a shared goal without copying them.
**Independent Test**: Inspect creation, cancellation, category configuration, and detail navigation.

**Acceptance Scenarios**:

1. **Given** write access, **When** I add a Challenge, **Then** title and description
   must contain non-whitespace text, and Bronze/Silver/Gold Activity categories
   are an explicit option, off by default.
2. **Given** a valid new Challenge, **When** save succeeds, **Then** it has its own
   identity and starts with no Waypoints. Cancel clears the draft without writing.
3. **Given** a Challenge card, **When** I open it, **Then** I see its description
   and linked Waypoints with navigation to their details, or an explicit no-links state.
4. **Given** a Waypoint linked from either existing membership direction, **When**
   membership is displayed, **Then** that Waypoint is included once. Category
   eligibility still uses the Waypoint's category-supporting Challenge links;
   inconsistent imported memberships are a known defect, not an approved design.
5. **Given** viewer or read-only access, **When** I browse, **Then** reading remains
   available but Challenge creation and planned-route changes are not offered.

### User Story 3 - Maintain a Planned Route (Priority: P2)

As an administrator, I can attach, replace, or remove a planned GPX route and
compare it with recorded tracks without changing completion evidence.

**Why this priority**: Route planning adds context but must not count as a completed activity.
**Independent Test**: Review valid/invalid route files, draft changes, save failures, and track display.

**Acceptance Scenarios**:

1. **Given** a file accepted by the [GPX feature](../008-gpx-import-geometry/spec.md),
   **When** I select it, **Then** the parsed route is
   previewed as a draft; it is persisted only after Save route.
2. **Given** a saved route, **When** replacement is invalid or draft changes are
   cancelled, **Then** the saved route is not overwritten.
3. **Given** a route staged for removal, **When** I cancel, **Then** the saved
   route remains; **When** I save successfully, **Then** the route is removed.
4. **Given** file parsing or saving is underway, **When** I inspect route controls,
   **Then** conflicting actions are disabled. An earlier file read cannot replace
   a later selection.
5. **Given** a save failure, **When** the error is displayed, **Then** the draft
   remains available. Conflicts offer explicit reload, not automatic overwrite.
6. **Given** available planned route, located member Waypoints, or recorded tracks,
   **When** I view the detail map, **Then** those features are displayed with
   distinguishable planned/recorded styles and a recorded-track visibility toggle.
   Track membership follows the Activity's Waypoint, not a direct Challenge field.

### Edge Cases

- A Waypoint can belong to several Challenges and contributes independently to each.
- A completed Waypoint can still have Not Started award tier.
- No map is shown when the Challenge has no route, tracks, or fully located Waypoints.
- File acceptance, limits, geometry preservation, and planned-route metadata are
  defined only by the [GPX feature](../008-gpx-import-geometry/spec.md).
- Challenge title/description editing and Challenge deletion have no current
  user-facing controls; this baseline does not invent them.

## Requirements _(mandatory)_

### Functional Requirements

- **FR-001**: The overview MUST show each Challenge's completed/total Waypoints and
  rounded completion percentage, with zero percent for empty collections.
- **FR-002**: Completion MUST derive from member Waypoint once/count rules, not awards
  or Idea usage.
- **FR-003**: Dataset-wide exact-highest-tier summaries MUST link to the associated
  Waypoint filter, and recent visits MUST show at most three Waypoints by latest date.
- **FR-004**: Creation MUST require title and description, offer explicit award
  support, and create an initially empty collection; cancellation MUST write nothing.
- **FR-005**: Details MUST list existing member Waypoints once, considering either
  stored membership direction, and provide their detail links.
- **FR-006**: Route selection/removal MUST remain a draft until explicitly saved;
  cancellation and invalid replacement MUST preserve the saved route.
- **FR-007**: Route attachment MUST use the
  [shared GPX contract](../008-gpx-import-geometry/spec.md) and expose its rejection
  without replacing the saved Challenge route.
- **FR-008**: Parsing/saving MUST prevent conflicting route actions; stale file
  reads MUST NOT overwrite newer selections, and failed saves MUST retain drafts.
- **FR-009**: Detail maps MUST distinguish planned routes from recorded member
  tracks and allow the latter to be hidden without changing records or progress.
- **FR-010**: Access/data-mode restrictions MUST apply to creation and route changes;
  loading, absence, and failure MUST NOT be conflated.

### Key Entities

- **Challenge**: A named, described collection with a stable identity and explicit
  support or non-support for Activity award categories.
- **Membership**: Existing linked Waypoints, not duplicated destination records.
- **Progress**: Completed member Waypoints divided by total members.
- **Planned route**: An optional Challenge attachment defined by the
  [GPX feature](../008-gpx-import-geometry/spec.md).

## Success Criteria _(mandatory)_

### Measurable Outcomes

- **SC-001**: Empty, partial, and full completion cases produce the documented
  counts and rounded percentage; award-only changes do not change completion.
- **SC-002**: All three award summary links select the corresponding tier, while
  recent-visit output contains no more than three unique Waypoints.
- **SC-003**: Attach, replace, and remove each have explicit save/cancel outcomes;
  failed or invalid draft actions do not overwrite a saved route.
- **SC-004**: Every requirement is source-mapped with execution gaps and known
  defects visible, without inferring hosted acceptance from written tests.

## Assumptions

- Existing [access](../001-access-roles/spec.md),
  [persistence](../002-data-modes-persistence/spec.md), and
  [Waypoint](../003-waypoint-management/spec.md) boundaries apply.
- Membership editing currently happens through Waypoint editing. General
  Challenge administration is not added by this specification.
- [GPX](../008-gpx-import-geometry/spec.md) owns shared import/geometry rules;
  this feature owns the Challenge's route lifecycle and member-track comparison.
- Shared map-service availability is required for route rendering, not for
  defining completion rules. The separate map baseline covers general browsing.
- Existing relationship defects are logged separately; no canonical relationship
  redesign, new tests, repair, deployment, or hosted mutation is authorized.
