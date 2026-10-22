# Feature Specification: Waypoint Management Baseline

**Feature Branch**: `003-waypoint-management`
**Created**: 2026-10-20
**Status**: Baseline with implemented location-save improvement; validation in [evidence](evidence.md)
**Input**: Document existing Waypoint browsing, editing, relationships, and progress.
The location-save slice was subsequently authorized for implementation; this does
not authorize deployment or hosted mutation. A commit and feature-branch push were
authorized on 2026-10-22 solely to run GitHub Actions CI.

## Clarifications

### Session 2026-10-21

- Q: When a Waypoint's place name or address changes but its existing coordinates
  remain untouched, should saving keep those coordinates or find the location again?
  A: Clear unchanged coordinates and resolve the changed place/address on save.
  Implementation and executed acceptance are recorded separately in evidence.
- Q: If both the place name and address are removed without changing existing
  coordinates, should the Waypoint keep its position or have no location?
  A: Remove the entire location, including coordinates and location metadata.

## User Scenarios & Testing _(mandatory)_

### User Story 1 - Find and Understand a Waypoint (Priority: P1)

As a user, I can find destinations, experiences, or activities worth doing and see
their details, completion, planning records, and history.

**Why this priority**: A Waypoint is the shared anchor for planning and recorded activity.
**Independent Test**: Review fictional Waypoints with different categories, locations,
completion rules, Ideas, and Activities.

**Acceptance Scenarios**:

1. **Given** loaded Waypoints, **When** I open the list, **Then** all are eligible
   for display, ordered by name by default, regardless of Challenge membership.
2. **Given** a search term and filters, **When** I apply them, **Then** search matches
   title, area, or category without case sensitivity, and award-tier, area, and
   category filters combine. Area and category are secondary filters.
3. **Given** filtered results, **When** I choose another sort, **Then** they can be
   ordered by name, highest award tier first, or latest linked Activity date first.
4. **Given** a Waypoint card, **When** I open it, **Then** I see its description,
   category/location summary, linked Ideas with usage, and newest-first linked
   Activity history with links to individual records.
5. **Given** a once/count completion rule, **When** linked Activities change,
   **Then** completion reflects one Activity or the positive target count;
   award tier is shown separately as the highest linked Bronze/Silver/Gold category.
6. **Given** an unresolved detail address, **When** data is loading, failed, or
   successfully loaded without that Waypoint, **Then** the page distinguishes
   those three conditions rather than treating all as a missing record.

### User Story 2 - Maintain a Waypoint (Priority: P1)

As an administrator in a writable dataset, I can create and edit a Waypoint
without duplicating its related records.

**Why this priority**: Users need to maintain the destinations that other features reference.
**Independent Test**: Inspect create/edit scenarios with valid and invalid fictional drafts.

**Acceptance Scenarios**:

1. **Given** write access, **When** I submit the form, **Then** title, description,
   and category are required; tags, Challenge links, location, external references,
   and external photo links can be supplied.
2. **Given** count-based completion, **When** the target is invalid, **Then** save
   is blocked until it is a positive whole number.
3. **Given** optional location input, **When** coordinates are supplied, **Then**
   both latitude and longitude are required and must be within valid ranges.
   Searchable place-only Waypoint locations resolve before persistence through
   the form's atomic replacement path.
   If a place name or address changes while its previously saved coordinate pair
   is untouched, clear that pair and resolve the changed location on save.
   An explicitly edited valid coordinate pair remains authoritative. Failed
   resolution blocks the save and retains the draft, without changing stored data.
   Clearing both identifying text fields from a previously named location while
   leaving coordinates untouched removes the entire location and its metadata.
   Local verification and remaining hosted acceptance are recorded in evidence.
4. **Given** Waypoint add/edit, **When** I use
   [structured draft entry](../009-structured-draft-entry/spec.md), **Then** its
   shared load/review rules apply to Waypoint fields; Challenge links remain
   selected in the form.
5. **Given** reference/photo fields, **When** I save, **Then** each requires a
   title and an external HTTPS URL; optional preview images also use HTTPS.
   The application stores links, not uploaded photos.
6. **Given** an existing Waypoint, **When** I edit and save, **Then** its identity
   remains unchanged and Challenge membership is updated on both sides.
   Removing category eligibility while categorized Activities remain is rejected.
7. **Given** a cancelled draft or failed save, **When** I return to viewing,
   **Then** cancellation writes nothing and failure is not presented as success.
   A conflict offers an explicit reload of the latest dataset.

### User Story 3 - Delete Without Erasing History (Priority: P2)

As an administrator, I can remove a Waypoint while preserving its Ideas and Activities.

**Why this priority**: Removing a destination must not erase independent planning or history.
**Independent Test**: Review deletion with linked Challenges, Ideas, Activities, and shared references.

**Acceptance Scenarios**:

1. **Given** a linked Waypoint, **When** I request deletion, **Then** confirmation
   explains the affected Idea/Activity counts and that those records are kept.
2. **Given** confirmation, **When** deletion succeeds, **Then** the Waypoint is
   removed from Challenges and Ideas; Activities are detached and lose their
   Waypoint-dependent award categories, but the historical records remain.
