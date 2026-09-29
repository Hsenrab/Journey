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
  if (/<!DOCTYPE\b/i.test(value)) throw new Error('GPX DTDs are not supported.')
  // lgtm [js/xss-through-dom] XML parsing does not interpret HTML or execute scripts.
  const document = new DOMParser().parseFromString(value, 'application/xml')
  if (document.querySelector('parsererror') || document.documentElement.localName.toLowerCase() !== 'gpx') {
    throw new Error('GPX is not valid XML.')
  }

  const points = Array.from(document.querySelectorAll('trkpt, rtept')).map((point) => ({
    latitude: Number(point.getAttribute('lat')),
    longitude: Number(point.getAttribute('lon')),
  }))
  return GpxRouteSchema.parse({ points })
}
