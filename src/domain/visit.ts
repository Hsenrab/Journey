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
  'not-started': 'No linked activity with a Bronze, Silver or Gold category has been recorded.',
  bronze: 'At least one linked Bronze activity has been recorded.',
  silver: 'At least one linked Silver activity has been recorded.',
  gold: 'At least one linked Gold activity has been recorded.',
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

const PostcodeLocationSchema = z.object({
  kind: z.literal('postcode'),
  postcode: z.string().trim().min(1, 'Postcode is required'),
})

const CoordinateLocationSchema = z.object({
  kind: z.literal('coordinates'),
  latitude: z.number().min(-90).max(90),
  longitude: z.number().min(-180).max(180),
})

export const ActivityLocationSchema = z.discriminatedUnion('kind', [PostcodeLocationSchema, CoordinateLocationSchema])

const WaypointLocationSchema = z.object({
  placeName: z.string().min(1).optional(),
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
  location: WaypointLocationSchema.optional(),
  referenceIds: z.array(z.string().min(1)),
  photoReferenceIds: z.array(z.string().min(1)),
})

export const ChallengeSchema = z.object({
  challengeId: z.string().min(1),
  title: z.string().min(1),
  description: z.string().min(1),
  waypointIds: z.array(z.string().min(1)),
  supportsActivityCategories: z.boolean(),
  location: WaypointLocationSchema.optional(),
})

export const IdeaSchema = z.object({
  ideaId: z.string().min(1),
  title: z.string().min(1),
  description: z.string().min(1),
  waypointIds: z.array(z.string().min(1)),
  challengeIds: z.array(z.string().min(1)),
  location: WaypointLocationSchema.optional(),
})

const httpsUrl = z.url('Please enter a valid URL').startsWith('https://', 'URL must use https://')

export const ReferenceSchema = z.object({
  referenceId: z.string().min(1),
  title: z.string().trim().min(1, 'Reference title is required'),
  description: z.string().trim().min(1).optional(),
  url: httpsUrl,
  previewImageUrl: httpsUrl.optional(),
})

export const ExternalPhotoReferenceSchema = z.object({
  photoReferenceId: z.string().min(1),
  title: z.string().trim().min(1, 'Photo title is required'),
  altText: z.string().trim().min(1).optional(),
  url: httpsUrl,
})

