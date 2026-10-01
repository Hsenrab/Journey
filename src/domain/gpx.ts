import {
  GpxGeometrySchema,
  MAX_GPX_FILE_SIZE_BYTES,
  MAX_PLANNED_ROUTE_POINTS,
  MAX_PLANNED_ROUTE_SEGMENTS,
  type PlannedRoute,
} from './visit'

function elements(parent: Document | Element, name: string): HTMLCollectionOf<Element> {
  return parent.getElementsByTagNameNS('*', name)
}

function pointPosition(point: Element): [number, number] {
  const latitudeValue = point.getAttribute('lat')
  const longitudeValue = point.getAttribute('lon')
  const latitude = Number(latitudeValue)
  const longitude = Number(longitudeValue)
  if (
    latitudeValue === null ||
    latitudeValue.trim() === '' ||
    longitudeValue === null ||
    longitudeValue.trim() === '' ||
    !Number.isFinite(latitude) ||
    latitude < -90 ||
    latitude > 90 ||
    !Number.isFinite(longitude) ||
    longitude < -180 ||
    longitude > 180
  ) {
    throw new Error('GPX route contains a point with invalid latitude or longitude.')
  }
  return [longitude, latitude]
}

export function parseGpxRoute(contents: string, fileName: string): PlannedRoute {
  if (contents.length > MAX_GPX_FILE_SIZE_BYTES)
    throw new Error(`GPX files must be no larger than ${MAX_GPX_FILE_SIZE_BYTES} bytes.`)

  const document = new DOMParser().parseFromString(contents, 'application/xml')
  if (elements(document, 'parsererror').length > 0) throw new Error('The selected file is not valid XML.')
  if (document.documentElement.localName !== 'gpx') throw new Error('The selected file is not a GPX document.')

  const coordinates: [number, number][][] = []
  let pointCount = 0
  const collectSegment = (segment: Element, pointName: string) => {
    const points: [number, number][] = []
    const segmentPoints = elements(segment, pointName)
    for (let index = 0; index < segmentPoints.length; index += 1) {
      pointCount += 1
      if (pointCount > MAX_PLANNED_ROUTE_POINTS)
        throw new Error(`A GPX route cannot contain more than ${MAX_PLANNED_ROUTE_POINTS} points.`)
      points.push(pointPosition(segmentPoints[index]!))
    }
    if (points.length < 2) return
    if (coordinates.length >= MAX_PLANNED_ROUTE_SEGMENTS)
      throw new Error(`A GPX route cannot contain more than ${MAX_PLANNED_ROUTE_SEGMENTS} segments.`)
    coordinates.push(points)
  }

  const trackSegments = elements(document, 'trkseg')
  for (let index = 0; index < trackSegments.length; index += 1) collectSegment(trackSegments[index]!, 'trkpt')
  const routes = elements(document, 'rte')
  for (let index = 0; index < routes.length; index += 1) collectSegment(routes[index]!, 'rtept')
  if (coordinates.length === 0) throw new Error('The GPX file must contain a track or route with at least two points.')

  return {
    fileName,
    geometry: GpxGeometrySchema.parse({ type: 'MultiLineString', coordinates }),
  }
}

export async function parseGpxFile(file: File): Promise<PlannedRoute> {
  if (file.size > MAX_GPX_FILE_SIZE_BYTES)
    throw new Error(`GPX files must be no larger than ${MAX_GPX_FILE_SIZE_BYTES} bytes.`)
  return parseGpxRoute(await file.text(), file.name)
}
