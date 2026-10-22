# Tasks: Waypoint Location Edits and Save-Time Resolution

**Input**: [Specification](spec.md), [plan](plan.md), [research](research.md),
[data model](data-model.md), [contract](contracts/waypoint-location-save.md),
and [validation guide](quickstart.md).

**Scope**: Clarified US2 / FR-005 / SC-005 and the prerequisite Waypoint portion
of [#174](https://github.com/Hsenrab/Journey/issues/174). Preserve FR-006,
FR-008, and FR-010. US1 browsing/progress and US3 deletion already exist and are
regression surfaces, not new implementation phases. Activity postcode replacement,
#170, #171, migrations, infrastructure, and new services are outside scope.

Implementation was subsequently authorized on `implement-waypoint-location-save`.
Commit and feature-branch push were authorized on 2026-10-22 to run GitHub Actions
CI. Deployment and hosted mutation remain unauthorized. Tests are included because
SC-005 explicitly requires verification and the contract/plan define its acceptance
matrix.

## Phase 1: Setup

- [x] T001 Verify the actual Git branch and preserve existing changes before creating a dedicated implementation branch when authorized; trace `src/components/WaypointEditor.tsx` through `src/pages/Locations.tsx`, `src/pages/LocationDetails.tsx`, `src/features/journey/JourneyContext.tsx`, `src/services/journeyApi.ts`, and `api/src/functions/journey.ts`; record any concrete differences from the planned save path in `specs/003-waypoint-management/research.md`. Do not interpret the feature-directory override as an actual Git branch.

## Phase 2: Foundation

- [x] T002 Review `api/src/lib/journeySchema.ts`, `api/src/lib/journeyGraph.ts`, `api/src/lib/geocode.ts`, and `src/domain/visit.ts` for reusable schemas, graph-check types, and resolver boundaries; confirm in `specs/003-waypoint-management/research.md` how replacement input can contain unresolved Waypoints without loosening saved/imported data or using unsafe casts. Preserve all existing collection constraints, schema versions, ETags, and the 100-operation limit; add no dependencies, generic schema framework, endpoint, or migration. Depends on T001.

**Checkpoint**: Existing architecture and strict input/output boundaries are
understood. All following increments serve US2; no unrelated feature scaffolding.

## Phase 3: US2 - Maintain a Waypoint (P1)

**Goal**: Save new searchable locations, re-resolve changed named locations,
remove cleared locations, and preserve explicit coordinates without partial writes.

**Independent test**: Through the real replacement client/provider path, create
a place-only Waypoint, edit its name/address with untouched saved coordinates,
and receive the authoritative resolved position. Verify location removal,
manual-coordinate precedence, unchanged coordinate-only positions, and failure
retaining the draft while causing zero writes.

### Increment A: Replacement request and server resolution

- [x] T003 [P] [US2] Add replacement-input regressions in `api/src/lib/journeySchema.test.ts`: "Waypoints allow absent location, a complete valid pair, or searchable text with both coordinates absent"; reject partial/out-of-range pairs, metadata-only locations, and unknown/malformed fields. Assert "Saved-document and import schemas still require complete coordinates" and every non-Waypoint collection, including Activity replacement, retains its constraints. Depends on T002.
- [x] T004 [US2] Implement the narrowly typed replacement dataset schema in `api/src/lib/journeySchema.ts` by reusing current entity constraints and allowing unresolved Waypoints only for `operation: replace`. Enforce "Coordinate pair: validated finite numeric latitude/longitude in existing ranges" (latitude -90 to 90, longitude -180 to 180); require nonblank searchable place/address when the pair is absent. Keep persisted documents, imports, other operations, and schema versions unchanged. Depends on T003.
- [x] T005 [US2] Add actual replacement-handler tests in `api/src/functions/journey.test.ts` and focused resolver tests in `api/src/lib/geocode.test.ts`: resolve searchable Waypoints before any write; skip lookup for supplied pairs, absent locations, and other entity types; reject invalid graphs before lookup; fail with zero writes if any of multiple resolutions fails or final coordinates are invalid; preserve exact no-result errors, unexpected downstream rejection, and stale-ETag conflict handling. Assert viewer/invalid principals cause no lookup/write, and original ETags and unrelated relationships reach the batch unchanged. Depends on T004.
- [x] T006 [US2] Wire replacement resolution in `api/src/functions/journey.ts`, reusing `api/src/lib/geocode.ts` only where necessary: authorize, validate input/graph, resolve each unresolved Waypoint once, validate the complete result with the strict saved dataset schema and graph rules, then convert documents and invoke the existing ETag-checked `replaceDataset`. Return the full resolved dataset/ETags. Map expected validation/no-result failures through the existing explicit response boundary; unexpected failures must retain specific messages and propagate. No retry, omission, partial batch, background repair, or Activity resolution. Depends on T005.

### Increment B: Effective editor location

- [x] T007 [P] [US2] Add table-driven tests in `src/domain/waypointLocation.test.ts` for absent/new text/new pair input; changed place name or address with the initial pair untouched; both identifying fields cleared; explicit changed pairs with empty text; unchanged coordinate-only location; metadata-only changes; trimmed-equivalent text and numerically equivalent coordinates; and clearing the pair while retaining searchable text. Assert "An explicitly changed valid pair wins even when all identifying text is removed" and "Entire location absent, including metadata" for clearing a named location with untouched coordinates. Depends on T002.
- [x] T008 [US2] Implement the small pure submission normalizer in `src/domain/waypointLocation.ts` using the existing location type and validated inputs: compare "trimmed `placeName` and `addressOrRegion`, with empty as absent" and "numeric equality of both values against the initial pair". Return the effective location without mutating the initial object or visible form; no touched flags, persisted metadata, or keystroke clearing. Preserve source/approximate metadata except when the entire location is removed. Depends on T007.
- [x] T009 [US2] Extend `src/components/WaypointEditor.test.tsx`, then wire the helper into `src/components/WaypointEditor.tsx` after field validation. Cover the complete normalizer matrix through submission, JSON-loaded add drafts, and untouched form values after rejection. Enforce "Partial/invalid supplied pair | Validation error; no submission" and "No pair and only metadata | Validation error; not silently discarded or geocoded"; never normalize invalid coordinates into apparent success. Preserve required fields, Challenge links, references/photos, applied-JSON tracking, and draft registration. Depends on T008.

### Increment C: Client errors and complete save journeys

- [x] T010 [P] [US2] Extend `src/services/journeyApi.test.ts`, then update `src/services/journeyApi.ts` using the browser error-response rules in `specs/003-waypoint-management/contracts/waypoint-location-save.md`: HTTP 400/409 require JSON regardless of content type; other error statuses parse JSON only for declared `application/json` or `application/*+json` (case-insensitive, parameters ignored). Validate an object with a nonblank `error` string, allowing additional fields, and surface its message with HTTP status/status-text context. Preserve `JourneyConflictError` and `JourneyImportNotEmptyError` only for their matching HTTP 409 codes; unknown valid codes are ordinary errors. Other non-JSON errors retain status/status-text reporting without body parsing. Test valid 400 JSON including absent/wrong content type; malformed JSON and missing/non-string/empty/blank `error` with original parsing/validation failures intact; both typed 409 codes and unknown codes; codes on other statuses; other JSON errors including parameterized/mixed-case and `+json` content types; and HTML/missing-content-type 502 errors. Verify replacement request shape and parsed authoritative resolved response; do not swallow parsing failures or add fallbacks. Depends on T002.
- [x] T011 [US2] Add remote-mode integration regressions in `src/features/journey/JourneyContext.test.tsx`, `src/pages/Locations.test.tsx`, and `src/pages/LocationDetails.test.tsx` for actual add/edit `replaceJourney` saves, submitted effective locations, and adoption of returned coordinates/ETags. Assert stable identity, synchronized memberships/supporting links, no changes to linked historical records, lookup-failure draft retention, specific error/no success message, and conflict reload behaviour. Defer responses to verify switching stays blocked through resolution/write and unlocks on success/failure; a retained failed draft still requires discard consent. Change `src/features/journey/JourneyContext.tsx`, `src/pages/Locations.tsx`, or `src/pages/LocationDetails.tsx` only if needed to satisfy these tests, retaining the reducer/replacement path. Depends on T006, T009, T010.
- [ ] T012 [US2] Add a synthetic remote-mocked Demo Cosmos create/edit/failure journey in `e2e/journey.spec.ts`: create a text-only Waypoint, return a resolved pair, edit text and assert stale coordinates are absent from the request, verify failed resolution retains fields and causes no success navigation, then explicitly save again successfully. Exercise clearing the named location and manual-coordinate precedence; assert no automatic retries or legacy browser-record persistence. Preserve existing smoke tests and configuration; mocked routes prove browser/client behaviour, not actual Maps/Cosmos execution. Depends on T011.

**Checkpoint**: US2's new location rules work end-to-end locally. Existing US1
and US3 remain unchanged and covered by the final regression suite.

## Phase 4: Polish and Verification

- [ ] T013 Trace final imports/callers, API schema consumers, frontend/API builds, and deployment consumers from changed files; after pushing the authorized feature branch, manually dispatch and monitor the complete `.github/workflows/ci.yml` workflow because local frontend coverage is prohibitively slow in this WSL/OneDrive workspace. Verify both coverage suites/thresholds, builds, full Chromium suite, and built-host smoke tests; retain existing browsing, completion, deletion, permission, mode, and conflict coverage. Record exact outcomes/warnings/failures in `specs/003-waypoint-management/evidence.md`; do not claim deployment or hosted application acceptance. Depends on T012.
- [ ] T014 Update `docs/waypoints-model.md`, `docs/operations.md`, `specs/003-waypoint-management/spec.md`, and `specs/003-waypoint-management/evidence.md` to distinguish implemented/executed location behaviour from remaining acceptance gaps. Review changed UI against `docs/UI_GUIDELINES.md`, update the surface inventory in `specs/003-waypoint-management/research.md` if implementation differs, and format/check changed documentation without rerunning unchanged successful code checks. Keep #174 open for its unfinished Activity portion, retain #170/#171 and the batch limit, and do not imply hosted acceptance or authorization to commit/push/deploy. Depends on T013.

## Dependencies and Execution Order

```text
T001 -> T002
          |-> T003 -> T004 -> T005 -> T006 --|
          |-> T007 -> T008 -> T009 ---------|-> T011 -> T012 -> T013 -> T014
          |-> T010 ------------------------|
```

- T003-T006 implement the server contract; T007-T009 implement editor semantics;
  T010 implements the client error boundary. They touch different files and may
  run independently after T002; coordinate on the documented request/response shape.
- T011 integrates all three tracks; T012 requires working integration.
- US1 and US3 have no new tasks or dependency on one another; their existing
  behaviour is preserved, not declared newly accepted by generating this backlog.

## Parallel Example: US2

After T002, one worker can execute T003-T006 (API), another T007-T009
(domain/editor), and a third T010 (client), without editing the same files.
The `[P]` markers identify their independent entry tasks, not permission to skip
within-track prerequisites. Parallel execution is optional; direct sequential
work is appropriate for this personal project.

## Implementation Strategy

1. Start with the smallest server prerequisite: admit and resolve place-only
   Waypoint replacement without loosening persistence/import validation.
2. Complete the editor and error-boundary tracks, then verify real add/edit saves.
3. Finish the remote browser journey, full local validation, and evidence updates.

The bounded MVP is the complete US2 location-save slice (T001-T014), not a
replacement-schema relaxation alone. A backend-only increment is testable but
does not complete FR-005/SC-005. T001-T011 are implemented; T012-T014 remain pending
until the browser journey, GitHub Actions CI, and final evidence review are complete.
