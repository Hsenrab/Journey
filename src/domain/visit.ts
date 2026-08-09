import { z } from 'zod'
import type { Location } from './location'

export const statusOrder = ['not-started', 'bronze', 'silver', 'gold'] as const
export type Status = (typeof statusOrder)[number]

export const statusLabels: Record<Status, string> = {
  'not-started': 'Not Started',
  bronze: 'Bronze',
  silver: 'Silver',
  gold: 'Gold',
}

export const statusRules: Record<Status, string> = {
  'not-started': 'No qualifying activity recorded.',
  bronze: 'At least one linked activity has been recorded.',
  silver: 'Main waypoint experience completed.',
  gold: 'Every planned waypoint in the challenge is completed.',
}

export const awardableStatuses = ['bronze', 'silver', 'gold'] as const satisfies readonly Status[]
export const AwardedStatusSchema = z.enum(awardableStatuses)
export type AwardedStatus = z.infer<typeof AwardedStatusSchema>

const isoDate = z
  .string()
  .regex(/^\d{4}-\d{2}-\d{2}$/, 'Activity date must use YYYY-MM-DD format')
  .refine((value) => {
    const date = new Date(`${value}T00:00:00Z`)
    return !Number.isNaN(date.getTime()) && date.toISOString().slice(0, 10) === value
  }, 'Activity date must be a real calendar date')

export const ActivityLocationSchema = z.object({
  placeName: z.string().min(1),
  latitude: z.number().min(-90).max(90).optional(),
  longitude: z.number().min(-180).max(180).optional(),
  addressOrRegion: z.string().min(1).optional(),
  source: z.string().min(1).optional(),
  approximate: z.boolean().optional(),
})

const CompletionSchema = z.discriminatedUnion('mode', [
  z.object({ mode: z.literal('once') }),
  z.object({ mode: z.literal('count'), target: z.number().int().positive() }),
])

export const WaypointSchema = z.object({
  waypointId: z.string().min(1),
  title: z.string().min(1),
  description: z.string().min(1),
  category: z.string().min(1),
  tags: z.array(z.string().min(1)),
  challengeIds: z.array(z.string().min(1)),
  completion: CompletionSchema,
  location: ActivityLocationSchema.partial({ placeName: true }).optional(),
  referenceIds: z.array(z.string().min(1)),
  photoReferenceIds: z.array(z.string().min(1)),
})

export const ChallengeSchema = z.object({
  challengeId: z.string().min(1),
  title: z.string().min(1),
  description: z.string().min(1),
  waypointIds: z.array(z.string().min(1)),
  location: ActivityLocationSchema.partial({ placeName: true }).optional(),
})

export const IdeaSchema = z.object({
  ideaId: z.string().min(1),
  title: z.string().min(1),
  description: z.string().min(1),
  waypointIds: z.array(z.string().min(1)),
  challengeIds: z.array(z.string().min(1)),
  location: ActivityLocationSchema.partial({ placeName: true }).optional(),
})

export const ReferenceSchema = z.object({
  referenceId: z.string().min(1),
  title: z.string().min(1),
  url: z.string().url().startsWith('https://'),
})

export const ExternalPhotoReferenceSchema = z.object({
  photoReferenceId: z.string().min(1),
  title: z.string().min(1),
  url: z.string().url().startsWith('https://'),
})

export const ActivitySchema = z.object({
  activityId: z.string().min(1),
  waypointId: z.string().min(1).optional(),
  challengeId: z.string().min(1).optional(),
  ideaId: z.string().min(1).optional(),
  date: isoDate,
  status: AwardedStatusSchema,
  location: ActivityLocationSchema,
  notes: z.string(),
  photos: z.array(z.string()),
  referenceIds: z.array(z.string().min(1)),
  photoReferenceIds: z.array(z.string().min(1)),
  createdAt: z.iso.datetime(),
  updatedAt: z.iso.datetime(),
})

export const DataSchema = z.object({
  waypoints: z.array(WaypointSchema),
  challenges: z.array(ChallengeSchema),
  ideas: z.array(IdeaSchema),
  activities: z.array(ActivitySchema),
  references: z.array(ReferenceSchema),
  photoReferences: z.array(ExternalPhotoReferenceSchema),
})

export type Waypoint = z.infer<typeof WaypointSchema>
export type Challenge = z.infer<typeof ChallengeSchema>
export type Idea = z.infer<typeof IdeaSchema>
export type Activity = z.infer<typeof ActivitySchema>
export type WaypointsData = z.infer<typeof DataSchema>

