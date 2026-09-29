import { z } from 'zod'
import type { Coordinates } from './map'

const GpxCoordinateSchema = z.object({
  latitude: z.number().finite().min(-90).max(90),
  longitude: z.number().finite().min(-180).max(180),
})

export const GpxLineSchema = z
  .object({
    id: z.string().min(1),
    label: z.string().min(1),
    segments: z.array(z.array(GpxCoordinateSchema)),
    color: z
      .string()
      .regex(/^#[0-9a-f]{6}$/i)
      .optional(),
  })
  .strict()

export type GpxLine = {
  readonly id: string
  readonly label: string
  readonly segments: readonly (readonly Coordinates[])[]
  readonly color?: string
}

export type GpxLineFeature = {
  id: string
  lineId: string
  label: string
  color: string
  coordinates: [[number, number], ...Array<[number, number]>]
}

const lineColors = ['#1565c0', '#c62828', '#6a1b9a', '#ef6c00', '#00838f']

function validSegment(segment: readonly Coordinates[]): boolean {
  if (segment.length < 2) return false
  return segment.every(
    (point) =>
      Number.isFinite(point.latitude) &&
      point.latitude >= -90 &&
      point.latitude <= 90 &&
      Number.isFinite(point.longitude) &&
      point.longitude >= -180 &&
      point.longitude <= 180,
  )
}

export function gpxLineFeatures(lines: readonly GpxLine[]): GpxLineFeature[] {
  return lines.flatMap((line, lineIndex) =>
    line.segments.flatMap((segment, segmentIndex) => {
      if (!validSegment(segment)) return []
      return [
        {
          id: `${line.id}-${segmentIndex}`,
          lineId: line.id,
          label: line.label,
          color: line.color ?? lineColors[lineIndex % lineColors.length]!,
          coordinates: segment.map(({ longitude, latitude }) => [longitude, latitude]) as [
            [number, number],
            ...Array<[number, number]>,
          ],
        },
      ]
    }),
  )
}
