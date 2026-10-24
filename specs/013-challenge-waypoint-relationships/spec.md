# Feature Specification: Single-Source Challenge–Waypoint Relationships

**Feature Branch**: `013-challenge-waypoint-relationships`

**Created**: 2026-10-22

**Status**: Draft

**Input**: User description: "Create a new feature to make Challenge–Waypoint relationships live in one place, consistent with the other relationships."

## User Scenarios & Testing _(mandatory)_

### User Story 1 - See Accurate Challenge Membership (Priority: P1)

As a user, I want each Challenge to show exactly the Waypoints assigned to it,
so that Challenge progress, category eligibility, and recorded tracks agree.

**Why this priority**: Challenge membership is the basis for the Challenge's
detail view and related progress behavior. A single authoritative relationship
prevents those views from disagreeing.

**Independent Test**: Assign a Waypoint to one or more Challenges, then verify
that each Challenge detail view includes it exactly where assigned and excludes
it everywhere else.

**Acceptance Scenarios**:

1. **Given** a Waypoint assigned to a Challenge, **When** I view that Challenge,
   **Then** the Waypoint appears once and contributes to its Challenge progress.
2. **Given** a Waypoint assigned to multiple Challenges, **When** I view each
   Challenge, **Then** it appears once in each assigned Challenge and nowhere
   else.
3. **Given** a valid dataset in which a Waypoint is not assigned to a Challenge,
   **When** I view that Challenge, **Then** the Waypoint is absent from its member
   list, progress calculation, and recorded-track selection.
4. **Given** a Waypoint's Challenge assignment changes, **When** the update
   succeeds, **Then** Challenge membership, category eligibility, and recorded
   track membership all reflect that assignment.

### User Story 2 - Maintain Challenge Assignments (Priority: P1)

As an administrator, I want to add or remove Challenge assignments from a
Waypoint without affecting its other records or assignments.

**Why this priority**: Waypoint editing is the existing user-facing place to
manage this relationship; it should remain clear and preserve unrelated data.

**Independent Test**: Add, change, and remove Challenge assignments on a
Waypoint, then verify the resulting Challenge views and the Waypoint's
Activities, Ideas, and other Challenge assignments.

**Acceptance Scenarios**:

1. **Given** a writable Waypoint, **When** I add or remove a Challenge
   assignment and save, **Then** the resulting assignment is reflected by the
   associated Challenge view.
2. **Given** a Waypoint assigned to multiple Challenges, **When** I remove one
   assignment, **Then** its other Challenge assignments and its Activities,
   Ideas, and Waypoint data remain unchanged.
3. **Given** I cancel a Waypoint edit, **When** I return to the Challenge
   overview, **Then** the saved Challenge assignments remain unchanged.
4. **Given** a Waypoint has awarded Activities and only one category-enabled
   Challenge assignment, **When** I try to remove that assignment, **Then**
   saving is rejected with a specific explanation, the draft remains available,
   and saved assignments and Activities remain unchanged.

### User Story 3 - Reject Obsolete or Invalid Relationship Data (Priority: P1)

As a user or administrator, I want obsolete or invalid Challenge relationship
data to produce a clear failure rather than be silently discarded or misread.

**Why this priority**: Existing records contain a duplicate Challenge-side
membership list. Silently dropping it could lose links that are not represented
on the Waypoint side.

**Independent Test**: Load or import data containing the obsolete duplicate
membership field, or a Waypoint assignment to an unknown Challenge, and verify
that validation fails explicitly before data is accepted or replaced.

**Acceptance Scenarios**:

1. **Given** persisted or imported Challenge data contains the obsolete
   Challenge-side Waypoint list, **When** the data is validated, **Then** it is
   rejected with an actionable compatibility error and is not silently
   normalized.
2. **Given** a Waypoint refers to a Challenge that does not exist, **When** the
   data is validated or saved, **Then** the operation fails explicitly before
   accepting the invalid relationship.
3. **Given** relationship validation fails, **When** the user sees the error,
   **Then** the active dataset is not reported as successfully updated and no
   unrelated records are discarded.

## Edge Cases

- A Waypoint may be assigned to no Challenges or to several Challenges.
- Repeating the same Challenge assignment must not display the Waypoint more
  than once or create duplicate links.
