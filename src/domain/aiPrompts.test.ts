import { describe, expect, it } from 'vitest'
import { activityJsonAiPrompt, ideaJsonAiPrompt, waypointJsonAiPrompt } from './aiPrompts'
import { parseActivityDraftJson, parseIdeaDraftJson, parseWaypointDraftJson } from './draftJsonImport'

function promptExamples(prompt: string): string[] {
  return Array.from(prompt.matchAll(/Example \d[^\n]*:\n(\{[\s\S]*?\n\})/g), (match) => match[1]!)
}

describe('AI JSON prompts', () => {
  it('contains two valid examples for each entity type', () => {
    const activityExamples = promptExamples(activityJsonAiPrompt)
    const ideaExamples = promptExamples(ideaJsonAiPrompt)
    const waypointExamples = promptExamples(waypointJsonAiPrompt)

    expect(activityExamples).toHaveLength(2)
    expect(ideaExamples).toHaveLength(2)
    expect(waypointExamples).toHaveLength(2)

    activityExamples.forEach((example) => expect(parseActivityDraftJson(example).ok).toBe(true))
    ideaExamples.forEach((example) => expect(parseIdeaDraftJson(example).ok).toBe(true))
    waypointExamples.forEach((example) => expect(parseWaypointDraftJson(example).ok).toBe(true))
  })

  it('keeps editor-managed relationships out of external prompts', () => {
    const relationshipField = /"(?:waypointId|ideaIds|waypointIds|challengeIds)"/

    expect(activityJsonAiPrompt).not.toMatch(relationshipField)
    expect(ideaJsonAiPrompt).not.toMatch(relationshipField)
    expect(waypointJsonAiPrompt).not.toMatch(relationshipField)
  })
})
