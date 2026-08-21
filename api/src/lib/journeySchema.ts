import { z } from 'zod'

const entityTypes = ['waypoint', 'challenge', 'idea', 'activity', 'reference', 'photoReference'] as const
export const EntityTypeSchema = z.enum(entityTypes)
export type EntityType = z.infer<typeof EntityTypeSchema>

export const JourneyDocumentSchema = z
  .object({
    id: z.string().min(1),
    datasetId: z.string().min(1),
    type: EntityTypeSchema,
    schemaVersion: z.number().int().positive(),
    entity: z.record(z.string(), z.unknown()),
  })
  .strict()
export type JourneyDocument = z.infer<typeof JourneyDocumentSchema>

export const JourneyDataSchema = z
  .object({
    waypoints: z.array(z.record(z.string(), z.unknown())),
    challenges: z.array(z.record(z.string(), z.unknown())),
    ideas: z.array(z.record(z.string(), z.unknown())),
    activities: z.array(z.record(z.string(), z.unknown())),
    references: z.array(z.record(z.string(), z.unknown())),
    photoReferences: z.array(z.record(z.string(), z.unknown())),
  })
  .strict()
export type JourneyData = z.infer<typeof JourneyDataSchema>

export const JourneyMutationSchema = z.discriminatedUnion('operation', [
  z.object({ operation: z.literal('create'), type: EntityTypeSchema, entity: z.record(z.string(), z.unknown()) }),
  z.object({
    operation: z.literal('update'),
    type: EntityTypeSchema,
    id: z.string().min(1),
    entity: z.record(z.string(), z.unknown()),
    ifMatch: z.string().min(1),
  }),
  z.object({
    operation: z.literal('delete'),
    type: EntityTypeSchema,
    id: z.string().min(1),
    ifMatch: z.string().min(1),
  }),
  z.object({ operation: z.literal('clear') }),
  z.object({ operation: z.literal('import'), data: JourneyDataSchema }),
])
