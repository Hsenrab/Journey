import { z } from 'zod'

export const MAX_GPX_SEGMENTS = 100
export const MAX_GPX_POINTS = 20_000
export const MAX_GPX_JSON_BYTES = 1_000_000

const GpxPointSchema = z
  .object({
    latitude: z.number().min(-90).max(90),
    longitude: z.number().min(-180).max(180),
    elevation: z.number().finite().optional(),
    time: z.iso.datetime().optional(),
  })
  .strict()

const GpxSegmentSchema = z.object({ points: z.array(GpxPointSchema).min(2).max(MAX_GPX_POINTS) }).strict()

export const GpxGeometrySchema = z
  .object({ segments: z.array(GpxSegmentSchema).min(1).max(MAX_GPX_SEGMENTS) })
  .strict()
  .superRefine((geometry, context) => {
    const pointCount = geometry.segments.reduce((total, segment) => total + segment.points.length, 0)
    if (pointCount > MAX_GPX_POINTS) {
      context.addIssue({
        code: 'too_big',
        maximum: MAX_GPX_POINTS,
        inclusive: true,
        origin: 'array',
        path: ['segments'],
        message: `GPX geometry cannot contain more than ${MAX_GPX_POINTS} points.`,
      })
    }
    if (JSON.stringify(geometry).length > MAX_GPX_JSON_BYTES) {
      context.addIssue({
        code: 'too_big',
        maximum: MAX_GPX_JSON_BYTES,
        inclusive: true,
        origin: 'string',
        path: ['segments'],
        message: `GPX geometry cannot exceed ${MAX_GPX_JSON_BYTES} JSON bytes.`,
      })
    }
  })
