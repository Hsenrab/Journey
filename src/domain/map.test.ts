import { describe, expect, it } from 'vitest'
import { completionStateForWaypoint, distanceMiles, filterWaypointsByStatus, orderNearbyWaypoints } from './map'
import type { Activity, Waypoint } from './visit'

const waypoint = (waypointId: string, title: string, latitude?: number): Waypoint => ({
  waypointId,
  title,
  description: 'Description',
  category: 'Castle',
  tags: [],
  challengeIds: [],
  completion: { mode: 'once' },
  location: latitude === undefined ? undefined : { latitude, longitude: -2 },
  referenceIds: [],
  photoReferenceIds: [],
})

describe('map domain helpers', () => {
  it('filters by the selected status', () => {
    const waypoints = [waypoint('one', 'One'), waypoint('two', 'Two')]
    expect(filterWaypointsByStatus(waypoints, ['gold'], (id) => (id === 'one' ? 'gold' : 'bronze'))).toEqual([
      waypoints[0],
    ])
  })

  it('orders nearby waypoints in miles, omitting records without coordinates', () => {
    const results = orderNearbyWaypoints(
      [waypoint('far', 'Far', 52), waypoint('missing', 'Missing'), waypoint('near', 'Near', 51.5)],
      { latitude: 51.4, longitude: -2 },
    )
    expect(results.map(({ waypoint: item }) => item.waypointId)).toEqual(['near', 'far'])
    expect(results[0]?.distanceMiles).toBeGreaterThan(0)
    expect(distanceMiles({ latitude: 51.4, longitude: -2 }, { latitude: 51.4, longitude: -2 })).toBe(0)
  })

  it('derives completion from the waypoint rule, not activity award categories', () => {
    const once = waypoint('once', 'Once')
    const count = { ...waypoint('count', 'Count'), completion: { mode: 'count' as const, target: 2 } }
    const activity = (waypointId: string, category?: Activity['category']): Activity => ({
      activityId: `${waypointId}-${category ?? 'uncategorised'}`,
      waypointId,
      date: '2026-08-10',
      category,
      location: { kind: 'coordinates', latitude: 51, longitude: -2 },
      notes: '',
      referenceIds: [],
      photoReferenceIds: [],
      createdAt: '2026-08-10T00:00:00.000Z',
      updatedAt: '2026-08-10T00:00:00.000Z',
    })

    expect(completionStateForWaypoint(once, [activity(once.waypointId)])).toBe('complete')
    expect(completionStateForWaypoint(once, [])).toBe('not-started')
    expect(completionStateForWaypoint(count, [activity(count.waypointId, 'gold')])).toBe('not-started')
    expect(completionStateForWaypoint(count, [activity(count.waypointId), activity(count.waypointId, 'bronze')])).toBe(
      'complete',
    )
  })
})
