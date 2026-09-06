import { describe, expect, it } from 'vitest'
import {
  IdeaSchema,
  ActivitySchema,
  activitiesUsingIdea,
  createActivity,
  createDemoData,
  ideaUsageCount,
  ideasForActivity,
  ideasForWaypoint,
  type Idea,
} from './visit'

function idea(overrides: Partial<Idea> = {}): Idea {
  return IdeaSchema.parse({
    ideaId: 'idea-1',
    title: 'Kitchen garden tour',
    description: '',
    notes: '',
    waypointIds: [],
    planningState: 'active',
    difficulty: 2,
    referenceIds: [],
    createdAt: '2026-08-01T00:00:00.000Z',
    updatedAt: '2026-08-01T00:00:00.000Z',
    ...overrides,
  })
}

describe('idea schema', () => {
  it('allows zero, one or many distinct waypoint links and empty text', () => {
    expect(idea({ waypointIds: [] }).waypointIds).toEqual([])
    expect(idea({ waypointIds: ['a', 'b'] }).waypointIds).toEqual(['a', 'b'])
    expect(() => idea({ waypointIds: ['a', 'a'] })).toThrow('Idea waypoint links must be distinct')
    expect(idea({ description: '', notes: '' }).notes).toBe('')
    expect(() => idea({ title: '  ' })).toThrow('Idea title is required')
  })

  it('requires a rejection reason only when rejected', () => {
    expect(() => idea({ planningState: 'rejected' })).toThrow('A rejected idea requires a rejection reason')
    expect(idea({ planningState: 'rejected', rejectionReason: 'Closed to visitors' }).rejectionReason).toBe(
      'Closed to visitors',
    )
    expect(() => idea({ rejectionReason: 'Closed to visitors' })).toThrow(
      'Only a rejected idea can have a rejection reason',
    )
  })

  it('rejects obsolete idea fields and photo links', () => {
    expect(IdeaSchema.safeParse({ ideaId: 'idea-1', title: 'Old', description: 'x', waypointIds: [] }).success).toBe(
      false,
    )
    expect(idea({ difficulty: 4 }).difficulty).toBe(4)
    expect(() => idea({ difficulty: 5 as Idea['difficulty'] })).toThrow()
  })
})

describe('idea and activity relationships', () => {
  const activity = (activityId: string, ideaIds: string[], waypointId?: string) =>
    createActivity({
      activityId,
      waypointId,
      ideaIds,
      date: '2026-08-02',
      location: { kind: 'postcode', postcode: 'GL3 4AQ' },
    })

  it('derives usage from activities rather than idea state', () => {
    const rejected = idea({ ideaId: 'idea-2', planningState: 'rejected', rejectionReason: 'Too far' })
    const activities = [activity('a1', ['idea-1', 'idea-2'], 'waypoint-1'), activity('a2', ['idea-2'])]

    expect(ideaUsageCount(activities, 'idea-1')).toBe(1)
    expect(ideaUsageCount(activities, 'idea-2')).toBe(2)
    expect(ideaUsageCount(activities, 'idea-3')).toBe(0)
    expect(activitiesUsingIdea(activities, 'idea-2').map((item) => item.activityId)).toEqual(['a2', 'a1'])
    expect(rejected.planningState).toBe('rejected')
  })

  it('links ideas and activities across different waypoints', () => {
    const ideas = [idea({ waypointIds: ['waypoint-1'] }), idea({ ideaId: 'idea-2', waypointIds: ['waypoint-2'] })]
    const unattached = activity('a1', ['idea-1', 'idea-2'])

    expect(ideasForWaypoint(ideas, 'waypoint-1').map((item) => item.ideaId)).toEqual(['idea-1'])
    expect(ideasForActivity(ideas, unattached).map((item) => item.ideaId)).toEqual(['idea-1', 'idea-2'])
    expect(unattached.waypointId).toBeUndefined()
  })

  it('keeps activity idea links distinct and rejects the obsolete singular link', () => {
    expect(() => activity('a1', ['idea-1', 'idea-1'])).toThrow('Activity idea links must be distinct')
    expect(
      ActivitySchema.safeParse({
        activityId: 'a1',
        ideaId: 'idea-1',
        date: '2026-08-02',
        location: { kind: 'postcode', postcode: 'GL3 4AQ' },
        notes: '',
        referenceIds: [],
        photoReferenceIds: [],
        createdAt: '2026-08-02T00:00:00.000Z',
        updatedAt: '2026-08-02T00:00:00.000Z',
      }).success,
    ).toBe(false)
  })

  it('uses the replacement schema for demo ideas', () => {
    const data = createDemoData()
    const shared = data.ideas.find((item) => item.ideaId === 'demo-idea-orangery-tour')

    expect(shared?.waypointIds).toEqual(['demo-foxglove-manor', 'demo-bramblewick-gardens'])
    expect(ideaUsageCount(data.activities, 'demo-idea-orangery-tour')).toBe(2)
    expect(ideaUsageCount(data.activities, 'demo-idea-railway-picnic')).toBe(0)
    expect(data.ideas.find((item) => item.planningState === 'rejected')?.rejectionReason).toBeTruthy()
  })
})
