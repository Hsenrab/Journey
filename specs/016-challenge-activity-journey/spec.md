# Feature Specification: Complete the Challenge Activity Journey

**Feature Branch**: `016-challenge-activity-journey`

**Created**: 2026-10-25

**Status**: Draft

**Input**: Following the UX review, improve "Discover a challenge, record progress,
and see the result": Dashboard to Challenge to Waypoint to Activity and back.
Address the lost return path, conflicting progress and award wording, missing
Challenge summary and next step, stale validation errors, and excessive travel to
the recording form and Save action. Cover desktop, mobile, zero and partial
progress, and viewers who can browse but cannot edit.

**Current baseline**: [Challenge award levels](../017-challenge-award-levels/spec.md)
is complete. Its conditional mandatory awards, highest-versus-recorded labels,
exact statistics, and history protection remain unchanged. Award clarity in
User Story 3, FR-009, FR-010, and SC-004 is regression coverage, not a second award
redesign. The remaining work concerns return navigation, progress explanation
and next steps, validation feedback, and recording ergonomics.

## Clarifications

### Session 2026-10-26

- Q: Should the originating Challenge's return link also appear on Activity details and editing when opened from its Waypoint? → A: No. Keep it on the Waypoint, during its recording flow, and in its save confirmation; Activity details and editing retain their existing navigation.
- Q: If the Activity's linked Waypoint changes before saving, should confirmation retain the original Challenge return even when the Activity no longer contributes to it? → A: Yes. Keep "Back to [original Challenge]" while the original context remains valid, explicitly state when the Activity does not contribute to it, and never imply a progress increase when there is no contribution.
- Q: Should Challenge details include a direct "Back to Dashboard" action on both screen sizes rather than rely on main navigation? → A: Yes. Provide a visible page-level action that reaches Dashboard in one action on mobile and desktop, without opening a navigation menu or using browser history.
- Q: After a successful Activity save on the Waypoint, where should the page move the view and keyboard focus? → A: Bring the success confirmation into view and focus the confirmation itself, with the valid original Challenge return available; stay on the Waypoint without automatic navigation.

## User Scenarios & Testing _(mandatory)_

### User Story 1 - Return to the Challenge I Started From (Priority: P1)

As a user exploring a Challenge, I can open one of its Waypoints and return to
that same Challenge without relying on browser history. As an administrator,
I can record an Activity and follow an explicit return action to see its effect.

**Why this priority**: A successful save does not complete the journey if I
cannot readily return to the progress I was working toward.

**Independent Test**: Start on Dashboard, open a Challenge, open a member
Waypoint, save an Activity, and return using the application's own navigation.
Repeat browsing as a viewer and with a Waypoint shared by two Challenges.

**Acceptance Scenarios**:

1. **Given** I opened Challenge A from Dashboard, **When** I open a member
   Waypoint, **Then** I can identify Challenge A by name and return to it with
   one explicit navigation action, before or after opening the Activity editor.
2. **Given** a Waypoint belongs to Challenges A and B, **When** I visit it from
   either Challenge, **Then** the return action names and opens the Challenge
   from that visit rather than choosing another membership.
3. **Given** I successfully save an Activity still linked to that Waypoint,
   **When** confirmation appears on the Waypoint, **Then** it offers an action
   to view the originating Challenge's progress; following it shows the saved
   Activity's effect without a manual reload.
4. **Given** I return to the Challenge, **When** I want to return to my starting
   Dashboard, **Then** a visible page-level "Back to Dashboard" action reaches
   it in one action on both mobile and desktop, without opening the main
   navigation menu or using browser Back.
5. **Given** I opened a Waypoint directly or from the Waypoints list, **When**
   I browse or save, **Then** normal Waypoints navigation remains available
   and no originating Challenge is invented.
6. **Given** a save is pending or a draft has unsaved changes, **When** I use
   the new return action, **Then** existing pending-save protection and
   unsaved-change decisions apply; navigation does not silently discard input.
7. **Given** I open an Activity's details or editing from a Waypoint,
   **When** I navigate within those Activity screens, **Then** their existing
   navigation and save destinations remain unchanged; this feature does not
   extend the named Challenge return into those screens.
