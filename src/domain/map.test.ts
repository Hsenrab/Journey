import { describe, expect, it } from 'vitest'
import { distanceMiles, filterWaypointsByStatus, orderNearbyWaypoints } from './map'
import type { Waypoint } from './visit'

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
})
