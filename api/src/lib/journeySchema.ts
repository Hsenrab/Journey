import { z } from 'zod'

const entityTypes = ['waypoint', 'challenge', 'idea', 'activity', 'reference', 'photoReference'] as const
export const EntityTypeSchema = z.enum(entityTypes)
export type EntityType = z.infer<typeof EntityTypeSchema>

const identifier = z.string().min(1)
const distinctIds = (message: string) => z.array(identifier).refine((ids) => new Set(ids).size === ids.length, message)
const httpsUrl = z.url().startsWith('https://')
const place = z
  .object({
    placeName: identifier.optional(),
    latitude: z.number().min(-90).max(90).optional(),
    longitude: z.number().min(-180).max(180).optional(),
    addressOrRegion: identifier.optional(),
    source: identifier.optional(),
    approximate: z.boolean().optional(),
  })
  .strict()
const activityLocation = z.discriminatedUnion('kind', [
  z.object({ kind: z.literal('postcode'), postcode: identifier }).strict(),
  z
    .object({
      kind: z.literal('coordinates'),
      latitude: z.number().min(-90).max(90),
      longitude: z.number().min(-180).max(180),
    })
    .strict(),
])
const schemas = {
  waypoint: z
    .object({
      waypointId: identifier,
      title: identifier,
      description: identifier,
      category: identifier,
      tags: z.array(identifier),
      challengeIds: z.array(identifier),
      completion: z.discriminatedUnion('mode', [
        z.object({ mode: z.literal('once') }).strict(),
        z.object({ mode: z.literal('count'), target: z.number().int().positive() }).strict(),
      ]),
      location: place.optional(),
      referenceIds: z.array(identifier),
      photoReferenceIds: z.array(identifier),
    })
    .strict(),
  challenge: z
    .object({
      challengeId: identifier,
      title: identifier,
      description: identifier,
      waypointIds: z.array(identifier),
      supportsActivityCategories: z.boolean(),
      location: place.optional(),
    })
    .strict(),
  idea: z
    .object({
      ideaId: identifier,
      title: identifier,
      description: z.string(),
      notes: z.string(),
      waypointIds: distinctIds('Idea waypoint links must be distinct'),
      planningState: z.enum(['active', 'someday', 'rejected']),
      rejectionReason: z.string().trim().min(1).optional(),
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
      waypointId: identifier.optional(),
      challengeId: identifier.optional(),
      ideaIds: distinctIds('Activity idea links must be distinct'),
      date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
      category: z.enum(['bronze', 'silver', 'gold']).optional(),
      location: activityLocation,
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

export const schemaVersions = {
  waypoint: 1,
  challenge: 1,
  idea: 2,
  activity: 2,
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
  .superRefine((document, context) => {
    const expected = schemaVersions[document.type]
    if (document.schemaVersion !== expected)
      context.addIssue({
        code: 'custom',
        path: ['schemaVersion'],
        message: `Document type "${document.type}" requires schema version ${expected}, received ${document.schemaVersion}.`,
      })
    const parsed = schemas[document.type].safeParse(document.entity)
    if (!parsed.success)
      for (const issue of parsed.error.issues) context.addIssue({ ...issue, path: ['entity', ...issue.path] })
  })
export type JourneyDocument = z.infer<typeof JourneyDocumentSchema>

export const JourneyDataSchema = z
  .object({
    waypoints: z.array(schemas.waypoint),
    challenges: z.array(schemas.challenge),
    ideas: z.array(schemas.idea),
    activities: z.array(schemas.activity),
    references: z.array(schemas.reference),
    photoReferences: z.array(schemas.photoReference),
  })
  .strict()
export type JourneyData = z.infer<typeof JourneyDataSchema>

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
  z.object({ operation: z.literal('replace'), data: JourneyDataSchema, etags: z.record(identifier, identifier) }),
])
