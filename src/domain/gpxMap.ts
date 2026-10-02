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

function isLineColor(color: string | undefined): color is string {
  return color !== undefined && /^#[0-9a-f]{6}$/i.test(color)
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

function validSegment(segment: unknown): segment is readonly GpxPosition[] {
  return Array.isArray(segment) && segment.length >= 2 && segment.every(validPosition)
}

export function gpxLineFeatures(lines: readonly GpxMapLine[]): GpxLineFeature[] {
  const validLines = lines.map((line, lineIndex) => {
    if (
      !line ||
      typeof line.id !== 'string' ||
      !line.id.trim() ||
      typeof line.label !== 'string' ||
      !line.label.trim() ||
      !Array.isArray(line.segments)
    ) {
      throw new Error(`GPX line ${lineIndex + 1} must have a non-empty id, label, and segments array.`)
    }
    if (line.color !== undefined && !isLineColor(line.color)) {
      throw new Error(`GPX line "${line.id}" color must be a six-digit hexadecimal color.`)
    }
    return line
  })
  const fallbackLineIds = [
    ...new Set(
      validLines.filter((line) => !isLineColor(line.color) && line.segments.some(validSegment)).map((line) => line.id),
    ),
  ].sort()
  const usedStyles = new Set(
    validLines.flatMap((line) => (isLineColor(line.color) ? [`${line.color.toLowerCase()}:4`] : [])),
  )
  const fallbackStyles = new Map<string, { color: string; strokeWidth: number }>()
  let styleIndex = 0
  for (const id of fallbackLineIds) {
    let style: { color: string; strokeWidth: number }
    do {
      style = {
        color: lineColors[styleIndex % lineColors.length]!,
        strokeWidth: 4 + Math.floor(styleIndex / lineColors.length),
      }
      styleIndex += 1
    } while (usedStyles.has(`${style.color}:${style.strokeWidth}`))
    usedStyles.add(`${style.color}:${style.strokeWidth}`)
    fallbackStyles.set(id, style)
  }

  return validLines.flatMap((line) => {
    const style = isLineColor(line.color) ? { color: line.color, strokeWidth: 4 } : fallbackStyles.get(line.id)!
    return line.segments.flatMap((segment, segmentIndex) => {
      if (!validSegment(segment)) {
        throw new Error(
          `GPX line "${line.id}" segment ${segmentIndex + 1} must contain at least two valid coordinates.`,
        )
      }
      return [
        {
          id: `${line.id}:${segmentIndex}`,
          lineId: line.id,
          label: line.label,
          color: style.color,
          strokeWidth: style.strokeWidth,
          coordinates: segment.map(([longitude, latitude]) => [longitude, latitude]),
        },
      ]
    })
  })
}
