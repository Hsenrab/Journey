import { describe, expect, it } from 'vitest'
import { gpxLineFeatures, GpxLineSchema } from './gpx'

describe('gpxLineFeatures', () => {
  it('keeps every validated segment as a separate feature and assigns distinct styles', () => {
    const lines = [
      GpxLineSchema.parse({
        id: 'route',
        label: 'Route',
        segments: [
          [
            { latitude: 51, longitude: -2 },
            { latitude: 52, longitude: -1 },
          ],
          [
            { latitude: 53, longitude: 0 },
            { latitude: 54, longitude: 1 },
          ],
        ],
      }),
      GpxLineSchema.parse({
        id: 'track',
        label: 'Track',
        segments: [
          [
            { latitude: 55, longitude: 2 },
            { latitude: 56, longitude: 3 },
          ],
        ],
      }),
    ]

    expect(gpxLineFeatures(lines)).toEqual([
      {
        id: 'route-0',
        lineId: 'route',
        label: 'Route',
        color: '#1565c0',
        coordinates: [
          [-2, 51],
          [-1, 52],
        ],
      },
      {
        id: 'route-1',
        lineId: 'route',
        label: 'Route',
        color: '#1565c0',
        coordinates: [
          [0, 53],
          [1, 54],
        ],
      },
      {
        id: 'track-0',
        lineId: 'track',
        label: 'Track',
        color: '#c62828',
        coordinates: [
          [2, 55],
          [3, 56],
        ],
      },
    ])
  })

  it('ignores empty, short, and invalid runtime geometry', () => {
    expect(
      gpxLineFeatures([
        {
          id: 'invalid',
          label: 'Invalid',
          segments: [
            [],
            [{ latitude: 51, longitude: -2 }],
            [
              { latitude: Number.NaN, longitude: -2 },
              { latitude: 52, longitude: -1 },
            ],
          ],
        },
      ]),
    ).toEqual([])
  })
})