export const ActivitySchema = z.object({
  activityId: z.string().min(1),
  waypointId: z.string().min(1).optional(),
  challengeId: z.string().min(1).optional(),
  ideaId: z.string().min(1).optional(),
  date: isoDate,
  category: AwardedStatusSchema.optional(),
  location: ActivityLocationSchema,
  notes: z.string(),
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
export type Reference = z.infer<typeof ReferenceSchema>
export type ExternalPhotoReference = z.infer<typeof ExternalPhotoReferenceSchema>
export type Activity = z.infer<typeof ActivitySchema>
export type ActivityLocation = z.infer<typeof ActivityLocationSchema>
export type WaypointsData = z.infer<typeof DataSchema>

export function locationSummary(location: ActivityLocation): string {
  return location.kind === 'postcode'
    ? `Postcode: ${location.postcode}`
    : `${location.latitude.toFixed(5)}, ${location.longitude.toFixed(5)}`
}

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
        supportsActivityCategories: true,
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

export function createDemoData(locations: readonly Location[]): WaypointsData {
  const selected = locations.slice(0, 8)
  const waypointIds = selected.map((location) => location.locationId)
  const waypoints: Waypoint[] = selected.map((location, index) => ({
    waypointId: location.locationId,
    title: location.name,
    description: `${location.notes} Demo waypoint ${index + 1}.`,
    category: location.category,
    tags: [location.area, location.category, index % 2 === 0 ? 'weekend' : 'day-trip'],
    challengeIds: ['national-trust', 'autumn-explorers'],
    completion: { mode: 'once' },
    location: { placeName: location.name, addressOrRegion: location.area },
    referenceIds: [`reference-${location.locationId}`],
    photoReferenceIds: [`photo-reference-${location.locationId}`],
  }))

  return {
    waypoints,
    challenges: [
      {
        challengeId: 'national-trust',
        title: 'National Trust',
        description: 'Demo challenge: complete waypoint activities across National Trust places.',
        waypointIds,
        supportsActivityCategories: true,
      },
      {
        challengeId: 'autumn-explorers',
        title: 'Autumn Explorers',
        description: 'Collect five varied waypoints before winter.',
        waypointIds: waypointIds.slice(0, 5),
        supportsActivityCategories: false,
      },
      {
        challengeId: 'completed-highlights',
        title: 'Completed Highlights',
        description: 'A finished demo challenge for checking the Gold challenge milestone.',
        waypointIds: [waypointIds[2], waypointIds[7]].filter(Boolean),
        supportsActivityCategories: false,
      },
      {
        challengeId: 'historic-weekend',
        title: 'Historic Weekend',
        description: 'Focus on the most heritage-rich waypoints.',
        waypointIds: waypointIds.slice(0, 4),
        supportsActivityCategories: false,
      },
      {
        challengeId: 'garden-route',
        title: 'Garden Route',
        description: 'A challenge with mostly gardens and house-and-garden stops.',
        waypointIds: waypointIds.slice(2, 7),
        supportsActivityCategories: false,
      },
      {
        challengeId: 'nearby-day-trips',
        title: 'Nearby Day Trips',
        description: 'Shorter trips to fit into one day.',
        waypointIds: waypointIds.slice(1, 6),
        supportsActivityCategories: false,
      },
      {
        challengeId: 'future-shortlist',
        title: 'Future Shortlist',
        description: 'An empty demo challenge for checking empty challenge states.',
        waypointIds: [],
        supportsActivityCategories: false,
      },
    ],
    ideas: [],
    activities: [
      {
        activityId: 'activity-demo-1',
        waypointId: waypointIds[0],
        date: '2026-07-01',
        category: 'bronze',
        location: { kind: 'postcode', postcode: 'BA1 1AA' },
        notes: 'Arrived at opening time and walked the full grounds.',
        referenceIds: [`reference-${waypointIds[0]}`],
        photoReferenceIds: [`photo-reference-${waypointIds[0]}`],
        createdAt: '2026-07-01T08:00:00.000Z',
        updatedAt: '2026-07-01T08:00:00.000Z',
      },
      {
        activityId: 'activity-demo-2',
        waypointId: waypointIds[1],
        date: '2026-07-08',
        location: { kind: 'coordinates', latitude: 51.4209, longitude: -2.0998 },
        notes: 'Completed the longer trail route without category.',
        referenceIds: [`reference-${waypointIds[1]}`],
        photoReferenceIds: [`photo-reference-${waypointIds[1]}`],
        createdAt: '2026-07-08T18:15:00.000Z',
        updatedAt: '2026-07-08T18:15:00.000Z',
      },
    ],
    references: selected.map((location) => ({
      referenceId: `reference-${location.locationId}`,
      title: `${location.name} visitor information`,
      description: 'Official visitor details and opening times.',
      url: location.url,
    })),
    photoReferences: selected.map((location) => ({
      photoReferenceId: `photo-reference-${location.locationId}`,
      title: `${location.name} sample photo`,
      altText: `${location.name} sample external photo`,
      url: `https://example.com/photos/${location.locationId}.jpg`,
    })),
  }
}

export function waypointSupportsActivityCategory(data: WaypointsData, waypointId: string | undefined): boolean {
  if (!waypointId) return false
  const waypoint = data.waypoints.find((item) => item.waypointId === waypointId)
  if (!waypoint) return false
  return waypoint.challengeIds.some((challengeId) =>
    data.challenges.some((challenge) => challenge.challengeId === challengeId && challenge.supportsActivityCategories),
  )
}

export function validateActivityCategory(data: WaypointsData, activity: Activity) {
  if (activity.category && !waypointSupportsActivityCategory(data, activity.waypointId)) {
    throw new Error('Selected waypoint does not support Bronze, Silver or Gold categories.')
  }
}

export function createActivity(input: {
  activityId?: string
  waypointId?: string
  challengeId?: string
  ideaId?: string
  date: string
  category?: AwardedStatus
  location: z.input<typeof ActivityLocationSchema>
  notes?: string
  referenceIds?: string[]
  photoReferenceIds?: string[]
  createdAt?: string
  updatedAt?: string
}): Activity {
  const now = new Date().toISOString()
  return ActivitySchema.parse({
    activityId: input.activityId ?? crypto.randomUUID(),
    waypointId: input.waypointId,
    challengeId: input.challengeId,
    ideaId: input.ideaId,
    date: input.date,
    category: input.category,
    location: input.location,
    notes: input.notes ?? '',
    referenceIds: input.referenceIds ?? [],
    photoReferenceIds: input.photoReferenceIds ?? [],
    createdAt: input.createdAt ?? now,
    updatedAt: input.updatedAt ?? now,
  })
}

export function activitiesForWaypoint(activities: readonly Activity[], waypointId: string): Activity[] {
  return activities
    .filter((activity) => activity.waypointId === waypointId)
    .sort((a, b) => b.date.localeCompare(a.date) || b.updatedAt.localeCompare(a.updatedAt))
}

export function statusForWaypoint(activities: readonly Activity[], waypointId: string): Status {
  return activities
    .filter((activity) => activity.waypointId === waypointId && activity.category)
    .reduce<Status>(
      (highest, activity) =>
        statusOrder.indexOf(activity.category ?? 'not-started') > statusOrder.indexOf(highest)
          ? (activity.category ?? highest)
          : highest,
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

export function recentlyVisited(
  waypoints: readonly Waypoint[],
  activities: readonly Activity[],
  limit = 3,
): Waypoint[] {
  const dates = lastActivityDates(activities)
  return waypoints
    .filter((waypoint) => dates.has(waypoint.waypointId))
    .sort((a, b) => (dates.get(b.waypointId) ?? '').localeCompare(dates.get(a.waypointId) ?? ''))
    .slice(0, limit)
}

export function stillToVisit(waypoints: readonly Waypoint[], activities: readonly Activity[]): Waypoint[] {
  return waypoints.filter((waypoint) => activities.every((activity) => activity.waypointId !== waypoint.waypointId))
}

export function suggestedNext(waypoints: readonly Waypoint[], activities: readonly Activity[], limit = 3): Waypoint[] {
  return stillToVisit(waypoints, activities).slice(0, limit)
}
