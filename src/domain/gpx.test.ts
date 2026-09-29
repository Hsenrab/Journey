import { describe, expect, it } from 'vitest'
import { MAX_GPX_FILE_SIZE_BYTES, MAX_GPX_POINT_COUNT, parseGpx } from './gpx'

describe('parseGpx', () => {
  it('parses track geometry while preserving segment boundaries', () => {
    const result = parseGpx(`
      <gpx version="1.1" xmlns="http://www.topografix.com/GPX/1/1">
        <trk><trkseg>
          <trkpt lat="51.5" lon="-2.1" />
          <trkpt lat="51.6" lon="-2.2" />
        </trkseg><trkseg>
          <trkpt lat="52" lon="-3" />
          <trkpt lat="52.1" lon="-3.1" />
        </trkseg></trk>
      </gpx>
    `)

    expect(result).toEqual({
      segments: [
        [
          { latitude: 51.5, longitude: -2.1 },
          { latitude: 51.6, longitude: -2.2 },
        ],
        [
          { latitude: 52, longitude: -3 },
          { latitude: 52.1, longitude: -3.1 },
        ],
      ],
      pointCount: 4,
    })
  })

  it('parses each route as a separate segment', () => {
    const result = parseGpx(`
      <gpx>
        <rte><rtept lat="10" lon="20" /><rtept lat="11" lon="21" /></rte>
        <rte><rtept lat="30" lon="40" /><rtept lat="31" lon="41" /></rte>
      </gpx>
    `)

    expect(result.segments).toHaveLength(2)
    expect(result.pointCount).toBe(4)
  })

  it('rejects malformed XML and non-GPX documents', () => {
    expect(() => parseGpx('<gpx><trk></gpx>')).toThrow('GPX file is not valid XML')
    expect(() => parseGpx('<xml />')).toThrow('GPX file is not valid XML')
  })

  it('rejects unsupported, empty, and unusable geometry', () => {
    expect(() => parseGpx('<gpx><wpt lat="1" lon="2" /></gpx>')).toThrow(
      'does not contain supported track or route geometry',
    )
    expect(() => parseGpx('<gpx><trk /></gpx>')).toThrow('does not contain any track segments or routes')
    expect(() => parseGpx('<gpx><rte><rtept lat="1" lon="2" /></rte></gpx>')).toThrow(
      'segment 1 must contain at least two points',
    )
  })

  it('rejects missing, non-numeric, and out-of-range coordinates', () => {
    expect(() => parseGpx('<gpx><rte><rtept lon="2" /><rtept lat="1" lon="2" /></rte></gpx>')).toThrow(
      'point 1 must include numeric lat and lon',
    )
    expect(() =>
      parseGpx('<gpx><rte><rtept lat="north" lon="2" /><rtept lat="1" lon="2" /></rte></gpx>'),
    ).toThrow('point 1 has latitude north')
    expect(() =>
      parseGpx('<gpx><rte><rtept lat="1" lon="181" /><rtept lat="1" lon="2" /></rte></gpx>'),
    ).toThrow('point 1 has longitude 181')
  })

  it('rejects files over the byte size limit', () => {
    expect(() => parseGpx('é'.repeat(MAX_GPX_FILE_SIZE_BYTES / 2 + 1))).toThrow(
      `${MAX_GPX_FILE_SIZE_BYTES}-byte size limit`,
    )
  })

  it('rejects files over the point limit', () => {
    const points = '<rtept lat="1" lon="2"/>'.repeat(MAX_GPX_POINT_COUNT + 1)

    expect(() => parseGpx(`<gpx><rte>${points}</rte></gpx>`)).toThrow(
      `${MAX_GPX_POINT_COUNT}-point limit`,
    )
  })

  it('rejects declarations that could define entities and ignores embedded markup', () => {
    expect(() =>
      parseGpx(
        '<!DOCTYPE gpx [<!ENTITY example "text">]><gpx><rte><rtept lat="1" lon="2"/><rtept lat="3" lon="4"/></rte></gpx>',
      ),
    ).toThrow('DOCTYPE declarations are not supported')

    const result = parseGpx(`
      <gpx>
        <metadata><script>globalThis.compromised = true</script></metadata>
        <rte>
          <rtept lat="1" lon="2"><script>alert("ignored")</script></rtept>
          <rtept lat="3" lon="4" />
        </rte>
      </gpx>
    `)
    expect(result.segments).toEqual([
      [
        { latitude: 1, longitude: 2 },
        { latitude: 3, longitude: 4 },
      ],
    ])
    expect('compromised' in globalThis).toBe(false)
  })
})