8. **Given** I change the draft to an unlinked Activity or a Waypoint outside
   the originating Challenge, **When** saving succeeds and the original context
   remains valid, **Then** confirmation retains "Back to [original Challenge]",
   states that the Activity does not contribute to it, and shows no invented
   progress on return.
9. **Given** I successfully save from the Waypoint's recording form,
   **When** the form finishes saving, **Then** the success confirmation is
   brought into view and receives keyboard focus, its valid Challenge return
   is available, and the application stays on the Waypoint until I choose a
   navigation action.

---

### User Story 2 - Understand the Result and What Remains (Priority: P1)

As a user, I can see the Challenge's overall progress and its members' progress
together, understand why an Activity did or did not change the overall percentage,
and identify an incomplete Waypoint to continue.

**Why this priority**: Correct counts must be understandable, including when an
Activity makes partial progress without completing a Waypoint.

**Independent Test**: Compare Dashboard and Challenge details before and after
recording against once-only and count-based members. Include zero, partial,
complete, and empty Challenges.

**Acceptance Scenarios**:

1. **Given** a Challenge with members, **When** I open its details, **Then**
   the summary shows completed and total Waypoints, the completion percentage,
   and an explanation that the percentage measures completed Waypoints.
2. **Given** a two-member Challenge with neither member complete and one
   requiring three Activities, **When** I record its first Activity and return,
   **Then** that member shows "1 of 3 activities", while the summary remains
   0 of 2 complete and 0%; the explanation makes the unchanged percentage clear.
3. **Given** a two-member Challenge with one complete member and a second at
   2 of 3 Activities, **When** I record the third Activity and return, **Then**
   the second member is done and the summary changes from 1 of 2 and 50% to
   2 of 2 and 100%.
4. **Given** an incomplete Challenge, **When** I review it, **Then** its summary
   and an action leading to an incomplete Waypoint appear before optional route
   administration; existing member ordering is retained.
5. **Given** a fully completed Challenge, **When** I open it, **Then** its
   completed state is explicit and it does not offer an action implying that an
   incomplete member remains.
6. **Given** a Challenge without members, **When** I open it, **Then** its
   empty state explains that no Waypoints are linked, without a suggested
   incomplete member, a division error, or a claim of 100% completion.

---

### User Story 3 - Preserve Completion and Award Clarity (Priority: P2)

As a user, I can trust that a saved Activity counts toward completion without
mistaking the absence of an award for the absence of progress.

**Why this priority**: The completed award feature already distinguishes these
concepts. The new journey must preserve that clarity rather than reintroduce
contradictory "Not Started" award wording.

**Independent Test**: Record Activities against Waypoints with and without
applicable awards, then inspect Waypoint details and Dashboard's Recently visited
entries as both an administrator and a viewer.

**Acceptance Scenarios**:

1. **Given** a Waypoint with no award-enabled Challenge membership, **When** I view its
   details or its Recently visited entry, **Then** no award-tier indicator appears;
   completion remains visible.
2. **Given** applicable awards but no recorded award, **When** I view an award
   indicator on those surfaces, **Then** it explicitly identifies the award
   context and says "No award recorded", not an unqualified "Not Started".
3. **Given** a recorded award and partial or completed Waypoint progress,
   **When** I view those surfaces, **Then** the award and completion have
   distinct labels and both agree with the recorded Activities.
4. **Given** a Waypoint with recorded Activities, **When** it appears in
   Recently visited, **Then** its completion is visible rather than an
   unqualified award status being the only progress indicator.

---

### User Story 4 - See When My Corrections Are Valid (Priority: P2)

As an administrator correcting an Activity draft, I can tell that a reported
field error has been resolved before submitting the whole form again.

**Why this priority**: Stale errors make valid input look rejected and undermine
both visual feedback and assistive-technology feedback.

**Independent Test**: Submit invalid Activity drafts, correct each reported
field, and leave that field. Verify visible and accessible errors without
resubmitting, including optional sections and linked-field rules.

**Acceptance Scenarios**:

