import { describe, expect, it } from 'vitest'
import {
  ActivitySchema,
  IdeaSchema,
  activitiesUsingIdea,
  completedWaypointCount,
  createActivity,
  createDemoData,
  createSeedData,
  difficultyDescriptions,
  ideaUsageCount,
  ideasForActivity,
  ideasForWaypoint,
  statusForWaypoint,
  validateActivityCategory,
  waypointSupportsActivityCategory,
  type Idea,
  type Waypoint,
  type WaypointsData,
} from './visit'
import { locations } from '../data/locations'

function waypoint(waypointId: string): Waypoint {
  return {
    waypointId,
    title: waypointId.toUpperCase(),
    description: `${waypointId} description`,
    category: 'Historic building',
    tags: ['Test'],
    challengeIds: ['national-trust'],
    completion: { mode: 'once' },
    location: { placeName: waypointId },
    referenceIds: [],
    photoReferenceIds: [],
  }
}

describe('activity rules', () => {
  it('creates an activity with stable id/timestamps', () => {
    const activity = createActivity({
      waypointId: 'lacock-abbey',
      date: '2026-08-01',
      category: 'bronze',
      location: { kind: 'postcode', postcode: 'SN15 2LG' },
    })
    expect(activity.activityId).not.toHaveLength(0)
    expect(activity.createdAt).toBe(activity.updatedAt)
  })

  it('rejects invalid postcode/coordinate payloads', () => {
    expect(() =>
      createActivity({
        date: '2026-08-01',
        location: { kind: 'postcode', postcode: '   ' },
      }),
    ).toThrow()

    expect(() =>
      createActivity({
        date: '2026-08-01',
        location: { kind: 'coordinates', latitude: 120, longitude: 0 },
      }),
    ).toThrow()
  })

  it('makes category optional and validates eligibility by challenge config', () => {
    const data = createSeedData(locations)
    const waypointId = data.waypoints[0]!.waypointId
    expect(waypointSupportsActivityCategory(data, waypointId)).toBe(true)

    const activity = createActivity({
      waypointId,
      date: '2026-08-01',
      category: 'gold',
      location: { kind: 'postcode', postcode: 'SN15 2LG' },
    })
    expect(() => validateActivityCategory(data, activity)).not.toThrow()

    const unsupported: WaypointsData = {
      ...data,
      challenges: data.challenges.map((challenge) => ({ ...challenge, supportsActivityCategories: false })),
    }
    expect(() => validateActivityCategory(unsupported, activity)).toThrow(
      'Selected waypoint does not support Bronze, Silver or Gold categories.',
    )
  })

  it('counts completion independently from category summaries', () => {
    const waypoints = [waypoint('a')]
    const uncategorized = createActivity({
      waypointId: 'a',
      date: '2026-08-01',
      location: { kind: 'postcode', postcode: 'GL3 4AQ' },
    })

    expect(completedWaypointCount(waypoints, [uncategorized])).toBe(1)
    expect(statusForWaypoint([uncategorized], 'a')).toBe('not-started')
  })
})

describe('demo data', () => {
  it('uses clearly fabricated, coordinate-bearing Gloucestershire places', () => {
    const data = createDemoData()

    expect(data.waypoints.map((waypoint) => waypoint.waypointId)).toEqual([
      'demo-foxglove-manor',
      'demo-bramblewick-gardens',
      'demo-cindercombe-mill',
      'demo-lantern-hill-fort',
      'demo-wychwood-night-walk',
      'demo-puddlebrook-paddle',
      'demo-copper-kettle-trail',
      'demo-glasshouse-workshop',
    ])
    expect(data.waypoints.every((waypoint) => waypoint.tags.includes('Fictional'))).toBe(true)
    expect(
      data.waypoints.every(
        (waypoint) => waypoint.location?.latitude !== undefined && waypoint.location.longitude !== undefined,
      ),
    ).toBe(true)
  })

  it('limits Bronze, Silver and Gold categories to the National Trust-style challenge', () => {
    const data = createDemoData()

    expect(data.challenges.filter((challenge) => challenge.supportsActivityCategories)).toEqual([
      expect.objectContaining({ challengeId: 'national-trust' }),
    ])
    expect(data.activities.find((activity) => activity.waypointId === 'demo-foxglove-manor')?.category).toBe('silver')
    expect(
      data.activities.find((activity) => activity.waypointId === 'demo-wychwood-night-walk')?.category,
    ).toBeUndefined()
  })
})

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

  it('uses the agreed difficulty guidance copy', () => {
    expect(difficultyDescriptions[1]).toContain('It could realistically be done tomorrow.')
    expect(difficultyDescriptions[2]).toContain('but remains simple to arrange.')
    expect(difficultyDescriptions[3]).toContain('coordination with others.')
    expect(difficultyDescriptions[4]).toContain('It is usually a big-ticket goal.')
  })
})

describe('idea and activity relationships', () => {
  const activity = (activityId: string, ideaIds: string[], waypointId?: string, date = '2026-08-02') =>
    createActivity({
      activityId,
      waypointId,
      ideaIds,
      date,
      location: { kind: 'postcode', postcode: 'GL3 4AQ' },
    })

  it('derives usage from activities rather than idea state', () => {
    const rejected = idea({ ideaId: 'idea-2', planningState: 'rejected', rejectionReason: 'Too far' })
    const activities = [
      activity('a1', ['idea-1', 'idea-2'], 'waypoint-1'),
      activity('a2', ['idea-2'], undefined, '2026-08-09'),
    ]

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
