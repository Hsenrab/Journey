# Idea Planning Evidence

**Reviewed**: 2026-10-20
**Specification**: [Idea baseline](spec.md)

Shared draft parsing, example copying, and prompt help are owned by
[draft-entry evidence](../009-structured-draft-entry/evidence.md). Idea add-only
availability, fields, and save remain here. Shared shell/header/card patterns are
owned by [navigation evidence](../010-navigation-interactions/evidence.md).

| Requirements          | Implementation reviewed                                                                                                                                | Existing tests reviewed                                                                                                                                                                 |
| --------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------ | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| FR-001, FR-002        | [Ideas list](../../src/pages/Ideas.tsx), [usage helpers](../../src/domain/visit.ts)                                                                    | [List tests](../../src/pages/Ideas.test.tsx), [domain tests](../../src/domain/visit.test.ts)                                                                                            |
| FR-003 through FR-006 | [Detail](../../src/pages/IdeaDetails.tsx), [editor](../../src/components/IdeaEditor.tsx), [schema](../../src/domain/visit.ts)                          | [Detail tests](../../src/pages/IdeaDetails.test.tsx), [editor tests](../../src/components/IdeaEditor.test.tsx), [domain tests](../../src/domain/visit.test.ts)                          |
| FR-007, FR-008        | [Editor](../../src/components/IdeaEditor.tsx), [parser](../../src/domain/draftJsonImport.ts), [context](../../src/features/journey/JourneyContext.tsx) | [Editor tests](../../src/components/IdeaEditor.test.tsx), [parser tests](../../src/domain/draftJsonImport.test.ts), [context tests](../../src/features/journey/JourneyContext.test.tsx) |
| FR-009                | [Idea detail](../../src/pages/IdeaDetails.tsx), [Activity handoff](../../src/pages/Activities.tsx)                                                     | [Handoff tests](../../src/pages/IdeaDetails.test.tsx)                                                                                                                                   |
| FR-010, FR-011        | [Detail](../../src/pages/IdeaDetails.tsx), [context](../../src/features/journey/JourneyContext.tsx), [graph](../../api/src/lib/journeyGraph.ts)        | [Detail tests](../../src/pages/IdeaDetails.test.tsx), [context tests](../../src/features/journey/JourneyContext.test.tsx), [graph tests](../../api/src/lib/journeyGraph.test.ts)        |

## Status and Boundaries

- Every row is source-reviewed, not newly executed. No application test run, hosted
  interaction, mutation, deployment, or infrastructure change occurred here.
- State counts are calculated before text/usage/state filters. Other-state match
  messaging uses search/usage matches before the selected-state restriction.
- Idea JSON mode is add-only. Waypoint links remain form-selected, and reference
  order is preserved by the Idea's reference-ID order.
- The context generates creation/update timestamps and retains creation time on
  edit. This review does not claim that every direct API path enforces
  server-owned timestamps; the model guide's stronger wording is not evidence
  of that enforcement.
- Ideas may have descriptive locations without coordinates. The geocoder
  intentionally handles Waypoints and Activities, not Ideas.
- Detail edit/delete errors are rendered directly; unlike the list's create
  conflict alert, detail does not implement a dedicated Reload latest action.
- Baseline scenarios are verification targets, not claims of fresh passing tests.
  Legacy local test-mode mutation tests cannot prove shared role enforcement.

## Existing Issues and Gaps

- [#168](https://github.com/Hsenrab/Journey/issues/168) requests additional
  difficulty/link-usage filters and Activity difficulty. Those are not baselined
  as implemented; current Ideas include usage filtering and difficulty sorting.
- [#170](https://github.com/Hsenrab/Journey/issues/170) tracks duplicate identity
  handling in import/replacement, which also carries Ideas.
- [#160](https://github.com/Hsenrab/Journey/issues/160) blocks shared hosted
  persistence acceptance; no successful live Idea CRUD is claimed.
- No additional Idea defect was confirmed. Timestamp ownership across direct
  API paths and editor drafts across data-mode changes are not newly verified.

The [quality checklist](checklists/requirements.md) evaluates this written baseline.
No repair, new tests, or implementation plan was created.
