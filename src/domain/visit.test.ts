import { describe, expect, it } from 'vitest'
import {
  ActivitySchema,
  ChallengeSchema,
  AwardDescriptionsSchema,
  awardStatistics,
  awardFilterError,
  validateAwardTransition,
  DataSchema,
  challengeWaypoints,
  IdeaSchema,
  PlannedRouteSchema,
  activitiesForWaypoint,
  activitiesUsingIdea,
  awardableStatuses,
  completedWaypointCount,
  challengeCompletionSummary,
  countLabel,
  completionProgressLabel,
  completionRuleLabel,
  createActivity,
  createDemoData,
  difficultyDescriptions,
  GpxGeometrySchema,
  ideaUsageCount,
  ideasForActivity,
  ideasForWaypoint,
  photoReferencesForActivity,
  referencesForActivity,
  statusForWaypoint,
  validateActivityCategory,
  waypointSupportsActivityCategory,
  waypointCompletionProgress,
  type Idea,
  type Waypoint,
  type WaypointsData,
} from './visit'
import { completionStateForWaypoint } from './map'
import { createAwardTestData, createJourneyTestData } from '../test/demoData'

describe('Activity evidence order', () => {
  const references = [
    { referenceId: 'r1', title: 'First reference', url: 'https://example.com/first' },
    { referenceId: 'r2', title: 'Second reference', url: 'https://example.com/second' },
    { referenceId: 'other', title: 'Unlinked reference', url: 'https://example.com/other' },
  ]
  const photos = [
    { photoReferenceId: 'p1', title: 'First photo', url: 'https://example.com/first.jpg' },
    { photoReferenceId: 'p2', title: 'Second photo', url: 'https://example.com/second.jpg' },
    { photoReferenceId: 'other', title: 'Unlinked photo', url: 'https://example.com/other.jpg' },
  ]
  const activity = createActivity({
    activityId: 'ordered',
    name: 'Ordered activity',
    date: '2026-08-01',
    location: { kind: 'postcode', postcode: 'GL1 1AA' },
    referenceIds: ['r2', 'r1'],
    photoReferenceIds: ['p2', 'p1'],
  })

  it('resolves only linked evidence in saved order without changing collection order', () => {
    expect(referencesForActivity(references, activity)).toEqual([references[1], references[0]])
    expect(photoReferencesForActivity(photos, activity)).toEqual([photos[1], photos[0]])
    expect(references.map((item) => item.referenceId)).toEqual(['r1', 'r2', 'other'])
    expect(photos.map((item) => item.photoReferenceId)).toEqual(['p1', 'p2', 'other'])
  })

  it('returns no evidence for empty link arrays', () => {
    const empty = { ...activity, referenceIds: [], photoReferenceIds: [] }
    expect(referencesForActivity(references, empty)).toEqual([])
    expect(photoReferencesForActivity(photos, empty)).toEqual([])
  })

  it('fails explicitly for a missing linked reference', () => {
    expect(() => referencesForActivity(references, { ...activity, referenceIds: ['missing'] })).toThrow(
      'Activity "ordered" references unknown reference "missing".',
    )
  })

  it('fails explicitly for a missing linked photo', () => {
    expect(() => photoReferencesForActivity(photos, { ...activity, photoReferenceIds: ['missing'] })).toThrow(
      'Activity "ordered" references unknown photo reference "missing".',
    )
  })
})

describe('Challenge completion summary', () => {
  it('uses completed members rather than Activities, rounds percentages, and handles empty membership', () => {
    const data = createJourneyTestData(true)
    const members = challengeWaypoints(data.challenges[0]!, data.waypoints)
    expect(challengeCompletionSummary(members, data.activities)).toEqual({ completed: 1, total: 2, percentage: 50 })
    const extra = createActivity({
      activityId: 'threshold',
      name: 'Threshold',
      waypointId: 'counted',
      date: '2026-08-02',
      location: { kind: 'postcode', postcode: 'GL1' },
    })
    expect(challengeCompletionSummary(members, [...data.activities, extra])).toEqual({
      completed: 2,
      total: 2,
      percentage: 100,
    })
    expect(
      challengeCompletionSummary(members, [...data.activities, extra, { ...extra, activityId: 'above' }]).completed,
    ).toBe(2)
    expect(challengeCompletionSummary([], data.activities)).toEqual({ completed: 0, total: 0, percentage: 0 })
    expect(challengeCompletionSummary([...members, data.waypoints[2]!], data.activities).percentage).toBe(33)
  })
})

