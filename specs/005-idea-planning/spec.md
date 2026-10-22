# Feature Specification: Idea Planning Baseline

**Feature Branch**: `005-idea-planning`
**Created**: 2026-10-20
**Status**: Current-state baseline; source-reviewed, not newly runtime-verified
**Input**: Document existing Idea planning, discovery, editing, research links,
derived usage, and Activity handoff without designing new features.

## User Scenarios & Testing _(mandatory)_

### User Story 1 - Find Planning and Research Records (Priority: P1)

As a user, I can find Ideas by planning state and past use without confusing plans
with things that happened.

**Why this priority**: Ideas organize research independently of historical activity.
**Independent Test**: Review fictional Ideas across all states, difficulties, and usage counts.

**Acceptance Scenarios**:

1. **Given** loaded Ideas, **When** I open Ideas, **Then** All, Active, Someday,
   and Rejected views show collection counts; the initial state filter is All
   unless a valid state is specified in the address.
2. **Given** a search term, **When** I search, **Then** matching considers title,
   description, notes, linked Waypoint titles, reference titles, and reference
   hostnames without case sensitivity.
3. **Given** search, planning-state, and usage choices, **When** I combine them,
   **Then** Used means at least one Activity references the Idea, while Not used
   means none. State counts remain collection totals, not filtered match counts.
4. **Given** results, **When** I choose ordering, **Then** Recently updated is
   newest first by default, or Difficulty is lowest first with title as tie-breaker.
5. **Given** no matches in the selected state but matches elsewhere, **When**
   the empty result is shown, **Then** I can view matches in all states.
   An empty collection, no filtered matches, loading, and load failure are distinct.
6. **Given** an Idea detail, **When** I open it, **Then** I see its planning state,
   rejection reason when relevant, difficulty guidance, location, research links,
   linked Waypoint names, and newest-first Activities using it.

### User Story 2 - Maintain an Idea Without Rewriting History (Priority: P1)

As an administrator, I can maintain planning records, link them to multiple
Waypoints, and record research without creating an Activity.

**Why this priority**: Planning must remain independent of completion history.
**Independent Test**: Inspect minimal, rejected, located, linked, and reference-bearing drafts.

**Acceptance Scenarios**:

1. **Given** write access, **When** I add an Idea, **Then** title is required;
   description and notes may be empty. Active and Easy are the initial state
   and difficulty, and no Waypoint link is required.
2. **Given** a planning state, **When** I save Rejected, **Then** a nonempty
   rejection reason is required; for Active/Someday it is absent from the saved record.
3. **Given** Waypoint choices, **When** I save, **Then** zero, one, or many distinct
   existing Waypoints may be linked; an Add idea shortcut from a Waypoint preselects it.
4. **Given** difficulty choices, **When** I inspect them, **Then** Easy, Moderate,
   Involved, and Ambitious describe increasing preparation, travel, cost, and commitment,
   not an Activity result or completion award.
5. **Given** optional location and research links, **When** I save, **Then**
   supplied coordinates must be a valid pair, references require a title and HTTPS
   URL, optional preview URLs also use HTTPS, and no photo collection is accepted.
   References can be added, reordered, and removed.
6. **Given** add mode, **When** I use
   [structured draft entry](../009-structured-draft-entry/spec.md), **Then** its
   shared load/review rules apply to Idea fields; usage and photo links are not
   supported Idea draft fields, and Waypoint links remain form-selected.
7. **Given** an existing Idea, **When** its content, state, or Waypoint links change,
   **Then** its identity and creation time are retained, its update time changes,
   and previously logged Activities are not relinked or rewritten.
8. **Given** unsaved edits, **When** I cancel a dirty form, **Then** confirmation
   is required before discarding it. Failed saves show an error, not completion.

### User Story 3 - Use or Remove an Idea Deliberately (Priority: P2)

As an administrator, I can use an Idea to start recording an Activity or delete
the planning record without erasing historical Activities.

**Why this priority**: Planning-to-history handoff must preserve the distinction between records.
**Independent Test**: Inspect handoff for zero/one/many Waypoint links and confirmed deletion.

**Acceptance Scenarios**:

1. **Given** an Idea, **When** I choose Log activity from this idea, **Then** the
   Activity editor preselects that Idea and preselects its Waypoint only if there
   is exactly one; zero or many linked Waypoints do not force a choice.
