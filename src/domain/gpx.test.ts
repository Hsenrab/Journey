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

  it('accepts an XML declaration and reads route points', () => {
    expect(
      parseGpx(
        '<?xml version="1.0"?><gpx><rte><rtept lat="51.1" lon="-2.1"/><rtept lat="51.2" lon="-2.2"/></rte></gpx>',
      ),
    ).toEqual({
      points: [
        { latitude: 51.1, longitude: -2.1 },
        { latitude: 51.2, longitude: -2.2 },
      ],
    })
  })

  it('rejects malformed XML, DTDs, and point-looking comments', () => {
    expect(() =>
      parseGpx('<gpx><trk><trkpt lat="51.1" lon="-2.1"/><trkpt lat="51.2" lon="-2.2"></trk></gpx>'),
    ).toThrow()
    expect(() =>
      parseGpx('<!DOCTYPE gpx><gpx><trkpt lat="51.1" lon="-2.1"/><trkpt lat="51.2" lon="-2.2"/></gpx>'),
    ).toThrow()
    expect(() => parseGpx('<gpx><!-- <trkpt lat="51.1" lon="-2.1"/> --></gpx>')).toThrow()
  })

  it('rejects content outside the single root element', () => {
    expect(() => parseGpx('<gpx><trkpt lat="51" lon="-2"/><trkpt lat="52" lon="-3"/></gpx><other/>')).toThrow()
    expect(() => parseGpx('text<gpx><trkpt lat="51" lon="-2"/><trkpt lat="52" lon="-3"/></gpx>')).toThrow()
    expect(() => parseGpx('<gpx><trkpt lat="51" lon="-2"/><trkpt lat="52" lon="-3"/></gpx>text')).toThrow()
  })

  it('rejects tracks with multiple segments', () => {
    expect(() =>
      parseGpx(
        '<gpx><trk><trkseg><trkpt lat="51" lon="-2"/></trkseg><trkseg><trkpt lat="52" lon="-3"/></trkseg></trk></gpx>',
      ),
    ).toThrow('GPX tracks with multiple segments are not supported.')
  })

  it('rejects blank point coordinates', () => {
    expect(() => parseGpx('<gpx><rtept lat="" lon="-2"/><rtept lat="52" lon="-3"/></gpx>')).toThrow()
    expect(() => parseGpx('<gpx><rtept lat="51" lon="  "/><rtept lat="52" lon="-3"/></gpx>')).toThrow()
  })
})
