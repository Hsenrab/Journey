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
  strokeWidth: number
  coordinates: [longitude: number, latitude: number][]
}

const lineColors = ['#1565c0', '#c62828', '#6a1b9a', '#ef6c00', '#00838f']

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

function validSegment(segment: unknown): segment is readonly GpxPosition[] {
  return Array.isArray(segment) && segment.length >= 2 && segment.every(validPosition)
}

export function gpxLineFeatures(lines: readonly GpxMapLine[]): GpxLineFeature[] {
  const fallbackLineIds = [
    ...new Set(
      lines
        .filter(
          (line) =>
            line &&
            typeof line.id === 'string' &&
            !!line.id.trim() &&
            typeof line.label === 'string' &&
            !!line.label.trim() &&
            Array.isArray(line.segments) &&
            line.segments.some(validSegment) &&
            !(line.color && /^#[0-9a-f]{6}$/i.test(line.color)),
        )
        .map(({ id }) => id),
    ),
  ].sort()
  const fallbackStyles = new Map(
    fallbackLineIds.map((id, index) => [
      id,
      {
        color: lineColors[index % lineColors.length]!,
        strokeWidth: 4 + Math.floor(index / lineColors.length),
      },
    ]),
  )

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
    const explicitColor = line.color && /^#[0-9a-f]{6}$/i.test(line.color) ? line.color : undefined
    const fallbackStyle = fallbackStyles.get(line.id) ?? { color: lineColors[0]!, strokeWidth: 4 }
    const color = explicitColor ?? fallbackStyle.color
    const strokeWidth = explicitColor ? 4 : fallbackStyle.strokeWidth
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
          strokeWidth,
          coordinates: segment.map(([longitude, latitude]) => [longitude, latitude]),
        },
      ]
    })
  })
}
