export const MAX_GPX_FILE_SIZE_BYTES = 5 * 1024 * 1024
export const MAX_GPX_POINT_COUNT = 50_000
const DECIMAL_COORDINATE = /^[+-]?(?:\d+(?:\.\d*)?|\.\d+)$/

export interface GpxPoint {
  latitude: number
  longitude: number
}

export interface GpxGeometry {
  segments: GpxPoint[][]
  pointCount: number
}

const GPX_NAMESPACES = new Set(['', 'http://www.topografix.com/GPX/1/0', 'http://www.topografix.com/GPX/1/1'])

function directChildren(element: Element, localName: string): Element[] {
  return Array.from(element.children).filter(
    (child) => child.localName === localName && child.namespaceURI === element.namespaceURI,
  )
}

function parsePoint(element: Element, pointNumber: number): GpxPoint {
  const latitudeText = element.getAttribute('lat')
  const longitudeText = element.getAttribute('lon')

  if (!latitudeText?.trim() || !longitudeText?.trim()) {
    throw new Error(`GPX point ${pointNumber} must include numeric lat and lon attributes.`)
  }

  const trimmedLatitude = latitudeText.trim()
  const trimmedLongitude = longitudeText.trim()
  const latitude = Number(trimmedLatitude)
  const longitude = Number(trimmedLongitude)

  if (!DECIMAL_COORDINATE.test(trimmedLatitude) || latitude < -90 || latitude > 90) {
    throw new Error(`GPX point ${pointNumber} has latitude ${latitudeText}; expected a number from -90 to 90.`)
  }
  if (!DECIMAL_COORDINATE.test(trimmedLongitude) || longitude < -180 || longitude > 180) {
    throw new Error(`GPX point ${pointNumber} has longitude ${longitudeText}; expected a number from -180 to 180.`)
  }

  return { latitude, longitude }
}

interface XmlElementFrame {
  namespaceURI: string
  kind: 'gpx' | 'route' | 'track' | 'track-segment' | 'other'
  namespaceChanges: Map<string, string | undefined>
}

function decodeXmlReferences(value: string): string {
  const predefinedReferences: Record<string, string> = {
    amp: '&',
    apos: "'",
    gt: '>',
    lt: '<',
    quot: '"',
  }

  return value.replace(/&(#x[0-9A-Fa-f]+|#\d+|amp|apos|gt|lt|quot);/g, (reference, content: string) => {
    if (content.startsWith('#')) {
      const codePoint = content.startsWith('#x') ? Number.parseInt(content.slice(2), 16) : Number.parseInt(content.slice(1), 10)
      return codePoint <= 0x10ffff && !(codePoint >= 0xd800 && codePoint <= 0xdfff)
        ? String.fromCodePoint(codePoint)
        : reference
    }
    return predefinedReferences[content] ?? reference
  })
}

