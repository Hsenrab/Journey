import { z } from 'zod'
import rawDemoData from '../data/demo.json' with { type: 'json' }
import { activityDateError } from './activityDate'

export const statusOrder = ['not-started', 'bronze', 'silver', 'gold'] as const
export type Status = (typeof statusOrder)[number]

export const statusLabels: Record<Status, string> = {
  'not-started': 'No award recorded',
  bronze: 'Bronze',
  silver: 'Silver',
  gold: 'Gold',
}

export const statusRules: Record<Status, string> = {
  'not-started': 'No award has been recorded at this eligible Waypoint.',
  bronze: 'The highest recorded Activity award is Bronze.',
  silver: 'The highest recorded Activity award is Silver.',
  gold: 'The highest recorded Activity award is Gold.',
}

export const awardableStatuses = ['bronze', 'silver', 'gold'] as const satisfies readonly Status[]
export const AwardedStatusSchema = z.enum(awardableStatuses)
export type AwardedStatus = z.infer<typeof AwardedStatusSchema>
export const AwardDescriptionsSchema = z
  .object({
    bronze: z.string().trim().min(1, 'Bronze explanation is required'),
    silver: z.string().trim().min(1, 'Silver explanation is required'),
    gold: z.string().trim().min(1, 'Gold explanation is required'),
  })
  .strict()
export type AwardDescriptions = z.infer<typeof AwardDescriptionsSchema>
export class AwardValidationError extends Error {}

const isoDate = z.string().superRefine((value, context) => {
  const message = activityDateError(value)
  if (message) context.addIssue({ code: 'custom', message })
})

