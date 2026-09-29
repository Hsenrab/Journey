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
  const source = value.trim()
  const points: Array<{ latitude: number; longitude: number }> = []
  const stack: string[] = []
  const tokenPattern = /<!--[\s\S]*?-->|<\?[\s\S]*?\?>|<!\[CDATA\[[\s\S]*?\]\]>|<\/?[^>]+>/g
  let position = 0
  let root: string | undefined
  for (const match of source.matchAll(tokenPattern)) {
    const token = match[0]
    if (match.index !== position && source.slice(position, match.index).includes('<')) {
      throw new Error('GPX is not valid XML.')
    }
    position = (match.index ?? 0) + token.length
    if (token.startsWith('<!--') || token.startsWith('<?') || token.startsWith('<![CDATA[')) continue
    if (token.startsWith('<!')) throw new Error('GPX is not valid XML.')
    const closing = /^<\/([A-Za-z_][\w:.-]*)\s*>$/.exec(token)
    if (closing) {
      if (stack.pop() !== closing[1]) throw new Error('GPX is not valid XML.')
      continue
    }
    const opening = /^<([A-Za-z_][\w:.-]*)([\s\S]*?)(\/?)>$/.exec(token)
    if (!opening) throw new Error('GPX is not valid XML.')
    const name = opening[1]!
    const attributes = opening[2]!.trim().replace(/\/$/, '').trim()
    if (!root) {
      root = name
      if (name.toLowerCase() !== 'gpx') throw new Error('GPX is not valid XML.')
    }
    const parsedAttributes: Record<string, string> = {}
    const attributePattern = /([A-Za-z_:][\w:.-]*)\s*=\s*("(?:[^"]*)"|'(?:[^']*)')/g
    let attributePosition = 0
    for (const attribute of attributes.matchAll(attributePattern)) {
      if (attribute.index !== attributePosition && attributes.slice(attributePosition, attribute.index).trim()) {
        throw new Error('GPX is not valid XML.')
      }
      parsedAttributes[attribute[1]!] = attribute[2]!.slice(1, -1)
      attributePosition = (attribute.index ?? 0) + attribute[0].length
    }
    if (attributes.slice(attributePosition).trim()) throw new Error('GPX is not valid XML.')
    if (name === 'trkpt' || name === 'rtept') {
      points.push({ latitude: Number(parsedAttributes.lat), longitude: Number(parsedAttributes.lon) })
    }
    if (opening[3] !== '/') stack.push(name)
  }
  if (position !== source.length || !root || stack.length > 0) throw new Error('GPX is not valid XML.')
  return GpxRouteSchema.parse({ points })
}
