# Feature Specification: GPX Import and Geometry Baseline

**Feature Branch**: `008-gpx-import-geometry`
**Created**: 2026-10-20
**Status**: Current-state baseline; source-reviewed, not newly runtime-verified
**Input**: Extract the existing shared GPX contract into one feature. Other
baselines reference it rather than repeat parsing, limits, or geometry rules.
This is documentation-only, not a code refactor or feature expansion.

## User Scenarios & Testing _(mandatory)_

### User Story 1 - Import Usable Route or Track Geometry (Priority: P1)

As a user preparing a planned route or recorded track, I can use supported GPX
content without losing its point order or joining unrelated segments.

**Why this priority**: Both uses depend on the same reliable interpretation of a file.
**Independent Test**: Inspect fictional route-only, track-only, mixed, and
multi-segment inputs and their resulting geometry.

**Acceptance Scenarios**:

1. **Given** a GPX document using no namespace or a supported GPX 1.0/1.1 namespace,
   **When** it contains routes or track segments, **Then** supported geometry is
   read in document order, preserving point order within each segment.
2. **Given** multiple routes or track segments, **When** they are imported,
   **Then** each route and each track segment remains separate; no connector
   is invented between them.
3. **Given** route/track points, **When** coordinates are read, **Then** latitude
   and longitude must be decimal numbers within -90 through 90 and -180 through
   180 respectively, including the boundaries.
4. **Given** supported geometry alongside extensions, **When** it is imported,
   **Then** vendor or extension elements do not become route/track points.
5. **Given** a document containing only standalone point markers, or a route/
   segment with fewer than two points, **When** it is imported, **Then** it is
   rejected rather than converted to an invented line.

---

### User Story 2 - Understand Invalid and Over-Limit Input (Priority: P1)

As a user, I receive an explicit rejection when a file cannot be used, rather
than a successful-looking truncated or repaired route.

**Why this priority**: Quietly dropping points or segments misrepresents the route.
**Independent Test**: Review malformed, unsupported, invalid-coordinate, and
boundary-limit inputs, distinguishing parsing limits from attachable geometry.

**Acceptance Scenarios**:

1. **Given** malformed XML, a non-GPX root, an unsupported namespace, or missing
   usable geometry, **When** import is attempted, **Then** it fails explicitly.
2. **Given** missing, non-decimal, or out-of-range coordinates, **When** import
   reaches that point, **Then** the input is rejected, not silently skipped.
3. **Given** file content larger than 5 MiB (5,242,880 bytes), **When** import is
   attempted, **Then** it is rejected. Multibyte text counts toward the byte limit.
4. **Given** more than 50,000 supported route/track points, **When** parsing is
   attempted, **Then** it fails at the parsing ceiling. Passing that ceiling
   alone does not make geometry eligible for attachment.
5. **Given** parsed content, **When** it becomes attachable geometry, **Then**
   it must contain 1 through 100 segments, each with at least two points, and
   no more than 10,000 total points. Larger geometry is rejected without
   simplification, truncation, or chunking.
6. **Given** a document with a DOCTYPE declaration or excessive structural
   complexity, **When** parsing is attempted, **Then** it is rejected explicitly;
   extension text does not bypass the document limits.

---

### User Story 3 - Keep Geometry Portable Without Storing the Original File (Priority: P2)

As a user, I can retain imported route/track geometry in saved records and
portable backups without uploading or preserving the original GPX document.

**Why this priority**: Saved evidence must remain usable across record loading and backups.
**Independent Test**: Review planned-route and recorded-track shapes and existing
backup round trips using fictional geometry.

**Acceptance Scenarios**:

1. **Given** accepted geometry, **When** it is attached to a Challenge,
   **Then** the planned route retains its filename with the geometry.
   The saved filename must be nonempty after trimming and at most 255 characters.
2. **Given** accepted geometry, **When** it is attached to an Activity,
   **Then** only the recorded geometry is retained, not the filename wrapper.
   The Challenge filename rule is not an Activity track metadata requirement.
3. **Given** a saved route or track, **When** it is loaded or included in a
   supported backup, **Then** segment/point order is retained without embedding
   the raw XML or importing unrelated original-file metadata.
4. **Given** a record without a route/track, **When** it is validated or backed up,
   **Then** GPX remains optional and no geometry is invented.