- Removing one assignment must not alter assignments to other Challenges.
- A Waypoint assignment to a missing Challenge is invalid and must be reported.
- Removing the last category-enabled assignment is invalid when it would leave
  existing awarded Activities without category support; those awards are not cleared.
- Existing data with the obsolete Challenge-side membership list is not
  automatically converted. It must fail explicitly and be corrected separately.
- The optional direct Activity-to-Challenge identifier is not changed by this
  feature. Challenge membership, category eligibility, progress, and recorded
  tracks continue to derive through the Activity's Waypoint.

## Requirements _(mandatory)_

### Functional Requirements

- **FR-001**: The system MUST represent a Challenge–Waypoint assignment in one
  authoritative place: the Waypoint's Challenge assignments.
- **FR-002**: The system MUST derive a Challenge's Waypoints from Waypoint
  assignments and MUST NOT maintain a duplicate Challenge-side list.
- **FR-003**: Challenge details, completion progress, Activity-category
  eligibility, and recorded member tracks MUST use the same authoritative
  Challenge assignment.
- **FR-004**: Administrators MUST be able to add and remove Challenge
  assignments through the existing Waypoint editing flow, subject to existing
  access and read-only rules.
- **FR-005**: Adding or removing an assignment MUST preserve the Waypoint, its
  other Challenge assignments, Activities, Ideas, and unrelated data.
- **FR-006**: Each Challenge assignment MUST reference an existing Challenge;
  duplicate or dangling assignments MUST be rejected before data is accepted.
- **FR-007**: Persisted, imported, and exported Journey data MUST use only the
  authoritative Waypoint-side assignment and MUST NOT silently discard obsolete
  Challenge-side membership data.
- **FR-008**: Data containing the obsolete Challenge-side membership field MUST
  fail explicitly with an actionable error. Automatic conversion or migration
  of existing Demo, Test, or Production data is out of scope.
- **FR-009**: Failed validation or persistence MUST leave the previously saved
  dataset unchanged and report the specific failure.
- **FR-010**: Existing access roles, data-mode boundaries, persistence
  protections, and Activity-to-Challenge field semantics MUST remain unchanged.
- **FR-011**: Assignment changes MUST be rejected if they would leave existing
  awarded Activities without a category-enabled Challenge. The draft MUST remain
  available and saved data MUST remain unchanged. The system MUST NOT clear awards
  or rewrite Activity history to permit the change.

### Key Entities

- **Challenge**: A goal-based collection with its own description, category
  settings, and optional planned route; it has no separately stored list of
  Waypoints.
- **Waypoint**: A destination that holds its Challenge assignments and may be
  associated with Activities and Ideas under their existing rules.
- **Challenge assignment**: The relationship from a Waypoint to an existing
  Challenge, used to derive that Challenge's membership.
- **Activity**: A record associated with at most one Waypoint. Its optional
  direct Challenge identifier remains outside this relationship change.

## Success Criteria _(mandatory)_

### Measurable Outcomes

- **SC-001**: For every valid dataset, each Challenge's displayed Waypoint set
  exactly matches the Waypoints assigned to that Challenge, with no missing or
  duplicate entries.
- **SC-002**: Challenge details, progress, category eligibility, and recorded
  tracks produce consistent membership results for the same Waypoint
  assignments.
- **SC-003**: Adding or removing one assignment changes only that association;
  the Waypoint and all unrelated links and records remain unchanged.
- **SC-004**: Every dataset containing the obsolete Challenge-side membership
  field or a dangling Challenge assignment fails explicitly before acceptance
  or replacement; no such data is silently dropped.
- **SC-005**: Valid saved and exported datasets contain no duplicate
  Challenge–Waypoint relationship representation.

## Assumptions

- Waypoint editing remains the user-facing place to manage Challenge
  assignments.
- The Waypoint-side Challenge assignment is authoritative, consistent with
  other one-sided relationships in the Journey model.
- Existing persisted data is not automatically migrated. Data using the
  obsolete duplicate representation must be corrected separately before it can
  be accepted by the new contract.
- The optional direct Activity-to-Challenge identifier is not part of this
  feature; Challenge behavior continues to derive through the Activity's
  Waypoint.
- Existing role, data-mode, API, Cosmos, import/export, and transaction
  boundaries continue to apply.