1. **Given** title and postcode required-field errors after submission, **When**
   I correct the title and leave it, **Then** its error and invalid indication
   clear before another submission; the unresolved postcode error remains.
2. **Given** a reported field error, **When** I change its value but it is still
   invalid and leave the field, **Then** the applicable error remains accurate
   and associated with that field.
3. **Given** a reported error affected by another selection, **When** I change
   that selection and finish the interaction, **Then** the error reflects the
   current applicable requirements rather than the previous selection.
4. **Given** a correction in any supported Activity entry or edit flow,
   **When** the error state changes, **Then** draft values and attachments are
   retained, focus is not unexpectedly moved, and no record is written.
5. **Given** a failed save rather than a field-validation error, **When** I
   correct a field, **Then** the application does not imply that saving succeeded
   or erase the specific save failure as though it were a resolved field error.

---

### User Story 5 - Reach Recording and Save without Unrelated Content (Priority: P3)

As an administrator on mobile or desktop, I can start recording in the relevant
form and reach Save without traversing unrelated Waypoint history or expanded
optional evidence.

**Why this priority**: Reducing vertical travel makes routine recording direct
without removing detailed evidence capabilities.

**Independent Test**: Open Log activity on a Waypoint with a long description
and history, then complete a minimal draft at 360x800 and 1280x800 using pointer
and keyboard interaction.

**Acceptance Scenarios**:

1. **Given** a Waypoint with content extending beyond the viewport, **When** I
   select Log activity, **Then** the editor's first required editable field
   becomes visible and receives focus without manual searching or scrolling.
2. **Given** a minimal new draft with optional evidence collapsed, **When** I
   reach the last applicable required field, **Then** Save is reachable within
   at most one additional viewport-height of vertical scrolling, without
   passing through Waypoint history or expanding optional content.
3. **Given** expanded optional content or an existing Activity with evidence,
   **When** I navigate and save, **Then** the content remains editable, focused
   controls are not obscured, and Save and Cancel remain keyboard-operable.

### Edge Cases

- Shared membership must not cause an arbitrary return destination. A later
  visit from a different Challenge replaces the previous visit's origin.
- If the originating Challenge is deleted, no longer contains the Waypoint, or
  belongs to a different active dataset, it must not be offered as a valid return
  destination. Ordinary Waypoints navigation remains available; missing records
  and failed loads retain their explicit states.
- If the saved Activity is unlinked from the originating Waypoint or reassigned,
  confirmation must describe its actual contribution rather than assume that
  the original Challenge gained progress. Its
  return action must retain "Back to [original Challenge]" while the original
  context remains valid, without switching to another Challenge. If the saved
  Activity has no linked Waypoint in that Challenge, confirmation must state
  that it does not contribute to it. If the new Waypoint is also a member,
  actual derived progress may change; the original Waypoint must not falsely
  appear to have gained an Activity.
- Cancelling or failing to save must not increase progress or show save success.
- Once-only completion, count targets of one, exact targets, and counts above the
  target retain their existing rules and wording; actual counts are not capped.
- Direct Activity-to-Challenge links, awards, and Ideas do not independently
  complete a member Waypoint or increase the Challenge completion percentage.
- Loaded Activity deletions or reassignment must be reflected on return, not
  overridden by an earlier success message.
- Loading or failed loading must not be presented as an empty Challenge or zero
  progress. Production failures must not substitute Demo or stale data.
- Viewers and read-only Demo users need the same browsing, return navigation,
  and progress explanations, but no recording or route-editing controls.
- Long names, wrapped messages, optional sections, and validation corrections
  must remain readable with visible keyboard focus on both target viewport sizes.

## Requirements _(mandatory)_

### Functional Requirements

- **FR-001**: Challenge-to-Waypoint visits MUST retain the originating Challenge
  for that visit and offer a named, one-action return while the origin remains
  valid, including while the Waypoint's recording form or save confirmation is
  shown. Shared membership MUST NOT select a different origin. Activity details
  and editing screens MUST retain their existing navigation; this feature MUST
  NOT extend the Challenge return link into those screens.