5. **Given** either kind of attachment, **When** it is imported or stored,
   **Then** it does not itself create an Activity, change Idea usage, or count
   as Waypoint completion.

### Edge Cases

- Route and track content can coexist; supported children must use the root's
  namespace, not merely matching local element names.
- Every included route/segment must be usable; a valid segment does not excuse
  another invalid or empty one.
- Supported coordinates are read as supplied; elevation, timestamps, styling,
  and other original-file metadata are not retained as recorded geometry.
- File parsing and saved geometry have different ceilings. A file below the
  parsing point ceiling can still be too large to attach in either workflow.
- Successful file reading does not certify a Challenge filename for persistence;
  that requirement is enforced by saved-record validation.
- An Activity track can exist without a planned Challenge route and vice versa.
- No GPX file export, route generation, geometry editing, simplification, or bulk
  import is provided by this baseline. Portable dataset export is not GPX export.

## Requirements _(mandatory)_

### Functional Requirements

- **FR-001**: GPX import MUST accept supported route and track content from the
  existing no-namespace/GPX 1.0/GPX 1.1 forms and reject unsupported documents.
- **FR-002**: Import MUST preserve document, segment, and point ordering without
  connecting separate routes/segments or treating extension points as geometry.
- **FR-003**: Included segments MUST contain at least two valid decimal-coordinate
  points; invalid/missing coordinates or unusable geometry MUST be explicit failures.
- **FR-004**: The file-byte and parsing-point ceilings MUST be enforced independently
  from the stricter attachable-geometry limits stated in User Story 2.
- **FR-005**: Saved and attachable geometry MUST obey the segment/point bounds
  without silent reduction, repair, or partial import.
- **FR-006**: DOCTYPE and structurally excessive documents MUST be rejected with
  explicit errors, not recovered as successful geometry.
- **FR-007**: Planned routes MUST retain a valid filename and geometry; Activity
  tracks MUST retain geometry without adopting planned-route filename metadata.
- **FR-008**: Record loading and supported backups MUST preserve validated geometry
  without storing raw GPX or claiming lossless preservation of original metadata.
- **FR-009**: Geometry MUST remain optional and separate from Activity existence,
  Idea usage, and Waypoint completion.
- **FR-010**: Consuming features MUST use this shared contract for file acceptance
  and geometry; their own save/cancel/selection workflows remain separately specified.

### Key Entities

- **GPX input**: A route/track document selected for interpretation, not a stored file attachment.
- **Segmented geometry**: Ordered lines of coordinate pairs, retaining separate
  route/track-segment boundaries.
- **Planned route**: Geometry plus a valid source filename on a Challenge.
- **Recorded track**: Geometry on an Activity, independent of planned-route metadata.

## Success Criteria _(mandatory)_

### Measurable Outcomes

- **SC-001**: Route-only, track-only, and mixed fixtures retain every accepted
  point in its original segment/order, with zero invented inter-segment connections.
- **SC-002**: Documented file, point, segment, coordinate, and filename boundaries
  each have an explicit allowed/rejected outcome and existing evidence or a stated gap.
- **SC-003**: Both attachment types retain their defined data through a supported
  backup round trip without raw GPX, while GPX-free records remain valid.
- **SC-004**: Shared acceptance and geometry rules have one authoritative baseline;
  Challenges, Activities, Map, and persistence reference it rather than duplicate limits.
- **SC-005**: Every requirement has source-grounded evidence with execution status;
  written tests do not imply freshly passed runtime or hosted acceptance.

## Assumptions

- [Challenges](../004-challenge-progress/spec.md) owns planned-route attachment,
  preview, save, cancellation, replacement, and removal.
- [Activities](../006-activity-recording/spec.md) owns recorded-track attachment,
  save, cancellation, replacement, removal, and stale file-read handling.
- [Map](../007-map-browsing/spec.md) owns display styles, visibility, selection,
  framing, and navigation; this feature owns geometry interpretation, not map UX.
- [Persistence](../002-data-modes-persistence/spec.md) owns dataset loading and
  backup operations; [access](../001-access-roles/spec.md) owns permissions.
- This extraction records existing behaviour. No code change, new tests,
  migration, deployment, GPX processing of personal data, or hosted mutation is authorized.
