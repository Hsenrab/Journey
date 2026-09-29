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
  const document = new DOMParser().parseFromString(value, 'application/xml')
  if (document.querySelector('parsererror')) throw new Error('GPX is not valid XML.')

  const elements = Array.from(document.querySelectorAll('trkpt, rtept'))
  const points = elements.map((element) => ({
    latitude: Number(element.getAttribute('lat')),
    longitude: Number(element.getAttribute('lon')),
  }))
  return GpxRouteSchema.parse({ points })
}