describe('canonical Challenge assignments', () => {
  it.each([{ waypointIds: [] }, { waypointIds: ['demo-foxglove-manor'] }])(
    'rejects obsolete Challenge member lists: $waypointIds',
    ({ waypointIds }) => {
      const challenge = createDemoData().challenges[0]!
      expect(() => ChallengeSchema.parse({ ...challenge, waypointIds })).toThrow('Challenge.waypointIds is obsolete')
    },
  )

  it('rejects duplicate and missing Challenge assignments without repairing them', () => {
    const data = createDemoData()
    const waypoint = data.waypoints[0]!
    waypoint.challengeIds = ['national-trust', 'national-trust']
    expect(() => DataSchema.parse(data)).toThrow('Waypoint challenge links must be distinct')
    waypoint.challengeIds = ['missing']
    const invalid = DataSchema.safeParse(data)
    expect(invalid.success).toBe(false)
    if (!invalid.success)
      expect(invalid.error.issues).toContainEqual(
        expect.objectContaining({
          message: 'Waypoint "demo-foxglove-manor" references unknown challenge "missing".',
        }),
      )
    expect(waypoint.challengeIds).toEqual(['missing'])
  })

  it('derives overlapping and empty member sets solely from Waypoints', () => {
    const data = createDemoData()
    const first = data.challenges[0]!
    const second = data.challenges[1]!
    const shared = { ...data.waypoints[0]!, challengeIds: [first.challengeId, second.challengeId] }
    const outside = { ...data.waypoints[1]!, challengeIds: [] }
    expect(challengeWaypoints(first, [shared, outside])).toEqual([shared])
    expect(challengeWaypoints(second, [shared, outside])).toEqual([shared])
    expect(challengeWaypoints(first, [outside])).toEqual([])
  })
})

function waypoint(waypointId: string): Waypoint {
  return {
    waypointId,
    title: waypointId.toUpperCase(),
    description: `${waypointId} description`,
    category: 'Historic building',
    tags: ['Test'],
    challengeIds: ['challenge-1'],
    completion: { mode: 'once' },
    location: { placeName: waypointId },
    referenceIds: [],
    photoReferenceIds: [],
  }
}

