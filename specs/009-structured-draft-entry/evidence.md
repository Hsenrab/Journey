# Structured Draft Entry Evidence

**Reviewed**: 2026-10-20
**Specification**: [Draft entry baseline](spec.md)

| Requirements   | Implementation reviewed                                                                                                                                                    | Existing tests reviewed                                                                                                                                                                |
| -------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| FR-001, FR-002 | [Waypoint editor](../../src/components/WaypointEditor.tsx), [Idea editor](../../src/components/IdeaEditor.tsx), [Activity editor](../../src/components/ActivityEditor.tsx) | [Waypoint tests](../../src/components/WaypointEditor.test.tsx), [Idea tests](../../src/components/IdeaEditor.test.tsx), [Activity tests](../../src/components/ActivityEditor.test.tsx) |
| FR-003, FR-004 | [Draft parser](../../src/domain/draftJsonImport.ts), editor load handlers above                                                                                            | [Parser tests](../../src/domain/draftJsonImport.test.ts), editor tests above                                                                                                           |
| FR-005, FR-006 | [Prompt dialog](../../src/components/AiPromptButton.tsx), editor copy-example handlers                                                                                     | [Dialog tests](../../src/components/AiPromptButton.test.tsx), editor tests above                                                                                                       |
| FR-007         | [Prompt content](../../src/domain/aiPrompts.ts)                                                                                                                            | [Prompt tests](../../src/domain/aiPrompts.test.ts)                                                                                                                                     |

## Current Boundaries

- All rows are source-reviewed, not newly executed. No clipboard/browser action,
  external AI request, application test run, or hosted mutation occurred here.
- JSON parsing rejects non-object input; key validation rejects missing required
  keys and unexpected top-level fields. Nested locations/completion/references
  have entity-specific validation. The forbidden-ID scan is recursive.
- All three examples are fictional. Existing prompt tests parse example objects
  and check relationship exclusions/content constraints; they do not execute an AI.
- Waypoint JSON tabs are present during add and edit. Idea/Activity tabs are
  guarded by add mode. Successful load changes supported form fields and returns
  to Form; save handlers explicitly ignore submission while JSON mode is active.
- Waypoint Challenge links, Idea Waypoint links, and Activity Waypoint/Idea links
  are not draft fields. Activity recorded-track state is not populated by draft JSON.
- Entity requirements remain authoritative: Idea drafts carry planning/difficulty
  fields and no photos; Activity drafts carry date/location; Waypoint drafts carry
  category/tags/completion. This shared baseline does not replace those schemas.
- Prompt text explicitly permits factual research for Ideas/Waypoints, but
  restricts Activity content to supplied source material. This is guidance to an
  external system, not application-enforced truth verification.
- Dirty checks principally track form state, not a guarantee that typed-but-unloaded
  JSON is protected by navigation/discard prompts. No stronger draft-retention
  guarantee is established by this review.

## Known Dependencies and Gaps

- [#174](https://github.com/Hsenrab/Journey/issues/174) qualifies any claim that
  accepted location drafts necessarily save remotely: form saves bypass geocoding.
- [#160](https://github.com/Hsenrab/Journey/issues/160) leaves hosted persistence
  acceptance incomplete. Local parser/editor evidence does not resolve it.
- No new defect was confirmed in this bounded documentation review.

The [quality checklist](checklists/requirements.md) evaluates documentation only.
No new test, implementation plan, or repair is required to complete this baseline.
