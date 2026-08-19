import { describe, expect, it } from 'vitest'
import {
  completedWaypointCount,
  createActivity,
  createDemoData,
  createSeedData,
  statusForWaypoint,
  validateActivityCategory,
  waypointSupportsActivityCategory,
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
