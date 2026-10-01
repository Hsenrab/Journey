import { describe, expect, it, vi } from 'vitest'
import { parseGpxFile, parseGpxRoute } from './gpx'
import {
  GpxGeometrySchema,
  MAX_GPX_FILE_SIZE_BYTES,
  MAX_PLANNED_ROUTE_POINTS,
  MAX_PLANNED_ROUTE_SEGMENTS,
} from './visit'

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

  it('rejects an oversized file before reading its contents', async () => {
    const text = vi.fn(async () => '<gpx />')
    const file = {
      name: 'large.gpx',
      size: MAX_GPX_FILE_SIZE_BYTES + 1,
      text,
    } as unknown as File

    await expect(parseGpxFile(file)).rejects.toThrow('GPX files must be no larger than')
    expect(text).not.toHaveBeenCalled()
  })

  it('rejects oversized text before parsing XML', () => {
    expect(() => parseGpxRoute(' '.repeat(MAX_GPX_FILE_SIZE_BYTES + 1), 'large.gpx')).toThrow(
      'GPX files must be no larger than',
    )
  })

  it('rejects routes exceeding the segment and point limits during extraction', () => {
    const point = '<trkpt lat="51" lon="-2"/><trkpt lat="52" lon="-3"/>'
    const segment = `<trk><trkseg>${point}</trkseg></trk>`
    const segments = `<gpx>${segment.repeat(MAX_PLANNED_ROUTE_SEGMENTS + 1)}</gpx>`
    const points = `<gpx><rte>${'<rtept lat="51" lon="-2"/>'.repeat(MAX_PLANNED_ROUTE_POINTS + 1)}</rte></gpx>`

    expect(() => parseGpxRoute(segments, 'segments.gpx')).toThrow('cannot contain more than 100 segments')
    expect(() => parseGpxRoute(points, 'points.gpx')).toThrow('cannot contain more than 10000 points')
  })

  it('rejects persisted geometry beyond the segment and point limits', () => {
    const point: [number, number] = [-2, 51]
    const segments = Array.from({ length: MAX_PLANNED_ROUTE_SEGMENTS + 1 }, () => [point, point])
    const points = Array.from({ length: MAX_PLANNED_ROUTE_POINTS + 1 }, () => point)

    expect(GpxGeometrySchema.safeParse({ type: 'MultiLineString', coordinates: segments }).success).toBe(false)
    expect(GpxGeometrySchema.safeParse({ type: 'MultiLineString', coordinates: [points] }).success).toBe(false)
  })
})