- **FR-002**: Successful Waypoint-origin Activity saves MUST retain confirmation
  on the Waypoint and offer a one-action route to the valid originating
  Challenge, labelled "Back to [original Challenge]". This return MUST remain
  available when the saved Activity no longer contributes to that Challenge,
  provided the original context remains valid; confirmation MUST state the
  lack of contribution rather than imply a progress increase. Changing the
  draft's linked Waypoint MUST NOT select a different originating Challenge.
  Success MUST appear only after saving succeeds. On successful completion,
  the confirmation MUST be brought into view and receive keyboard focus,
  without automatic navigation; pending, failed, or cancelled saves MUST NOT
  trigger this success transition.
- **FR-003**: Challenge details MUST offer a visible page-level "Back to
  Dashboard" action that reaches Dashboard in one action on both target viewport
  sizes, without opening the main navigation menu or using browser history.
  Direct or list-origin Waypoint visits MUST retain normal Waypoints navigation
  without inventing Challenge context.
- **FR-004**: New navigation MUST respect pending saves and unsaved-change
  decisions. Invalid origin context MUST NOT link across datasets or to a
  deleted or no-longer-associated Challenge.
- **FR-005**: Challenge details MUST show completed and total Waypoints and
  the same completion percentage as Dashboard for identical loaded data, and
  explain that completion percentage counts completed Waypoints, not Activities.
- **FR-006**: After successful recording and return, member counts, completion,
  aggregate progress, and Dashboard progress MUST reflect the updated loaded
  dataset without manual reload or a separately saved progress value.
- **FR-007**: An incomplete Challenge MUST expose an action to an incomplete
  member alongside its summary, before optional route administration. Existing
  member order MUST remain unchanged; a complete or empty Challenge MUST NOT
  offer a misleading incomplete-member action.
- **FR-008**: Empty, loading, missing-record, and failed-load states MUST remain
  distinct. Empty Challenges MUST NOT be represented as 100% complete.
- **FR-009**: Waypoint details and Dashboard Recently visited MUST distinguish
  completion from awards, omit inapplicable award indicators, and label the
  applicable unrecorded state "No award recorded" in an explicit award context,
  preserving feature 017's existing highest-versus-recorded terminology.
- **FR-010**: Recently visited MUST show Waypoint completion; recorded award
  indicators MUST remain accurate and separately identified. FR-009 and FR-010
  preserve the delivered award behavior rather than introduce new award rules.
- **FR-011**: Across supported Activity creation and editing surfaces, reported
  field errors and accessible invalid indications MUST be updated no later than
  leaving a corrected field or finishing a requirement-changing selection.
  Still-invalid fields MUST retain the applicable error.
- **FR-012**: Correction feedback MUST preserve draft content, attachments,
  and unrelated errors, MUST NOT move focus unexpectedly or write records,
  and MUST NOT clear a save failure as if saving had succeeded.
- **FR-013**: Opening Log activity on a Waypoint MUST bring the first required
  editable field into view and focus. In a minimal draft with optional evidence
  collapsed, Save MUST be within one viewport-height of scrolling after the
  last applicable required field, without intervening Waypoint history.
- **FR-014**: All new navigation, summary, feedback, and recording interactions
  MUST remain readable without horizontal page scrolling, clipped actions,
  overlapping content, or reliance on colour alone at 360x800 and 1280x800.
  Keyboard operation, visible focus, and accessible field errors MUST be retained.
- **FR-015**: Viewers and read-only Demo users MUST receive the same accurate
  progress and return navigation as writable users with identical data, with
  explanatory read-only notices and no write controls or writes.
- **FR-016**: Existing Activity title, UK-date, location, and conditional award
  validation, duplicate-submit protection, failure handling, optional evidence,
  Idea-origin returns, membership rules, completion calculations, and route
  capabilities MUST remain unchanged except for the presentation and correction
  behavior explicitly specified here.
- **FR-017**: Related user guidance MUST describe the Challenge return path,
  completed-Waypoint percentage, award distinction, and revised recording
  feedback consistently.

### Key Entities _(include if feature involves data)_

- **Challenge**: A collection of member Waypoints with aggregate completion
  derived from those members, not directly from its Activity count.