3. **Given** cancellation, viewer access, or a read-only dataset, **When** I browse
   the detail page, **Then** cancellation writes nothing and unavailable mutation
   actions are not offered; read-only context is explained.

### Edge Cases

- A Waypoint needs no location or Challenge membership.
- Without a linked categorized Activity, award tier is Not Started even if
  uncategorized Activities have completed the Waypoint.
- Idea planning state and Idea usage never complete a Waypoint.
- Absent area labels are grouped as Unspecified; a valid empty dataset and no
  matching filters are not load failures.
- Editing references can affect another record using the same reference identity;
  unreferenced supporting records are pruned, not independent Ideas or Activities.
- Waypoint drafts follow the confirmed-discard and pending-write rules in the
  [data-mode contract](../002-data-modes-persistence/spec.md). This does not add
  protection for unrelated navigation.
- A pre-existing coordinate-only location is not removed simply because its text
  fields remain empty; the removal rule applies when previously supplied identifying
  text is cleared and its coordinates are left untouched.

## Requirements _(mandatory)_

### Functional Requirements

- **FR-001**: Users MUST be able to browse all loaded Waypoints, search title/area/category,
  combine award-tier/area/category filters, and use name, award, or recent-activity ordering.
- **FR-002**: Details MUST expose linked Ideas and Activity history through existing
  relationships and allow navigation to those records.
- **FR-003**: Completion MUST count only Activities directly linked to the Waypoint;
  once/count rules and highest award tier MUST remain separate measures.
- **FR-004**: Create/edit MUST require title, description, category, and a valid
  completion rule, while allowing tags, optional location, and Challenge membership.
- **FR-005**: Supplied coordinates MUST be a valid pair. Searchable place-only
  Waypoint locations MUST resolve before atomic replacement persistence.
  Changing a place name or address while leaving the saved coordinates untouched
  MUST clear those coordinates and resolve the new location before persistence.
  Explicitly edited valid coordinates MUST take precedence over text resolution.
  Resolution failure MUST block the save, retain the draft, and leave stored data
  unchanged.
  Clearing both place name and address from a previously named location with
  untouched coordinates MUST remove the entire location, including source and
  approximate-location metadata. Existing coordinate-only locations remain valid.
- **FR-006**: Waypoint add/edit MUST use the
  [shared draft-entry contract](../009-structured-draft-entry/spec.md) for its
  supported fields, while retaining form-managed Challenge membership.
- **FR-007**: Supporting references and photo links MUST require titles and HTTPS
  URLs; no image-file storage is provided.
- **FR-008**: Edits MUST preserve Waypoint identity, synchronize Challenge membership,
  and reject edits invalidating existing Activity award eligibility.
- **FR-009**: Confirmed deletion MUST detach, not delete, Ideas and Activities,
  remove Challenge membership, and clear dependent Activity award categories.
- **FR-010**: Mutations MUST respect the access/data-mode baselines; cancellations
  and rejected saves MUST NOT be presented as successful changes.
- **FR-011**: Loading, load failure, absent records, and empty/filter-empty lists
  MUST have distinguishable outcomes.

### Key Entities

- **Waypoint**: A destination, experience, or activity worth doing, with a stable
  identity, title, description, category, tags, and once/count completion rule.
- **Membership**: A Waypoint may belong to multiple Challenges.
- **Related records**: Ideas link to zero or more Waypoints; each Activity links
  to at most one. The Waypoint stores neither child list.
- **Supporting links**: External reference and photo metadata, reusable by identity.

## Success Criteria _(mandatory)_

### Measurable Outcomes

- **SC-001**: Each of the three search fields, three filters, and three sort choices
  has a source-grounded outcome and a documented existing test or evidence gap.
- **SC-002**: Once/count scenarios with zero, below-target, and at-target Activities
  distinguish completion from all four award-tier labels without using Idea state.
- **SC-003**: Confirmed deletion preserves every linked Idea and Activity while
  removing the deleted Waypoint's links and dependent awards.
- **SC-004**: Every requirement maps to reviewed evidence, and unresolved defects
  are linked without claiming that runtime or hosted acceptance passed.
- **SC-005**: Verify that changing place/address text with untouched saved
  coordinates resolves a new position, explicitly edited coordinates are retained,
  and failed resolution preserves both the unsaved draft and the stored record.
  Clearing both identifying text fields with untouched coordinates removes the
  location; an unchanged coordinate-only location remains unchanged.
  Local execution and hosted acceptance MUST remain distinguished in evidence.

## Assumptions

- [Access](../001-access-roles/spec.md) and
  [data-mode/persistence](../002-data-modes-persistence/spec.md) contracts apply.
- Activity editing, Idea planning, Challenge routes, and map interaction have
  separate baselines. Detail-page shortcuts do not merge those feature scopes.
- [Structured draft entry](../009-structured-draft-entry/spec.md) owns JSON
  load/review, examples, and external prompt help; this feature owns Waypoint fields/save.
- The authorized implementation is limited to the planned Waypoint location-save
  slice. No deployment, hosted data changes, migrations, or unrelated defect repairs
  are authorized.
