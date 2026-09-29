import { z } from 'zod'

export const GpxPointSchema = z
  .object({
    latitude: z.number().finite().min(-90).max(90),
    longitude: z.number().finite().min(-180).max(180),
  })
  .strict()

export const GpxRouteSchema = z
  .object({
    points: z.array(GpxPointSchema).min(2).max(10000),
  })
  .strict()

export type GpxPoint = z.infer<typeof GpxPointSchema>
export type GpxRoute = z.infer<typeof GpxRouteSchema>

export function parseGpx(value: string): GpxRoute {
  if (!/^<gpx\b[^>]*>[\s\S]*<\/gpx>\s*$/i.test(value.trim()) || /<!DOCTYPE|<script\b/i.test(value))
    throw new Error('GPX is not valid XML.')

  const points = Array.from(value.matchAll(/<(?:trkpt|rtept)\b([^>]*)\/?>/gi)).map((match) => {
    const attributes = match[1] ?? ''
    const latitude = attributes.match(/\blat\s*=\s*["']([^"']+)["']/i)?.[1]
    const longitude = attributes.match(/\blon\s*=\s*["']([^"']+)["']/i)?.[1]
    return { latitude: Number(latitude), longitude: Number(longitude) }
  })
  return GpxRouteSchema.parse({ points })
}
