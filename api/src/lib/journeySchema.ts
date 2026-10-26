import { z } from 'zod'
import { isValidActivityDate } from './activityDate.js'

const entityTypes = ['waypoint', 'challenge', 'idea', 'activity', 'reference', 'photoReference'] as const
export const EntityTypeSchema = z.enum(entityTypes)
export type EntityType = z.infer<typeof EntityTypeSchema>

const identifier = z.string().min(1)
const text = z.string().trim().min(1)
const distinctIds = (message: string) => z.array(identifier).refine((ids) => new Set(ids).size === ids.length, message)
const httpsUrl = z.url().startsWith('https://')
const latitude = z.number().min(-90).max(90)
const longitude = z.number().min(-180).max(180)
const place = z
  .object({
    placeName: identifier.optional(),
    latitude: latitude.optional(),
    longitude: longitude.optional(),
    addressOrRegion: identifier.optional(),
    source: identifier.optional(),
    approximate: z.boolean().optional(),
  })
  .strict()
const resolvedPlace = place.required({ latitude: true, longitude: true })
const unresolvedPlace = place.omit({ latitude: true, longitude: true }).superRefine((location, context) => {
  if (![location.placeName, location.addressOrRegion].some((value) => value?.trim()))
    context.addIssue({
      code: 'custom',
      message: 'An unresolved waypoint location needs a place name or address.',
    })
})
const activityLocation = z.discriminatedUnion('kind', [
  z.object({ kind: z.literal('postcode'), postcode: identifier, latitude, longitude }).strict(),
  z.object({ kind: z.literal('coordinates'), latitude, longitude }).strict(),
])
const maxGpxGeometrySegments = 100
const maxGpxGeometryPoints = 10_000
const gpxGeometry = z
  .object({
    type: z.literal('MultiLineString'),
    coordinates: z
      .array(z.array(z.tuple([longitude, latitude])).min(2))
      .min(1)
      .max(maxGpxGeometrySegments),
  })
  .strict()
  .superRefine((geometry, context) => {
    const pointCount = geometry.coordinates.reduce((total, segment) => total + segment.length, 0)
    if (pointCount > maxGpxGeometryPoints)
      context.addIssue({
        code: 'custom',
        path: ['coordinates'],
        message: `GPX geometry cannot contain more than ${maxGpxGeometryPoints} points.`,
      })
  })
const plannedRoute = z.object({ fileName: text.max(255), geometry: gpxGeometry }).strict()
const schemas = {
  waypoint: z
    .object({
      waypointId: identifier,
      title: identifier,
      description: identifier,
      category: identifier,
      tags: z.array(identifier),
      challengeIds: distinctIds('Waypoint Challenge assignments must be distinct'),
      completion: z.discriminatedUnion('mode', [
        z.object({ mode: z.literal('once') }).strict(),
        z.object({ mode: z.literal('count'), target: z.number().int().positive() }).strict(),
      ]),
      location: resolvedPlace.optional(),
      referenceIds: z.array(identifier),
      photoReferenceIds: z.array(identifier),
    })
    .strict(),
  challenge: z.preprocess(
    (value, context) => {
      if (typeof value === 'object' && value !== null && 'waypointIds' in value) {
        const challengeId =
          'challengeId' in value && typeof value.challengeId === 'string' ? value.challengeId : 'unknown'
        context.addIssue({
          code: 'custom',
          message: `Challenge "${challengeId}" contains obsolete field "waypointIds"; review its links and correct them separately before use.`,
        })
      }
      return value
    },
    z
      .object({
        challengeId: identifier,
        title: identifier,
        description: identifier,
        supportsActivityCategories: z.boolean(),
        awardDescriptions: z.object({ bronze: text, silver: text, gold: text }).strict().optional(),
        location: place.optional(),
        plannedRoute: plannedRoute.optional(),
      })
      .strict()
      .superRefine((challenge, context) => {
        if (challenge.supportsActivityCategories !== (challenge.awardDescriptions !== undefined))
          context.addIssue({
            code: 'custom',
            path: ['awardDescriptions'],
            message: challenge.supportsActivityCategories
              ? 'Award-enabled Challenges require Bronze, Silver and Gold descriptions.'
              : 'Challenges with awards disabled must omit awardDescriptions.',
          })
      }),
  ),
  idea: z
    .object({
      ideaId: identifier,
      title: text,
      description: z.string(),
      notes: z.string(),
      waypointIds: distinctIds('Idea waypoint links must be distinct'),
      planningState: z.enum(['active', 'someday', 'rejected']),
      rejectionReason: text.optional(),
      difficulty: z.union([z.literal(1), z.literal(2), z.literal(3), z.literal(4)]),
      location: place.optional(),
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
    }),
  activity: z
    .object({
      activityId: identifier,
      name: z.string({ error: 'Activity title is required.' }).trim().min(1, 'Activity title is required.'),
      waypointId: identifier.optional(),
      challengeId: identifier.optional(),
      ideaIds: distinctIds('Activity idea links must be distinct'),
      date: z
        .string({ error: 'Activity date is required.' })
        .refine(
          (value) => isValidActivityDate(value),
          'Activity date must be a real YYYY-MM-DD date no later than today in UK time.',
        ),
      category: z.enum(['bronze', 'silver', 'gold']).optional(),
      location: activityLocation,
      recordedTrack: gpxGeometry.optional(),
      notes: z.string(),
      referenceIds: z.array(identifier),
      photoReferenceIds: z.array(identifier),
      createdAt: z.iso.datetime(),
      updatedAt: z.iso.datetime(),
    })
    .strict(),
  reference: z
    .object({
      referenceId: identifier,
      title: identifier,
      description: identifier.optional(),
      url: httpsUrl,
      previewImageUrl: httpsUrl.optional(),
    })
    .strict(),
  photoReference: z
    .object({ photoReferenceId: identifier, title: identifier, altText: identifier.optional(), url: httpsUrl })
    .strict(),
} as const

