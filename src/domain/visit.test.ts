import { describe, expect, it } from 'vitest'
import {
  completedWaypointCount,
  createActivity,
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
