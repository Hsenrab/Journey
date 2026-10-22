# Waypoint Management Evidence

**Reviewed**: 2026-10-22
**Specification**: [Waypoint baseline](spec.md)

Shared draft parsing, example copying, and prompt help are owned by
[draft-entry evidence](../009-structured-draft-entry/evidence.md). Waypoint
add/edit availability, fields, and save remain here. Shared shell/header/card
patterns are owned by [navigation evidence](../010-navigation-interactions/evidence.md).

## Evidence Map

| Requirements          | Implementation reviewed                                                                                                                                   | Existing tests reviewed                                                                                                                                                              |
| --------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| FR-001, FR-011        | [List](../../src/pages/Locations.tsx), [detail](../../src/pages/LocationDetails.tsx)                                                                      | [List tests](../../src/pages/Locations.test.tsx), [detail tests](../../src/pages/LocationDetails.test.tsx)                                                                           |
| FR-002, FR-003        | [Domain helpers](../../src/domain/visit.ts), [detail](../../src/pages/LocationDetails.tsx)                                                                | [Domain tests](../../src/domain/visit.test.ts), [detail tests](../../src/pages/LocationDetails.test.tsx)                                                                             |
| FR-004 through FR-007 | [Editor](../../src/components/WaypointEditor.tsx), [draft parser](../../src/domain/draftJsonImport.ts), [geocoding](../../api/src/lib/geocode.ts)         | [Editor tests](../../src/components/WaypointEditor.test.tsx), [draft tests](../../src/domain/draftJsonImport.test.ts), [geocoding tests](../../api/src/lib/geocode.test.ts)          |
| FR-008 through FR-010 | [Context](../../src/features/journey/JourneyContext.tsx), [graph rules](../../api/src/lib/journeyGraph.ts), [handler](../../api/src/functions/journey.ts) | [Context tests](../../src/features/journey/JourneyContext.test.tsx), [graph tests](../../api/src/lib/journeyGraph.test.ts), [detail tests](../../src/pages/LocationDetails.test.tsx) |

The table originated as source-reviewed baseline evidence. The location-save
implementation and executed local checks below supersede its former unexecuted
status for that slice. No hosted acceptance or data mutation was performed. Local
test-mode browser persistence does not establish remote authorization or real
persistence.

## Location-Save Implementation

- `effectiveWaypointLocation` compares trimmed identifying text and numeric
  coordinates without changing the visible draft. Named-location clearing removes
  metadata too; changed valid pairs win; unchanged coordinate-only locations remain.
- The editor validates supplied coordinate pairs before normalization, rejects
  metadata-only input, and routes JSON-loaded add drafts through the same form.
- Replacement accepts unresolved searchable Waypoints only, checks authorization
  and graph integrity before lookup, resolves through the existing managed-identity
  helper, then strictly validates the complete saved dataset/graph before the
  existing ETag-checked atomic batch. Import, Activity, schema versions, and the
  100-operation maximum are unchanged.
- The client validates required JSON error envelopes and preserves specific
  messages with HTTP context. Only matching HTTP 409 codes get typed conflict or
  nonempty-import errors. Non-JSON gateway bodies are not parsed or displayed.
- Provider/page tests use the real replacement client, verify returned coordinates
  and ETags, stable identity/relationships, and failed draft retention. Existing
  deferred-mutation, discard-consent, conflict reload, and supporting-link tests
  remain the regression surface; no provider/page runtime changes were necessary.
- The synthetic Demo Cosmos browser journey mocks the remote HTTP boundary. It
  does not execute real Maps searches or Cosmos transactions.

## Local Validation

Commands run through Ubuntu WSL with installed dependencies, Chromium, and
Functions Core Tools. No dependencies, configuration, or check thresholds changed.
The local frontend coverage run was stopped due to runtime; full validation is
being moved to the authorized GitHub Actions workflow.

- Initial API track: 88 targeted schema/handler/geocode tests passed.
- Initial frontend target command:
  `npm test -- src/domain/waypointLocation.test.ts src/components/WaypointEditor.test.tsx src/services/journeyApi.test.ts`
  passed 35 domain/client tests but failed to start the editor worker:
  `[vitest-pool-runner]: Timeout waiting for worker to respond`.