describe('activity rules', () => {
  it.each([
    [0, 'activity', '0 activities'],
    [1, 'activity', '1 activity'],
    [2, 'linked activity', '2 linked activities'],
    [2, 'waypoint', '2 waypoints'],
  ] as const)('labels %s %s with the correct unit', (count, singular, expected) => {
    expect(countLabel(count, singular)).toBe(expected)
  })
  it('validates awards and Activity links even when the dataset has no Waypoints', () => {
    const data = { ...createAwardTestData(), waypoints: [], activities: [] }
    const activity = createActivity({
      name: 'Independent',
      date: '2026-08-01',
      location: { kind: 'coordinates', latitude: 51, longitude: -2 },
    })
    expect(DataSchema.safeParse({ ...data, activities: [activity] }).success).toBe(true)
    expect(() => DataSchema.parse({ ...data, activities: [{ ...activity, category: 'gold' }] })).toThrow(
      'does not support awards',
    )
    expect(() => DataSchema.parse({ ...data, activities: [{ ...activity, waypointId: 'missing' }] })).toThrow(
      'unknown Waypoint',
    )
    expect(() => DataSchema.parse({ ...data, activities: [{ ...activity, challengeId: 'missing' }] })).toThrow(
      'unknown Challenge',
    )
  })
  it('requires trimmed titles and real non-future dates on persisted and draft records', () => {
    const activity = createActivity({
      name: '  Evening walk  ',
      date: '2024-02-29',
      location: { kind: 'coordinates', latitude: 51, longitude: -2 },
    })
    expect(activity.name).toBe('Evening walk')
    for (const name of [undefined, '', ' \t '])
      expect(ActivitySchema.safeParse({ ...activity, name }).success).toBe(false)
    for (const date of ['', '2026-02-29', '9999-01-01'])
      expect(ActivitySchema.safeParse({ ...activity, date }).success).toBe(false)
    expect(() =>
      DataSchema.parse({ ...createDemoData(), activities: [activity, { ...activity, activityId: 'other' }] }),
    ).not.toThrow()
  })
  it('creates an activity with stable id/timestamps', () => {
    const activity = createActivity({
      name: 'Recorded activity',
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
        name: 'Recorded activity',
        date: '2026-08-01',
        location: { kind: 'postcode', postcode: '   ' },
      }),
    ).toThrow()

    expect(() =>
      createActivity({
        name: 'Recorded activity',
        date: '2026-08-01',
        location: { kind: 'coordinates', latitude: 120, longitude: 0 },
      }),
    ).toThrow()
  })

  it('preserves validated recorded GPX geometry as distinct segments', () => {
    const recordedTrack = GpxGeometrySchema.parse({
      type: 'MultiLineString' as const,
      coordinates: [
        [
          [-2.1, 51.1],
          [-2.2, 51.2],
        ],
        [
          [-3.1, 52.1],
          [-3.2, 52.2],
        ],
      ],
    })
    const activity = createActivity({
      name: 'Recorded activity',
      date: '2026-09-04',
      location: { kind: 'coordinates', latitude: 51.415, longitude: -2.123 },
      recordedTrack,
    })

    expect(activity.recordedTrack?.coordinates).toEqual(recordedTrack.coordinates)
    expect(() => ActivitySchema.parse({ ...activity, location: undefined })).toThrow()
    expect(() =>
      ActivitySchema.parse({
        ...activity,
        recordedTrack: {
          ...recordedTrack,
          coordinates: [
            [
              [-181, 0],
              [0, 0],
            ],
          ],
        },
      }),
    ).toThrow()
  })

  it('keeps recorded tracks optional and independent of activity completion', () => {
    const activity = createActivity({
      name: 'Recorded activity',
      waypointId: 'no-track',
      date: '2026-09-04',
      location: { kind: 'coordinates', latitude: 51.415, longitude: -2.123 },
    })
    const trackedActivity = createActivity({
      name: 'Recorded activity',
      waypointId: 'no-track',
      date: '2026-09-05',
      location: { kind: 'coordinates', latitude: 51.415, longitude: -2.123 },
      recordedTrack: {
        type: 'MultiLineString',
        coordinates: [
          [
            [-2.1, 51.1],
            [-2.2, 51.2],
          ],
        ],
      },
    })

    expect(activity.recordedTrack).toBeUndefined()
    expect(waypointCompletionProgress(waypoint('no-track'), [activity, trackedActivity])).toEqual({
      count: 2,
      target: 1,
      complete: true,
    })
  })

  it('requires awards exactly when the linked Waypoint is eligible', () => {
    const waypointId = 'waypoint-1'
    const data: WaypointsData = {
      waypoints: [waypoint(waypointId)],
      challenges: [
        {
          challengeId: 'challenge-1',
          title: 'Test challenge',
          description: 'A challenge for this test.',
          supportsActivityCategories: true,
          awardDescriptions: { bronze: 'Afternoon', silver: 'Full day', gold: 'Overnight' },
        },
      ],
      ideas: [],
      activities: [],
      references: [],
      photoReferences: [],
    }
    expect(waypointSupportsActivityCategory(data, waypointId)).toBe(true)

    const activity = createActivity({
      name: 'Recorded activity',
      waypointId,
      date: '2026-08-01',
      category: 'gold',
      location: { kind: 'postcode', postcode: 'SN15 2LG' },
    })
    expect(() => validateActivityCategory(data, activity)).not.toThrow()
    expect(() => validateActivityCategory(data, { ...activity, category: undefined })).toThrow('requires a Bronze')

    const unsupported: WaypointsData = {
      ...data,
      challenges: data.challenges.map(({ awardDescriptions: _removed, ...challenge }) => ({
        ...challenge,
        supportsActivityCategories: false,
      })),
    }
    expect(() => validateActivityCategory(unsupported, activity)).toThrow('does not support awards')
  })

  describe('Challenge award explanations and graph validation', () => {
    it('keeps exact member and Activity distributions distinct and globally deduplicated', () => {
      const data = createAwardTestData()
      const stats = awardStatistics(data, 'award-a')
      expect(stats.waypoints).toHaveLength(3)
      expect(stats.activities).toHaveLength(4)
      expect(
        Object.fromEntries(Object.entries(stats.waypointAwards).map(([tier, records]) => [tier, records.length])),
      ).toEqual({ 'not-started': 1, bronze: 0, silver: 1, gold: 1 })
      expect(
        Object.fromEntries(Object.entries(stats.activityAwards).map(([tier, records]) => [tier, records.length])),
      ).toEqual({ bronze: 2, silver: 1, gold: 1 })
      expect(awardStatistics(data).activities).toHaveLength(4)
      expect(awardStatistics(data).waypoints).toHaveLength(3)
      expect(awardStatistics(data, 'ordinary').supportsAwards).toBe(false)
      expect(awardStatistics(data, 'ordinary').activities).toHaveLength(4)
      expect(awardStatistics(data, 'empty').waypoints).toHaveLength(0)
    })
    it('recalculates the maximum, exact counts, and member records after editing, deleting, or moving Gold', () => {
      const data = createAwardTestData()
      const gold = data.activities.find((item) => item.category === 'gold')!
      for (const change of ['edit', 'delete', 'move']) {
        const next = {
          ...data,
          activities: data.activities.flatMap((item) =>
            item !== gold
              ? [item]
              : change === 'delete'
                ? []
                : [{ ...item, ...(change === 'edit' ? { category: 'bronze' as const } : { waypointId: 'award-w2' }) }],
          ),
        }
        const stats = awardStatistics(next, 'award-a')
        expect(stats.waypointAwards.bronze.map((item) => item.waypointId)).toEqual(['award-w1'])
        expect(stats.waypointAwards.gold.map((item) => item.waypointId)).toEqual(change === 'move' ? ['award-w2'] : [])
        expect(stats.activityAwards.gold).toHaveLength(change === 'move' ? 1 : 0)
      }
    })
    it('blocks disguised history loss but permits shared-Challenge removal', () => {
      const data = createAwardTestData()
      const candidate = {
        ...data,
        challenges: data.challenges.filter((item) => item.challengeId !== 'award-b'),
        waypoints: data.waypoints.map((item) => ({
          ...item,
          challengeIds: item.challengeIds.filter((id) => id !== 'award-b'),
        })),
      }
      expect(() => validateAwardTransition(data, candidate)).not.toThrow()
      const invalid = {
        ...candidate,
        waypoints: candidate.waypoints.map((item) => ({ ...item, challengeIds: [] })),
        activities: candidate.activities.map((item) => ({ ...item, category: undefined })),
      }
      expect(() => DataSchema.parse(invalid)).not.toThrow()
      expect(() => validateAwardTransition(data, invalid)).toThrow('award-visit-0')
      expect(() =>
        DataSchema.parse({
          ...data,
          challenges: data.challenges.map((item) =>
            item.challengeId !== 'ordinary'
              ? item
              : { ...item, supportsActivityCategories: true, awardDescriptions: data.challenges[0]!.awardDescriptions },
          ),
        }),
      ).toThrow('ordinary-visit')
    })
    it('rejects invalid filters and preserves valid zero-result buckets', () => {
      const data = createAwardTestData()
      expect(awardFilterError(data, { challengeId: 'missing' })).toContain('Unknown Challenge')
      expect(awardFilterError(data, { status: 'platinum' })).toContain('Invalid')
      expect(awardFilterError(data, { award: 'not-started' })).toContain('Invalid')
      expect(awardFilterError(data, { challengeId: 'ordinary', status: 'gold' })).toContain('ordinary')
      expect(awardFilterError(data, { challengeId: 'award-a', status: 'bronze' })).toBeUndefined()
      expect(awardStatistics(data, 'award-a').waypointAwards.bronze).toEqual([])
    })
    it('requires exactly three explicit nonblank explanations only when enabled', () => {
      const challenge = createDemoData().challenges[0]!
      expect(AwardDescriptionsSchema.parse({ bronze: ' Afternoon ', silver: 'Day', gold: 'Night' }).bronze).toBe(
        'Afternoon',
      )
      for (const awardDescriptions of [
        undefined,
        {},
        { bronze: 'Afternoon' },
        { bronze: ' ', silver: 'Day', gold: 'Night' },
        { bronze: 'Afternoon', silver: 'Day', gold: 'Night', platinum: 'Week' },
      ])
        expect(ChallengeSchema.safeParse({ ...challenge, awardDescriptions }).success).toBe(false)
      expect(ChallengeSchema.safeParse({ ...challenge, supportsActivityCategories: false }).success).toBe(false)
      const { awardDescriptions: _removed, ...ordinary } = challenge
      expect(ChallengeSchema.safeParse({ ...ordinary, supportsActivityCategories: false }).success).toBe(true)
    })

    it('rejects missing eligible awards, supplied ineligible awards, and dangling Waypoints', () => {
      const data = createDemoData()
      const awarded = data.activities.find((activity) => activity.category)!
      for (const invalid of [
        { ...awarded, category: undefined },
        { ...awarded, waypointId: undefined },
        { ...awarded, waypointId: 'missing' },
      ]) {
        const result = DataSchema.safeParse({ ...data, activities: [invalid] })
        expect(result.success).toBe(false)
        if (!result.success) expect(result.error.message).toContain(awarded.activityId)
      }
    })
  })

  it('counts completion independently from category summaries', () => {
    const waypoints = [waypoint('a')]
    const uncategorized = createActivity({
      name: 'Recorded activity',
      waypointId: 'a',
      date: '2026-08-01',
      location: { kind: 'postcode', postcode: 'GL3 4AQ' },
    })

    expect(completedWaypointCount(waypoints, [uncategorized])).toBe(1)
    expect(statusForWaypoint([uncategorized], 'a')).toBe('not-started')
  })

  it('derives completion progress for once waypoints', () => {
    const once = waypoint('a')
    const visit = createActivity({
      name: 'Recorded activity',
      waypointId: 'a',
      date: '2026-08-01',
      location: { kind: 'postcode', postcode: 'GL3' },
    })

    const notDone = waypointCompletionProgress(once, [])
    expect(notDone).toEqual({ count: 0, target: 1, complete: false })
    expect(completionProgressLabel(once, notDone)).toBe('Not done')

    const done = waypointCompletionProgress(once, [visit, { ...visit, activityId: 'other', waypointId: 'b' }])
    expect(done).toEqual({ count: 1, target: 1, complete: true })
    expect(completionProgressLabel(once, done)).toBe('Done')
    expect(completionRuleLabel(once)).toBe('Completed after one logged activity.')
  })

  it('derives completion progress toward a count target consistently with completion totals', () => {
    const counted: Waypoint = { ...waypoint('a'), completion: { mode: 'count', target: 5 } }
    const visit = createActivity({
      name: 'Recorded activity',
      waypointId: 'a',
      date: '2026-08-01',
      location: { kind: 'postcode', postcode: 'GL3' },
    })
    const visits = (count: number) => Array.from({ length: count }, (_, i) => ({ ...visit, activityId: `v${i}` }))

    const zero = waypointCompletionProgress(counted, [])
    expect(zero).toEqual({ count: 0, target: 5, complete: false })
    expect(completionProgressLabel(counted, zero)).toBe('0 of 5 activities')
    const exceeded = waypointCompletionProgress(counted, visits(7))
    expect(exceeded).toEqual({ count: 7, target: 5, complete: true })
    expect(completionProgressLabel(counted, exceeded)).toBe('7 of 5 activities')

    const partial = waypointCompletionProgress(counted, visits(2))
    expect(partial).toEqual({ count: 2, target: 5, complete: false })
    expect(completionProgressLabel(counted, partial)).toBe('2 of 5 activities')
    expect(completedWaypointCount([counted], visits(2))).toBe(0)
    expect(completionStateForWaypoint(counted, visits(2))).toBe('not-started')

    const singleTarget = { ...counted, completion: { mode: 'count' as const, target: 1 } }
    expect(completionProgressLabel(singleTarget, waypointCompletionProgress(singleTarget, []))).toBe('0 of 1 activity')

    const reached = waypointCompletionProgress(counted, visits(5))
    expect(reached).toEqual({ count: 5, target: 5, complete: true })
    expect(completionProgressLabel(counted, reached)).toBe('5 of 5 activities')
    expect(completedWaypointCount([counted], visits(5))).toBe(1)
    expect(completionStateForWaypoint(counted, visits(5))).toBe('complete')

    expect(completionRuleLabel(counted)).toBe('Completed after 5 logged activities.')
    expect(completionRuleLabel({ ...counted, completion: { mode: 'count', target: 1 } })).toBe(
      'Completed after 1 logged activity.',
    )
  })
})

