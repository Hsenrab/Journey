import { describe, expect, it } from 'vitest'
import {
  ActivitySchema,
  IdeaSchema,
  activitiesForWaypoint,
  activitiesUsingIdea,
  awardableStatuses,
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
import { waypointCoordinates } from './map'
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
    expect(data.waypoints.every((item) => waypointCoordinates(item) !== undefined)).toBe(true)
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
      'demo-thistledown-priory',
      'demo-marlpit-water-garden',
      'demo-wychwood-night-walk',
      'demo-puddlebrook-paddle',
      'demo-copper-kettle-trail',
      'demo-glasshouse-workshop',
      'demo-tannery-lane-pottery',
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
    const categorized = data.activities.filter((activity) => activity.category)

    expect(data.challenges.filter((challenge) => challenge.supportsActivityCategories)).toEqual([
      expect.objectContaining({ challengeId: 'national-trust' }),
    ])
    expect(categorized.every((activity) => waypointSupportsActivityCategory(data, activity.waypointId))).toBe(true)
    for (const category of awardableStatuses) {
      expect(categorized.filter((activity) => activity.category === category).length).toBeGreaterThan(1)
    }
    expect(
      data.activities.find((activity) => activity.waypointId === 'demo-wychwood-night-walk')?.category,
    ).toBeUndefined()
  })

  it('mixes repeat visits, single visits and unvisited waypoints across several years', () => {
    const data = createDemoData()
    const visitCounts = data.waypoints.map(
      (waypoint) => activitiesForWaypoint(data.activities, waypoint.waypointId).length,
    )
    const years = new Set(data.activities.map((activity) => activity.date.slice(0, 4)))

    expect(activitiesForWaypoint(data.activities, 'demo-foxglove-manor')).toHaveLength(2)
    expect(activitiesForWaypoint(data.activities, 'demo-puddlebrook-paddle')).toHaveLength(2)
    expect(activitiesForWaypoint(data.activities, 'demo-lantern-hill-fort')).toEqual([])
    expect(visitCounts.filter((count) => count > 1).length).toBeGreaterThan(1)
    expect(visitCounts.filter((count) => count === 1).length).toBeGreaterThan(1)
    expect(visitCounts.filter((count) => count === 0).length).toBeGreaterThan(1)
    expect(years.size).toBeGreaterThan(2)
    expect(new Set(data.activities.map((activity) => activity.date.slice(0, 7))).size).toBeGreaterThan(5)
  })

  it('shows partial progress for every challenge that has waypoints', () => {
    const data = createDemoData()
    const visited = new Set(data.activities.map((activity) => activity.waypointId))

    for (const challenge of data.challenges) {
      const completed = challenge.waypointIds.filter((waypointId) => visited.has(waypointId))
      if (challenge.waypointIds.length === 0) {
        expect(completed).toEqual([])
        continue
      }
      expect(completed.length).toBeGreaterThan(0)
      expect(completed.length).toBeLessThan(challenge.waypointIds.length)
    }
    expect(data.challenges.filter((challenge) => challenge.waypointIds.length === 0)).toHaveLength(1)
  })

  it('links photo references to some waypoints and activities but not all', () => {
    const data = createDemoData()
    const photoIds = new Set(data.photoReferences.map((photo) => photo.photoReferenceId))
    const linked = [...data.waypoints, ...data.activities].flatMap((entity) => entity.photoReferenceIds)

    expect(photoIds.size).toBeGreaterThan(5)
    expect(linked.every((photoReferenceId) => photoIds.has(photoReferenceId))).toBe(true)
    expect(new Set(linked)).toEqual(photoIds)
    expect(data.activities.filter((activity) => activity.photoReferenceIds.length > 0).length).toBeGreaterThan(3)
    expect(data.activities.some((activity) => activity.photoReferenceIds.length === 0)).toBe(true)
    expect(data.waypoints.some((waypoint) => waypoint.photoReferenceIds.length > 1)).toBe(true)
    expect(data.waypoints.some((waypoint) => waypoint.photoReferenceIds.length === 0)).toBe(true)
  })

  it('shares references and categories across several waypoints', () => {
    const data = createDemoData()
    const referenceUse = new Map<string, number>()
    for (const waypoint of data.waypoints)
      for (const referenceId of waypoint.referenceIds)
        referenceUse.set(referenceId, (referenceUse.get(referenceId) ?? 0) + 1)
    const categoryUse = new Map<string, number>()
    for (const waypoint of data.waypoints)
      categoryUse.set(waypoint.category, (categoryUse.get(waypoint.category) ?? 0) + 1)

    expect([...referenceUse.values()].some((count) => count > 1)).toBe(true)
    expect(data.waypoints.some((waypoint) => waypoint.referenceIds.length > 1)).toBe(true)
    expect(data.waypoints.some((waypoint) => waypoint.referenceIds.length === 0)).toBe(true)
    expect([...categoryUse.values()].filter((count) => count > 1).length).toBeGreaterThan(2)
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
    const stateCounts = new Map<Idea['planningState'], number>()
    for (const item of data.ideas) stateCounts.set(item.planningState, (stateCounts.get(item.planningState) ?? 0) + 1)

    expect(shared?.waypointIds).toEqual(['demo-foxglove-manor', 'demo-bramblewick-gardens'])
    expect(ideaUsageCount(data.activities, 'demo-idea-orangery-tour')).toBe(3)
    expect(ideaUsageCount(data.activities, 'demo-idea-mill-machinery-day')).toBe(2)
    expect(ideaUsageCount(data.activities, 'demo-idea-railway-picnic')).toBe(0)
    expect(ideaUsageCount(data.activities, 'demo-idea-winter-lantern-trail')).toBe(0)
    for (const state of ['active', 'someday', 'rejected'] as const)
      expect(stateCounts.get(state) ?? 0).toBeGreaterThan(1)
    expect(data.ideas.filter((item) => item.planningState === 'rejected').every((item) => item.rejectionReason)).toBe(
      true,
    )
  })
})
