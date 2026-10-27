# Feature Specification: Waypoint Draft Protection

**Feature Branch**: `018-waypoint-draft-protection`

**Created**: 2026-10-27

**Status**: Draft

**Input**: User description: "Take issue #188, confirm before discarding a changed
Waypoint draft, and clarify the behavior before implementation."

**Source issue**: [#188](https://github.com/Hsenrab/Journey/issues/188)

## Context

An admin can create or edit a Waypoint, including its location, Challenge
membership, completion rule, references and photo references. The current Cancel
action closes that editor without checking for unsaved changes. Idea and Activity
editors already ask before cancelling changed drafts.

The proposed outcome is a deliberate choice before losing a changed Waypoint
draft, without adding friction when nothing has changed or introducing autosave.

Source inspection at revision
`75dfe5d3a7896ca5a275c58977eb09a78a8be16c` confirms the unguarded Cancel
action and the existing distinction between changed and unchanged drafts.
This is not a browser-reproduced incident. The UX discovery browser session was
blocked by a connection timeout; mobile, desktop and role combinations remain
unexecuted. Specification review does not establish that implementation or
runtime acceptance has passed.

## Clarifications

### Session 2026-10-27

- Q: Should this feature protect only the Waypoint editor's Cancel action, or also
  expand protection to other ways of leaving the editor? → A: Protect Cancel only;
  leave other navigation and browser-close behavior unchanged.
- Q: What should Cancel do while a Waypoint save is still running? → A: Disable
  Cancel until saving finishes. Success follows the normal save behavior; failure
  restores Cancel while preserving the draft and existing failure information.

## User Scenarios & Testing _(mandatory)_

### User Story 1 - Keep work after an accidental Cancel (Priority: P1)

As an admin creating or editing a Waypoint, I want Cancel to give me the choice
to keep editing when I have unsaved changes, so an accidental action does not
lose entered work.

**Why this priority**: Losing location research, evidence or Challenge assignments
is the direct risk reported in the source review.

**Independent Test**: Change a new or existing Waypoint, select Cancel, and decline
discard. Verify that the same editor and complete draft remain, with no saved
record changes.

**Acceptance Scenarios**:

1. **Given** a meaningfully changed new or existing Waypoint draft, **When** the
   admin selects Cancel, **Then** they are asked whether to discard unsaved changes.
2. **Given** that confirmation, **When** the admin chooses not to discard,
   **Then** the editor stays open with the exact field values, selected Challenges,
   completion rule, evidence order, active tab, JSON content and visible errors.
3. **Given** a changed draft retained after a failed save, **When** the admin
   cancels and declines discard, **Then** both the draft and failure information
   remain; the interaction does not imply a successful save.
4. **Given** repeated Cancel attempts on a retained changed draft, **When** the
   admin continues to decline discard, **Then** every attempt leaves the same
   unsaved work intact and performs no write.
5. **Given** a save is in progress, **When** the admin tries to cancel, **Then**
   form controls, Save and Cancel are unavailable and Cancel cannot close the
   editor. If saving fails, editing and Cancel become available again and protect
   the retained changed draft.

---

### User Story 2 - Deliberately abandon a draft (Priority: P2)

As an admin, I want to confirm that I am abandoning unsaved work and return to
where I opened the editor, without changing saved data.

**Why this priority**: Draft protection must not prevent intentional cancellation
or confuse discarding with saving.

**Independent Test**: Change an add or edit draft, confirm discard, and reopen
the editor. Verify the original parent context and the absence of abandoned values.

**Acceptance Scenarios**:

1. **Given** a changed new-Waypoint draft, **When** the admin confirms discard,
   **Then** the add editor closes, no Waypoint is created, and the originating
   list context is retained.
2. **Given** a changed existing-Waypoint draft, **When** the admin confirms discard,
   **Then** the edit editor closes, the saved record remains unchanged, and the
   same Waypoint detail context is retained.
3. **Given** a discarded draft, **When** its editor is opened again, **Then** it
   starts from the saved record or the intended new-record defaults, not from
   abandoned values or errors.

---

### User Story 3 - Cancel without unnecessary warnings (Priority: P2)

As an admin, I want an unchanged editor to close immediately, including when I
have restored my changes to their initial values.

**Why this priority**: Warnings should indicate actual unsaved work rather than
teach users to dismiss them automatically.

**Independent Test**: Cancel an untouched draft, then repeat after changing and
restoring a field. Verify there is no confirmation or write in either case.

**Acceptance Scenarios**:

1. **Given** an unchanged new or existing Waypoint draft, **When** the admin
   selects Cancel, **Then** the editor closes without confirmation or saving.
2. **Given** all form values and evidence restored to their initial state and no
   unapplied non-whitespace JSON, **When** the admin selects Cancel, **Then** the
   editor closes without confirmation.
3. **Given** a viewer or a read-only dataset, **When** the user browses Waypoints,
   **Then** no Waypoint editor or write action becomes available through this feature.

### Edge Cases

- Initial Challenge selections and default completion values alone are not changes.
- Field edits, Challenge membership, completion mode/target, location, tags,
  references and photo references retain the existing changed-draft rules.
- Evidence reordering is a change; declining discard preserves that order.
- Non-whitespace unapplied JSON is unsaved work, including malformed JSON.
- Whitespace-only JSON alone is not unsaved work.
- Loading JSON into the form can change the form independently of the JSON text;
  clearing the JSON input must not conceal those changes.
- Merely switching between the form and JSON tabs is not a change.
- A failed validation, location resolution or protected-assignment save does not
  clear meaningful draft changes or discard their associated visible errors.
- Cancel is unavailable during an active save; it becomes available again after
  failure without resetting the draft or treating that failure as success.
- Errors alone do not turn an otherwise unchanged draft into a changed draft.
- Returning from confirmation must not submit the form or trigger a second action.
- Mobile and keyboard use must allow both retaining and abandoning the draft.

## Requirements _(mandatory)_

### Functional Requirements

- **FR-001**: Cancel MUST apply the same existing changed-draft distinction to
  both new and existing Waypoint editors.
- **FR-002**: Cancel on an unchanged draft MUST close the editor immediately
  without a confirmation or write.
- **FR-003**: Cancel on a changed draft MUST require an explicit choice before
  abandoning it; the confirmation MUST make clear that unsaved work will be lost.
- **FR-004**: Declining discard MUST preserve the complete current editor state,
  including form values, selections, completion, location, ordered evidence,
  active tab, JSON input and visible errors, and MUST allow editing to continue.
- **FR-005**: Confirming discard MUST close only the abandoned editor, preserve
  its parent list/detail context, and leave all saved records unchanged.
- **FR-006**: Neither Cancel nor either confirmation choice MUST create, update,
  delete or automatically save a Waypoint or related record.
- **FR-007**: Reopening after discard MUST use the saved record or intended
  new-record defaults, with no restoration of the abandoned draft.
- **FR-008**: Existing form and JSON changed-draft rules MUST remain unchanged,
  including restored values, unapplied JSON and changes already loaded into the form.
- **FR-009**: Save failures MUST retain their existing handling and messages.
  Changed drafts retained after failure MUST receive the same discard protection.
- **FR-010**: The confirmation MUST be operable with a keyboard and at 360 by
  800 and 1280 by 800 viewports. Declining MUST return control to the still-open
  editor without losing focus from the editing interaction.
- **FR-011**: Existing viewer and dataset write restrictions MUST remain unchanged.
- **FR-012**: New protection MUST apply only to the explicit Waypoint Cancel
  action. Existing in-app navigation, browser Back/Forward, dataset-switch and
  browser unload behavior MUST remain unchanged; a single Cancel MUST NOT produce
  duplicate prompts.
- **FR-013**: An active Waypoint save MUST disable form controls, Save and Cancel
  until the save finishes, preventing further edits, duplicate submissions and
  cancellation during that interval. Success MUST follow the existing save
  behavior. Handled failure MUST restore editing and Cancel while preserving the
  draft and the existing failure handling and messages.

### Key Entities

- **Saved Waypoint**: The existing persisted record, its Challenge membership,
  completion settings and linked evidence; cancellation does not modify it.
- **Waypoint draft**: Unsaved form and JSON content for creating or editing one
  Waypoint, including its current selections, ordered evidence and error state.
- **Discard decision**: A transient choice to abandon a changed draft or continue
  editing; it neither saves data nor creates a persisted draft.

## Success Criteria _(mandatory)_

### Measurable Outcomes

- **SC-001**: In all changed-draft add/edit cancellation cases, declining discard
  preserves every entered value and evidence position, with zero record writes.
- **SC-002**: In all confirmed-discard cases, the correct editor closes with zero
  record writes, and reopening contains none of the abandoned changes.
- **SC-003**: All unchanged and fully reverted cases close with zero discard
  prompts; each changed Cancel attempt presents exactly one confirmation.
- **SC-004**: Both choices can be completed using only a keyboard and at each
  target viewport without obscured or unreachable actions.
- **SC-005**: Viewer and read-only-mode checks expose zero new Waypoint mutation
  controls or permitted writes.
- **SC-006**: During an active save, zero Cancel interactions close the editor;
  after a failed save, Cancel is available and the changed draft is still protected.

## Assumptions

- The confirmed scope is the explicit Waypoint Cancel action. Other leave routes
  retain their current behavior and are not expanded by this feature.
- Confirmation follows the existing Idea/Activity cancellation interaction unless
  clarification establishes a different user-facing requirement.
- Meaningful changes are determined by the current Waypoint editor rules; this
  feature does not normalize inputs or redesign the draft comparison.
- Only admins with an active writable dataset can enter the editor.
- No autosave, draft persistence, recovery after closing the editor, offline work,
  schema changes, migrations, new services or new access roles are introduced.
- Save, delete, geocoding, awards and protected Challenge-assignment semantics
  remain unchanged. Issue #174 concerns a separate Activity save defect.
- The Paste JSON replacement interaction belongs to issue #190; this feature
  preserves existing JSON draft protection but does not redesign replacement.
- Runtime acceptance uses fictional isolated data, never mutations to real records.
