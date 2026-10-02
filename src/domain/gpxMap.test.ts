import { describe, expect, it } from 'vitest'
import { gpxLineFeatures, type GpxMapLine } from './gpxMap'

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
      ).toThrow('GPX line "invalid" segment 1 must contain at least two valid positions.')
    }

    expect(gpxLineFeatures([])).toEqual([])
  })
})
