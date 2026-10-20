# Feature Specification: Activity Recording Baseline

**Feature Branch**: `006-activity-recording`
**Created**: 2026-10-20
**Status**: Current-state baseline; source-reviewed, not newly runtime-verified
**Input**: Document existing independent and linked Activity history, creation,
editing, supporting links/photos, GPX tracks, and deletion without repairing code.

## User Scenarios & Testing _(mandatory)_

### User Story 1 - Browse Real-World History (Priority: P1)

As a user, I can browse things that happened, including events with no linked
Waypoint or Idea, and inspect their location, notes, links, photos, and tracks.

**Why this priority**: Activities are historical evidence, not planning records.
**Independent Test**: Review a fictional log with named/unnamed, linked/independent,
tracked/untracked Activities and different dates.

**Acceptance Scenarios**:

1. **Given** loaded Activities, **When** I open Activities, **Then** the log is
   ordered newest date first with newest update time breaking date ties.
2. **Given** an Activity with an optional name, **When** it is shown in the log or
   detail, **Then** the name is its title and date is supporting text; without a
   name, the formatted date is the title. A linked Waypoint is separately identified.
3. **Given** a detail page, **When** I open it, **Then** I can inspect notes,
   location, optional award, linked Ideas, external references, and photo links.
   Breadcrumbs lead to its Waypoint when linked, otherwise to Activities.
4. **Given** linked photos, **When** I browse the gallery, **Then** previous/next,
   arrow-key, and horizontal-swipe navigation select photos; failed images show
   explicit errors without pretending they loaded.
5. **Given** a recorded track, **When** I choose View recorded track on map,
   **Then** the existing map receives the Activity selection. Without a track,
   that action is absent.
6. **Given** loading, failure, an empty log, or a genuinely unknown Activity,
   **When** I open the corresponding page, **Then** those outcomes remain distinct.

### User Story 2 - Record and Edit an Event (Priority: P1)

As an administrator, I can record an Activity independently or link it to one
Waypoint and any number of Ideas without transforming those Ideas.

**Why this priority**: Activities supply progress evidence and preserve personal history.
**Independent Test**: Inspect fictional create/edit drafts, validation, handoff, and failed saves.

**Acceptance Scenarios**:

1. **Given** write access, **When** I submit an Activity, **Then** a real calendar
   date and structured postcode or coordinate-pair location are required; name
   and notes may be empty. The form initially uses the current date.
2. **Given** Waypoint/Idea choices, **When** I select links, **Then** at most one
   existing Waypoint and zero/many distinct existing Ideas can be linked.
   Ideas associated with the chosen Waypoint appear first but others remain selectable.
3. **Given** selected Ideas, **When** I change or clear the Waypoint, **Then**
   the Idea selections remain; Ideas may belong to other or no Waypoints.
4. **Given** untouched empty location input, **When** I select a fully located
   Waypoint, **Then** its coordinates prefill the location. User-entered locations
   are not overwritten; a Waypoint without coordinates does not invent them.
5. **Given** postcode input, **When** a shared save is attempted, **Then** the
   approved contract is coordinate resolution before persistence and explicit
   rejection if it cannot resolve. The current form-save bypass is separately
   logged, not treated as a new coordinates-only requirement.
6. **Given** a Waypoint in an award-supporting Challenge, **When** I submit the
   form, **Then** it requires Bronze, Silver, or Gold. For an ineligible or absent
   Waypoint, the category control is unavailable and a previously selected award
   is cleared with an explanatory message.
7. **Given** add mode, **When** I use
   [structured draft entry](../009-structured-draft-entry/spec.md), **Then** its
   shared load/review rules apply to Activity fields; Waypoint/Idea selection and
   GPX track attachment remain separate form actions.
8. **Given** an existing Activity, **When** I edit it successfully, **Then** its
   identity and creation time remain, update time changes, and derived Waypoint
   completion and Idea usage reflect the saved links.
9. **Given** invalid input, a failed save, or cancelled dirty edits, **When**
   the action finishes, **Then** invalid/failed saves remain errors with the draft
   available, and dirty cancellation requires discard confirmation.

### User Story 3 - Add Evidence Without Storing Photo Files (Priority: P2)

As an administrator, I can maintain external links, photo metadata, and an optional
recorded GPX track alongside an Activity.

**Why this priority**: Supporting evidence enriches history without changing completion rules.
**Independent Test**: Inspect references, photos, and valid/invalid track replacements.

**Acceptance Scenarios**:

1. **Given** reference/photo fields, **When** I save them, **Then** each needs a
   title and HTTPS URL; reference description/preview and photo alternative text
   are optional, with HTTPS also required for supplied preview URLs.
2. **Given** supporting entries, **When** I edit them, **Then** form controls
   allow addition, ordering, and removal. Only metadata and external URLs are
   stored; no image upload or photo storage is provided.
3. **Given** a file accepted by the [GPX feature](../008-gpx-import-geometry/spec.md),
   **When** I attach/replace a recorded track, **Then** the attachment remains a
   draft until the Activity is saved.
4. **Given** invalid GPX or overlapping file selections, **When** parsing finishes,
   **Then** invalid input does not discard other edits/the existing track, stale
   results cannot replace newer selections, and save is blocked during parsing.
5. **Given** a track is removed and the Activity saved, **When** I inspect the
   Activity, **Then** the track is absent, but the Activity still counts toward
   its Waypoint and Idea usage.

