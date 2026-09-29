import { GpxGeometrySchema, type PlannedRoute } from './visit'

function elements(parent: Document | Element, name: string): Element[] {
  return Array.from(parent.getElementsByTagNameNS('*', name))
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
  const document = new DOMParser().parseFromString(contents, 'application/xml')
  if (elements(document, 'parsererror').length > 0) throw new Error('The selected file is not valid XML.')
  if (document.documentElement.localName !== 'gpx') throw new Error('The selected file is not a GPX document.')

  const trackSegments = elements(document, 'trkseg').map((segment) => elements(segment, 'trkpt').map(pointPosition))
  const routes = elements(document, 'rte').map((route) => elements(route, 'rtept').map(pointPosition))
  const coordinates = [...trackSegments, ...routes].filter((segment) => segment.length >= 2)
  if (coordinates.length === 0) throw new Error('The GPX file must contain a track or route with at least two points.')

  return {
    fileName,
    geometry: GpxGeometrySchema.parse({ type: 'MultiLineString', coordinates }),
  }
}
