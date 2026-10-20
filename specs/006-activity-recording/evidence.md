# Activity Recording Evidence

**Reviewed**: 2026-10-20
**Specification**: [Activity baseline](spec.md)

Shared draft parsing, example copying, and prompt help are owned by
[draft-entry evidence](../009-structured-draft-entry/evidence.md). Activity
add-only availability, fields, and save remain here. Shared shell/header/card
patterns are owned by [navigation evidence](../010-navigation-interactions/evidence.md).

| Requirements           | Implementation reviewed                                                                                                                                           | Existing tests reviewed                                                                                                                                                                                                                |
| ---------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| FR-001, FR-002, FR-012 | [Log](../../src/pages/Activities.tsx), [details](../../src/pages/ActivityDetails.tsx), [domain](../../src/domain/visit.ts)                                        | [Log tests](../../src/pages/Activities.test.tsx), [detail tests](../../src/pages/ActivityDetails.test.tsx)                                                                                                                             |
| FR-003 through FR-006  | [Editor](../../src/components/ActivityEditor.tsx), [context](../../src/features/journey/JourneyContext.tsx), [schemas](../../src/domain/visit.ts)                 | [Editor tests](../../src/components/ActivityEditor.test.tsx), [domain tests](../../src/domain/visit.test.ts), [context tests](../../src/features/journey/JourneyContext.test.tsx)                                                      |
| FR-007 through FR-009  | [Editor](../../src/components/ActivityEditor.tsx), [draft parser](../../src/domain/draftJsonImport.ts), [shared GPX contract](../008-gpx-import-geometry/spec.md) | [Editor workflow tests](../../src/components/ActivityEditor.test.tsx), [draft tests](../../src/domain/draftJsonImport.test.ts); shared parsing/schema evidence is maintained in [GPX evidence](../008-gpx-import-geometry/evidence.md) |
| FR-010, FR-011         | [Details](../../src/pages/ActivityDetails.tsx), [context](../../src/features/journey/JourneyContext.tsx), [graph](../../api/src/lib/journeyGraph.ts)              | [Detail tests](../../src/pages/ActivityDetails.test.tsx), [context tests](../../src/features/journey/JourneyContext.test.tsx), [graph tests](../../api/src/lib/journeyGraph.test.ts)                                                   |

## Execution Status and Implementation Boundaries

- All evidence is source-reviewed, not newly executed. No hosted mutations,
  application test run, map access, or deployment was performed for this feature.
- The editor validates dates using a real-calendar round trip. The API currently
  checks only their format; see the existing defect below.
- The editor reconstructs postcode input without coordinates. Shared context saves
  use whole-dataset replacement, which validates resolved locations before reaching
  a handler. Geocoding is implemented only for entity create/update, not replacement.
- Category eligibility uses the selected Waypoint's configured Challenges. The
  form requires an eligible award; schemas permit uncategorized Activities and
  completion counts them. Do not generalize the form requirement to every record.
- Reference/photo form order controls exist. Detail views currently select supporting
  records in top-level collection order, not Activity link-array order; this display
  discrepancy is recorded separately below.
- Delete in the context uses dataset replacement, then the detail page explicitly
  reloads. Its deleted-record display state distinguishes successful deletion from
  failed refresh and prevents another delete action.
- Shared parsing, stored-geometry representation, and filename distinctions have
  moved to the [GPX baseline](../008-gpx-import-geometry/evidence.md).
  This feature retains attachment, stale-read handling, and Activity save evidence.
- Local test-mode postcode saves bypass the resolved remote schema and cannot
  establish working hosted postcode persistence.

## Known Defects and Gaps

- [#174](https://github.com/Hsenrab/Journey/issues/174), found while baselining:
  Waypoint and Activity form saves bypass save-time resolution. Postcode-only
  Activities, including edits reconstructing an existing postcode, reach replacement
  validation without coordinates. The issue includes both paths; no duplicate filed.
- [#169](https://github.com/Hsenrab/Journey/issues/169) already tracks real-calendar
  validation missing at the API boundary.
- [#170](https://github.com/Hsenrab/Journey/issues/170) tracks duplicate identities
  in import/replacement; [#171](https://github.com/Hsenrab/Journey/issues/171)
  tracks the direct Activity/Challenge field's relationship ambiguity.
- [#168](https://github.com/Hsenrab/Journey/issues/168) requests Activity difficulty
  and additional filters. These are not described as current features.
- [#160](https://github.com/Hsenrab/Journey/issues/160) blocks hosted shared-data
  acceptance; no successful remote Activity save is claimed.
- [#175](https://github.com/Hsenrab/Journey/issues/175), logged during this review,
  tracks Activity detail/gallery and reopened-editor order ignoring the persisted
  link-array order. Form controls alone do not establish display-order preservation.

See the [quality checklist](checklists/requirements.md) for document review.
No implementation or new tests are authorized by completing this baseline.
