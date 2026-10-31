# Feature Specification: Return to Waypoint Discovery Results

**Feature Branch**: `020-waypoint-discovery-return`

**Created**: 2026-10-28

**Status**: Clarified; ready for planning

**Input**: User description: "Return from a Waypoint to the same discovery
results, preserving the existing shortlist and the user's place."
Source: [GitHub issue #194](https://github.com/Hsenrab/Journey/issues/194).

## Clarifications

### Session 2026-10-28

- Q: Should the shortlist also survive refreshing the browser while you are on
  the list or a Waypoint? → A: No. Preserve it only during the live list/detail
  journey; refresh resets the captured return context.
- Q: When you return to the list, should keyboard focus move back to the Waypoint
  you opened? → A: Yes. Bring its link into view and focus it; if the Waypoint is
  gone or no longer matches, focus the explanation instead.
- Q: If you switch datasets while viewing a Waypoint, should returning to
  Waypoints start with a completely fresh list? → A: Yes. Clear all previous
  discovery criteria, Challenge scope and selection, use the initial Name sort,
  and do not revive the old shortlist if switching back.

## User Scenarios & Testing _(mandatory)_

### User Story 1 - Resume the Same Shortlist (Priority: P1)

As an admin or viewer comparing Waypoints, I want to open a result and return
to the same discovery criteria, so I can compare destinations without rebuilding
my shortlist.

**Why this priority**: Losing search and filters breaks the core comparison journey.

**Independent Test**: Set search, Area, Category, sort and applicable highest-award
filtering in a Challenge-scoped list. Open a result and return using the explicit
list return, then repeat using browser Back. Check every control, scope and
result order without re-entering any criteria.

**Acceptance Scenarios**:

1. **Given** a list with search, Area, Category, sort and applicable highest-award
   filtering, **When** the user opens a result and uses the explicit list return,
   **Then** all criteria and the originating Challenge scope are restored, and
   results reflect the current dataset under the same ordering rules.
2. **Given** the same journey, **When** the user uses browser Back instead,
   **Then** the same discovery criteria and Challenge scope are restored.
3. **Given** restored secondary filters, **When** the user inspects their active
   count and chooses Clear filters, **Then** the count is correct, filtering
   criteria clear, and the chosen sort and intentional Challenge scope remain.
4. **Given** the user has returned to the list, **When** they open another
   result and return again, **Then** the current shortlist remains usable without
   criteria from another navigation origin replacing it.

---

### User Story 2 - Resume in the Right Place with Current Data (Priority: P2)

As someone returning from a Waypoint, I want to recognize where I left the list
and see current results, without mistaking an old record or position for current
information.

**Why this priority**: Remembered controls alone do not help if the user loses
their place or sees stale results after a change.

**Independent Test**: Open a result below the initial visible list, return, and
check visible return context. Repeat after changing or deleting that Waypoint
and after switching dataset.

**Acceptance Scenarios**:

1. **Given** the opened Waypoint still matches, **When** the user returns,
   **Then** the previously opened result's link is brought into view and receives
   visible keyboard focus, even if its position in the list has changed.
2. **Given** the opened Waypoint has changed, **When** the user returns,
   **Then** filtering, completion, award summaries and ordering use current
   records rather than a remembered copy of the results.
3. **Given** the opened Waypoint was deleted or no longer matches, **When** the
   user returns, **Then** criteria remain, the missing result is not reinserted,
   and an explanation of its absence receives focus instead.
4. **Given** the active dataset changes while the user is away from the list,
   **When** they return, **Then** a fresh list uses empty search, no filters or
   Challenge scope, the initial Name sort and no selected result. Switching
   back to the previous dataset does not revive its former shortlist.
5. **Given** a restored filter or Challenge scope is invalid for the current
   dataset, **When** the list is shown, **Then** the scope error is explicit
   rather than silently showing unfiltered results or an empty success state.

---

### User Story 3 - Browse Without Editing or an Invented Origin (Priority: P2)

As a viewer, Demo local user, or someone opening a Waypoint directly, I want
navigation that fits how I arrived, without requiring edit access or inventing
a previous shortlist.

**Why this priority**: Read-only access and other established journeys must work.

**Independent Test**: Exercise list/detail return as admin and viewer at
360 by 800 and 1280 by 800, using keyboard navigation. Also open a Waypoint
directly and from the existing Challenge and Idea journeys.

**Acceptance Scenarios**:

1. **Given** a viewer or Demo local user follows a list result, **When** they
   return, **Then** discovery criteria and return context work without enabling
   writes or presenting new edit actions.
2. **Given** direct Waypoint entry without a list origin, **When** the user
   chooses the Waypoints return, **Then** they reach the normal Waypoints list
   without an unrelated remembered shortlist or selected result.
3. **Given** a Waypoint was reached through an existing Challenge or Idea
   journey, **When** its navigation is used, **Then** existing origin-specific
   behavior remains and no list origin is fabricated.
4. **Given** an unsaved Waypoint or Activity draft, **When** the user attempts
   the list return, **Then** existing draft protection remains effective;
   this feature does not introduce a second discard-confirmation flow.

### Edge Cases

- Search is empty; all filters are clear; sort differs from the initial sort.
- Area or Category values include spaces, punctuation or non-ASCII names.
- Duplicate Waypoint titles identify different records.
- No matching results differs from an empty dataset and from a failed load.
- An ordinary Challenge has no applicable award controls; an award-enabled
  Challenge retains its existing highest-award semantics.
- Unvisited, partly complete and complete Waypoints retain once-only and
  count-based completion behavior.
- An Activity changes completion, highest award or last-Activity ordering
  while the user is on detail.
- A Waypoint is renamed, changes Area or Category, leaves the originating
  Challenge, or is deleted before return.
- The originating Challenge is deleted or its award configuration changes.
- Changing data mode, including Demo Cosmos visibly using Demo local data,
  invalidates the entire previous discovery context. Switching back must not
  revive it, even if a Waypoint has the same identity in both datasets.
- A load failure or invalid Challenge/award scope takes precedence over a
  missing-result explanation; missing results are assessed only after a
  successful load with valid scope.
- Direct entry and other navigation origins have no invented list history.
- Refreshing either page ends the captured list origin; it does not restore a
  pre-refresh shortlist or selected result. Existing explicitly supplied
  Challenge and highest-award scope still follow their normal behavior.
- Long labels, expanded secondary filters and a result below the first screen
  must not make return controls or visible focus unusable.

## Requirements _(mandatory)_

### Functional Requirements

- **FR-001**: The list/detail round trip MUST preserve search text, Area,
  Category, chosen sort, applicable highest-award filtering and Challenge scope.
  Their filtering and ordering meanings MUST remain unchanged. Preservation
  applies to the uninterrupted same-tab journey only; refreshing either page
  MUST end the captured list origin rather than restore its shortlist or
  selected result. Existing explicit Challenge and highest-award scope behavior
  remains unchanged.
- **FR-002**: A Waypoint opened from a discovery result MUST provide an explicit
  return to that originating list with its criteria. The action MUST identify
  that it returns to the list rather than another navigation origin.
- **FR-003**: Browser Back from that detail MUST support the same discovery
  criteria and return context as the explicit list return.
- **FR-004**: If the previously opened Waypoint still matches, returning MUST
  bring its link into view and give it visible keyboard focus, using record
  identity rather than its title or former list position. Exact restoration of
  the old scroll offset is not required.
- **FR-005**: Restored results MUST derive from current loaded records, not
  stored result copies. A changed or deleted result MUST NOT be reinserted to
  preserve an old position. After loading succeeds and scope is valid, if the
  previous result is absent, the list MUST
  explain that it no longer matches or is no longer available and retain the
  discovery criteria. That explanation MUST receive focus instead of attempting
  to focus a missing result.
- **FR-006**: A dataset change MUST invalidate the old dataset's discovery origin
  and selected-result context. Returning MUST start a fresh list with empty
  search, no Area, Category or highest-award filtering, no Challenge scope,
  initial Name sort and no previous selection. Switching back MUST NOT revive
  the old context. This reset applies to the captured origin after a dataset
  change, not to unrelated explicitly supplied invalid scopes, which remain
  errors under FR-008.
- **FR-007**: The secondary-filter active count MUST match restored criteria.
  Clear filters MUST clear search, Area, Category and highest-award filtering
  without clearing the intentional Challenge scope or changing the chosen sort.
- **FR-008**: Invalid Challenge or award scope MUST remain an explicit error.
  Loading, load failure, an empty dataset and no matching results MUST be
  distinguishable; none may masquerade as another state.
- **FR-009**: Direct Waypoint entry without a valid list origin MUST retain a
  normal Waypoints return, without borrowing an unrelated shortlist. Existing
  Challenge, Idea and Map navigation behavior MUST NOT be overwritten.
- **FR-010**: Admins, viewers and Demo local users MUST be able to browse and
  return without record mutations. Existing authorization, read-only notices,
  Activity recording and draft protection MUST remain unchanged.
- **FR-011**: At 360 by 800 and 1280 by 800, the journey MUST work with keyboard
  navigation, visible focus, accessible return-action names and no horizontal
  page overflow. At the initial desktop list entry, primary list content MUST
  be visible without scrolling; deliberate restoration to a later result may
  scroll the page to that result.
- **FR-012**: This feature MUST NOT introduce filters, saved searches, remembered
  defaults for unrelated future visits, new sort semantics, changed completion
  or award rules, new data services, record caches, offline behavior, roles,
  stored entity changes or migrations.

### Key Entities _(include if feature involves data)_

- **Discovery criteria**: Existing search text, Area, Category, sort,
  highest-award filter and optional Challenge scope.
- **List origin**: The particular discovery journey and its dataset identity,
  associated criteria and previously opened Waypoint identity. This is
  navigation context, not a saved search or a copy of dataset records.
- **Current result set**: Waypoints matching those criteria in the current
  loaded dataset under the existing ordering rules.

## Success Criteria _(mandatory)_

### Measurable Outcomes

- **SC-001**: Every applicable discovery criterion and Challenge scope is
  identical before and after each unchanged-data round trip, through both
  explicit return and browser Back, with zero criteria re-entered.
- **SC-002**: One explicit return action resumes the originating list. Every
  still-matching selected Waypoint's link is brought into view and visibly
  focused; every absent selected Waypoint produces a focused explanation
  without a stale result.
- **SC-003**: All changed-record, deleted-record, no-match, invalid-scope and
  dataset-change scenarios display current results or the appropriate explicit
  state, with zero copied records restored as current data.
- **SC-004**: All four admin/viewer and mobile/desktop combinations complete
  the round trip with visible keyboard context and no horizontal overflow;
  Demo local browsing remains read-only.
- **SC-005**: Browsing and returning cause zero record writes and preserve
  existing completion, award, recording, draft-protection and other-origin
  navigation behavior in their directly affected regression checks.

## Assumptions

- Existing authenticated access, admin/viewer roles, data modes, filtering
  semantics and domain rules remain the product contract.
- Scope is the live originating discovery journey. Refreshing ends its captured
  return context; a new tab or unrelated later visit does not inherit it.
- Current results may legitimately differ after edits or Activity recording;
  preserving criteria does not mean freezing result membership or ordering.
- No list-size, user-frequency or measured friction claim is inferred from
  the source review. Validation will use fictional data and enough results to
  exercise returning below the initial screen.
- The discovery-return work is independent of Map-origin restoration (#192),
  Activity-history search (#189) and the separate Activity save defect (#174).
  Existing Challenge return behavior from feature 016 and award behavior from
  feature 017 remain in scope only as regression constraints.
- The current source confirms locally initialized search, Area, Category and
  sort, and a bare Waypoints detail breadcrumb. This specification is a target
  contract, not evidence that the new behavior is implemented or browser-tested.
