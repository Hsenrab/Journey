export const MAX_GPX_FILE_SIZE_BYTES = 5 * 1024 * 1024
export const MAX_GPX_POINT_COUNT = 50_000

export interface GpxPoint {
  latitude: number
  longitude: number
}

export interface GpxGeometry {
  segments: GpxPoint[][]
  pointCount: number
}

function directChildren(element: Element, localName: string): Element[] {
  return Array.from(element.children).filter((child) => child.localName === localName)
}

function parsePoint(element: Element, pointNumber: number): GpxPoint {
  const latitudeText = element.getAttribute('lat')
  const longitudeText = element.getAttribute('lon')

  if (!latitudeText?.trim() || !longitudeText?.trim()) {
    throw new Error(`GPX point ${pointNumber} must include numeric lat and lon attributes.`)
  }

  const latitude = Number(latitudeText)
  const longitude = Number(longitudeText)

  if (!Number.isFinite(latitude) || latitude < -90 || latitude > 90) {
    throw new Error(`GPX point ${pointNumber} has latitude ${latitudeText}; expected a number from -90 to 90.`)
  }
  if (!Number.isFinite(longitude) || longitude < -180 || longitude > 180) {
    throw new Error(`GPX point ${pointNumber} has longitude ${longitudeText}; expected a number from -180 to 180.`)
  }

  return { latitude, longitude }
}

function exceedsPointLimit(xml: string): boolean {
  const pointStartTag = /<(?:[\w.-]+:)?(?:trkpt|rtept)(?=[\s/>])/g
  let count = 0
  while (pointStartTag.exec(xml)) {
    count += 1
    if (count > MAX_GPX_POINT_COUNT) return true
  }
  return false
}

export function parseGpx(xml: string): GpxGeometry {
  if (xml.length > MAX_GPX_FILE_SIZE_BYTES || new TextEncoder().encode(xml).byteLength > MAX_GPX_FILE_SIZE_BYTES) {
    throw new Error(`GPX file exceeds the ${MAX_GPX_FILE_SIZE_BYTES}-byte size limit.`)
  }
  if (/<!\s*DOCTYPE/i.test(xml)) {
    throw new Error('GPX files containing DOCTYPE declarations are not supported.')
  }
  if (exceedsPointLimit(xml)) {
    throw new Error(`GPX file exceeds the ${MAX_GPX_POINT_COUNT}-point limit.`)
  }

  const document = new DOMParser().parseFromString(xml, 'application/xml')
  const parserError = Array.from(document.getElementsByTagName('*')).find(
    (element) => element.localName === 'parsererror',
  )
  if (parserError || document.documentElement.localName !== 'gpx') {
    throw new Error('GPX file is not valid XML with a gpx root element.')
  }

  const root = document.documentElement
  const tracks = directChildren(root, 'trk')
  const routes = directChildren(root, 'rte')
  if (tracks.length === 0 && routes.length === 0) {
    throw new Error('GPX file does not contain supported track or route geometry.')
  }

  const pointElements = [
    ...tracks.flatMap((track) =>
      directChildren(track, 'trkseg').map((segment) => directChildren(segment, 'trkpt')),
    ),
    ...routes.map((route) => directChildren(route, 'rtept')),
  ]
  const pointCount = pointElements.reduce((count, segment) => count + segment.length, 0)

  if (pointCount > MAX_GPX_POINT_COUNT) {
    throw new Error(`GPX file exceeds the ${MAX_GPX_POINT_COUNT}-point limit.`)
  }
  if (pointElements.length === 0) {
    throw new Error('GPX file does not contain any track segments or routes.')
  }

  let pointNumber = 0
  const segments = pointElements.map((elements, segmentIndex) => {
    if (elements.length < 2) {
      throw new Error(`GPX segment ${segmentIndex + 1} must contain at least two points.`)
    }
    return elements.map((element) => parsePoint(element, ++pointNumber))
  })

  return { segments, pointCount }
}
