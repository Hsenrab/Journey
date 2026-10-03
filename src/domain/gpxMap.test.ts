import { describe, expect, it } from 'vitest'
import { challengeRecordedTracks, gpxLineFeatures, type GpxMapLine } from './gpxMap'
import { createDemoData, waypointCompletionProgress, type Activity } from './visit'

describe('challengeRecordedTracks', () => {
  it('selects tracks through either Waypoint membership direction, not direct Activity Challenge links', () => {
    const data = createDemoData()
    const challenge = { ...data.challenges[0]!, waypointIds: ['forward'] }
    const waypoints = [
      { ...data.waypoints[0]!, waypointId: 'forward', challengeIds: [] },
      { ...data.waypoints[0]!, waypointId: 'reverse', challengeIds: [challenge.challengeId] },
      { ...data.waypoints[0]!, waypointId: 'outside', challengeIds: [] },
    ]
    const recordedTrack: NonNullable<Activity['recordedTrack']> = {
      type: 'MultiLineString',
      coordinates: [
        [
          [-2, 51],
          [-1, 52],
        ],
      ],
    }
    const activity = { ...data.activities[0]!, recordedTrack }
    const activities = [
      { ...activity, activityId: 'a', name: 'Forward walk', waypointId: 'forward' },
      { ...activity, activityId: 'b', name: 'Reverse walk', waypointId: 'reverse' },
      { ...activity, activityId: 'c', waypointId: 'outside', challengeId: challenge.challengeId },
      { ...activity, activityId: 'd', waypointId: undefined, challengeId: challenge.challengeId },
      { ...activity, activityId: 'e', waypointId: 'forward', recordedTrack: undefined },
    ]

    expect(challengeRecordedTracks(challenge, waypoints, activities)).toEqual([
      { id: 'a', label: 'Forward walk', segments: recordedTrack.coordinates },
      { id: 'b', label: 'Reverse walk', segments: recordedTrack.coordinates },
    ])
    expect(challengeRecordedTracks(challenge, waypoints, [])).toEqual([])
    expect(challengeRecordedTracks(challenge, [], activities)).toEqual([])
  })

  it('does not change once/count completion or require a track on qualifying Activities', () => {
    const data = createDemoData()
    const waypoint = data.waypoints[0]!
    const activity = { ...data.activities[0]!, waypointId: waypoint.waypointId, recordedTrack: undefined }
    const activities = [activity, { ...activity, activityId: 'second' }]
    const before = waypointCompletionProgress(waypoint, activities)

    expect(challengeRecordedTracks(data.challenges[0]!, [waypoint], activities)).toEqual([])
    expect(waypointCompletionProgress(waypoint, activities)).toEqual(before)
    expect(before.complete).toBe(true)
    expect(waypointCompletionProgress({ ...waypoint, completion: { mode: 'count', target: 3 } }, activities)).toEqual({
      count: 2,
      target: 3,
      complete: false,
    })
  })
})

describe('gpxLineFeatures', () => {
  it('keeps segments separate and assigns stable, distinguishable line colors', () => {
    const route: GpxMapLine = {
      id: 'route',
      label: 'Route',
      segments: [
        [
          [-2, 51],
          [-1, 52],
        ],
        [
          [0, 53],
          [1, 54],
        ],
      ],
    }
    const track: GpxMapLine = {
      id: 'track',
      label: 'Track',
      segments: [
        [
          [2, 55],
          [3, 56],
        ],
      ],
    }

    const features = gpxLineFeatures([route, track])
    expect(features.map(({ id, lineId, coordinates }) => ({ id, lineId, coordinates }))).toEqual([
      { id: 'route:0', lineId: 'route', coordinates: route.segments[0] },
      { id: 'route:1', lineId: 'route', coordinates: route.segments[1] },
      { id: 'track:0', lineId: 'track', coordinates: track.segments[0] },
    ])
    expect(features[0]!.color).not.toBe(features[2]!.color)
    expect(Object.fromEntries(gpxLineFeatures([track, route]).map(({ id, color }) => [id, color]))).toEqual(
      Object.fromEntries(features.map(({ id, color }) => [id, color])),
    )
  })

  it('allocates distinct fallback styles and preserves explicit colors', () => {
    const segment: GpxMapLine['segments'][number] = [
      [-2, 51],
      [-1, 52],
    ]
    const lines: GpxMapLine[] = ['f', 'a', 'b', 'c', 'd', 'e'].map((id) => ({
      id,
      label: id,
      segments: [segment],
    }))
    lines.push({ id: 'explicit', label: 'Explicit', color: '#1565c0', segments: [segment] })

    const features = gpxLineFeatures(lines)
    const stylesByLine = Object.fromEntries(
      features.map(({ lineId, color, strokeWidth }) => [lineId, { color, strokeWidth }]),
    )
    expect(stylesByLine.a).not.toEqual(stylesByLine.f)
    expect(new Set(Object.values(stylesByLine).map(({ color, strokeWidth }) => `${color}:${strokeWidth}`)).size).toBe(
      lines.length,
    )
    expect(stylesByLine.explicit).toEqual({ color: '#1565c0', strokeWidth: 4 })
    expect(
      Object.fromEntries(
        gpxLineFeatures([...lines].reverse()).map(({ lineId, color, strokeWidth }) => [lineId, { color, strokeWidth }]),
      ),
    ).toEqual(stylesByLine)
  })

  it('rejects invalid runtime segments with line and segment details', () => {
    const invalidSegments: (readonly (readonly [number, number])[])[] = [
      [],
      [[1, 2]],
      [
        [Number.NaN, 2],
        [3, 4],
      ],
      [
        [181, 2],
        [3, 4],
      ],
    ]

    for (const segment of invalidSegments) {
      expect(() =>
        gpxLineFeatures([
          {
            id: 'invalid',
            label: 'Invalid',
            segments: [segment],
          },
        ]),
      ).toThrow('GPX line "invalid" segment 1 must contain at least two valid coordinates.')
    }

    expect(gpxLineFeatures([])).toEqual([])
  })
})
