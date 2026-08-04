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
])
export type LocationCategory = z.infer<typeof LocationCategorySchema>

/**
 * Travel boundary approach: distance and drive time are measured, in a straight
 * line and by typical road route respectively, from Brockworth, Gloucester
 * (GL3), the reference starting point for this challenge. A location only
 * qualifies for the catalogue if its `driveTimeMinutes` falls within the
 * documented boundary (see README.md "Travel boundary").
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
