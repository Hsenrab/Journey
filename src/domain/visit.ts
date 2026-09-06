import { z } from 'zod'
import type { Location } from './location'
import rawDemoData from '../data/demo.json'

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

export const planningStates = ['active', 'someday', 'rejected'] as const
export const PlanningStateSchema = z.enum(planningStates)
export type PlanningState = z.infer<typeof PlanningStateSchema>

export const difficulties = [1, 2, 3, 4] as const
export const DifficultySchema = z.union([z.literal(1), z.literal(2), z.literal(3), z.literal(4)])
export type Difficulty = z.infer<typeof DifficultySchema>

const distinctIds = (message: string) =>
  z.array(z.string().min(1)).refine((ids) => new Set(ids).size === ids.length, message)

export const IdeaSchema = z
  .object({
    ideaId: z.string().min(1),
    title: z.string().trim().min(1, 'Idea title is required'),
    description: z.string(),
    notes: z.string(),
    waypointIds: distinctIds('Idea waypoint links must be distinct'),
    planningState: PlanningStateSchema,
    rejectionReason: z.string().trim().min(1).optional(),
    difficulty: DifficultySchema,
    location: WaypointLocationSchema.optional(),
    referenceIds: distinctIds('Idea reference links must be distinct'),
    createdAt: z.iso.datetime(),
    updatedAt: z.iso.datetime(),
  })
  .superRefine((idea, context) => {
    if (idea.planningState === 'rejected' && idea.rejectionReason === undefined)
      context.addIssue({
        code: 'custom',
        path: ['rejectionReason'],
        message: 'A rejected idea requires a rejection reason',
      })
    if (idea.planningState !== 'rejected' && idea.rejectionReason !== undefined)
      context.addIssue({
        code: 'custom',
        path: ['rejectionReason'],
        message: 'Only a rejected idea can have a rejection reason',
      })
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
  ideaIds: distinctIds('Activity idea links must be distinct'),
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

export function createDemoData(): WaypointsData {
  return DataSchema.parse(rawDemoData)
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
  ideaIds?: string[]
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
    ideaIds: input.ideaIds ?? [],
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

export function ideasForWaypoint(ideas: readonly Idea[], waypointId: string): Idea[] {
  return ideas.filter((idea) => idea.waypointIds.includes(waypointId))
}

export function ideasForActivity(ideas: readonly Idea[], activity: Activity): Idea[] {
  const byId = new Map(ideas.map((idea) => [idea.ideaId, idea]))
  return activity.ideaIds.flatMap((ideaId) => {
    const idea = byId.get(ideaId)
    return idea ? [idea] : []
  })
}

export function activitiesUsingIdea(activities: readonly Activity[], ideaId: string): Activity[] {
  return activities
    .filter((activity) => activity.ideaIds.includes(ideaId))
    .sort((a, b) => b.date.localeCompare(a.date) || b.updatedAt.localeCompare(a.updatedAt))
}

export function ideaUsageCount(activities: readonly Activity[], ideaId: string): number {
  return activities.filter((activity) => activity.ideaIds.includes(ideaId)).length
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
