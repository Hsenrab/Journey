import { describe, expect, it } from 'vitest'
import { parseGpxRoute } from './gpx'

describe('parseGpxRoute', () => {
  it('parses track segments and routes into persisted line geometry', () => {
    const route = parseGpxRoute(
      `<?xml version="1.0"?>
      <gpx xmlns="http://www.topografix.com/GPX/1/1">
        <trk><trkseg><trkpt lat="51.1" lon="-2.1"/><trkpt lat="51.2" lon="-2.2"/></trkseg></trk>
        <rte><rtept lat="52.1" lon="-3.1"/><rtept lat="52.2" lon="-3.2"/></rte>
      </gpx>`,
      'weekend.gpx',
    )

    expect(route).toEqual({
      fileName: 'weekend.gpx',
      geometry: {
        type: 'MultiLineString',
        coordinates: [
          [
            [-2.1, 51.1],
            [-2.2, 51.2],
          ],
          [
            [-3.1, 52.1],
            [-3.2, 52.2],
          ],
        ],
      },
    })
  })

  it.each([
    ['malformed XML', '<gpx><trk>', 'The selected file is not valid XML.'],
    ['another XML format', '<route />', 'The selected file is not a GPX document.'],
    ['no usable line', '<gpx><trk><trkseg><trkpt lat="51" lon="-2"/></trkseg></trk></gpx>', 'at least two points'],
    [
      'an invalid coordinate',
      '<gpx><rte><rtept lat="91" lon="-2"/><rtept lat="51" lon="-2"/></rte></gpx>',
      'invalid latitude or longitude',
    ],
    [
      'a missing coordinate',
      '<gpx><rte><rtept lat="51"/><rtept lat="51" lon="-2"/></rte></gpx>',
      'invalid latitude or longitude',
    ],
  ])('rejects %s', (_label, contents, message) => {
    expect(() => parseGpxRoute(contents, 'invalid.gpx')).toThrow(message)
  })
})
