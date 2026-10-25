# Feature Specification: Clear and Reliable Activity Recording

**Feature Branch**: `015-activity-recording-experience`

**Created**: 2026-10-25

**Status**: Draft

**Input**: Improve the Activity-recording journey: visible saving and duplicate-submit
protection, compact optional details, clear required fields, accessible validation,
and confirmation when returning to an originating Idea. Activity title and date
must be mandatory.

## Clarifications

### Session 2026-10-25

- Q: Should an Activity be allowed to have a future date? A: No. Only today or
  earlier is allowed; future dates are rejected across forms and data boundaries.
- Q: Which time zone should define today when rejecting future Activity dates?
  A: UK time everywhere, accounting for British Summer Time.

## User Scenarios & Testing _(mandatory)_

### User Story 1 - Record a Valid, Named Activity (Priority: P1)

As an administrator, I can record or edit an Activity with a meaningful title and
valid date, understand which information is required, and correct errors without
losing the rest of my draft.

**Why this priority**: Every historical record needs an identifiable title and
date, and mandatory information must be enforced consistently rather than only
suggested by one screen.

**Independent Test**: Create and edit independent and linked Activities; reject
missing titles and dates through every supported entry path, then correct the
fields and save the intended record.

**Acceptance Scenarios**:

1. **Given** a create or edit draft, **When** its title is absent, empty, or
   whitespace-only, **Then** submission is rejected with a title-specific error,
   no records are written, and entered values remain available for correction.
2. **Given** a draft, **When** its date is absent, empty, or not a real calendar
   date, or is in the future, **Then** submission is rejected with a date-specific
   error and no writes. Today is the current UK calendar date, including British
   Summer Time, regardless of the user's device time zone.
3. **Given** a draft with a title, valid date, required location, and any
   applicable award selection, **When** I save it, **Then** its trimmed title and
   selected date are retained, whether or not it links to a Waypoint or Idea.
4. **Given** structured Activity draft entry, backup import, or a direct data
   write, **When** an Activity lacks a valid title or date, **Then** it is rejected
   explicitly before any write; invalid imports do not partially modify data.
5. **Given** multiple invalid fields, including one inside collapsed optional
   details, **When** I submit, **Then** the first invalid field in reading order
   becomes visible and receives focus, and each error is associated with its field.
6. **Given** an eligible linked Waypoint, **When** the award field appears,
   **Then** it is labelled "Award tier", its requirement is explained, and its
   selection does not imply that an award is needed for Waypoint completion.

---

### User Story 2 - Save Once with Clear Feedback (Priority: P1)

As an administrator, I know when a save is in progress and when it succeeds or
fails, without accidentally submitting twice or losing my draft.

**Why this priority**: Uncertain saving encourages repeat actions and makes
Activity history difficult to trust.

**Independent Test**: Hold a save pending from each entry point, repeatedly try
to submit or leave, then complete or reject it and inspect records and feedback.

**Acceptance Scenarios**:

1. **Given** a valid draft from Activities, Waypoint details, Idea-origin entry,
   or Activity editing, **When** I submit, **Then** a visible and accessible
   "Saving..." state appears until the operation settles.
2. **Given** a pending save, **When** I click Save repeatedly or submit by
   keyboard, **Then** only the original submission is accepted and no duplicate
   Activity is created.
3. **Given** a pending save, **When** I attempt conflicting edits, cancellation,
   deletion, input-mode changes, or in-app navigation that would discard the
   editor, **Then** the pending draft remains protected and no conflicting action
   proceeds. Browser unload retains the existing unsaved-change warning.
4. **Given** a failed save, **When** the failure is reported, **Then** its specific
   message remains visible, entered draft content is retained, controls become
   usable again, and a deliberate corrected or unchanged retry is possible.
5. **Given** successful saving, **When** the operation finishes, **Then** the
   pending state ends and the appropriate destination confirms "Activity saved."
6. **Given** an Activity started from an Idea that remains linked on submission,
   **When** saving succeeds, **Then** I return to that Idea, see the confirmation
   and updated Activity usage, and can open the new Activity. If I removed that
   Idea link, the existing Activities destination is retained with confirmation.

