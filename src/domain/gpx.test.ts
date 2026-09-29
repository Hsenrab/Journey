import { describe, expect, it } from 'vitest'
import { GpxGeometrySchema } from './gpx'

const geometry = {
  segments: [
    {
      points: [
        { latitude: 51, longitude: -2, elevation: 100 },
        { latitude: 51.1, longitude: -2.1, time: '2026-09-01T00:00:00.000Z' },
      ],
    },
    {
      points: [
        { latitude: 52, longitude: -3 },
        { latitude: 52.1, longitude: -3.1 },
      ],
    },
  ],
}

describe('GPX geometry schema', () => {
  it('accepts optional point metadata and preserves segment boundaries', () => {
    expect(GpxGeometrySchema.parse(geometry)).toEqual(geometry)
  })

  it('rejects invalid coordinates, short segments, and unknown fields', () => {
    expect(GpxGeometrySchema.safeParse({ segments: [{ points: [{ latitude: 91, longitude: 0 }] }] }).success).toBe(
      false,
    )
    expect(
      GpxGeometrySchema.safeParse({ segments: [{ points: [{ latitude: 51, longitude: 0 }] }] }).success,
    ).toBe(false)
    expect(GpxGeometrySchema.safeParse({ ...geometry, raw: '<gpx />' }).success).toBe(false)
  })
})