function scanXmlBeforeParsing(xml: string): boolean {
  let count = 0
  let index = 0
  const namespaces = new Map<string, string>()
  const elements: XmlElementFrame[] = []

  const popElement = () => {
    const element = elements.pop()
    if (!element) return
    for (const [prefix, previousValue] of element.namespaceChanges) {
      if (previousValue === undefined) namespaces.delete(prefix)
      else namespaces.set(prefix, previousValue)
    }
  }

  while (index < xml.length) {
    if (xml[index] !== '<') {
      index += 1
      continue
    }
    if (xml.startsWith('<!--', index)) {
      const end = xml.indexOf('-->', index + 4)
      index = end === -1 ? xml.length : end + 3
      continue
    }
    if (xml.startsWith('<![CDATA[', index)) {
      const end = xml.indexOf(']]>', index + 9)
      index = end === -1 ? xml.length : end + 3
      continue
    }
    if (xml.startsWith('<?', index)) {
      const end = xml.indexOf('?>', index + 2)
      index = end === -1 ? xml.length : end + 2
      continue
    }
    if (/^<!DOCTYPE(?:\s|\[|>)/i.test(xml.slice(index))) {
      throw new Error('GPX files containing DOCTYPE declarations are not supported.')
    }
    if (xml[index + 1] === '!' || xml[index + 1] === '?') {
      index += 1
      continue
    }
    if (xml[index + 1] === '/') {
      index += 2
      while (index < xml.length && xml[index] !== '>') index += 1
      if (index < xml.length) index += 1
      popElement()
      continue
    }

    let nameEnd = index + 1
    while (nameEnd < xml.length && !/[\s/>]/.test(xml[nameEnd])) nameEnd += 1
    const name = xml.slice(index + 1, nameEnd)
    const localName = name.split(':').at(-1)
    const namespaceDeclarations = new Map<string, string>()
    let selfClosing = false
    index = nameEnd
    while (index < xml.length) {
      while (/\s/.test(xml[index] ?? '') && index < xml.length) index += 1
      if (xml[index] === '>') {
        index += 1
        break
      }
      if (xml[index] === '/') {
        selfClosing = true
        index += 1
        while (/\s/.test(xml[index] ?? '') && index < xml.length) index += 1
        if (xml[index] === '>') index += 1
        break
      }

      const attributeStart = index
      while (index < xml.length && !/[\s=/>]/.test(xml[index])) index += 1
      if (index === attributeStart) {
        index += 1
        continue
      }
      const attributeName = xml.slice(attributeStart, index)
      while (/\s/.test(xml[index] ?? '') && index < xml.length) index += 1
      if (xml[index] !== '=') continue
      index += 1
      while (/\s/.test(xml[index] ?? '') && index < xml.length) index += 1
      const quote = xml[index]
      if (quote !== '"' && quote !== "'") continue
      const valueStart = ++index
      while (index < xml.length && xml[index] !== quote) index += 1
      const value = decodeXmlReferences(xml.slice(valueStart, index))
      if (attributeName === 'xmlns') namespaceDeclarations.set('', value)
      else if (attributeName.startsWith('xmlns:')) namespaceDeclarations.set(attributeName.slice(6), value)
      if (index < xml.length) index += 1
    }

    const namespaceChanges = new Map<string, string | undefined>()
    for (const [prefix, value] of namespaceDeclarations) {
      if (!namespaceChanges.has(prefix)) namespaceChanges.set(prefix, namespaces.get(prefix))
      namespaces.set(prefix, value)
    }
    const prefix = name.includes(':') ? name.slice(0, name.indexOf(':')) : ''
    const namespaceURI = namespaces.get(prefix) ?? ''
    const parent = elements.at(-1)
    const kind: XmlElementFrame['kind'] =
      elements.length === 0 && localName === 'gpx' && GPX_NAMESPACES.has(namespaceURI)
        ? 'gpx'
        : parent?.namespaceURI === namespaceURI && parent.kind === 'gpx' && localName === 'rte'
          ? 'route'
          : parent?.namespaceURI === namespaceURI && parent.kind === 'gpx' && localName === 'trk'
            ? 'track'
            : parent?.namespaceURI === namespaceURI && parent.kind === 'track' && localName === 'trkseg'
              ? 'track-segment'
              : 'other'
    if (
      namespaceURI === parent?.namespaceURI &&
      ((parent.kind === 'route' && localName === 'rtept') || (parent.kind === 'track-segment' && localName === 'trkpt'))
    ) {
      count += 1
      if (count > MAX_GPX_POINT_COUNT) return true
    }

    elements.push({ namespaceURI, kind, namespaceChanges })
    if (selfClosing) popElement()
  }
  return false
}

export function parseGpx(xml: string): GpxGeometry {
  if (xml.length > MAX_GPX_FILE_SIZE_BYTES || new TextEncoder().encode(xml).byteLength > MAX_GPX_FILE_SIZE_BYTES) {
    throw new Error(`GPX file exceeds the ${MAX_GPX_FILE_SIZE_BYTES}-byte size limit.`)
  }
  if (scanXmlBeforeParsing(xml)) {
    throw new Error(`GPX file exceeds the ${MAX_GPX_POINT_COUNT}-point limit.`)
  }

  const document = new DOMParser().parseFromString(xml, 'application/xml')
  const root = document.documentElement
  if (root.localName === 'parsererror' || root.localName !== 'gpx') {
    throw new Error('GPX file is not valid XML with a gpx root element.')
  }
  if (!GPX_NAMESPACES.has(root.namespaceURI ?? '')) {
    throw new Error('GPX file is not valid XML with a supported gpx namespace.')
  }
  const tracks = directChildren(root, 'trk')
  const routes = directChildren(root, 'rte')
  if (tracks.length === 0 && routes.length === 0) {
    throw new Error('GPX file does not contain supported track or route geometry.')
  }

  const pointElements = [
    ...tracks.flatMap((track) => directChildren(track, 'trkseg').map((segment) => directChildren(segment, 'trkpt'))),
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
