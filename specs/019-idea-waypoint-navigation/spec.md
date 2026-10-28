# Feature Specification: Idea-to-Waypoint Navigation

**Feature Branch**: `019-idea-waypoint-navigation`

**Created**: 2026-10-27

**Status**: Implemented and locally validated; not published

**Input**: [GitHub issue #193](https://github.com/Hsenrab/Journey/issues/193):
Make an Idea's linked Waypoints directly navigable. Preserve the existing
Activity recording flow, planning state, usage rules, and read-only access.

## Clarifications

### Session 2026-10-27

- Q: While an Idea is being edited, should its new Waypoint links remain usable?
  -> A: Show destination names as plain text while editing; restore their links
  when editing ends. Do not add a new discard-warning flow.

## User Scenarios & Testing _(mandatory)_

### User Story 1 - Open a linked destination (Priority: P1)

As someone revisiting an Idea, I want to open any of its linked Waypoints
directly so that I can explore a destination without finding it again in the
Waypoints list.

**Why this priority**: Linked destinations currently appear as plain text.
Making them navigable closes the specific gap identified in #193.

**Independent Test**: Open an Idea with multiple linked Waypoints and follow
each named destination link to its corresponding detail page.

**Acceptance Scenarios**:

1. **Given** an Idea linked to one Waypoint, **When** I open its detail page,
   **Then** the linked destination is named and opens that Waypoint's detail
   page in one activation.
2. **Given** an Idea linked to several Waypoints, **When** I review its linked
   destinations, **Then** each has its own independently focusable link.
3. **Given** two linked Waypoints with the same title, **When** I activate either
   link, **Then** it opens the record identified by that link rather than
   choosing a destination by its title.
4. **Given** an Idea with no linked Waypoints, **When** I review its details,
   **Then** the section explicitly says none are linked and contains no empty
   destination control.
5. **Given** the active dataset changes after I saw a destination link, **When**
   the destination or original Idea no longer exists, **Then** the existing
   missing-record or load-failure state remains explicit rather than presenting
   an unavailable record as usable.
6. **Given** I am editing an Idea, **When** I review its linked destinations,
   **Then** their names remain visible as plain text, not navigation controls.
   Successful saving or cancelling restores the links; a failed save that leaves
   the editor open does not restore them.

---

### User Story 2 - Understand associations and actual usage (Priority: P2)

As someone planning or reviewing an Idea, I want linked destinations and past
Activity usage to remain distinct so that I do not mistake a planning
association for a completed experience.

**Why this priority**: A navigable destination must not suggest that the Idea
was used there, change planning state, or alter the existing recording flow.

**Independent Test**: Review an Idea linked to one Waypoint and used by an
Activity at another, then verify the existing recording entry points.

**Acceptance Scenarios**:

1. **Given** an Idea with linked Waypoints and Activity usage, **When** I review
   its detail page, **Then** planning state, linked destinations, and Activity
   usage are separately labelled, with concise wording explaining that linked
   Waypoints are planning associations and usage counts Activities that
   explicitly used the Idea.
2. **Given** an Activity using this Idea at a different Waypoint, **When** I
   review the Idea, **Then** that Activity contributes to usage without changing
   planning state or adding its Waypoint to the Idea's linked destinations.
3. **Given** a writable Idea with zero, one, or multiple linked Waypoints,
   **When** I choose "Log activity from this idea", **Then** the Idea is
   preselected and a Waypoint is preselected only when exactly one is linked.
4. **Given** I record an Activity from an Idea, **When** the save succeeds and
   retains that Idea, **Then** I return to the Idea with its existing saved
   confirmation and Activity link; cancelling, a failed save, or removing the
   Idea from the Activity does not produce that confirmation.
5. **Given** an Idea in any existing planning state, **When** I follow a
   destination link, **Then** navigation does not edit the Idea, its associations,
   its planning state, or its usage.

---

### User Story 3 - Browse accessibly without write access (Priority: P2)

As a viewer or a person using a narrow screen or keyboard, I want to browse
linked destinations without needing editing permissions or losing readable
labels and visible focus.

**Why this priority**: Destination navigation is a reading action and must work
for viewers as well as admins on mobile and desktop.

**Independent Test**: Browse an Idea as a viewer and navigate its long-named
destinations using keyboard and pointer input at 360x800 and 1280x800.

**Acceptance Scenarios**:

1. **Given** a viewer can read an Idea and its Waypoints, **When** they open its
   detail page, **Then** destination links and existing Activity-usage links are
   available without exposing editing, deletion, or recording actions.
2. **Given** long destination titles, **When** I view the page at 360x800 or
   1280x800, **Then** labels wrap without horizontal page overflow and each
   destination remains independently operable.
3. **Given** I navigate by keyboard, **When** focus reaches a destination link,
   **Then** focus is visible and activating the link opens the correct detail
   page.

### Edge Cases

- An Idea has no linked destinations, exactly one, or several.
- Multiple linked destinations have the same title or very long titles.
- Active, someday, and rejected Ideas each have either zero or nonzero usage.
- An Activity uses an Idea at an unassociated Waypoint, or without a Waypoint.
- A dataset change or deletion makes a previously visible record unavailable.
- A viewer, Demo local mode, or another existing read-only condition permits
  browsing but not writes.
- An Idea's editor is open while its existing detail content remains visible:
  linked destination names are plain text until editing ends, including after
  a failed save that keeps the editor open.

## Requirements _(mandatory)_

### Functional Requirements

- **FR-001**: Idea detail MUST retain a labelled "Linked waypoints" section and
  expose a separate named destination link for every currently available linked
  Waypoint.
- **FR-002**: Each destination link MUST target its Waypoint by identity, not by
  its title. Duplicate titles MUST NOT collapse links or change their targets.
- **FR-003**: An Idea with no linked Waypoints MUST have an explicit none-linked
  message and no empty or dead destination control. Unavailable records MUST NOT
  be presented as usable destinations; existing load-failure and missing-record
  feedback MUST remain distinct.
- **FR-004**: Planning state, linked destinations, and Activity usage MUST remain
  separately labelled. Concise contextual wording MUST explain that destination
  links are planning associations, while usage counts Activities that explicitly
  reference the Idea.
- **FR-005**: Following destination links MUST NOT change any record, planning
  state, association, completion, or usage. Activities at an unrelated Waypoint
  MUST still count toward Idea usage without adding that destination to the Idea.
- **FR-006**: Existing Activity recording from an Idea MUST remain unchanged:
  preselect the Idea, preselect a Waypoint only for exactly one linked
  destination, and show the existing return-with-success feedback only after a
  successful save that retains the Idea.
- **FR-007**: Viewers and other existing read-only states MUST retain destination
  and Activity-usage navigation without gaining any write action. Existing
  read-only notices and access restrictions MUST remain intact.
- **FR-008**: Every destination link MUST be independently keyboard reachable,
  have a visible destination name and visible focus, and be operable by pointer
  and keyboard.
- **FR-009**: Long destination labels MUST wrap without horizontal page overflow
  at 360x800 and 1280x800.
- **FR-010**: Existing Idea capture, search, difficulty guidance, planning states,
  Activity usage, and Activity-usage links MUST remain unchanged apart from the
  contextual wording specified above.
- **FR-011**: While an Idea is being edited, the linked Waypoint names MUST remain
  visible as plain text rather than navigation controls. The links MUST return
  when editing ends through successful saving or cancelling, and MUST remain
  non-interactive after a failed save while the editor stays open. This feature
  MUST NOT add a new discard-warning flow or alter existing reference and
  Activity-usage navigation.

### Key Entities _(include if feature involves data)_

- **Idea**: A planning record with a title, planning state, linked Waypoint
  identities, and usage derived from Activities; destination navigation adds
  no new stored information.
- **Waypoint**: A destination opened by its identity from an Idea's existing
  associations.
- **Activity**: An experience that can explicitly reference an Idea independently
  of whether its Waypoint is associated with that Idea.

## Success Criteria _(mandatory)_

### Measurable Outcomes

- **SC-001**: Every available destination on an Idea with one or several linked
  Waypoints can be opened in one link activation, including duplicate-title
  cases, with no intermediate list search.
- **SC-002**: All linked destinations are keyboard reachable and visibly focused;
  long-label scenarios produce zero horizontal page overflow at both 360x800
  and 1280x800 for admin and viewer browsing.
- **SC-003**: All standalone, shared-Idea, and different-Waypoint usage scenarios
  preserve their expected planning state, associations, usage count, and
  recording defaults.
- **SC-004**: Viewer and read-only browsing introduces zero new write actions,
  while every available destination and existing Activity-usage link remains
  navigable.
- **SC-005**: Browser acceptance records the actual role, dataset, and viewport
  used; failed, blocked, and unexecuted scenarios are identified explicitly.

## Assumptions

- This feature implements the bounded enhancement in #193; it is not evidence
  that user abandonment or a task-time improvement has been measured.
- Linked destinations use the existing same-tab Waypoint detail navigation.
  The initial scope does not add a new return action on Waypoint detail or
  preserve discovery-list or Map state.
- Existing access roles, data modes, record integrity, and error handling
  continue to apply. No new persisted fields, services, roles, or migrations
  are required.
- There is no dependency on another UX proposal. Waypoint discovery return
  (#194) and Map exploration return (#192) remain separate features.
- Activity recording, Challenge return, awards, Idea search, and draft
  protection are not being redesigned.
- #174 owns the separately reported postcode-only Activity save failure.
  Acceptance must check its current status before using that path. If it is
  still blocked, use unaffected coordinate-based or read-only scenarios for
  navigation and report the blocked save honestly rather than treating a mock
  save as proof.
- The new navigation must preserve the Challenge/Activity journey and award
  behavior already delivered, including the Activity evidence-order fix.