const replacementWaypoint = schemas.waypoint
  .omit({ location: true })
  .extend({ location: z.union([resolvedPlace, unresolvedPlace]).optional() })

export const schemaVersions = {
  waypoint: 2,
  challenge: 4,
  idea: 2,
  activity: 5,
  reference: 1,
  photoReference: 1,
} as const satisfies Record<EntityType, number>

export const JourneyDocumentSchema = z
  .object({
    id: identifier,
    datasetId: identifier,
    type: EntityTypeSchema,
    schemaVersion: z.number().int().positive(),
    entity: z.record(z.string(), z.unknown()),
  })
  .strict()
  .transform((document, context) => {
    const expected = schemaVersions[document.type]
    if (document.schemaVersion !== expected)
      context.addIssue({
        code: 'custom',
        path: ['schemaVersion'],
        message: `Document type "${document.type}" requires schema version ${expected}, received ${document.schemaVersion}.`,
      })
    const parsed = schemas[document.type].safeParse(document.entity)
    if (!parsed.success) {
      for (const issue of parsed.error.issues) context.addIssue({ ...issue, path: ['entity', ...issue.path] })
      return z.NEVER
    }
    return { ...document, entity: parsed.data }
  })
export type JourneyDocument = z.infer<typeof JourneyDocumentSchema>

const journeyDataShape = {
  waypoints: z.array(schemas.waypoint),
  challenges: z.array(schemas.challenge),
  ideas: z.array(schemas.idea),
  activities: z.array(schemas.activity),
  references: z.array(schemas.reference),
  photoReferences: z.array(schemas.photoReference),
}

type JourneyDataIds = {
  waypoints: { waypointId: string }[]
  challenges: { challengeId: string }[]
  ideas: { ideaId: string }[]
  activities: { activityId: string }[]
  references: { referenceId: string }[]
  photoReferences: { photoReferenceId: string }[]
}

const withUniqueEntityIds = <T extends JourneyDataIds>(data: T, context: z.RefinementCtx) => {
  const ids = [
    ...data.waypoints.map((entity) => entity.waypointId),
    ...data.challenges.map((entity) => entity.challengeId),
    ...data.ideas.map((entity) => entity.ideaId),
    ...data.activities.map((entity) => entity.activityId),
    ...data.references.map((entity) => entity.referenceId),
    ...data.photoReferences.map((entity) => entity.photoReferenceId),
  ]
  const seen = new Set<string>()
  for (const id of ids) {
    if (seen.has(id))
      context.addIssue({
        code: 'custom',
        message: `Duplicate entity ID "${id}". IDs must be unique across all entity types in a dataset.`,
      })
    seen.add(id)
  }
}

export const JourneyDataSchema = z.object(journeyDataShape).strict().superRefine(withUniqueEntityIds)
export type JourneyData = z.infer<typeof JourneyDataSchema>

// z.record drops "__proto__", but every entity ID must retain its ETag.
const etagsSchema = z.custom<Record<string, string>>(
  (value) =>
    typeof value === 'object' &&
    value !== null &&
    !Array.isArray(value) &&
    Object.entries(value).every(([id, etag]) => identifier.safeParse(id).success && identifier.safeParse(etag).success),
  'ETags must map nonempty entity IDs to nonempty strings.',
)

export const ReplacementJourneyDataSchema = z
  .object({
    ...journeyDataShape,
    waypoints: z.array(replacementWaypoint),
  })
  .strict()
  .superRefine(withUniqueEntityIds)
export type ReplacementJourneyData = z.infer<typeof ReplacementJourneyDataSchema>

export const JourneyMutationSchema = z.discriminatedUnion('operation', [
  z.object({ operation: z.literal('create'), type: EntityTypeSchema, entity: z.record(z.string(), z.unknown()) }),
  z.object({
    operation: z.literal('update'),
    type: EntityTypeSchema,
    id: identifier,
    entity: z.record(z.string(), z.unknown()),
    ifMatch: identifier,
  }),
  z.object({ operation: z.literal('delete'), type: EntityTypeSchema, id: identifier, ifMatch: identifier }),
  z.object({ operation: z.literal('clear') }),
  z.object({ operation: z.literal('import'), data: JourneyDataSchema }),
  z.object({
    operation: z.literal('replace'),
    data: ReplacementJourneyDataSchema,
    etags: etagsSchema,
  }),
])
