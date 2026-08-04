import { z } from 'zod'

export type Status = 'not-started' | 'bronze' | 'silver' | 'gold'

/**
 * Categories of qualifying National Trust visitor destination.
 * Cafés only, shops only, offices, holiday cottages, standalone car parks,
 * non-public properties and non-qualifying tenant attractions are excluded.
 */
export const LocationCategorySchema = z.enum([
  'House and garden',
  'Garden',
  'Countryside',
  'Historic house',
  'Mill',
  'Roman villa',
  'Estate and parkland',
  'Castle',
  'Nature reserve',
  'Historic building',
  'Coastline',
])
export type LocationCategory = z.infer<typeof LocationCategorySchema>

/**
 * Travel reference approach: distance and drive time are measured, in a
 * straight line and by typical road route respectively, from Brockworth,
 * Gloucester (GL3), the reference starting point for this app. The catalogue
 * is not restricted to locations near Brockworth — it aims to include all
 * qualifying National Trust properties nationally — but every record stores
 * its distance/drive time from Brockworth so the location list can be
 * filtered or sorted by proximity (see README.md "Travel reference point").
 */
export const LocationTravelSchema = z.object({
  distanceMiles: z.number().nonnegative(),
  driveTimeMinutes: z.number().nonnegative(),
})
export type LocationTravel = z.infer<typeof LocationTravelSchema>

/**
 * A qualifying National Trust visitor destination.
 *
 * `locationId` is a stable, immutable identifier and must never be derived
 * from, or replaced by, the (mutable) display `name`.
 */
export const LocationSchema = z.object({
  locationId: z.string().min(1),
  name: z.string().min(1),
  area: z.string().min(1),
  category: LocationCategorySchema,
  travel: LocationTravelSchema,
  url: z.string().url(),
  notes: z.string(),
  createdAt: z.iso.date(),
  updatedAt: z.iso.date(),
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
    .sort((a, b) =>
      (data[b.locationId]?.date ?? '').localeCompare(data[a.locationId]?.date ?? ''),
    )
    .slice(0, limit)
}

export function stillToVisit(locations: Location[], data: JourneyData): Location[] {
  return locations.filter((location) => statusOf(data, location.locationId) === 'not-started')
}

/** Suggests the next locations to visit, preferring those not yet started. */
export function suggestedNext(locations: Location[], data: JourneyData, limit = 3): Location[] {
  return stillToVisit(locations, data).slice(0, limit)
}
