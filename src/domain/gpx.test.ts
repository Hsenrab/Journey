import { describe, expect, it } from 'vitest'
import { parseGpx } from './gpx'

describe('parseGpx', () => {
  it('parses track points', () => {
    expect(
      parseGpx('<gpx><trk><trkseg><trkpt lat="51.1" lon="-2.1"/><trkpt lat="51.2" lon="-2.2"/></trkseg></trk></gpx>'),
    ).toEqual({
      points: [
        { latitude: 51.1, longitude: -2.1 },
        { latitude: 51.2, longitude: -2.2 },
      ],
    })
  })

  it('rejects malformed and too-short routes', () => {
    expect(() => parseGpx('<gpx><trk><trkpt lat="51.1" lon="-2.1"/></trk></gpx>')).toThrow()
    expect(() => parseGpx('<gpx>not xml')).toThrow()
  })
})
