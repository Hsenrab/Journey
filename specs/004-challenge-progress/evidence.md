# Challenges and Progress Evidence

**Reviewed**: 2026-10-20

**Supersession**: [Feature013](../013-challenge-waypoint-relationships/spec.md)
replaces the historical membership-union behavior described below. This evidence
retains its original review date and is not new runtime acceptance.
**Specification**: [Challenge baseline](spec.md)

| Requirements          | Implementation reviewed                                                                                                                  | Existing tests reviewed                                                                                                                                                    |
| --------------------- | ---------------------------------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| FR-001 through FR-004 | [Overview](../../src/pages/Dashboard.tsx), [domain](../../src/domain/visit.ts), [context](../../src/features/journey/JourneyContext.tsx) | [Overview tests](../../src/pages/Dashboard.test.tsx), [domain tests](../../src/domain/visit.test.ts)                                                                       |
| FR-005, FR-010        | [Details](../../src/pages/ChallengeDetails.tsx), [membership helpers](../../src/domain/visit.ts)                                         | [Detail tests](../../src/pages/ChallengeDetails.test.tsx), [overview tests](../../src/pages/Dashboard.test.tsx)                                                            |
| FR-006 through FR-008 | [Details](../../src/pages/ChallengeDetails.tsx), [shared GPX contract](../008-gpx-import-geometry/spec.md)                               | [Detail workflow tests](../../src/pages/ChallengeDetails.test.tsx); shared parsing/schema evidence is maintained in [GPX evidence](../008-gpx-import-geometry/evidence.md) |
| FR-009                | [Route map](../../src/components/ChallengeRouteMap.tsx), [track membership](../../src/domain/gpxMap.ts)                                  | [Route-map tests](../../src/components/ChallengeRouteMap.test.tsx), [GPX map tests](../../src/domain/gpxMap.test.ts)                                                       |

## Current-State Details

- All rows are source-reviewed, not newly executed. No hosted access, save,
  GPX upload, resource change, or data mutation was performed for this baseline.
- Dashboard is the implementation name for the Challenges overview. It is not
  a separate unbaselined analytics product.
- `challengeWaypoints` uses the union of Challenge and Waypoint membership.
  `waypointSupportsActivityCategory` uses only Waypoint-side links to configured
  Challenges. Contradictory stored links are not a reliable alternate model.
- Context exposes Challenge creation and planned-route update, not user-facing
  title/description editing or deletion.
- Recorded tracks are selected through member Waypoints, even if an Activity
  carries the schema's optional direct `challengeId`; that field is not the
  track-membership or completion authority.
- Shared parsing limits, saved-geometry bounds, and filename validation evidence
  have moved to the [GPX baseline](../008-gpx-import-geometry/evidence.md).
  This feature retains route draft/save/cancel and member-track comparison evidence.
- Route-map rendering requests the existing protected Maps token and distinguishes
  a pending token from empty geometry. A failed map service is not proof of absent routes.

## Known Defects and Gaps

- [#171](https://github.com/Hsenrab/Journey/issues/171) tracks unsynchronized
  Challenge-side membership updates, linked deletion, and the unresolved direct
  Activity/Challenge relationship. No new Challenge CRUD UI is implied here.
- [#170](https://github.com/Hsenrab/Journey/issues/170) tracks duplicate IDs in
  import/replacement; malformed imported collections are not certified safe.
- [#160](https://github.com/Hsenrab/Journey/issues/160) includes shared-test
  Journey and Maps API 404 observations. Hosted progress/persistence/map acceptance
  remains unverified; local fixture tests are not a substitute.
- No additional defect was confirmed during this bounded Challenge review.

The [quality checklist](checklists/requirements.md) reviews the document, not
runtime acceptance. No application, test, deployment, or infrastructure changes
were made. No plan or implementation tasks are required to finish this baseline.