2. **Given** a saved Activity that still references the originating Idea, **When**
   the handoff finishes, **Then** navigation returns to that Idea. Removing the
   preselected Idea before saving leaves navigation on Activities.
3. **Given** Activities use an Idea, **When** I view its usage, **Then** usage is
   derived from those Activities regardless of planning state, and does not mark
   a linked Waypoint complete unless the Activity itself links that Waypoint.
4. **Given** confirmed deletion, **When** it succeeds, **Then** the Idea and its
   Activity links are removed, but Activities and Waypoints remain; orphan research
   references may be pruned while shared ones remain.
5. **Given** viewer/read-only access, **When** I browse an Idea, **Then** edit,
   delete, and Log activity actions are unavailable and the reason is explained.

### Edge Cases

- A Rejected Idea can be historically used; use does not change planning state.
- One Activity may use several Ideas, and one Idea may inspire many Activities.
- Activities can use Ideas linked to other Waypoints or no Waypoints.
- Changing Idea-to-Waypoint links never moves historical Activities.
- Location remains optional and may be descriptive without coordinates; Waypoint
  save-time geocoding requirements do not extend to Ideas.
- Source/approximate metadata alone does not establish an Idea location in the form.
- The current Ideas page has a difficulty sort, not a difficulty filter.
- Detail-page unknown-record errors must not replace an actual load failure.

## Requirements _(mandatory)_

### Functional Requirements

- **FR-001**: Idea discovery MUST combine text search, planning state, and derived
  usage, with recent-update and difficulty ordering and collection-wide state counts.
- **FR-002**: Empty results MUST distinguish no Ideas from filtered-out Ideas and
  offer cross-state discovery when applicable.
- **FR-003**: Details MUST show research, planning metadata, linked Waypoint names,
  and historical usage without storing duplicated usage records on an Idea.
- **FR-004**: Creation/edit MUST require title, an allowed state and one of four
  difficulty levels; description, notes, location, and Waypoint links MAY be empty.
- **FR-005**: Rejection reason MUST be present only for Rejected Ideas; Waypoint
  links MUST identify distinct existing records.
- **FR-006**: References MUST use titled HTTPS links and support ordering/removal;
  Idea photo links MUST NOT be accepted.
- **FR-007**: Idea add mode MUST use the
  [shared draft-entry contract](../009-structured-draft-entry/spec.md) for its
  supported fields, without importing usage or Waypoint relationships.
- **FR-008**: Editing MUST preserve identity and creation time without rewriting
  Activity history; dirty cancellation MUST require discard confirmation.
- **FR-009**: Activity handoff MUST preselect the Idea, optionally its sole Waypoint,
  and preserve the independent Idea after Activity creation.
- **FR-010**: Confirmed deletion MUST remove Idea links from Activities while
  preserving the Activities and Waypoints.
- **FR-011**: Access and loading restrictions MUST apply to all mutations; failed
  saves MUST remain errors, not successful planning changes.

### Key Entities

- **Idea**: An independent planning record with title, text, state, difficulty,
  optional location, timestamps, research links, and zero/many Waypoint links.
- **Derived usage**: The Activities referencing an Idea, their count, and links;
  independent of Active/Someday/Rejected state.
- **Research reference**: Titled external HTTPS information with optional description
  and preview image, not a photo attachment or stored image.

## Success Criteria _(mandatory)_

### Measurable Outcomes

- **SC-001**: All three planning states can be independently combined with Used
  and Not used, without changing their collection counts or historical usage.
- **SC-002**: All four difficulty levels, six search sources, and two sort choices
  have source-grounded outcomes and explicit coverage or evidence gaps.
- **SC-003**: Zero/one/many Waypoint handoffs retain the Idea and preselect only the
  documented links; edit/delete scenarios preserve all independent history.
- **SC-004**: Each requirement has reviewed evidence and an honest execution status;
  baseline completion does not imply hosted acceptance or a defect repair.

## Assumptions

- Existing [access](../001-access-roles/spec.md) and
  [persistence](../002-data-modes-persistence/spec.md) constraints apply.
- Activity recording is separate; Ideas are never converted into Activities.
- [Structured draft entry](../009-structured-draft-entry/spec.md) owns JSON
  load/review, examples, and external prompt help; this feature owns Idea fields/save.
- Existing enhancement requests are not current functionality. No difficulty filter,
  Activity difficulty, new state, migration, code repair, or new test is introduced.
- This documentation-only baseline can be complete with linked defects and
  unexecuted acceptance.