---

### User Story 3 - Complete the Essentials without Optional Clutter (Priority: P2)

As an administrator recording a simple Activity, I can reach the save action
without passing through expanded optional attachment sections, while still being
able to add or edit detailed evidence when I need it.

**Why this priority**: Simple recording should remain direct without removing
advanced capabilities.

**Independent Test**: Record a minimal Activity and one with GPX, references, and
photos on narrow and desktop screens, including keyboard-only interaction.

**Acceptance Scenarios**:

1. **Given** a new draft without attachments, **When** I open the editor,
   **Then** title, date, links, applicable award, and location are readily
   available; GPX, References, and Photos are clearly optional and collapsed.
2. **Given** optional sections, **When** I expand, edit, collapse, and reopen
   them, **Then** values and attachment selections remain unchanged until I
   explicitly remove or replace them.
3. **Given** an existing record or applied structured draft with optional
   content, **When** the form is shown, **Then** the relevant sections reveal
   that content without requiring me to discover hidden populated fields.
4. **Given** the form at 360x800 or 1280x800, **When** I navigate its controls,
   **Then** labels and actions do not clip or overlap, there is no horizontal
   page scrolling, and every optional-section toggle and save action is
   keyboard-operable with visible focus.
5. **Given** an invalid optional field, **When** I submit or collapse its section,
   **Then** its error is not hidden from correction and its draft is not discarded.

### Edge Cases

- Activity title is the user-facing name of the Activity, not a Waypoint title,
  Idea title, notes excerpt, or formatted-date substitute.
- A new draft prefills the current UK calendar date. It may be accepted unchanged;
  clearing it must not silently restore today's date.
- Future Activity dates are invalid, including in structured drafts, imports,
  existing loaded records, and protected writes; they must not be silently adjusted.
- UK midnight defines the future-date boundary even when UTC or the user's
  device has a different calendar date. Winter and British Summer Time cases,
  including daylight-saving transitions, use the same UK calendar-date rule.
- Activity dates remain calendar dates, not timestamps; time-zone handling must
  not shift a recorded Activity date.
- Exact duplicate title/date combinations are allowed as distinct deliberate
  Activities; duplicate-submit protection must not become a uniqueness rule.
- Title validation trims surrounding whitespace without inventing a title.
- An invalid title on existing persisted or imported data fails explicitly.
  No title backfill, silent fallback, persisted-data migration, or hosted data
  correction is authorized.
- GPX parsing still prevents saving until parsing finishes; invalid replacement
  retains the previous track and reports its specific error.
- A failed operation must not show success, lose links/attachments, retry
  automatically, or send the user to the success destination.
- Conflict handling retains its explicit reload/discard decision; reloading must
  not be presented as successful saving.
- Read-only users retain browsing and explanatory notices, but no write actions.
- Opening, collapsing, or navigating form sections does not write records.

## Requirements _(mandatory)_

### Functional Requirements

- **FR-001**: Every Activity MUST have a non-whitespace title and a real calendar
  date no later than today, enforced for creation, editing, structured draft entry,
  import, data loading, and protected writes. Incompatible records MUST fail explicitly.
- **FR-002**: The form MUST label the Activity title and date as required,
  explain the required location, and distinguish optional fields. Existing
  mandatory location and conditional award rules MUST remain enforced.
- **FR-003**: The conditional award field MUST use "Award tier" wording and
  explain its requirement without conflating awards and completion.
- **FR-004**: Invalid submission MUST preserve the draft, reveal and focus the
  first invalid field in reading order, and associate each error with its control
  so it is available to assistive technology, including coordinate and award errors.
- **FR-005**: Every Activity save surface MUST expose an accessible pending state
  and accept at most one submission from that editor until it settles.
- **FR-006**: Pending saves MUST protect the submitted draft from conflicting
  editor actions and in-app navigation that would discard it; existing browser
  unload warnings MUST be preserved.
- **FR-007**: Failed saves MUST show the specific failure, retain the draft and
  allow deliberate retry. Success MUST be shown only after saving succeeds.
- **FR-008**: Successful Idea-origin saves MUST return to the originating Idea
  when still linked, confirm success there, and expose updated Activity usage.
  Other entry points MUST retain their intended destinations and confirmation.
