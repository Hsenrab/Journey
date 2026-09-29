import { describe, expect, it } from 'vitest'
import { challengeRecordedActivities } from './challenge'
import { waypointCompletionProgress, type Activity, type Challenge, type Waypoint } from './visit'

const route = {
  segments: [{ points: [{ latitude: 51, longitude: -2 }, { latitude: 51.1, longitude: -2.1 }] }],
}

const challenge: Challenge = {
  challengeId: 'challenge-1',
  title: 'Challenge',
  description: 'Description',
  waypointIds: ['waypoint-1'],
  supportsActivityCategories: false,
}

const waypoints: Waypoint[] = [
  {
    waypointId: 'waypoint-1',
    title: 'One',
    description: 'One',
    category: 'Walk',
    tags: [],
    challengeIds: [],
    completion: { mode: 'count', target: 2 },
    referenceIds: [],
    photoReferenceIds: [],
  },
  {
    waypointId: 'waypoint-2',
    title: 'Two',
    description: 'Two',
    category: 'Walk',
    tags: [],
    challengeIds: ['challenge-1'],
    completion: { mode: 'once' },
    referenceIds: [],
    photoReferenceIds: [],
  },
  {
    waypointId: 'outside',
    title: 'Outside',
    description: 'Outside',
    category: 'Walk',
    tags: [],
    challengeIds: [],
    completion: { mode: 'once' },
    referenceIds: [],
    photoReferenceIds: [],
  },
]

function activity(activityId: string, waypointId: string, recordedTrack = route): Activity {
  return {
    activityId,
    waypointId,
    ideaIds: [],
    date: '2026-09-01',
    location: { kind: 'coordinates', latitude: 51, longitude: -2 },
    recordedTrack,
    notes: '',
    referenceIds: [],
    photoReferenceIds: [],
    createdAt: '2026-09-01T00:00:00.000Z',
    updatedAt: '2026-09-01T00:00:00.000Z',
  }
}

describe('Challenge recorded Activities', () => {
  it('includes tracks linked through either side of Challenge membership and excludes all others', () => {
    const withoutTrack = { ...activity('without-track', 'waypoint-1'), recordedTrack: undefined }
    const activities = [
      activity('direct', 'waypoint-1'),
      activity('reverse', 'waypoint-2'),
      activity('outside', 'outside'),
      withoutTrack,
      { ...activity('unlinked', 'waypoint-1'), waypointId: undefined },
    ]

    expect(challengeRecordedActivities(challenge, waypoints, activities).map((item) => item.activityId)).toEqual([
      'direct',
      'reverse',
    ])
  })

  it('does not change count-based completion semantics based on track geometry', () => {
    const tracked = activity('tracked', 'waypoint-1')
    const untracked = { ...activity('untracked', 'waypoint-1'), recordedTrack: undefined }

    expect(waypointCompletionProgress(waypoints[0]!, [tracked, untracked])).toEqual({
      count: 2,
      target: 2,
      complete: true,
    })
  })
})
