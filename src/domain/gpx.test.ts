import { describe, expect, it } from 'vitest'
import { parseGpx } from './gpx'

describe('parseGpx', () => {
  it('reads recorded tracks, keeping separate segments and longitude-first coordinates', () => {
    expect(
      parseGpx(
        '<gpx xmlns="http://www.topografix.com/GPX/1/1"><trk><trkseg><trkpt lat="51" lon="-2"/><trkpt lat="52" lon="-3"/></trkseg><trkseg><trkpt lat="53" lon="-4"/><trkpt lat="54" lon="-5"/></trkseg></trk></gpx>',
        'walk.gpx',
      ),
    ).toEqual({
      name: 'walk.gpx',
      segments: [
        [
          [-2, 51],
          [-3, 52],
        ],
        [
          [-4, 53],
          [-5, 54],
        ],
      ],
    })
  })

  it.each([
    ['invalid XML', '<gpx><trk>'],
    ['missing track', '<gpx><rte><rtept lat="51" lon="-2"/></rte></gpx>'],
    ['missing coordinate', '<gpx><trk><trkseg><trkpt lat="51"/><trkpt lat="52" lon="-2"/></trkseg></trk></gpx>'],
    ['empty coordinate', '<gpx><trk><trkseg><trkpt lat="" lon="-2"/><trkpt lat="52" lon="-2"/></trkseg></trk></gpx>'],
    [
      'out-of-range coordinate',
      '<gpx><trk><trkseg><trkpt lat="91" lon="-2"/><trkpt lat="52" lon="-2"/></trkseg></trk></gpx>',
    ],
    ['one point', '<gpx><trk><trkseg><trkpt lat="51" lon="-2"/></trkseg></trk></gpx>'],
    ['declaration', '<!DOCTYPE gpx><gpx/>'],
  ])('rejects %s', (_description, xml) => {
    expect(() => parseGpx(xml, 'bad.gpx')).toThrow()
  })
})
