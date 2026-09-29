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

  it('gives Waypoint prompts explicit research and output constraints', () => {
    expect(waypointJsonAiPrompt).toContain('factual details you can reliably confirm through internet research')
    expect(waypointJsonAiPrompt).toContain('When online sources disagree, rely on the most authoritative source.')
    expect(waypointJsonAiPrompt).toContain('Do not invent, guess, embellish, hype, or use promotional language.')
    expect(waypointJsonAiPrompt).toContain('Do not add commentary, markdown, or extra JSON fields.')
    expect(waypointJsonAiPrompt).toContain('Every waypoint belongs to a challenge collection')
    expect(waypointJsonAiPrompt).toContain('After I provide the source material, produce exactly one JSON object')
  })

  it('gives Activity and Idea prompts explicit source and output constraints', () => {
    for (const prompt of [activityJsonAiPrompt, ideaJsonAiPrompt]) {
      expect(prompt).toContain('factual details you can reliably confirm through internet research')
      expect(prompt).toContain('If a detail cannot be confirmed, omit it.')
      expect(prompt).toContain('Do not invent, guess, embellish, or use promotional language.')
      expect(prompt).toContain('Do not add commentary, markdown, or extra JSON fields.')
      expect(prompt).toContain(
        'After I provide the source material, produce exactly one JSON object in this exact shape.',
      )
    }
  })
})
