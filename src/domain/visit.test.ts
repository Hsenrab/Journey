import { describe, expect, it } from 'vitest'
import {
  createActivity,
  progressTowards,
  recentlyVisited,
  statusCounts,
  statusForWaypoint,
  stillToVisit,
  suggestedNext,
  type Waypoint,
} from './visit'

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
  it('creates an activity with a stable id and timestamps', () => {
    const activity = createActivity({
      waypointId: 'lacock-abbey',
      date: '2026-08-01',
      status: 'bronze',
      location: { placeName: 'Lacock Abbey' },
    })
    expect(activity.activityId).not.toHaveLength(0)
    expect(activity.createdAt).toBe(activity.updatedAt)
  })

  it('rejects an invalid activity date', () => {
    expect(() =>
      createActivity({
        waypointId: 'lacock-abbey',
        date: 'yesterday',
        status: 'bronze',
        location: { placeName: 'Lacock Abbey' },
      }),
    ).toThrow()
  })

  it('rejects activities that do not include location data', () => {
    expect(() =>
      createActivity({
        waypointId: 'lacock-abbey',
        date: '2026-08-01',
        status: 'bronze',
        location: { placeName: '' },
      }),
    ).toThrow()
  })

  it('reports Not Started when no activity exists', () => {
    expect(statusForWaypoint([], 'lacock-abbey')).toBe('not-started')
  })

  it('derives the highest awarded status across multiple activities', () => {
    const activities = [
      createActivity({
        waypointId: 'lacock-abbey',
        date: '2026-08-01',
        status: 'bronze',
        location: { placeName: 'Lacock Abbey' },
      }),
      createActivity({
        waypointId: 'lacock-abbey',
        date: '2026-08-02',
        status: 'gold',
        location: { placeName: 'Lacock Abbey' },
      }),
      createActivity({
        waypointId: 'lacock-abbey',
        date: '2026-08-03',
        status: 'silver',
        location: { placeName: 'Lacock Abbey' },
      }),
      createActivity({
        waypointId: 'cliveden',
        date: '2026-08-03',
        status: 'bronze',
        location: { placeName: 'Cliveden' },
      }),
    ]
    expect(statusForWaypoint(activities, 'lacock-abbey')).toBe('gold')
    expect(statusForWaypoint(activities, 'cliveden')).toBe('bronze')
  })
})

const waypoints: Waypoint[] = ['a', 'b', 'c'].map(waypoint)

describe('progress across waypoints', () => {
  it('counts waypoints by derived status', () => {
    const activities = [
      createActivity({ waypointId: 'a', date: '2026-01-01', status: 'bronze', location: { placeName: 'A' } }),
      createActivity({ waypointId: 'b', date: '2026-01-02', status: 'gold', location: { placeName: 'B' } }),
    ]
    expect(statusCounts(waypoints, activities)).toEqual({ 'not-started': 1, bronze: 1, silver: 0, gold: 1 })
  })

  it('calculates progress towards a status as a percentage', () => {
    const activities = [
      createActivity({ waypointId: 'a', date: '2026-01-01', status: 'silver', location: { placeName: 'A' } }),
      createActivity({ waypointId: 'b', date: '2026-01-02', status: 'gold', location: { placeName: 'B' } }),
    ]
    expect(progressTowards(waypoints, activities, 'silver')).toBe(67)
    expect(progressTowards(waypoints, activities, 'gold')).toBe(33)
  })

  it('orders recently visited waypoints by most recent activity first', () => {
    const activities = [
      createActivity({ waypointId: 'a', date: '2026-01-01', status: 'bronze', location: { placeName: 'A' } }),
      createActivity({ waypointId: 'b', date: '2026-02-01', status: 'silver', location: { placeName: 'B' } }),
    ]
    expect(recentlyVisited(waypoints, activities).map((item) => item.waypointId)).toEqual(['b', 'a'])
  })

  it('lists waypoints that are still not started', () => {
    const activities = [
      createActivity({ waypointId: 'a', date: '2026-01-01', status: 'bronze', location: { placeName: 'A' } }),
    ]
    expect(stillToVisit(waypoints, activities).map((item) => item.waypointId)).toEqual(['b', 'c'])
  })

  it('suggests next waypoints from those not yet started', () => {
    const activities = [
      createActivity({ waypointId: 'a', date: '2026-01-01', status: 'bronze', location: { placeName: 'A' } }),
    ]
    expect(suggestedNext(waypoints, activities, 1).map((item) => item.waypointId)).toEqual(['b'])
  })
})
