import { describe, expect, it } from 'vitest'
import { JourneyDocumentSchema, JourneyMutationSchema } from './journeySchema.js'

describe('Journey document validation', () => {
  it('requires the partition and entity discriminator', () => {
    expect(
      JourneyDocumentSchema.parse({
        id: 'activity-1',
        datasetId: 'production',
        type: 'activity',
        schemaVersion: 1,
        entity: {
          activityId: 'activity-1',
          date: '2026-09-04',
          location: { kind: 'postcode', postcode: 'SN15 2LG' },
          notes: '',
          referenceIds: [],
          photoReferenceIds: [],
          createdAt: '2026-09-04T00:00:00.000Z',
          updatedAt: '2026-09-04T00:00:00.000Z',
        },
      }),
    ).toMatchObject({ datasetId: 'production', type: 'activity' })
    expect(() => JourneyDocumentSchema.parse({ id: 'activity-1', entity: {} })).toThrow()
  })

  it('requires ETags for updates and deletes', () => {
    expect(
      JourneyMutationSchema.safeParse({
        operation: 'update',
        type: 'activity',
        id: 'activity-1',
        entity: { activityId: 'activity-1' },
      }).success,
    ).toBe(false)
    expect(
      JourneyMutationSchema.safeParse({
        operation: 'delete',
        type: 'activity',
        id: 'activity-1',
        ifMatch: 'etag',
      }).success,
    ).toBe(true)
  })

  it('rejects malformed persisted entities', () => {
    expect(
      JourneyDocumentSchema.safeParse({
        id: 'activity-1',
        datasetId: 'production',
        type: 'activity',
        schemaVersion: 1,
        entity: { activityId: 'activity-1' },
      }).success,
    ).toBe(false)
  })
})
