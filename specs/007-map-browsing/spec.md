# Feature Specification: Map Browsing Baseline

**Feature Branch**: `007-map-browsing`
**Created**: 2026-10-20
**Status**: Current-state baseline; source-reviewed, not newly runtime-verified
**Input**: Document the existing Waypoint/Activity map, filters, nearby origin,
popups, planned routes, and recorded tracks without introducing new map capabilities.

## User Scenarios & Testing _(mandatory)_

### User Story 1 - Explore Located Records (Priority: P1)

As an invited user, I can explore saved Waypoints or Activities geographically
and navigate to their records without changing them.

**Why this priority**: Geographic browsing is the map's central purpose.
**Independent Test**: Review fictional located/unlocated records, marker groups,
mode changes, and detail navigation.

**Acceptance Scenarios**:

1. **Given** loaded data, **When** I open Map normally, **Then** Waypoints is the
   initial mode. Switching to Activities shows Activity markers instead of
   Waypoint markers, not a simultaneous combination of both point layers.
2. **Given** records with complete saved coordinates, **When** their mode is
   active, **Then** markers are displayed; records without a coordinate pair
   are omitted with explicit dataset-wide missing-coordinate counts.
3. **Given** Waypoint markers, **When** I inspect completion styling, **Then**
   it reflects the Waypoint's once/count rule, separately from its highest award tier.
4. **Given** a Waypoint marker, **When** I select it, **Then** its popup identifies
   the Waypoint and lists linked Activities with detail navigation, or explains
   that it has no recorded Activities.
5. **Given** an Activity marker, **When** I select it, **Then** its popup shows
   the Activity's name or Unnamed activity, award or Uncategorised, linked Waypoint
   or no-link context, and an Activity detail link.
6. **Given** a marker cluster, **When** I activate it, **Then** it lists up to 25
   identifiable members with detail links and a zoom-in instruction if more exist.
   A stale cluster lookup cannot replace a newer marker selection.
7. **Given** a small screen, **When** Map opens, **Then** the map panel appears
   first and a Map/List switch exposes either panel; larger screens show map and
   nearby list together. Map height adapts to the available viewport.

### User Story 2 - Find Nearby Records With Independent Filters (Priority: P1)

As a user, I can choose a geographic origin and find the nearest saved records,
while separating activity progress from award tiers.

**Why this priority**: Nearby discovery helps choose destinations without altering records.
**Independent Test**: Review no/one/many origin matches, combined filters, and distance ordering.

**Acceptance Scenarios**:

1. **Given** a postcode/place search, **When** it yields one coordinate-bearing
   match, **Then** that match becomes the nearby origin. Multiple matches require
   explicit selection; no matches produce an explicit error without resetting filters.
2. **Given** a chosen origin, **When** Waypoints is active, **Then** the list shows
   up to ten nearest coordinate-bearing Waypoints matching current filters,
   sorted by straight-line distance in miles with title breaking distance ties.
3. **Given** Activities mode and an origin, **When** the list is calculated,
   **Then** it shows up to ten nearest located Activities, using date to break
   distance ties, without applying Waypoint progress/medal filters.
4. **Given** Waypoint progress filters, **When** I choose Started or Not Started,
   **Then** Started means at least one directly linked Activity, not completed;
   Not Started means no linked Activities, irrespective of awards.
5. **Given** a medal choice, **When** I combine it with progress, **Then** only
   Waypoints whose highest award equals Bronze/Silver/Gold match; All independently
   clears each filter.
6. **Given** no chosen origin, **When** I inspect the list, **Then** it asks for
   an origin instead of treating the map's initial center as my selected search.
   A located-record list with no matches is a separate outcome.

### User Story 3 - View Planned Routes and Historical Tracks (Priority: P2)

As a user, I can view saved planned routes and recorded tracks without turning a
planned route into activity evidence.

**Why this priority**: Geometry adds geographic context but must preserve planning/history boundaries.
**Independent Test**: Review saved segmented routes, recorded tracks, a selected
Activity deep link, and geometry crossing the longitude boundary.

**Acceptance Scenarios**:

1. **Given** saved Challenge routes, **When** I open Map, **Then** they are drawn
   with planned-route styling and named route controls. Selecting a route frames
   its geometry without mutating it.
2. **Given** Activities mode without a specific Activity selection, **When**
   recorded tracks exist, **Then** they are drawn as historical tracks,
   distinct from planned routes. Waypoints mode hides recorded Activity tracks.
3. **Given** a recorded-track detail link, **When** Map opens with that Activity
   selected, **Then** Activities mode is initial, recorded-track geometry is
   limited to that Activity, the camera frames it, and a status identifies it.
   The selection does not filter every Activity marker or the nearby Activity list.
4. **Given** geometry conforming to the
   [GPX feature](../008-gpx-import-geometry/spec.md) and crossing the longitude
   boundary, **When** a route or track is framed, **Then** framing uses the short
   geographic extent rather than spanning most of the world.
5. **Given** missing/removed track geometry, **When** the selected Activity has
   no track, **Then** it is not advertised as having a displayed recorded track.

### User Story 4 - Recognize Unavailable Map Services (Priority: P2)

As a user, I can distinguish loading and service errors from a genuinely empty map.