describe('planned route schema', () => {
  it('accepts 255-character filenames and rejects 256-character filenames', () => {
    const route = {
      geometry: {
        type: 'MultiLineString' as const,
        coordinates: [
          [
            [-2.1, 51.1],
            [-2.2, 51.2],
          ],
        ],
      },
    }

    expect(PlannedRouteSchema.safeParse({ ...route, fileName: 'a'.repeat(255) }).success).toBe(true)
    expect(PlannedRouteSchema.safeParse({ ...route, fileName: 'a'.repeat(256) }).success).toBe(false)
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
      'demo-cotswold-north-beacon',
      'demo-cotswold-midway-gate',
      'demo-cotswold-south-view',
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
    expect(visitCounts.filter((count) => count > 1).length).toBe(2)
    expect(visitCounts.filter((count) => count === 1).length).toBe(8)
    expect(visitCounts.filter((count) => count === 0).length).toBe(4)
    expect([...years].sort()).toEqual(['2024', '2025', '2026'])
    expect(new Set(data.activities.map((activity) => activity.date.slice(0, 7))).size).toBe(8)
  })

  it('shows partial progress for every challenge that has waypoints', () => {
    const data = createDemoData()
    for (const challenge of data.challenges) {
      const members = challengeWaypoints(challenge, data.waypoints)
      const completed = completedWaypointCount(members, data.activities)
      if (members.length === 0) {
        expect(completed).toBe(0)
        continue
      }
      expect(completed).toBeGreaterThan(0)
      expect(completed).toBeLessThan(members.length)
    }
    expect(data.challenges.filter((challenge) => challengeWaypoints(challenge, data.waypoints).length === 0)).toEqual([
      expect.objectContaining({ challengeId: 'future-shortlist' }),
    ])
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
    const categoryUse = new Map<string, number>()
    for (const waypoint of data.waypoints) {
      for (const referenceId of waypoint.referenceIds)
        referenceUse.set(referenceId, (referenceUse.get(referenceId) ?? 0) + 1)
      categoryUse.set(waypoint.category, (categoryUse.get(waypoint.category) ?? 0) + 1)
    }

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
      name: 'Recorded activity',
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
        name: 'Recorded activity',
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
    expect(ideaUsageCount(data.activities, 'demo-idea-heritage-open-day')).toBe(2)
    expect(ideaUsageCount(data.activities, 'demo-idea-canal-cycle-loop')).toBe(0)
    expect(ideaUsageCount(data.activities, 'demo-idea-railway-picnic')).toBe(0)
    expect(ideaUsageCount(data.activities, 'demo-idea-winter-lantern-trail')).toBe(0)
    expect(data.ideas.filter((item) => ideaUsageCount(data.activities, item.ideaId) === 0)).toHaveLength(3)
    for (const state of ['active', 'someday', 'rejected'] as const)
      expect(stateCounts.get(state) ?? 0).toBeGreaterThan(1)
    expect(data.ideas.filter((item) => item.planningState === 'rejected').every((item) => item.rejectionReason)).toBe(
      true,
    )
  })
})
