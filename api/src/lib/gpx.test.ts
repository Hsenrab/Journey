import { describe, expect, it } from 'vitest'
import { GpxGeometrySchema } from './gpx.js'

describe('GPX geometry schema', () => {
  it('accepts multiple segments without flattening them', () => {
    const geometry = {
      segments: [
        {
          points: [
            { latitude: 51, longitude: -2 },
            { latitude: 51.1, longitude: -2.1 },
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
    expect(GpxGeometrySchema.parse(geometry)).toEqual(geometry)
  })

  it('rejects invalid coordinates and oversized geometry', () => {
    expect(GpxGeometrySchema.safeParse({ segments: [{ points: [{ latitude: 91, longitude: 0 }] }] }).success).toBe(
      false,
    )
    expect(
      GpxGeometrySchema.safeParse({
        segments: [{ points: Array.from({ length: 20_001 }, () => ({ latitude: 51, longitude: -2 })) }],
      }).success,
    ).toBe(false)
  })
})
