import { beforeEach, describe, expect, it } from 'vitest'
import {
  backupVersion,
  createBackup,
  createDefaultData,
  createDemoModeData,
  load,
  parseImport,
  save,
  setDemoMode,
} from './storage'
import { challengeMilestone, statusForWaypoint, type Activity, type WaypointsData } from '../domain/visit'

const activity: Activity = {
  activityId: 'a1',
  waypointId: 'dyrham-park',
  challengeId: 'national-trust',
  date: '2026-08-01',
  status: 'silver',
  location: { placeName: 'Dyrham Park', addressOrRegion: 'South Gloucestershire' },
  notes: 'Great day',
  photos: ['dyrham-park.jpg'],
  referenceIds: [],
  photoReferenceIds: [],
  createdAt: '2026-08-01T10:00:00.000Z',
  updatedAt: '2026-08-01T10:00:00.000Z',
}

const backup = (overrides: { version?: number; data?: Partial<WaypointsData> } = {}) =>
  JSON.stringify({
    version: overrides.version ?? backupVersion,
    exportedAt: '2026-08-01T00:00:00.000Z',
    data: { ...createDefaultData(), activities: [activity], ...(overrides.data ?? {}) },
  })

describe('load', () => {
  beforeEach(() => localStorage.clear())

  it('returns seeded waypoints when nothing is stored', () => {
    expect(load().waypoints.length).toBeGreaterThan(0)
  })

  it('returns previously saved data', () => {
    const seed = createDefaultData()
    save({ ...seed, activities: [{ ...activity, status: 'gold' }] })
    expect(load()).toMatchObject({ activities: [{ waypointId: 'dyrham-park', status: 'gold' }] })
  })

  it('falls back to seeded data when stored data is corrupted', () => {
    localStorage.setItem('waypoints-v1', '{not valid json')
    expect(load().waypoints.length).toBeGreaterThan(0)
  })

  it('falls back to seeded data when stored data fails validation', () => {
    localStorage.setItem('waypoints-v1', '{"activities":[{"status":"unknown"}]}')
    expect(load().waypoints.length).toBeGreaterThan(0)
  })

  it('loads demo data when demo mode is enabled', () => {
    setDemoMode(true)
    expect(load()).toMatchObject({ waypoints: createDemoModeData().waypoints })
  })
})

describe('save', () => {
  beforeEach(() => localStorage.clear())

  it('persists waypoints data to localStorage as JSON', () => {
    const data: WaypointsData = { ...createDefaultData(), activities: [{ ...activity, status: 'bronze' as const }] }
    save(data)
    expect(JSON.parse(localStorage.getItem('waypoints-v1')!)).toEqual(data)
  })

  it('keeps personal and demo data in separate storage partitions', () => {
    const personal = { ...createDefaultData(), activities: [{ ...activity, status: 'silver' as const }] }
    save(personal)

    setDemoMode(true)
    const demo = load()
    save({ ...demo, activities: [{ ...activity, activityId: 'demo-only', status: 'gold' }] })

    setDemoMode(false)
    expect(load().activities).toEqual(personal.activities)

    setDemoMode(true)
    expect(load().activities).toEqual([{ ...activity, activityId: 'demo-only', status: 'gold' }])
  })
})

describe('createBackup', () => {
  it('wraps data in a versioned envelope that can be imported back', () => {
    const exported = createBackup({ ...createDefaultData(), activities: [activity] })
    expect(exported.version).toBe(backupVersion)
    expect(parseImport(JSON.stringify(exported))).toMatchObject({
      activities: [{ waypointId: 'dyrham-park', status: 'silver' }],
    })
  })
})

describe('parseImport', () => {
  it('accepts a portable waypoints backup', () => {
    expect(parseImport(backup())).toMatchObject({ activities: [{ waypointId: 'dyrham-park', status: 'silver' }] })
  })

  it('accepts an empty activities list', () => {
    expect(parseImport(backup({ data: { activities: [] } })).activities).toEqual([])
  })

  it('rejects files that are not JSON', () => {
    expect(() => parseImport('not json')).toThrow()
  })

  it('rejects unsupported versions', () => {
    expect(() => parseImport(backup({ version: backupVersion + 1 }))).toThrow()
  })

  it('rejects malformed activity records', () => {
    expect(() => parseImport(backup({ data: { activities: [{ status: 'silver' } as unknown as Activity] } }))).toThrow()
  })

  it('rejects unknown statuses', () => {
    expect(() =>
      parseImport(backup({ data: { activities: [{ ...activity, status: 'platinum' as never }] } })),
    ).toThrow()
  })

  it('rejects activities without location data', () => {
    expect(() =>
      parseImport(backup({ data: { activities: [{ ...activity, location: {} as unknown as Activity['location'] }] } })),
    ).toThrow()
  })

  it('rejects dates that are not YYYY-MM-DD', () => {
    expect(() => parseImport(backup({ data: { activities: [{ ...activity, date: '01/08/2026' }] } }))).toThrow()
  })

  it('rejects impossible calendar dates', () => {
    expect(() => parseImport(backup({ data: { activities: [{ ...activity, date: '2026-02-30' }] } }))).toThrow()
  })
})

