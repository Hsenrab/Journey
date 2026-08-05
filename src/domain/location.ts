import { z } from 'zod'

export type Status = 'not-started' | 'bronze' | 'silver' | 'gold'

export const locationCategories = [
  'Archaeological site',
  'Castle',
  'Coastline',
  'Countryside',
  'Estate',
  'Garden',
  'Historic building',
  'House',
  'House and garden',
  'Industrial heritage',
  'Mill',
  'Nature reserve',
  'Roman villa',
  'Village',
] as const

export const LocationCategorySchema = z.enum(locationCategories)
export type LocationCategory = z.infer<typeof LocationCategorySchema>

export const LocationTravelSchema = z.object({
  distanceMiles: z.number().positive(),
  driveTimeMinutes: z.number().int().positive().max(150),
})
export type LocationTravel = z.infer<typeof LocationTravelSchema>

const CatalogueDateSchema = z.union([z.iso.date(), z.iso.datetime()])

export const LocationSchema = z.object({
  locationId: z.string().min(1),
  name: z.string().min(1),
  area: z.string().min(1),
  category: LocationCategorySchema,
  travel: LocationTravelSchema,
  url: z.string().url().startsWith('https://www.nationaltrust.org.uk/'),
  notes: z.string().min(1),
  createdAt: CatalogueDateSchema,
  updatedAt: CatalogueDateSchema,
})
export type Location = z.infer<typeof LocationSchema>

export const LocationListSchema = z.array(LocationSchema)

/**
 * Parses and validates a raw location list (e.g. imported JSON), throwing a
 * descriptive ZodError if any record is invalid. Never mutates the input.
 */
export function parseLocations(value: unknown): Location[] {
  return LocationListSchema.parse(value)
}

export type Visit = { status: Status; date: string; notes: string; photos: string[] }
export type JourneyData = Record<string, Visit>

export const statusOrder: Status[] = ['not-started', 'bronze', 'silver', 'gold']

export function statusOf(data: JourneyData, locationId: string): Status {
  return data[locationId]?.status ?? 'not-started'
}

export function statusCounts(locations: Location[], data: JourneyData): Record<Status, number> {
  const counts: Record<Status, number> = { 'not-started': 0, bronze: 0, silver: 0, gold: 0 }
  for (const location of locations) counts[statusOf(data, location.locationId)]++
  return counts
}

/** Percentage (0-100) of locations that have reached at least the given status. */
export function progressTowards(locations: Location[], data: JourneyData, status: Status): number {
  if (locations.length === 0) return 0
  const threshold = statusOrder.indexOf(status)
  const reached = locations.filter(
    (location) => statusOrder.indexOf(statusOf(data, location.locationId)) >= threshold,
  ).length
  return Math.round((reached / locations.length) * 100)
}

export function recentlyVisited(locations: Location[], data: JourneyData, limit = 3): Location[] {
  return locations
    .filter((location) => data[location.locationId])
    .sort((a, b) => (data[b.locationId]?.date ?? '').localeCompare(data[a.locationId]?.date ?? ''))
    .slice(0, limit)
}

export function stillToVisit(locations: Location[], data: JourneyData): Location[] {
  return locations.filter((location) => statusOf(data, location.locationId) === 'not-started')
}

/** Suggests the next locations to visit, preferring those not yet started. */
export function suggestedNext(locations: Location[], data: JourneyData, limit = 3): Location[] {
  return stillToVisit(locations, data).slice(0, limit)
}
