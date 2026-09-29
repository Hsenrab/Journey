import { ActivityTrackSchema, type ActivityTrack } from './visit'

export function parseGpx(text: string, filename: string): ActivityTrack {
  if (text.length > 1_000_000) throw new Error('GPX file is too large (maximum 1 MB).')
  if (/<!DOCTYPE|<!ENTITY/i.test(text)) throw new Error('GPX document declarations are not supported.')

  const document = new DOMParser().parseFromString(text, 'application/xml')
  if (document.querySelector('parsererror') || document.documentElement.localName !== 'gpx') {
    throw new Error('Invalid GPX XML: expected a GPX document.')
  }

  const children = (element: Element, name: string) =>
    Array.from(element.children).filter((child) => child.localName === name)
  const segments: [number, number][][] = []
  let points = 0
  for (const track of children(document.documentElement, 'trk')) {
    for (const segment of children(track, 'trkseg')) {
      const coordinates = children(segment, 'trkpt').map((point) => {
        const lat = point.getAttribute('lat')
        const lon = point.getAttribute('lon')
        if (!lat?.trim() || !lon?.trim()) {
          throw new Error('GPX track point requires latitude and longitude.')
        }
        const latitude = Number(lat)
        const longitude = Number(lon)
        points += 1
        if (points > 10_000) throw new Error('GPX track exceeds 10,000 points.')
        return [longitude, latitude] as [number, number]
      })
      if (coordinates.length < 2) throw new Error('Each GPX track segment needs at least two points.')
      segments.push(coordinates)
    }
  }
  if (!segments.length) throw new Error('GPX must contain a recorded track with at least two points.')
  const parsed = ActivityTrackSchema.safeParse({ name: filename, segments })
  if (!parsed.success) throw new Error(`Invalid GPX track coordinates: ${parsed.error.issues[0]?.message}`)
  return parsed.data
}