- **FR-009**: Optional GPX, References, and Photos sections MUST be collapsible,
  initially collapsed for empty new drafts, and reveal existing/applied content.
  Toggling sections MUST preserve entered values; validation MUST reveal errors.
- **FR-010**: At 360 and 1280 CSS pixel widths, required fields, validation,
  optional-section controls, and save feedback MUST remain readable without
  horizontal scrolling and usable by keyboard with visible focus.
- **FR-011**: Activity/Waypoint/Idea linking, location prefill, valid GPX handling,
  reference/photo ordering, completion calculations, and read-only restrictions
  MUST be preserved. Optional content MUST remain optional.
- **FR-012**: Demo data, examples, prompts, and directly related guidance MUST
  reflect mandatory title/date and the revised recording journey. Obsolete
  unnamed-Activity behavior MUST not be retained as a compatibility path.
- **FR-013**: Today MUST mean the current UK calendar date, accounting for British
  Summer Time, at every validation boundary and when prefilling a new draft.
  Device time-zone preferences MUST NOT change the cutoff or stored Activity date.

### Key Entities

- **Activity**: A completed event with mandatory title, date, and valid location;
  existing optional notes, links, award, and supporting evidence remain.
- **Activity draft**: Unsaved input whose values and validation state remain
  available until successful save or explicit permitted discard.
- **Save operation**: One submitted draft, visibly pending until explicit success
  or failure, without automatic retry or duplicate submission.
- **Originating Idea**: An existing planning record that can initiate Activity
  entry and receive the user back with confirmed usage; it does not become an Activity.

## Success Criteria _(mandatory)_

### Measurable Outcomes

- **SC-001**: All acceptance cases for missing, empty, or whitespace-only titles
  and absent, invalid, or future dates reject without writes; every successful case
  retains the supplied title and date across supported entry boundaries.
- **SC-002**: For each of the four save surfaces, repeated pointer and keyboard
  submissions during one pending operation result in exactly one accepted save.
- **SC-003**: All pending/failure cases preserve draft content and prevent
  contradictory success feedback; each failed case supports a deliberate retry.
- **SC-004**: Every invalid-field acceptance case reveals and focuses the first
  invalid control and makes each error available with its field, including
  errors in previously collapsed sections.
- **SC-005**: Every accepted Idea-origin case returns to the correct destination
  with explicit success confirmation and accurate linked usage.
- **SC-006**: A minimal valid new Activity can be saved without expanding any
  attachment section. Expanding/collapsing each section preserves all entered
  attachment values in the acceptance cases.
- **SC-007**: All recording and correction acceptance flows pass at 360x800 and
  1280x800 without horizontal page scrolling, clipped actions, or keyboard traps.
- **SC-008**: Viewer and read-only Demo cases expose no new write controls or
  record writes, while existing progress and Activity relationships stay correct.
- **SC-009**: Around UK midnight in both winter and British Summer Time, all
  date-entry and validation boundaries agree: the current UK date is accepted,
  the following date is rejected, and a new draft prefills the UK date even on
  a device configured to a different time zone.

## Assumptions

- One cohesive feature covers the five reviewed UX improvements plus mandatory
  title/date; splitting separate features would duplicate the same editor and
  validation acceptance surfaces.
- "Title" refers to the existing Activity name concept, not a second competing
  field. Choosing its internal representation belongs to planning.
- The current UK date is prefilled; mandatory means a valid non-future date must
  be present, not that users must manually re-enter it.
- This specification intentionally replaces optional Activity names in the
  historical Activity-recording baseline and related structured-entry contracts.
- Existing data is not assumed valid under the new title requirement. Bundled
  fictional fixtures/examples are updated; incompatible persisted data fails
  explicitly. No migration or live-data changes are included.
- Existing authentication, datasets, approved services, and shared UI conventions
  remain constraints. No offline drafts, photo uploads, new services, or redesign
  of other entity editors is included.
- Research findings are hypotheses supported by source review, not measured
  usability outcomes. Acceptance uses concrete behavior rather than invented
  user-study or time-saving claims.
