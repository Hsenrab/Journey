# Waypoint Management Evidence

**Reviewed**: 2026-10-20
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

All rows are **source-reviewed, not newly executed**. Test names/assertions provide
existing coverage evidence, not a new passing run. No hosted acceptance or data
mutation was performed. Local test-mode browser persistence does not establish
remote authorization or real persistence.

## Known Deviations and Gaps

- [#174](https://github.com/Hsenrab/Journey/issues/174), logged during this review:
  form create/edit uses context `persist` -> client `replaceJourney` -> server
  replacement schema. Supplied Waypoint locations require coordinates in that
  schema; replacement does not call `geocodedEntity`. Only entity create/update
  does. Therefore place-only form drafts are rejected before resolution. This
  contradicts the save-time requirement from closed
  [#67](https://github.com/Hsenrab/Journey/issues/67), not a newly accepted
  coordinates-only product restriction. Source trace confirmed; no hosted repro.
- [#171](https://github.com/Hsenrab/Journey/issues/171) already tracks Challenge-side
  relationship update/deletion inconsistencies. Waypoint-side synchronization is
  present; do not infer consistency across every API path.
- [#170](https://github.com/Hsenrab/Journey/issues/170) already tracks duplicate
  identity data loss during import/replacement. Baseline documentation does not
  certify every malformed dataset as safely rejected.
- [#160](https://github.com/Hsenrab/Journey/issues/160) blocks shared hosted
  acceptance. Demo local visibility is not proof of successful hosted CRUD.
- Shared-reference edits, cross-mode unsaved drafts, and saves overlapping a mode
  change have not received new runtime verification here.

## Review Outcome

The current user journeys and their boundaries are documented; defects remain
separate. Specification quality review is in the
[requirements checklist](checklists/requirements.md). No repair or new test is
required to finish this written baseline, and none was made.
