# Feature Specification: Data Modes and Persistence Baseline

**Feature Branch**: `002-data-modes-persistence`

**Created**: 2026-10-20

**Status**: Existing-behaviour baseline drafted; source review complete; acceptance not newly executed

**Input**: Document existing data modes, persistence boundaries, loading/failure
behaviour, and export/restore/clear. Baseline creation is documentation-only.
Log defects separately; do not repair code, tests, or deployment configuration.

## User Scenarios & Testing _(mandatory)_

### User Story 1 - Know Which Dataset Is Active (Priority: P1)

As an invited user, I can choose between real shared records, shared demonstration
records, and bundled demonstration records without confusing or overwriting them.

**Why this priority**: Every browsing, backup, and editing action depends on knowing
which records it affects.

**Independent Test**: With approved demonstration data, select each mode and inspect
the selected mode, displayed dataset, access status, and startup preference.

**Acceptance Scenarios**:

1. **Given** no valid saved choice, **When** the application starts, **Then**
   a production deployment selects Production data and a test deployment selects
   Demo Cosmos.
2. **Given** a saved Production selection on a test deployment, **When** a new
   application session starts, **Then** Demo Cosmos is selected instead. Other
   valid saved selections are retained.
3. **Given** a user selects another mode in Settings, **When** its load completes,
   **Then** the displayed dataset and status correspond to that mode without
   copying, merging, clearing, or overwriting another dataset.
4. **Given** Demo local is selected, **When** it loads, **Then** bundled fictional
   records are available and editing remains unavailable to every user.
5. **Given** overlapping dataset loads, **When** an older load completes after
   a newer load has begun, **Then** the older result cannot replace the newer load.

---

### User Story 2 - Recognize Unavailable Data Without Unsafe Recovery (Priority: P1)

As a user, I can distinguish a successful load from loading, failure, and a
demonstration fallback, so I do not edit or back up an unavailable real dataset.

**Why this priority**: An apparently successful empty or substituted real dataset
could mislead users or cause data loss.

**Independent Test**: Inspect controlled load outcomes for both shared modes,
including initial failure, failed refresh, and an in-progress load.

**Acceptance Scenarios**:

1. **Given** a selected dataset is loading, **When** the user opens editing or
   backup controls, **Then** mutations and export are unavailable until a load
   succeeds.
2. **Given** Demo Cosmos cannot load, **When** the failure is handled, **Then**
   bundled Demo local records are shown with an explicit failure/fallback warning,
   the selected mode remains Demo Cosmos, and writes are blocked.
3. **Given** Production cannot load, **When** the failure is handled, **Then**
   an explicit error is shown, writes and export are blocked, and demonstration
   records are not substituted as a successful Production dataset.
4. **Given** Production loaded earlier and a later refresh fails, **When** that
   failure is displayed, **Then** previously held records may remain in memory,
   but the load is failed and those records cannot be written or exported as a
   currently loaded dataset.
5. **Given** the user explicitly reloads an available shared dataset, **When**
   that load succeeds, **Then** the loaded records and access status are refreshed.
   No offline synchronization or automatic retry is implied.

---

### User Story 3 - Keep Shared Changes Within the Active Dataset (Priority: P1)

As an administrator, my successful changes persist to the active shared dataset,
while viewers can browse without acquiring write access.

**Why this priority**: Real and demonstration records must remain separate, and
changing a data mode must never bypass access or availability restrictions.

**Independent Test**: Review isolated fixture-based save results for each shared
mode, permission, and failure state; never mutate real hosted data for baseline work.

**Acceptance Scenarios**:

1. **Given** an administrator has loaded Production or Demo Cosmos, **When**
   a valid change succeeds, **Then** it affects only that shared dataset and is
   reflected in the current session.
2. **Given** a viewer selects either shared mode, **When** its records load,
   **Then** browsing is available but record changes, restore, and clear remain
   unavailable, including direct calls outside the normal controls.
3. **Given** a conflicting change, invalid data, or an unsupported operation size,
   **When** persistence rejects the action, **Then** the action is reported as
   failed rather than silently retried, partially applied, or treated as saved.
