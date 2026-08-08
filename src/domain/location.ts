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