### User Story 4 - Remove an Activity Without Removing Its Plans (Priority: P2)

As an administrator, I can delete mistaken history while preserving independent
Ideas and Waypoints.

**Why this priority**: Correcting the log must update derived progress without cascading deletion.
**Independent Test**: Inspect confirmed/cancelled deletion and post-delete refresh failure.

**Acceptance Scenarios**:

1. **Given** deletion is requested, **When** I cancel, **Then** no records change.
   **When** I confirm and deletion succeeds, **Then** the Activity is removed,
   Ideas/Waypoints remain, and now-unused supporting links may be pruned.
2. **Given** deletion succeeded but the following refresh fails, **When** the
   page reports it, **Then** it explicitly says the Activity was deleted but
   latest data could not load, blocks repeat mutation of that deleted Activity,
   and offers reload instead of claiming deletion failed.
3. **Given** viewer/read-only access, **When** I browse history, **Then** browsing
   remains available but add, edit, and delete actions are not offered.

### Edge Cases

- Unattached Activities are valid and do not complete any Waypoint.
- Uncategorised Activities still count toward once/count completion. The existing
  data contract permits them even though the eligible-Waypoint form requires an award.
- Shared file acceptance, limits, geometry preservation, and track representation
  are defined only by the [GPX feature](../008-gpx-import-geometry/spec.md).
- Notes and the optional Activity name are not substitutes for the required location.
- The current Activity log has no search, difficulty field, or difficulty/usage filters.
- Gallery failure is explicit; external image availability is not guaranteed.

## Requirements _(mandatory)_

### Functional Requirements

- **FR-001**: The log MUST order by date/update time and display name-or-date titles
  with linked Waypoint context and detail navigation.
- **FR-002**: Details MUST expose notes, structured location, linked Ideas,
  supporting links/photos, and a track-map action only when a track exists.
- **FR-003**: The form MUST validate real calendar dates and mandatory structured
  locations while keeping name, notes, Waypoint, Ideas, and tracks optional.
- **FR-004**: Link selection MUST permit at most one Waypoint and multiple distinct
  Ideas without restricting Ideas to the Waypoint or changing Idea planning state.
- **FR-005**: Automatic location prefill MUST NOT overwrite deliberate location edits;
  postcode resolution and its known remote-save defect MUST remain distinguished.
- **FR-006**: Award selection MUST be available only for eligible Waypoints, required
  by that form, and explicitly cleared when eligibility is lost.
- **FR-007**: Activity add mode MUST use the
  [shared draft-entry contract](../009-structured-draft-entry/spec.md) without
  importing entity relationships or recorded tracks.
- **FR-008**: Supporting references/photos MUST require titled HTTPS links; form
  controls MUST allow ordering/removal without storing uploaded image files.
- **FR-009**: Track attachment MUST use the
  [shared GPX contract](../008-gpx-import-geometry/spec.md) and remain a draft until
  Activity save; invalid/stale reads MUST NOT destroy valid edits.
- **FR-010**: Editing MUST preserve identity/creation time, and confirmed deletion
  MUST preserve Ideas/Waypoints while derived usage and completion recalculate.
- **FR-011**: Dirty cancellation MUST require confirmation; validation, save,
  conflict, and post-delete reload failures MUST retain their distinct outcomes.
- **FR-012**: Access/data-mode guards and distinguishable loading/failure/empty/missing
  outcomes MUST apply throughout Activity pages.

### Key Entities

- **Activity**: A dated historical event with mandatory location, optional name,
  notes, supporting links, track geometry, and stable identity/timestamps.
- **Activity links**: At most one Waypoint and zero/many Ideas; not an Idea conversion.
- **Recorded track**: An optional Activity attachment defined by the
  [GPX feature](../008-gpx-import-geometry/spec.md).
- **External photo/reference**: Titled HTTPS metadata, not an uploaded image.

## Success Criteria _(mandatory)_

### Measurable Outcomes

- **SC-001**: Named/unnamed and linked/unlinked log cases have consistent order,
  titles, breadcrumb destinations, and detail access.
- **SC-002**: Zero/one Waypoint and zero/one/many Idea cases preserve independent
  records and derive progress only from the Activity's saved links.
- **SC-003**: Track attach/replace/remove, deletion confirm/cancel, and failed
  post-delete refresh each have explicit outcomes without implied partial success.
- **SC-004**: Every requirement maps to existing sources/tests or a stated gap;
  no hosted save, valid-date enforcement, or geocoding success is claimed solely
  from legacy local-mode test results.

## Assumptions

- [Access](../001-access-roles/spec.md),
  [persistence](../002-data-modes-persistence/spec.md),
  [Waypoints](../003-waypoint-management/spec.md), and
  [Ideas](../005-idea-planning/spec.md) supply shared boundaries.
- General map interaction has its own baseline; Activity detail only hands off selection.
- [GPX](../008-gpx-import-geometry/spec.md) owns shared import/geometry rules;
  this feature owns track attachment and its Activity save/cancel workflow.
- [Structured draft entry](../009-structured-draft-entry/spec.md) owns JSON
  load/review, examples, and external prompt help; this feature owns Activity fields/save.
- Known API validation and geocoding defects remain linked, not repaired. This
  baseline adds no tests, migration, filters, difficulty, deployment, or live mutation.