- Serial integration command:
  `npm test -- src/components/WaypointEditor.test.tsx src/pages/Locations.test.tsx src/pages/LocationDetails.test.tsx src/features/journey/JourneyContext.test.tsx --maxWorkers=1`
  passed 103 tests and exposed one new ambiguous Category label selector. The test
  now targets the textbox rather than the similarly labelled filter.
- Frontend `npm run typecheck` initially caught unsupported Testing Library
  `exact` query options (TS2769); removed the option and typecheck passed.
- API `npm run typecheck` initially caught missing union-property narrowing at
  `journey.ts:113` (TS2339); explicit property guards fixed it and typecheck passed.
- Frontend `npm run lint` passed with three existing warnings: editor
  `defaultChallengeIds` memo dependency and two context fast-refresh export warnings.
  API `npm run lint` passed with no warnings.
- `npm run format:check` initially found client-test formatting after the first
  write pass; a focused Prettier write corrected it and the full check passed.
- API `npm run test:coverage`: **160 tests passed**, 10 files. Statements 85.77%,
  branches 78.46%, functions 89.92%, lines 88.41%. API config has no numeric coverage
  thresholds. Azure Functions runtime-registration warnings are expected in unit
  test mode; built-host verification is separate.
- API `npm run build` passed.
- API `npm run test:smoke`: **2 built-host tests passed**, including registration
  and unauthenticated route checks.
- The serial full frontend coverage run did not finish after more than 30 minutes.
  Its partial output showed one failed Waypoint draft-registration parameter; a
  focused App test rerun passed all four matching parameters.
- A local frontend coverage attempt with `--maxWorkers=4` was stopped before suite
  completion after partial output reported failures in two IdeaEditor tests and one
  Idea draft-registration parameter. No final coverage result was produced.
- After tightening the client error-envelope fixtures, `npx vitest run
src/services/journeyApi.test.ts --maxWorkers=1` passed **25 tests**. Focused
  Prettier validation for that file passed.

Frontend coverage/build and the Chromium suite remain pending GitHub Actions CI.

## Known Deviations and Gaps

- Clarification on 2026-10-21 approved the location-edit rules now implemented: changed
  place/address text invalidates untouched saved coordinates; explicitly edited
  valid coordinates remain authoritative. Clearing both identifying text fields
  from a previously named location removes the entire location and metadata.
  Unchanged coordinate-only locations remain valid. Hosted acceptance remains
  unexecuted.
- [#174](https://github.com/Hsenrab/Journey/issues/174), logged during this review:
  form create/edit uses context `persist` -> client `replaceJourney` -> server
  replacement schema. Its Waypoint place-only defect is repaired by this
  implementation, restoring the save-time requirement from closed
  [#67](https://github.com/Hsenrab/Journey/issues/67). Keep #174 open: Activity
  postcode-only replacement remains strict and out of scope. No hosted repro or
  post-deployment acceptance was run.
- [#171](https://github.com/Hsenrab/Journey/issues/171) already tracks Challenge-side
  relationship update/deletion inconsistencies. Waypoint-side synchronization is
  present; do not infer consistency across every API path.
- [#170](https://github.com/Hsenrab/Journey/issues/170) already tracks duplicate
  identity data loss during import/replacement. Baseline documentation does not
  certify every malformed dataset as safely rejected.
- The former hosted API blocker [#160](https://github.com/Hsenrab/Journey/issues/160)
  was resolved by [#178](https://github.com/Hsenrab/Journey/pull/178). That repair
  does not establish hosted Waypoint CRUD acceptance.
- [#179](https://github.com/Hsenrab/Journey/pull/179) implements the shared
  pending-write and draft-discard rules, including Waypoint editor regressions.
  See [data-mode evidence](../002-data-modes-persistence/evidence.md) for executed
  local checks and the remaining hosted acceptance boundary. Its pending/discard
  regressions are retained in this implementation's local suite.

## Review Outcome

The bounded Waypoint location-save improvement is implemented with focused
regressions and unchanged persistence/authorization infrastructure. Remaining
defects and hosted acceptance stay separate. Specification quality review is in
the [requirements checklist](checklists/requirements.md). A feature-branch commit
and push are authorized solely to run CI; no deployment, hosted mutation, or
migration is authorized or performed.