describe('createDemoModeData', () => {
  it('creates varied linked demo entities', () => {
    const demo = createDemoModeData()
    expect(demo.waypoints.length).toBeGreaterThanOrEqual(5)
    expect(demo.waypoints.length).toBeLessThanOrEqual(10)
    expect(demo.challenges.length).toBeGreaterThanOrEqual(5)
    expect(demo.challenges.length).toBeLessThanOrEqual(10)
    expect(demo.ideas.length).toBeGreaterThanOrEqual(5)
    expect(demo.ideas.length).toBeLessThanOrEqual(10)
    expect(demo.activities.length).toBeGreaterThanOrEqual(5)
    expect(demo.activities.length).toBeLessThanOrEqual(10)

    const waypointIds = new Set(demo.waypoints.map((waypoint) => waypoint.waypointId))
    expect(demo.challenges.flatMap((challenge) => challenge.waypointIds).every((id) => waypointIds.has(id))).toBe(true)
    expect(demo.ideas.every((idea) => idea.waypointIds.every((waypointId) => waypointIds.has(waypointId)))).toBe(true)
    expect(
      demo.activities
        .filter((demoActivity) => demoActivity.waypointId)
        .every((demoActivity) => waypointIds.has(demoActivity.waypointId!)),
    ).toBe(true)
  })

  it('covers representative statuses, challenge progress, links, and standalone examples', () => {
    const demo = createDemoModeData()
    const statusCounts = demo.waypoints.reduce<Record<string, number>>((counts, waypoint) => {
      const status = statusForWaypoint(demo.activities, waypoint.waypointId)
      counts[status] = (counts[status] ?? 0) + 1
      return counts
    }, {})

    expect(statusCounts).toMatchObject({ 'not-started': 2, bronze: 1, silver: 3, gold: 2 })
    expect(demo.waypoints.some((waypoint) => waypoint.completion.mode === 'count')).toBe(true)
    expect(new Set(demo.waypoints.map((waypoint) => waypoint.category)).size).toBeGreaterThanOrEqual(4)
    expect(new Set(demo.waypoints.map((waypoint) => waypoint.location?.addressOrRegion)).size).toBeGreaterThanOrEqual(4)

    const multiActivityWaypoint = demo.waypoints[0]!
    expect(demo.activities.filter((demoActivity) => demoActivity.waypointId === multiActivityWaypoint.waypointId)).toHaveLength(
      2,
    )
    expect(statusForWaypoint(demo.activities, multiActivityWaypoint.waypointId)).toBe('silver')
    expect(demo.activities.map((demoActivity) => demoActivity.date).sort()).toEqual([
      '2026-07-01',
      '2026-07-08',
      '2026-07-12',
      '2026-07-20',
      '2026-07-23',
      '2026-07-27',
      '2026-07-31',
      '2026-08-02',
    ])
    expect(
      demo.activities.some(
        (demoActivity) =>
          demoActivity.notes &&
          demoActivity.referenceIds.length > 0 &&
          (demoActivity.photos.length > 0 || demoActivity.photoReferenceIds.length > 0),
      ),
    ).toBe(true)

    const completedChallenge = demo.challenges.find((challenge) => challenge.challengeId === 'completed-highlights')!
    const completedWaypoints = demo.waypoints.filter((waypoint) => completedChallenge.waypointIds.includes(waypoint.waypointId))
    expect(challengeMilestone(completedWaypoints, demo.activities)).toBe('gold')

    const partialChallenge = demo.challenges.find((challenge) => challenge.challengeId === 'national-trust')!
    const partialWaypoints = demo.waypoints.filter((waypoint) => partialChallenge.waypointIds.includes(waypoint.waypointId))
    expect(challengeMilestone(partialWaypoints, demo.activities)).toBe('silver')

    expect(demo.challenges).toContainEqual(expect.objectContaining({ challengeId: 'future-shortlist', waypointIds: [] }))
    expect(demo.ideas).toContainEqual(expect.objectContaining({ ideaId: 'idea-standalone', waypointIds: [], challengeIds: [] }))
  })
})
