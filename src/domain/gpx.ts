import { z } from 'zod'

const GpxPointSchema = z
  .object({
    latitude: z.number().min(-90).max(90),
    longitude: z.number().min(-180).max(180),
    elevation: z.number().finite().optional(),
    time: z.iso.datetime().optional(),
  })
  .strict()

const GpxSegmentSchema = z.object({ points: z.array(GpxPointSchema).min(2) }).strict()

export const GpxGeometrySchema = z.object({ segments: z.array(GpxSegmentSchema).min(1) }).strict()

export type GpxGeometry = z.infer<typeof GpxGeometrySchema>