- **Waypoint**: A record that can belong to multiple Challenges and completes
  according to its existing once-only or count-based Activity rule.
- **Activity**: A recorded event contributing to the progress of its linked
  Waypoint, independently of its recorded award.
- **Originating Challenge**: Visit context identifying the Challenge from which
  a Waypoint was opened, not a new membership or persisted Journey record.
- **Activity draft and feedback**: Unsaved values, field errors, and save state;
  correction and navigation must not imply a successful write.

## Success Criteria _(mandatory)_

### Measurable Outcomes

- **SC-001**: In every valid-origin acceptance case, users can return from the
  Waypoint or its save confirmation to the correct named Challenge in one action,
  and then reach Dashboard in one further action through the visible page-level
  action. Both return legs meet this requirement at both target viewport sizes
  without opening the main navigation menu or using browser history.
- **SC-002**: All zero, partial, exact-target, above-target, once-only, shared
  membership, and empty acceptance cases show the correct member and aggregate
  progress. A partial increment and a completion-threshold crossing produce the
  expected distinct results without a manual reload.
- **SC-003**: At both target viewport sizes, users can find overall progress,
  identify an incomplete member when one exists, and open it without first
  traversing route-editing controls or opening every member.
- **SC-004**: No reviewed Waypoint-detail or Recently visited award state
  describes recorded completion as unqualified "Not Started"; all applicable
  recorded awards and "No award recorded" states remain distinguishable from
  completion, preserving feature 017.
- **SC-005**: Every reported-field correction case shows accurate visible and
  accessible validity before another submission, with no lost draft values,
  unexpected focus movement, or writes caused by correction.
- **SC-006**: At 360x800 and 1280x800, opening Log activity exposes and focuses
  the first required editable field; minimal recording meets the one-viewport
  Save-reach criterion and all changed actions are keyboard-accessible.
- **SC-007**: All eight combinations of desktop/mobile, admin/viewer, and
  zero/partial Challenge progress pass the applicable discovery, return, and
  progress-understanding scenarios. Admin cases additionally pass recording;
  viewer cases expose zero write controls and perform zero writes.
- **SC-008**: Every cancelled, pending, failed-save, invalid-origin, and
  read-only acceptance case preserves its explicit outcome without false
  success, invented progress, cross-dataset navigation, or lost draft input.
  Every successful Waypoint-recording acceptance case brings confirmation
  into view and focuses it without automatic navigation.

## Assumptions

- This feature completes the remaining findings from the preceding UX review,
  retaining the already-delivered award improvements as regression coverage;
  it is not a baseline audit or a change to progress arithmetic.
- It builds on [Challenge member progress](../014-challenge-waypoint-progress/spec.md),
  [Activity recording](../015-activity-recording-experience/spec.md),
  [Challenge award levels](../017-challenge-award-levels/spec.md), and the
  existing navigation and responsive UI contracts. It extends the Waypoint's
  browsing and recording navigation without changing Activity details/editing
  navigation or replacing the established Idea-origin save destination.
- Recording remains on the Waypoint after save, with an explicit Challenge
  return action rather than automatic redirection, so users can inspect history
  or record another Activity. Successful saving moves the view and focus to
  the confirmation rather than directly to a navigation button.
- The existing Activity form already collapses empty recorded-GPX, reference,
  and photo sections on new drafts and opens sections containing existing
  content when editing. Preserve that behavior; the remaining recording work
  concerns entry focus, Save reach, and successful-save feedback, not a new
  optional-evidence redesign.
- Selecting a recommended incomplete Waypoint follows existing member ordering;
  no ranking, scheduling, or recommendation system is introduced.
- Visit context need not survive a fresh direct visit or page reload. Such
  visits retain ordinary Waypoints navigation without an inferred origin.
- The UX review reported isolated browser-fixture coverage, not hosted
  authentication or persistence acceptance. Its test-worker timeout remains an
  unverified check, not proof of a product defect or successful acceptance.
- This specification does not authorize schema changes, persisted-data
  migrations, new services, offline state, live-data corrections, deployments,
  or a redesign of unrelated editors. Existing permissions, approved data modes,
  failure boundaries, and shared UI conventions remain constraints.
