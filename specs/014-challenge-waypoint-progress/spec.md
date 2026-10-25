# Feature Specification: Waypoint Progress on Challenge Details

**Feature Branch**: `014-challenge-waypoint-progress`

**Created**: 2026-10-24

**Status**: Draft

**Input**: Show each member Waypoint's completion and count-based progress on the
Challenge detail page, so users can understand what remains without opening every
Waypoint.

## User Scenarios & Testing _(mandatory)_

### User Story 1 - See Which Waypoints Are Complete (Priority: P1)

As a user viewing a Challenge, I can see whether each member Waypoint is complete
alongside its title and description, without opening individual Waypoints.

**Why this priority**: The Challenge's overall progress is useful only when users
can identify which members still need attention.

**Independent Test**: Open a Challenge containing completed and incomplete
Waypoints and identify each member's completion directly from its entry.

**Acceptance Scenarios**:

1. **Given** a once-completion Waypoint with no linked Activities, **When** I view
   its Challenge, **Then** its entry shows "Not done".
2. **Given** a once-completion Waypoint with one or more linked Activities,
   **When** I view its Challenge, **Then** its entry shows "Done".
3. **Given** a Challenge with several members, **When** I review their entries,
   **Then** each completion indicator is unambiguously associated with its
   Waypoint and the existing "View waypoint" action remains available.

---

### User Story 2 - Understand Count-Based Progress (Priority: P1)

As a user working toward a repeated-activity target, I can see each count-based
Waypoint's recorded activity count and target, and whether it is complete.

**Why this priority**: Incomplete does not explain how much work remains; the
count and target make progress actionable.

**Independent Test**: View members with zero, partial, target-reaching, and
above-target activity counts and verify both counts and completion.

**Acceptance Scenarios**:

1. **Given** a Waypoint requiring five Activities with two linked Activities,
   **When** I view its Challenge, **Then** its entry shows "2 of 5 activities"
   and identifies it as not done.
2. **Given** that Waypoint with five linked Activities, **When** I view its
   Challenge, **Then** its entry shows "5 of 5 activities" and identifies it as done.
3. **Given** that Waypoint with seven linked Activities, **When** I view its
   Challenge, **Then** its entry shows "7 of 5 activities" and remains done;
   the recorded count is not capped or discarded.
4. **Given** a count-based target of one with no linked Activities, **When** I
   view its Challenge, **Then** the label reads "0 of 1 activity" and it is not done.

---

### User Story 3 - Trust Consistent Progress Across Views (Priority: P2)

As a user, I see the same completion for a Waypoint wherever it appears, including
when it belongs to multiple Challenges or I can only read the dataset.

**Why this priority**: Conflicting indicators would make Challenge progress
untrustworthy and read-only users need the same understanding as editors.

**Independent Test**: View one Waypoint in two Challenges and on its detail page,
then verify the indicators agree before and after an Activity change is loaded.

**Acceptance Scenarios**:

1. **Given** a Waypoint assigned to two Challenges, **When** I view either
   Challenge, **Then** its completion and count agree with its own detail page.
2. **Given** an Activity linked directly to a Challenge but not to a member
   Waypoint, **When** I view that Challenge, **Then** it does not increase any
   member's activity count or completion.
3. **Given** a linked Activity is added, deleted, or reassigned and the changed
   dataset is loaded, **When** I return to the Challenge detail page, **Then**
   the affected members show the resulting progress, without a separately saved
   completion value.
4. **Given** a viewer or a read-only Demo dataset, **When** I view a Challenge,
   **Then** member progress is visible without enabling any write actions.

### Edge Cases

- A Challenge with no members retains its existing empty-state message and does
  not show invented member progress.
- Zero linked Activities produces zero count and incomplete status, not missing
  information.
- Activity award categories, dates, and optional direct Challenge links do not
  alter completion; every Activity linked to the Waypoint counts once.
- Count-based targets of one use singular wording; larger targets use plural.
- Counts above the target remain visible and complete.
- Loading, failed-load, and missing-Challenge states remain distinct; unavailable
  data must not be presented as zero progress.
- Long titles and progress labels remain readable on narrow and wide screens.

## Requirements _(mandatory)_

### Functional Requirements

- **FR-001**: The Challenge detail page MUST show a textual completion indicator
  for every member Waypoint alongside that member's existing information.
- **FR-002**: Once-completion members MUST show "Not done" with zero linked
  Activities and "Done" with one or more linked Activities.
- **FR-003**: Count-based members MUST show their actual linked Activity count,
  target, and completion indicator. Completion MUST occur at or above the target,
  and displayed counts MUST remain uncapped above it.
- **FR-004**: Count labels MUST use singular "activity" for a target of one and
  plural "activities" for larger targets, matching existing Waypoint wording.
- **FR-005**: Membership MUST follow the existing Waypoint Challenge assignments.
  Progress MUST count Activities linked to the member Waypoint only, consistently
  across Challenges and other Waypoint views. Direct Activity Challenge links,
  awards, and Ideas MUST NOT act as alternate completion sources.
- **FR-006**: Indicators MUST reflect the active loaded dataset and changes to
  linked Activities once those changes are loaded. Viewing progress MUST NOT
  write records or introduce separately saved progress.
- **FR-007**: Member titles, descriptions, navigation, ordering, and the existing
  Challenge empty, loading, missing-record, and failure states MUST be preserved.
- **FR-008**: Progress MUST be available to all users who can view the Challenge,
  including viewers and read-only Demo users, without changing write permissions.
- **FR-009**: Progress MUST be understandable without relying on colour alone,
  clearly associated with its member, and readable without overlap or horizontal
  page scrolling at 360 and 1280 CSS pixel viewport widths.
- **FR-010**: Existing Challenge overview calculations, award summaries, planned
  routes, recorded tracks, and route-editing behaviour MUST remain unchanged.

### Key Entities

- **Challenge**: A collection whose members are determined by existing Waypoint
  assignments; this feature adds visibility, not new membership behaviour.
- **Waypoint**: A member with an existing completion rule: one Activity or a
  positive target count.
- **Activity**: A recorded event that contributes to a Waypoint's progress only
  when linked to that Waypoint.
- **Member progress**: The derived activity count, required target, and completed
  state shown for a Waypoint; not a new persisted record.

## Success Criteria _(mandatory)_

### Measurable Outcomes

- **SC-001**: Every member in the acceptance dataset has a correctly associated
  textual completion indicator on Challenge details, without opening its own page.
- **SC-002**: Count-based labels and completion are correct for all zero, partial,
  exact-target, above-target, and target-one acceptance cases.
- **SC-003**: Progress agrees across both Challenges and the Waypoint detail page
  in every overlapping-membership and loaded Activity-change acceptance case.
- **SC-004**: At both 360 and 1280 CSS pixel viewport widths, all progress labels
  are readable without overlap or horizontal page scrolling, and every member
  retains its navigation action.
- **SC-005**: Viewer and read-only Demo acceptance cases expose the same progress
  as writable cases with identical data, with no writes caused by viewing it.

## Assumptions

- This is a new presentation feature building on the existing Challenge baseline
  and the single-source membership contract in
  [Feature 013](../013-challenge-waypoint-relationships/spec.md).
- Existing Waypoint completion semantics and wording remain authoritative.
  Completion and Bronze/Silver/Gold awards are distinct; this feature does not
  add or redefine per-member award displays.
- The active dataset already provides the records needed to derive progress.
  No new refresh mechanism, offline storage, schema change, migration, or
  deployment is included.
- Filtering, sorting changes, new aggregate summaries, Challenge editing/deletion,
  membership management, and map redesign are outside this feature's scope.