**Why this priority**: Missing data or service access must not look like a successful empty result.
**Independent Test**: Inspect pending data/token, invalid service content, rejected search,
and missing endpoint responses without changing hosted resources.

**Acceptance Scenarios**:

1. **Given** data is loading or failed, **When** Map renders, **Then** it shows
   a loading/failure explanation rather than normal empty-map controls.
2. **Given** data loaded but rendering access is pending, **When** the map is
   not ready, **Then** a Loading map indicator is visible.
3. **Given** rendering/search service failure, missing endpoint, or non-JSON
   response, **When** it is encountered, **Then** an explicit error is surfaced,
   not a fabricated token, alternate map, successful empty search, or retry loop.
4. **Given** valid administrator or viewer access, **When** protected map services
   are requested, **Then** both roles may browse; invalid identities are rejected.

### Edge Cases

- Nearby search is origin lookup, not routing, travel-time estimation, or automatic
  current-device location. Search does not update saved record coordinates.
- Search accepts trimmed text of 2 through 200 characters at the service boundary.
- Distances use saved coordinates and are displayed to one decimal place in miles.
- Started is not Complete: a count-target Waypoint with one Activity may be started
  but incomplete, even with a Gold award.
- Unnamed Activity map labels remain Unnamed activity; unlike the Activity log,
  the date is not promoted to the primary map label.
- Missing-coordinate notices do not imply that the current form save path can
  repair coordinates; the known geocoding defect is separately linked.
- Map browsing has no record editor, location dragging, new-provider fallback, or
  background geocoding.
- Demo local records still require the protected rendering/search service for the
  interactive map; bundled records do not make the map an offline feature.

## Requirements _(mandatory)_

### Functional Requirements

- **FR-001**: The map MUST provide exclusive Waypoint/Activity point modes using
  saved coordinate pairs, defaulting to Waypoints except for Activity deep links.
- **FR-002**: Unlocated records MUST be omitted with explicit counts, not silently
  geocoded or silently represented by invented locations.
- **FR-003**: Waypoint completion styling MUST use once/count rules independently
  from award tiers and Started/Not Started filters.
- **FR-004**: Marker/cluster popups MUST identify records and provide detail
  navigation, limit cluster lists to 25, and ignore stale cluster responses after
  newer marker selection.
- **FR-005**: Nearby origin search MUST distinguish zero, one, and multiple matches,
  require explicit ambiguous-result selection, and preserve independent filters.
- **FR-006**: Nearby lists MUST show at most ten located records in ascending
  distance order, apply Waypoint filters only to Waypoints, and require a chosen origin.
- **FR-007**: Waypoint progress and exact highest-medal filters MUST combine, with
  independent All choices and no award requirement for Started.
- **FR-008**: Planned routes and recorded tracks conforming to the
  [shared GPX contract](../008-gpx-import-geometry/spec.md) MUST have distinguishable
  styles; selection MUST frame relevant geometry without changing records.
- **FR-009**: An Activity deep link MUST select Activities mode and that track,
  without implicitly filtering all Activity points or nearby results.
- **FR-010**: Small screens MUST offer Map/List selection with Map initially shown,
  while available viewport space determines map height.
- **FR-011**: Data-loading, rendering-loading, failure, no-origin, and no-results
  outcomes MUST be distinguishable; service failures MUST NOT be disguised as success.
- **FR-012**: Map rendering/search MUST use the existing protected service boundary
  for both invited roles, without record writes, new providers, or offline fallback.

### Key Entities

- **Located record**: An existing Waypoint or Activity with a saved coordinate pair.
- **Nearby origin**: A user-chosen search result used for session distance ordering,
  not a persisted Waypoint or device location.
- **Selection**: A marker, route, or Activity-track focus, not a record edit.
- **Geometry**: Route/track attachments defined by the
  [GPX feature](../008-gpx-import-geometry/spec.md), consumed here for map display.

## Success Criteria _(mandatory)_

### Measurable Outcomes

- **SC-001**: Both point modes show only their eligible located records; omitted
  coordinate counts and empty/loading/failure cases have explicit explanations.
- **SC-002**: Every combination of three progress and four medal choices has a
  deterministic Waypoint outcome without changing Activity-mode results.
- **SC-003**: Zero/one/many origin results lead to explicit error, automatic sole
  selection, or manual selection; nearby output never exceeds ten records per mode.
- **SC-004**: Planned routes, all-track Activity mode, and selected-track deep links
  preserve the documented display scope and short-boundary framing while consuming
  geometry under the shared GPX contract.
- **SC-005**: Every requirement is source-mapped with validation gaps stated;
  no simulated rendering test is presented as proof of live hosted map availability.

## Assumptions

- [Access](../001-access-roles/spec.md) and
  [data modes](../002-data-modes-persistence/spec.md) determine the active records.
- [Challenges](../004-challenge-progress/spec.md) owns planned-route changes;
  [Activities](../006-activity-recording/spec.md) owns recorded-track changes.
- [GPX](../008-gpx-import-geometry/spec.md) owns shared import/geometry rules;
  this feature owns route/track display, visibility, selection, and framing.
- Service provisioning and geocoding defects are existing dependencies, not
  permission to change deployment or adopt another provider.
- This documents existing browsing only. No application changes, new tests,
  hosted checks, deployment, record migration, or location repair is authorized.
