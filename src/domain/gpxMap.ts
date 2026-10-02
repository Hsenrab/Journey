export type GpxPosition = readonly [longitude: number, latitude: number]

export type GpxMapLine = {
  readonly id: string
  readonly label: string
  readonly segments: readonly (readonly GpxPosition[])[]
  readonly color?: string
}

export type GpxLineFeature = {
  id: string
  lineId: string
  label: string
  color: string
  coordinates: [longitude: number, latitude: number][]
}

const lineColors = ['#1565c0', '#c62828', '#6a1b9a', '#ef6c00', '#00838f']

function colorForLine(id: string): string {
  let hash = 0
  for (const character of id) hash = (hash * 31 + character.charCodeAt(0)) >>> 0
  return lineColors[hash % lineColors.length]!
}

function validPosition(position: unknown): position is GpxPosition {
  if (!Array.isArray(position) || position.length !== 2) return false
  const [longitude, latitude] = position
  return (
    typeof longitude === 'number' &&
    Number.isFinite(longitude) &&
    longitude >= -180 &&
    longitude <= 180 &&
    typeof latitude === 'number' &&
    Number.isFinite(latitude) &&
    latitude >= -90 &&
    latitude <= 90
  )
}

export function gpxLineFeatures(lines: readonly GpxMapLine[]): GpxLineFeature[] {
  return lines.flatMap((line) => {
    if (
      !line ||
      typeof line.id !== 'string' ||
      !line.id.trim() ||
      typeof line.label !== 'string' ||
      !line.label.trim() ||
      !Array.isArray(line.segments)
    ) {
      return []
    }
    const color = line.color && /^#[0-9a-f]{6}$/i.test(line.color) ? line.color : colorForLine(line.id)
    return line.segments.flatMap((segment, segmentIndex) => {
      if (!Array.isArray(segment) || segment.length < 2 || !segment.every(validPosition)) {
        throw new Error(`GPX line "${line.id}" segment ${segmentIndex + 1} must contain at least two valid positions.`)
      }
      return [
        {
          id: `${line.id}:${segmentIndex}`,
          lineId: line.id,
          label: line.label,
          color,
          coordinates: segment.map(([longitude, latitude]) => [longitude, latitude]),
        },
      ]
    })
  })
}
