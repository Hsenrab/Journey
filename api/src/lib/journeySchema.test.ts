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
        entity: { activityId: 'activity-1' },
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
})