4. **Given** real shared data is used in an ordinary application session, **When**
   records are read or changed, **Then** no browser-persisted record cache,
   offline edit queue, or legacy-record migration is created.
5. **Given** shared demonstration records were edited, **When** infrastructure
   is redeployed with demonstration seeding, **Then** those records are reset
   from the bundled fixture; ordinary browsing and mode switching do not reseed.

---

### User Story 4 - Back Up, Restore, and Clear Deliberately (Priority: P2)

As a user, I can export the dataset actually loaded. As an administrator, I can
restore a validated backup into an empty writable dataset or explicitly clear
that dataset without changing another one.

**Why this priority**: Portable backups and destructive actions must have explicit,
predictable boundaries.

**Independent Test**: Use fictional backups and isolated empty/nonempty datasets
to inspect export, import rejection, confirmation, and failure outcomes.

**Acceptance Scenarios**:

1. **Given** a successfully loaded dataset, including local demonstration fallback,
   **When** an administrator or viewer exports it, **Then** the backup contains
   that active dataset, a format version, and an export timestamp. Export does
   not modify stored records or combine datasets.
2. **Given** a supported backup and an empty writable shared dataset, **When**
   an administrator restores it, **Then** complete data and relationship validation
   occurs before writing, and only the active dataset receives the records.
3. **Given** a nonempty shared dataset or an invalid/incompatible backup, **When**
   restore is attempted, **Then** it is rejected without clearing or overwriting
   existing records. No automatic migration or merge occurs.
4. **Given** a writable dataset, **When** clear is cancelled, **Then** nothing
   is deleted. **When** clear is explicitly confirmed and succeeds, **Then** all
   records in that dataset are removed and other datasets remain unchanged.
5. **Given** restore or clear fails, **When** the result is displayed, **Then**
   a failure is shown, not a success message; a failed clear leaves its confirmation
   available rather than implying completion.

### Edge Cases

- Missing or unrecognized saved mode uses the deployment default; an unsupported
  deployment default is an explicit configuration error, not a new data mode.
- Demo local has no remote persistence and cannot acquire write access from a role.
- Fallback warning takes precedence over viewer/local status; Settings shows the
  dataset actually used for export, not an unavailable shared source.
- Retained in-memory records after a failed Production refresh are not a successful
  load, an offline mode, or an authorized stale backup.
- Unsupported backup versions, malformed records, invalid relationships, and
  incompatible files must be rejected before a restore writes records.
- Existing atomic dataset changes support at most 100 record operations per change;
  greater changes fail explicitly. This is an operation count, not a file-size or
  supported dataset-size promise; chunking is outside scope.
- Unsaved editor drafts across mode switches and simultaneous mode switches during
  saves are not newly specified as safe. Their behaviour needs separate evidence
  before any stronger guarantee is made.

## Requirements _(mandatory)_

### Functional Requirements

- **FR-001**: The system MUST expose exactly Demo local, Demo Cosmos, and Production
  data as user-selectable modes in Settings.
- **FR-002**: Startup MUST retain valid preferences except that a saved Production
  preference is overridden by the test deployment's Demo Cosmos default.
  Missing/unknown preferences MUST use the configured default.
- **FR-003**: Mode selection MUST reload the selected source without transferring
  or mutating records in another dataset, and MUST distinguish selected and active
  sources when demonstration fallback occurs.
- **FR-004**: An older load MUST NOT replace the result of a newer begun load.
- **FR-005**: Loading MUST block writes and export; successful shared loads MUST
  establish current records and the user's access status.
- **FR-006**: Demo local MUST always be read-only and MUST use bundled fictional
  records rather than real user records.
- **FR-007**: Demo Cosmos load failure MUST visibly activate read-only Demo local
  fallback without presenting it as successfully loaded shared data.
- **FR-008**: Production load failure MUST show an error and block writes/export;
  it MUST NOT substitute demonstration records or treat retained memory as a
  successfully refreshed dataset.
- **FR-009**: Only administrators with a loaded writable shared dataset MAY
  modify records. Mode selection MUST NOT elevate viewer permissions.