const PostcodeLocationSchema = z.object({
  kind: z.literal('postcode'),
  postcode: z.string().trim().min(1, 'Postcode is required'),
  latitude: z.number().min(-90).max(90).optional(),
  longitude: z.number().min(-180).max(180).optional(),
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

const RoutePositionSchema = z.tuple([z.number().min(-180).max(180), z.number().min(-90).max(90)])

export const MAX_GPX_GEOMETRY_SEGMENTS = 100
export const MAX_GPX_GEOMETRY_POINTS = 10_000
export const MAX_GPX_FILE_SIZE_BYTES = 5 * 1024 * 1024

export const GpxGeometrySchema = z
  .object({
    type: z.literal('MultiLineString'),
    coordinates: z.array(z.array(RoutePositionSchema).min(2)).min(1).max(MAX_GPX_GEOMETRY_SEGMENTS),
  })
  .strict()
  .superRefine((geometry, context) => {
    const pointCount = geometry.coordinates.reduce((total, segment) => total + segment.length, 0)
    if (pointCount > MAX_GPX_GEOMETRY_POINTS)
      context.addIssue({
        code: 'custom',
        path: ['coordinates'],
        message: `GPX geometry cannot contain more than ${MAX_GPX_GEOMETRY_POINTS} points.`,
      })
  })

export type GpxGeometry = z.infer<typeof GpxGeometrySchema>

export const PlannedRouteSchema = z
  .object({
    fileName: z.string().trim().min(1).max(255),
    geometry: GpxGeometrySchema,
  })
  .strict()

const CompletionSchema = z.discriminatedUnion('mode', [
  z.object({ mode: z.literal('once') }).strict(),
  z.object({ mode: z.literal('count'), target: z.number().int().positive() }).strict(),
])

export const WaypointSchema = z.object({
  waypointId: z.string().min(1),
  title: z.string().min(1),
  description: z.string().min(1),
  category: z.string().min(1),
  tags: z.array(z.string().min(1)),
  challengeIds: z
    .array(z.string().min(1))
    .refine((ids) => new Set(ids).size === ids.length, 'Waypoint challenge links must be distinct'),
  completion: CompletionSchema,
  location: WaypointLocationSchema.optional(),
  referenceIds: z.array(z.string().min(1)),
  photoReferenceIds: z.array(z.string().min(1)),
})

export const ChallengeSchema = z.preprocess(
  (value, context) => {
    if (typeof value === 'object' && value !== null && 'waypointIds' in value) {
      context.addIssue({
        code: 'custom',
        path: ['waypointIds'],
        message:
          'Challenge.waypointIds is obsolete. Assign Challenges through Waypoint.challengeIds; existing data must be corrected separately.',
      })
    }
    return value
  },
  z
    .object({
      challengeId: z.string().min(1),
      title: z.string().min(1),
      description: z.string().min(1),
      supportsActivityCategories: z.boolean(),
      awardDescriptions: AwardDescriptionsSchema.optional(),
      location: WaypointLocationSchema.optional(),
      plannedRoute: PlannedRouteSchema.optional(),
    })
    .strict()
    .superRefine((challenge, context) => {
      if (challenge.supportsActivityCategories !== (challenge.awardDescriptions !== undefined))
        context.addIssue({
          code: 'custom',
          path: ['awardDescriptions'],
          message: challenge.supportsActivityCategories
            ? 'Award-enabled Challenges require Bronze, Silver and Gold explanations.'
            : 'Challenges with awards disabled must omit awardDescriptions.',
        })
    }),
)

export const planningStates = ['active', 'someday', 'rejected'] as const
export const PlanningStateSchema = z.enum(planningStates)
export type PlanningState = z.infer<typeof PlanningStateSchema>
export const planningStateLabels: Record<PlanningState, string> = {
  active: 'Active',
  someday: 'Someday',
  rejected: 'Rejected',
}

export const difficulties = [1, 2, 3, 4] as const
export const DifficultySchema = z.union([z.literal(1), z.literal(2), z.literal(3), z.literal(4)])
export type Difficulty = z.infer<typeof DifficultySchema>
export const difficultyLabels: Record<Difficulty, string> = {
  1: 'Easy',
  2: 'Moderate',
  3: 'Involved',
  4: 'Ambitious',
}
export const difficultyDescriptions: Record<Difficulty, string> = {
  1: 'Local, low-cost, and achievable within half a day with little or no preparation. It could realistically be done tomorrow.',
  2: 'Requires some commitment, such as a full-day or straightforward multi-day trip, advance booking, or additional travel, but remains simple to arrange.',
  3: 'Requires substantial preparation or resources, such as route planning, several bookings, specialist knowledge, significant expense, or coordination with others.',
  4: 'A major undertaking requiring extensive planning, training, significant expense, international travel, or long-term commitment. It is usually a big-ticket goal.',
}

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
  .strict()
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

export const ReferenceSchema = z
  .object({
    referenceId: z.string().min(1),
    title: z.string().trim().min(1, 'Reference title is required'),
    description: z.string().trim().min(1).optional(),
    url: httpsUrl,
    previewImageUrl: httpsUrl.optional(),
  })
  .strict()

export const ExternalPhotoReferenceSchema = z
  .object({
    photoReferenceId: z.string().min(1),
    title: z.string().trim().min(1, 'Photo title is required'),
    altText: z.string().trim().min(1).optional(),
    url: httpsUrl,
  })
  .strict()

export const ActivitySchema = z
  .object({
    activityId: z.string().min(1),
    name: z.string().trim().min(1, 'Activity title is required'),
    waypointId: z.string().min(1).optional(),
    challengeId: z.string().min(1).optional(),
    ideaIds: distinctIds('Activity idea links must be distinct'),
    date: isoDate,
    category: AwardedStatusSchema.optional(),
    location: ActivityLocationSchema,
    recordedTrack: GpxGeometrySchema.optional(),
    notes: z.string(),
    referenceIds: z.array(z.string().min(1)),
    photoReferenceIds: z.array(z.string().min(1)),
    createdAt: z.iso.datetime(),
    updatedAt: z.iso.datetime(),
  })
  .strict()

export const DataSchema = z
  .object({
    waypoints: z.array(WaypointSchema),
    challenges: z.array(ChallengeSchema),
    ideas: z.array(IdeaSchema),
    activities: z.array(ActivitySchema),
    references: z.array(ReferenceSchema),
    photoReferences: z.array(ExternalPhotoReferenceSchema),
  })
  .superRefine((data, context) => {
    const challengeIds = new Set(data.challenges.map((challenge) => challenge.challengeId))
    data.waypoints.forEach((waypoint, index) => {
      waypoint.challengeIds.forEach((challengeId, linkIndex) => {
        if (!challengeIds.has(challengeId))
          context.addIssue({
            code: 'custom',
            path: ['waypoints', index, 'challengeIds', linkIndex],
            message: `Waypoint "${waypoint.waypointId}" references unknown challenge "${challengeId}".`,
          })
      })
    })
    data.activities.forEach((activity, index) => {
      const message = activityCategoryError(data, activity)
      if (message) context.addIssue({ code: 'custom', path: ['activities', index, 'category'], message })
      if (activity.challengeId && !challengeIds.has(activity.challengeId))
        context.addIssue({
          code: 'custom',
          path: ['activities', index, 'challengeId'],
          message: `Activity "${activity.activityId}" references unknown Challenge "${activity.challengeId}".`,
        })
    })
  })

export type Waypoint = z.infer<typeof WaypointSchema>
export type Challenge = z.infer<typeof ChallengeSchema>
export type PlannedRoute = z.infer<typeof PlannedRouteSchema>
export type Idea = z.infer<typeof IdeaSchema>
export type Reference = z.infer<typeof ReferenceSchema>
export type ExternalPhotoReference = z.infer<typeof ExternalPhotoReferenceSchema>
export type Activity = z.infer<typeof ActivitySchema>
export type ActivityLocation = z.infer<typeof ActivityLocationSchema>
export type WaypointsData = z.infer<typeof DataSchema>

export function formatActivityDate(date: string) {
  // Parse as local midnight so date-only activity values do not shift by UTC offset when displayed.
  return new Date(`${date}T00:00:00`).toLocaleDateString()
}

export function activityTitle(activity: Activity) {
  return activity.name
}

export function activitySubtitle(activity: Activity) {
  return formatActivityDate(activity.date)
}

export function countLabel(count: number, singular: string) {
  const label = count === 1 ? singular : singular.endsWith('activity') ? `${singular.slice(0, -1)}ies` : `${singular}s`
  return `${count} ${label}`
}

export function locationSummary(location: ActivityLocation): string {
  return location.kind === 'postcode'
    ? `Postcode: ${location.postcode}`
    : `${location.latitude.toFixed(5)}, ${location.longitude.toFixed(5)}`
}

export function createDemoData(): WaypointsData {
  return DataSchema.parse(rawDemoData)
}

export function challengeWaypoints(challenge: Challenge, waypoints: readonly Waypoint[]): Waypoint[] {
  return waypoints.filter((waypoint) => waypoint.challengeIds.includes(challenge.challengeId))
}

export function waypointSupportsActivityCategory(data: WaypointsData, waypointId: string | undefined): boolean {
  return eligibleAwardChallenges(data, waypointId).length > 0
}

export function eligibleAwardChallenges(data: WaypointsData, waypointId: string | undefined): Challenge[] {
  if (!waypointId) return []
  const waypoint = data.waypoints.find((item) => item.waypointId === waypointId)
  if (!waypoint) throw new Error(`Unknown Waypoint "${waypointId}".`)
  return waypoint.challengeIds.flatMap((id) => {
    const challenge = data.challenges.find((item) => item.challengeId === id)
    if (!challenge) throw new Error(`Waypoint "${waypointId}" references unknown Challenge "${id}".`)
    return challenge.supportsActivityCategories ? [challenge] : []
  })
}

export function activityCategoryError(
  data: WaypointsData,
  activity: Pick<Activity, 'activityId' | 'waypointId' | 'category'>,
): string | undefined {
  const waypoint = data.waypoints.find((item) => item.waypointId === activity.waypointId)
  if (activity.waypointId && !waypoint)
    return `Activity "${activity.activityId}" references unknown Waypoint "${activity.waypointId}".`
  const eligible = waypoint?.challengeIds.some((id) =>
    data.challenges.some((item) => item.challengeId === id && item.supportsActivityCategories),
  )
  if (eligible && !activity.category)
    return `Activity "${activity.activityId}" at Waypoint "${activity.waypointId}" requires a Bronze, Silver or Gold award. Award settings and membership changes cannot convert unawarded history; no automatic backfill is available.`
  if (!eligible && activity.category)
    return `Activity "${activity.activityId}" has an award but its Waypoint does not support awards.`
}

export function validateActivityCategory(data: WaypointsData, activity: Activity): void {
  const message = activityCategoryError(data, activity)
  if (message) throw new AwardValidationError(message)
}

export function validateAwardTransition(original: WaypointsData, candidate: WaypointsData): void {
  for (const activity of original.activities) {
    if (!activity.category || !activity.waypointId) continue
    if (!candidate.activities.some((item) => item.activityId === activity.activityId)) continue
    const waypoint = candidate.waypoints.find((item) => item.waypointId === activity.waypointId)
    if (!waypoint || !waypointSupportsActivityCategory(candidate, waypoint.waypointId))
      throw new AwardValidationError(
        `Activity "${activity.activityId}" at Waypoint "${activity.waypointId}" would lose its last award eligibility. Explicitly correct or delete the Activity before changing its Waypoint or Challenge.`,
      )
  }
}

export function createActivity(input: {
  activityId?: string
  name: string
  waypointId?: string
  challengeId?: string
  ideaIds?: string[]
  date: string
  category?: AwardedStatus
  location: z.input<typeof ActivityLocationSchema>
  recordedTrack?: z.input<typeof GpxGeometrySchema>
  notes?: string
  referenceIds?: string[]
  photoReferenceIds?: string[]
  createdAt?: string
  updatedAt?: string
}): Activity {
  const now = new Date().toISOString()
  return ActivitySchema.parse({
    activityId: input.activityId ?? crypto.randomUUID(),
    name: input.name,
    waypointId: input.waypointId,
    challengeId: input.challengeId,
    ideaIds: input.ideaIds ?? [],
    date: input.date,
    category: input.category,
    location: input.location,
    recordedTrack: input.recordedTrack,
    notes: input.notes ?? '',
    referenceIds: input.referenceIds ?? [],
    photoReferenceIds: input.photoReferenceIds ?? [],
    createdAt: input.createdAt ?? now,
    updatedAt: input.updatedAt ?? now,
  })
}

export function createIdea(input: {
  ideaId?: string
  title: string
  description?: string
  notes?: string
  waypointIds?: string[]
  planningState: PlanningState
  rejectionReason?: string
  difficulty: Difficulty
  location?: z.input<typeof WaypointLocationSchema>
  referenceIds?: string[]
  createdAt?: string
  updatedAt?: string
}): Idea {
  const now = new Date().toISOString()
  return IdeaSchema.parse({
    ideaId: input.ideaId ?? crypto.randomUUID(),
    title: input.title,
    description: input.description ?? '',
    notes: input.notes ?? '',
    waypointIds: input.waypointIds ?? [],
    planningState: input.planningState,
    rejectionReason: input.rejectionReason?.trim() ? input.rejectionReason.trim() : undefined,
    difficulty: input.difficulty,
    location: input.location,
    referenceIds: input.referenceIds ?? [],
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

export function referencesForActivity(references: readonly Reference[], activity: Activity): Reference[] {
  const byId = new Map(references.map((reference) => [reference.referenceId, reference]))
  return activity.referenceIds.map((referenceId) => {
    const reference = byId.get(referenceId)
    if (!reference) throw new Error(`Activity "${activity.activityId}" references unknown reference "${referenceId}".`)
    return reference
  })
}

export function photoReferencesForActivity(
  photoReferences: readonly ExternalPhotoReference[],
  activity: Activity,
): ExternalPhotoReference[] {
  const byId = new Map(photoReferences.map((photo) => [photo.photoReferenceId, photo]))
  return activity.photoReferenceIds.map((photoReferenceId) => {
    const photo = byId.get(photoReferenceId)
    if (!photo)
      throw new Error(`Activity "${activity.activityId}" references unknown photo reference "${photoReferenceId}".`)
    return photo
  })
}

function usesIdea(activity: Activity, ideaId: string): boolean {
  return activity.ideaIds.includes(ideaId)
}

export function activitiesUsingIdea(activities: readonly Activity[], ideaId: string): Activity[] {
  return activities
    .filter((activity) => usesIdea(activity, ideaId))
    .sort((a, b) => b.date.localeCompare(a.date) || b.updatedAt.localeCompare(a.updatedAt))
}

export function ideaUsageCount(activities: readonly Activity[], ideaId: string): number {
  return activities.filter((activity) => usesIdea(activity, ideaId)).length
}

export function ideaUsageLabel(count: number): string {
  return count === 0 ? 'Not used' : `Used in ${count} activit${count === 1 ? 'y' : 'ies'}`
}

export function ideaLocationSummary(location: Idea['location'] | undefined): string {
  if (!location) return 'No location'
  const parts = [location.placeName, location.addressOrRegion].filter(Boolean)
  if (parts.length > 0) return parts.join(' · ')
  if (location.latitude !== undefined && location.longitude !== undefined) {
    return `${location.latitude.toFixed(5)}, ${location.longitude.toFixed(5)}`
  }
  return 'No location'
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

export type WaypointCompletionProgress = { count: number; target: number; complete: boolean }

export function waypointCompletionProgress(
  waypoint: Waypoint,
  activities: readonly Activity[],
): WaypointCompletionProgress {
  const count = activities.filter((activity) => activity.waypointId === waypoint.waypointId).length
  const target = waypoint.completion.mode === 'once' ? 1 : waypoint.completion.target
  return { count, target, complete: count >= target }
}

export function completionProgressLabel(waypoint: Waypoint, progress: WaypointCompletionProgress): string {
  if (waypoint.completion.mode === 'once') return progress.complete ? 'Done' : 'Not done'
  return `${progress.count} of ${progress.target} ${progress.target === 1 ? 'activity' : 'activities'}`
}

export function completionRuleLabel(waypoint: Waypoint): string {
  return waypoint.completion.mode === 'once'
    ? 'Completed after one logged activity.'
    : `Completed after ${waypoint.completion.target} logged ${waypoint.completion.target === 1 ? 'activity' : 'activities'}.`
}

export function completedWaypointCount(waypoints: readonly Waypoint[], activities: readonly Activity[]): number {
  return waypoints.filter((waypoint) => waypointCompletionProgress(waypoint, activities).complete).length
}

export function challengeCompletionSummary(waypoints: readonly Waypoint[], activities: readonly Activity[]) {
  const completed = completedWaypointCount(waypoints, activities)
  const total = waypoints.length
  return { completed, total, percentage: total === 0 ? 0 : Math.round((completed / total) * 100) }
}

export function statusCounts(waypoints: readonly Waypoint[], activities: readonly Activity[]): Record<Status, number> {
  const counts: Record<Status, number> = { 'not-started': 0, bronze: 0, silver: 0, gold: 0 }
  for (const waypoint of waypoints) counts[statusForWaypoint(activities, waypoint.waypointId)]++
  return counts
}

export function awardStatistics(data: WaypointsData, challengeId?: string) {
  const challenge =
    challengeId === undefined ? undefined : data.challenges.find((item) => item.challengeId === challengeId)
  if (challengeId !== undefined && !challenge) throw new AwardValidationError(`Unknown Challenge "${challengeId}".`)
  const waypoints = challenge
    ? challengeWaypoints(challenge, data.waypoints)
    : data.waypoints.filter((item) => waypointSupportsActivityCategory(data, item.waypointId))
  const ids = new Set(waypoints.map((item) => item.waypointId))
  const activities = data.activities.filter((item) => item.waypointId !== undefined && ids.has(item.waypointId))
  const supportsAwards = challenge ? challenge.supportsActivityCategories : waypoints.length > 0
  const waypointAwards: Record<Status, Waypoint[]> = { 'not-started': [], bronze: [], silver: [], gold: [] }
  const activityAwards: Record<AwardedStatus, Activity[]> = { bronze: [], silver: [], gold: [] }
  if (supportsAwards) {
    for (const waypoint of waypoints) waypointAwards[statusForWaypoint(activities, waypoint.waypointId)].push(waypoint)
    for (const activity of activities) {
      if (activity.category) activityAwards[activity.category].push(activity)
    }
  }
  return { waypoints, activities, waypointAwards, activityAwards, supportsAwards }
}

export type AwardStatistics = ReturnType<typeof awardStatistics>

export function awardFilterError(
  data: WaypointsData,
  filters: { challengeId?: string; status?: string; award?: string },
): string | undefined {
  const challenge = data.challenges.find((item) => item.challengeId === filters.challengeId)
  if (filters.challengeId !== undefined && !challenge) return `Unknown Challenge "${filters.challengeId}".`
  if (
    filters.status !== undefined &&
    filters.status !== 'all' &&
    !statusOrder.some((value) => value === filters.status)
  )
    return `Invalid highest-award filter "${filters.status}".`
  if (filters.award !== undefined && !awardableStatuses.some((value) => value === filters.award))
    return `Invalid recorded-award filter "${filters.award}".`
  if (
    challenge &&
    !challenge.supportsActivityCategories &&
    ((filters.status !== undefined && filters.status !== 'all') || filters.award !== undefined)
  )
    return 'Award filters do not apply to an ordinary Challenge.'
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
