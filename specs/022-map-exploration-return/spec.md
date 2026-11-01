# Feature Specification: Resume Map Exploration

**Feature Branch**: `022-map-exploration-return`
**Created**: 2026-11-01
**Status**: Ready for planning
**Input**: [#192](https://github.com/Hsenrab/Journey/issues/192): Resume Map
exploration after opening a Waypoint or Activity.

## User Scenarios & Testing

### User Story 1 - Return to the same geographic exploration (Priority: P1)

As an admin or viewer, I can inspect a Waypoint or Activity and return to my
previous Map exploration without repeating the search or rebuilding my view.

**Why this priority**: This is the feature's central browse/detail/return journey.

**Independent Test**: Open either record type from the Map, then use the
contextual return or browser Back and compare the exploration before and after.

**Acceptance Scenarios**:

1. **Given** a resolved nearby origin, **when** a nearby-list record is opened and
   the user selects **Back to Map**, **then** the entered origin text, resolved
   origin, mode, applicable filters, planned-route choice and geographic framing
   resume without another origin search.
2. **Given** a record opened from a marker popup or cluster-member link, **when**
   the user returns, **then** the same exploration resumes using current records.
   Waypoint popups provide a direct Waypoint action even without Activities.
3. **Given** a mobile List or Map panel, **when** the user opens a record and uses
   browser Back, **then** the previous panel resumes.
4. **Given** two independent Map visits with different searches, **when** the
   user returns to either, **then** its own exploration resumes.

### User Story 2 - Trust the current dataset (Priority: P1)

As a browsing user, I see current results rather than old record copies when
returning after an edit, deletion or dataset transition.

**Why this priority**: Navigation continuity must not misrepresent private data.

**Independent Test**: Change or remove a record while viewing details, then
return; separately switch datasets and attempt to resume the original Map.

**Acceptance Scenarios**:

1. **Given** a record changed within the same dataset, **when** the user returns,
   **then** names, positions, distances, progress and awards reflect current data.
2. **Given** a removed, filtered-out or unplottable selection, **when** the user
   returns, **then** no stale popup or fake marker remains and an explanation is
   available. A removed planned route or recorded track is not drawn from old data.
3. **Given** an accepted dataset change, including changing away and back,
   **when** the original Map is revisited, **then** its old exploration is not
   restored and the reset is explained. Cancelled switches and same-dataset
   reloads do not invalidate the exploration.
4. **Given** loading or failed data access, **when** the user returns, **then**
   loading or the specific failure is shown, not a successful empty map.

### User Story 3 - Keep navigation predictable and accessible (Priority: P2)

As a keyboard or mobile user, I can return without losing my place, existing
record navigation, or the meaning of planned routes and recorded tracks.

**Why this priority**: The return must work without adding another navigation trap.

**Independent Test**: Exercise keyboard return, direct record/track entry,
modified links and read-only browsing at both target widths.

**Acceptance Scenarios**:

1. **Given** a Map-origin detail, **when** its navigation is displayed, **then**
   **Back to Map** is available alongside existing record and Challenge navigation.
   Direct detail entry does not invent a Map origin.
2. **Given** an existing recorded-track deep link, **when** opened directly,
   **then** Activities mode and track framing still apply. Returning from a
   captured exploration instead preserves its framing without an automatic refit.
3. **Given** a return to List, **when** current results are available, **then**
   focus moves once to the originating available result or an absence explanation.
   For Map return, focus goes to the available originating popup action or the
   visible Map panel/explanation. Subsequent updates do not steal focus.
4. **Given** unsaved or pending work, **when** contextual return is activated,
   **then** existing discard confirmation and pending-write protection apply.
   Modified/new-tab links retain ordinary link behavior without a captured session.

### Edge Cases

- Edited origin text is distinct from the last successfully resolved origin.
- Ambiguous origins retain their unchosen choices; no-match and failed searches
  retain distinct feedback. No choice is silently inferred or request retried.
- Dense clusters, long labels, zero nearby results and missing coordinates.
- Activity links within a Waypoint popup retain the Waypoint browsing mode.
- Deleted detail records still permit a valid contextual return.
- Planned routes and recorded tracks can coexist without changing their labels,
  solid/dashed styling or completion/award semantics.
- Refresh, a restarted tab or a new tab ends the live exploration session.

## Requirements

### Functional Requirements

- **FR-001**: Both record types MUST support Map-origin return from nearby lists,
  marker actions and cluster-member links.
- **FR-002**: Return MUST restore entered origin text, last resolved origin,
  unresolved choices/feedback, mode, filters, selected route, available geographic
  framing and mobile panel without another origin lookup.
- **FR-003**: Contextual return and browser Back MUST resume the correct original
  Map visit, not a later visit's exploration.
- **FR-004**: Detail pages MUST retain their existing record/Challenge navigation.
- **FR-005**: Results, selections and overlays MUST resolve from current loaded
  records; navigation MUST NOT retain record or geometry copies.
- **FR-006**: Invalid selections MUST be cleared or explained without fake
  coordinates, stale popups or automatic reframing.
- **FR-007**: Accepted selected/effective dataset changes MUST permanently
  invalidate old exploration, including away-and-back changes.
- **FR-008**: Loading, data failure, search failure, ambiguous search and genuine
  no-results states MUST remain distinct.
- **FR-009**: Direct recorded-track links MUST retain their existing Activities
  mode and framing; valid contextual return MUST not be overridden by route/track fits.
- **FR-010**: Return MUST provide one-shot visible keyboard focus and preserve
  ordinary modified-link behavior.
- **FR-011**: Admin, viewer and read-only Demo browsing MUST support the same
  return journey without navigation-triggered record writes.
- **FR-012**: Existing discard confirmation and pending-write guards MUST remain
  effective; this feature MUST not introduce a new browser-Back draft guard.
- **FR-013**: Captured exploration MUST be limited to the live tab and MUST not
  become a saved preference or survive refresh.

### Key Entities

- **Exploration**: One Map visit's search, display criteria, framing and selection
  identifiers, associated with its dataset and live-session lifetime.
- **Map origin**: The originating Map visit and the record opened from it.
- **Current selection**: A record, planned route or track resolved from the active
  dataset, never from retained entity content.

## Success Criteria

### Measurable Outcomes

- **SC-001**: All six record-type/entry-path combinations resume through both
  contextual return and browser Back without re-entering a resolved origin.
- **SC-002**: All available captured exploration values are retained in unchanged
  datasets; return performs zero additional origin searches or record writes.
- **SC-003**: Every deletion, coordinate/filter change and dataset-transition
  scenario displays current data or explicit absence/reset feedback, never stale data.
- **SC-004**: At 360 by 800 and 1280 by 800, admin/viewer scenarios have accessible
  return links, visible return focus and no horizontal page overflow.
- **SC-005**: Direct detail/track entry, planned-route distinction and existing
  Challenge/Waypoint-list return scenarios retain their established behavior.

## Assumptions

- This is a same-live-tab round trip, matching the existing Waypoint-list return
  lifetime; refresh/shareable/saved explorations are not requested.
- Closed cluster lists need not be recreated verbatim. Return may use a current
  individual-record popup instead; cluster identifiers are not durable selections.
- Geographic framing can only be captured when a Map camera exists. Nearby-list
  navigation before Map readiness must not invent a camera.
- Discovery assumptions in #192 remain hypotheses, not completed user research.
- No provider, storage, permission, radius/filter, route-planning or track-editing
  redesign is requested. #174 and the local coverage timeout remain separate work.