- **FR-010**: Successful shared changes MUST persist only within the active shared
  dataset; failed changes MUST NOT be presented as saved or queued for offline use.
- **FR-011**: Ordinary application sessions MUST NOT persist real records in the
  browser, synchronize offline edits, migrate, or delete legacy browser records.
  Saving the mode preference is permitted.
- **FR-012**: Export MUST use only the active loaded records and include the
  supported backup version and export timestamp. It MUST be available without
  write permission, including for loaded local demonstration records.
- **FR-013**: Restore MUST require a loaded, writable, empty shared dataset and
  complete supported-format and relationship validation before any write.
  Invalid/incompatible imports MUST leave existing records unchanged.
- **FR-014**: Clear MUST require explicit confirmation and affect only the active
  writable dataset. Cancellation MUST leave records unchanged.
- **FR-015**: Conflicts, restore failures, clear failures, and operations over the
  supported atomic-change limit MUST remain explicit failures; no silent merge,
  retry, partial-success fallback, or migration is permitted.
- **FR-016**: Shared demonstration data MUST be reseeded on infrastructure
  redeployment; Production records MUST NOT be seeded or reset by that operation.

### Key Entities _(include if feature involves data)_

- **Mode preference**: The user's selected source, subject to deployment startup
  rules; not a copy of the records.
- **Active dataset**: The records actually loaded, distinct from the requested
  shared demonstration source if fallback occurred.
- **Load outcome**: Loading, loaded, loaded with a demonstration warning, or failed;
  determines whether export and mutation are permitted.
- **Dataset contents**: Waypoints, Challenges, Ideas, Activities, references, and
  photo references, including their existing relationships and saved route/track data.
- **Portable backup**: A version, export timestamp, and one dataset's complete
  supported contents; it grants no access role and selects no destination itself.

## Success Criteria _(mandatory)_

### Measurable Outcomes

- **SC-001**: Every startup case (no preference, unknown preference, each valid
  saved mode, and saved Production on test) has one documented, verifiable selected
  mode with no record transfer between datasets.
- **SC-002**: For both shared sources, 100% of reviewed loading and failure scenarios
  distinguish unavailable data from successful data and prevent unauthorized writes
  and backups; demonstration fallback is visibly identified.
- **SC-003**: In all reviewed combinations of three modes and two invited roles,
  only a loaded administrator in a shared mode can modify records.
- **SC-004**: Exports from each loaded mode and demonstration fallback contain only
  that active dataset; none contain a combination of real and demonstration sources.
- **SC-005**: Both writable destinations accept valid supported backups only when
  empty, reject invalid/nonempty restores without modifying records, and require
  confirmation before clear.
- **SC-006**: Each requirement has a source/evidence mapping and an explicit
  reviewed, executed, failed, blocked, or not-run status. Baseline creation can
  complete with linked defects and unverified acceptance, but cannot claim those
  outcomes passed.

## Assumptions

- Shared route/track representation and geometry validation are defined by the
  [GPX feature](../008-gpx-import-geometry/spec.md); this feature owns the dataset
  export/restore actions that carry those attachments.

- This baseline documents existing behaviour and approved constraints; no application,
  test, infrastructure, or deployment changes are authorized.
- Access/role semantics come from [the access baseline](../001-access-roles/spec.md);
  this feature specifies source, availability, and persistence boundaries.
- Shared modes require the existing authenticated service. The known hosted API
  failure is tracked separately and does not authorize a workaround or delay
  documenting this baseline.
- Production starts empty but can subsequently contain real records. Infrastructure
  demonstration seeding is a lifecycle rule, not permission to redeploy.
- The legacy browser-record path exists for automated test mode only. Results using
  that path cannot prove shared persistence, permissions, or empty-target enforcement.
- Entity editing rules, relationship redesign, map rendering, new backup formats,
  capacity increases, draft migration, and new offline features are outside scope.
- All acceptance scenarios describe verification targets, not tests executed by
  writing this document. Hosted mutations, role changes, and deployments need
  separate explicit authorization.
