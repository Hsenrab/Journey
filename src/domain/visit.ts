import { z } from 'zod'
import type { Location, Status } from './location'

export const statusOrder: Status[] = ['not-started', 'bronze', 'silver', 'gold']

export const statusLabels: Record<Status, string> = {
  'not-started': 'Not Started',
  bronze: 'Bronze',
  silver: 'Silver',
  gold: 'Gold',
}

export const statusRules: Record<Status, string> = {
  'not-started': 'No visit recorded.',
  bronze: 'Physically visited.',
  silver: 'Main visitor experience completed — the main challenge completion level.',
  gold: 'Everything reasonably available to a normal visitor completed.',
}

/** Statuses that a visit can award. A visit always awards at least Bronze. */
export const awardableStatuses: Status[] = ['bronze', 'silver', 'gold']

const isoDate = z
  .string()
  .regex(/^\d{4}-\d{2}-\d{2}$/, 'Visit date must use YYYY-MM-DD format')
  .refine((value) => {
    const date = new Date(`${value}T00:00:00Z`)
    return !Number.isNaN(date.getTime()) && date.toISOString().slice(0, 10) === value
  }, 'Visit date must be a real calendar date')

export const AwardedStatusSchema = z.enum(['bronze', 'silver', 'gold'])

export const VisitSchema = z.object({
  visitId: z.string().min(1),
  locationId: z.string().min(1),
  date: isoDate,
  status: AwardedStatusSchema,
  notes: z.string(),
  photos: z.array(z.string()),
  createdAt: z.iso.datetime(),
  updatedAt: z.iso.datetime(),
})

export type Visit = z.infer<typeof VisitSchema>
export type AwardedStatus = z.infer<typeof AwardedStatusSchema>

/** Builds a schema that also rejects visits referencing an unknown location. */
export function visitsSchema(knownLocationIds: readonly string[]) {
  const known = new Set(knownLocationIds)
  return z.array(
    VisitSchema.refine((visit) => known.has(visit.locationId), {
      message: 'Visit references an unknown location',
      path: ['locationId'],
    }),
  )
}

export function createVisit(input: {
  locationId: string
  date: string
  status: AwardedStatus
  notes?: string
  photos?: string[]
}): Visit {
  const now = new Date().toISOString()
  return VisitSchema.parse({
    visitId: crypto.randomUUID(),
    locationId: input.locationId,
    date: input.date,
    status: input.status,
    notes: input.notes ?? '',
    photos: input.photos ?? [],
    createdAt: now,
    updatedAt: now,
  })
}

export function visitsForLocation(visits: readonly Visit[], locationId: string): Visit[] {
  return visits.filter((visit) => visit.locationId === locationId).sort((a, b) => b.date.localeCompare(a.date))
}

/** The current status of a location is the highest status awarded by any of its visits. */
export function statusForLocation(visits: readonly Visit[], locationId: string): Status {
  return visits
    .filter((visit) => visit.locationId === locationId)
    .reduce<Status>(
      (highest, visit) => (statusOrder.indexOf(visit.status) > statusOrder.indexOf(highest) ? visit.status : highest),
      'not-started',
    )
}

export function statusCounts(locations: readonly Location[], visits: readonly Visit[]): Record<Status, number> {
  const counts: Record<Status, number> = { 'not-started': 0, bronze: 0, silver: 0, gold: 0 }
  for (const location of locations) counts[statusForLocation(visits, location.locationId)]++
  return counts
}

/** Percentage (0-100) of locations that have reached at least the given status. */
export function progressTowards(locations: readonly Location[], visits: readonly Visit[], status: Status): number {
  if (locations.length === 0) return 0
  const threshold = statusOrder.indexOf(status)
  const reached = locations.filter(
    (location) => statusOrder.indexOf(statusForLocation(visits, location.locationId)) >= threshold,
  ).length
  return Math.round((reached / locations.length) * 100)
}

/** The date of the most recent visit to a location, or undefined if never visited. */
export function lastVisitDate(visits: readonly Visit[], locationId: string): string | undefined {
  return visitsForLocation(visits, locationId)[0]?.date
}

export function recentlyVisited(locations: readonly Location[], visits: readonly Visit[], limit = 3): Location[] {
  return locations
    .filter((location) => lastVisitDate(visits, location.locationId) !== undefined)
    .sort((a, b) =>
      (lastVisitDate(visits, b.locationId) ?? '').localeCompare(lastVisitDate(visits, a.locationId) ?? ''),
    )
    .slice(0, limit)
}

export function stillToVisit(locations: readonly Location[], visits: readonly Visit[]): Location[] {
  return locations.filter((location) => statusForLocation(visits, location.locationId) === 'not-started')
}

/** Suggests the next locations to visit, preferring those not yet started. */
export function suggestedNext(locations: readonly Location[], visits: readonly Visit[], limit = 3): Location[] {
  return stillToVisit(locations, visits).slice(0, limit)
}