export function createSeedData(locations: readonly Location[]): WaypointsData {
  const waypoints: Waypoint[] = locations.map((location) => ({
    waypointId: location.locationId,
    title: location.name,
    description: location.notes,
    category: location.category,
    tags: [location.area, location.category],
    challengeIds: ['national-trust'],
    completion: { mode: 'once' },
    location: { placeName: location.name, addressOrRegion: location.area },
    referenceIds: [`reference-${location.locationId}`],
    photoReferenceIds: [],
  }))

  return {
    waypoints,
    challenges: [
      {
        challengeId: 'national-trust',
        title: 'National Trust',
        description: 'Visit National Trust properties using the shared Waypoints model.',
        waypointIds: waypoints.map((waypoint) => waypoint.waypointId),
      },
    ],
    ideas: [],
    activities: [],
    references: locations.map((location) => ({
      referenceId: `reference-${location.locationId}`,
      title: `${location.name} visitor information`,
      url: location.url,
    })),
    photoReferences: [],
  }
}

export function createActivity(input: {
  waypointId?: string
  challengeId?: string
  ideaId?: string
  date: string
  status: AwardedStatus
  location: z.input<typeof ActivityLocationSchema>
  notes?: string
  photos?: string[]
  referenceIds?: string[]
  photoReferenceIds?: string[]
}): Activity {
  const now = new Date().toISOString()
  return ActivitySchema.parse({
    activityId: crypto.randomUUID(),
    waypointId: input.waypointId,
    challengeId: input.challengeId,
    ideaId: input.ideaId,
    date: input.date,
    status: input.status,
    location: input.location,
    notes: input.notes ?? '',
    photos: input.photos ?? [],
    referenceIds: input.referenceIds ?? [],
    photoReferenceIds: input.photoReferenceIds ?? [],
    createdAt: now,
    updatedAt: now,
  })
}

export function activitiesForWaypoint(activities: readonly Activity[], waypointId: string): Activity[] {
  return activities
    .filter((activity) => activity.waypointId === waypointId)
    .sort((a, b) => b.date.localeCompare(a.date))
}

export function statusForWaypoint(activities: readonly Activity[], waypointId: string): Status {
  return activities
    .filter((activity) => activity.waypointId === waypointId)
    .reduce<Status>(
      (highest, activity) =>
        statusOrder.indexOf(activity.status) > statusOrder.indexOf(highest) ? activity.status : highest,
      'not-started',
    )
}

export function completedWaypointCount(waypoints: readonly Waypoint[], activities: readonly Activity[]): number {
  return waypoints.filter((waypoint) => {
    const count = activities.filter((activity) => activity.waypointId === waypoint.waypointId).length
    return waypoint.completion.mode === 'once' ? count > 0 : count >= waypoint.completion.target
  }).length
}

export function statusCounts(waypoints: readonly Waypoint[], activities: readonly Activity[]): Record<Status, number> {
  const counts: Record<Status, number> = { 'not-started': 0, bronze: 0, silver: 0, gold: 0 }
  for (const waypoint of waypoints) counts[statusForWaypoint(activities, waypoint.waypointId)]++
  return counts
}

export function progressTowards(
  waypoints: readonly Waypoint[],
  activities: readonly Activity[],
  status: AwardedStatus,
): number {
  if (waypoints.length === 0) return 0
  const threshold = statusOrder.indexOf(status)
  const reached = waypoints.filter(
    (waypoint) => statusOrder.indexOf(statusForWaypoint(activities, waypoint.waypointId)) >= threshold,
  ).length
  return Math.round((reached / waypoints.length) * 100)
}

export function lastActivityDate(activities: readonly Activity[], waypointId: string): string | undefined {
  return activitiesForWaypoint(activities, waypointId)[0]?.date
}

export function lastActivityDates(activities: readonly Activity[]): Map<string, string> {
  const dates = new Map<string, string>()
  for (const activity of activities) {
    if (!activity.waypointId) continue
    const current = dates.get(activity.waypointId)
    if (current === undefined || activity.date > current) dates.set(activity.waypointId, activity.date)
  }
  return dates
}

export function recentlyVisited(waypoints: readonly Waypoint[], activities: readonly Activity[], limit = 3): Waypoint[] {
  const dates = lastActivityDates(activities)
  return waypoints
    .filter((waypoint) => dates.has(waypoint.waypointId))
    .sort((a, b) => (dates.get(b.waypointId) ?? '').localeCompare(dates.get(a.waypointId) ?? ''))
    .slice(0, limit)
}

export function stillToVisit(waypoints: readonly Waypoint[], activities: readonly Activity[]): Waypoint[] {
  return waypoints.filter((waypoint) => statusForWaypoint(activities, waypoint.waypointId) === 'not-started')
}

export function suggestedNext(waypoints: readonly Waypoint[], activities: readonly Activity[], limit = 3): Waypoint[] {
  return stillToVisit(waypoints, activities).slice(0, limit)
}

export function challengeMilestone(waypoints: readonly Waypoint[], activities: readonly Activity[]): Status {
  if (waypoints.length === 0) return 'not-started'
  const completed = completedWaypointCount(waypoints, activities)
  const ratio = completed / waypoints.length
  if (ratio >= 1) return 'gold'
  if (ratio >= 0.5) return 'silver'
  if (ratio > 0) return 'bronze'
  return 'not-started'
}
