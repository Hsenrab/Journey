import { describe, expect, it } from 'vitest'
import { JourneyDocumentSchema, JourneyMutationSchema } from './journeySchema.js'

function idea() {
  return {
    ideaId: 'idea-1',
    title: 'Idea',
    description: '',
    notes: '',
    waypointIds: [],
    planningState: 'active',
    difficulty: 2,
    referenceIds: [],
    createdAt: '2026-09-04T00:00:00.000Z',
    updatedAt: '2026-09-04T00:00:00.000Z',
  }
}

function document(entity: Record<string, unknown>) {
  return JourneyDocumentSchema.safeParse({
    id: 'idea-1',
    datasetId: 'production',
    type: 'idea',
    schemaVersion: 2,
    entity,
  })
}

function activity() {
  return {
    activityId: 'activity-1',
    ideaIds: [],
    date: '2026-09-04',
    location: { kind: 'coordinates', latitude: 51.415, longitude: -2.123 },
    notes: '',
    referenceIds: [],
    photoReferenceIds: [],
    createdAt: '2026-09-04T00:00:00.000Z',
    updatedAt: '2026-09-04T00:00:00.000Z',
  }
}

function activityDocument(entity: Record<string, unknown>) {
  return JourneyDocumentSchema.safeParse({
    id: 'activity-1',
    datasetId: 'production',
    type: 'activity',
    schemaVersion: 3,
    entity,
  })
}

describe('Journey document validation', () => {
  it('requires the partition and entity discriminator', () => {
    expect(
      JourneyDocumentSchema.parse({
        id: 'activity-1',
        datasetId: 'production',
        type: 'activity',
        schemaVersion: 3,
        entity: {
          activityId: 'activity-1',
          ideaIds: [],
          date: '2026-09-04',
          location: { kind: 'postcode', postcode: 'SN15 2LG', latitude: 51.415, longitude: -2.123 },
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
        schemaVersion: 3,
        entity: { activityId: 'activity-1' },
      }).success,
    ).toBe(false)
  })

  it('accepts activities with or without track geometry at schema version 3', () => {
    expect(activityDocument(activity()).success).toBe(true)
    expect(
      activityDocument({
        ...activity(),
        track: {
          name: 'Morning walk',
          segments: [
            [
              [-2.123, 51.415],
              [-2.124, 51.416],
            ],
            [
              [-2.125, 51.417],
              [-2.126, 51.418],
            ],
          ],
        },
      }).success,
    ).toBe(true)
  })

  it('rejects malformed track geometry', () => {
    const track = {
      name: 'Morning walk',
      segments: [
        [
          [-2.123, 51.415],
          [-2.124, 51.416],
        ],
      ],
    }
    for (const malformed of [
      { ...track, name: '' },
      { ...track, name: '   ' },
      { ...track, segments: [] },
      { ...track, segments: [[]] },
      { ...track, segments: [[[-2.123, 51.415]]] },
      { ...track, segments: [[[-2.123], [-2.124, 51.416]]] },
      {
        ...track,
        segments: [
          [
            [-2.123, 51.415, 42],
            [-2.124, 51.416],
          ],
        ],
      },
      {
        ...track,
        segments: [
          [
            [181, 51.415],
            [-2.124, 51.416],
          ],
        ],
      },
      {
        ...track,
        segments: [
          [
            [-2.123, -91],
            [-2.124, 51.416],
          ],
        ],
      },
      { ...track, name: 42 },
      { ...track, extra: true },
    ]) {
      expect(activityDocument({ ...activity(), track: malformed }).success).toBe(false)
    }
    expect(
      JourneyMutationSchema.safeParse({
        operation: 'import',
        data: {
          waypoints: [],
          challenges: [],
          ideas: [],
          activities: [
            {
              ...activity(),
              track: {
                ...track,
                segments: [
                  [
                    [181, 51.415],
                    [-2.124, 51.416],
                  ],
                ],
              },
            },
          ],
          references: [],
          photoReferences: [],
        },
      }).success,
    ).toBe(false)
  })

  it('rejects obsolete document schema versions', () => {
    const result = JourneyDocumentSchema.safeParse({
      id: 'idea-1',
      datasetId: 'production',
      type: 'idea',
      schemaVersion: 1,
      entity: idea(),
    })
    expect(result.success).toBe(false)
    expect(result.error?.issues[0]?.message).toBe('Document type "idea" requires schema version 2, received 1.')
  })

  it('accepts an idea with multiple waypoint links and no photos', () => {
    expect(
      JourneyDocumentSchema.safeParse({
        id: 'idea-1',
        datasetId: 'production',
        type: 'idea',
        schemaVersion: 2,
        entity: { ...idea(), waypointIds: ['waypoint-1', 'waypoint-2'] },
      }).success,
    ).toBe(true)
    expect(
      JourneyDocumentSchema.safeParse({
        id: 'idea-1',
        datasetId: 'production',
        type: 'idea',
        schemaVersion: 2,
        entity: { ...idea(), photoReferenceIds: [] },
      }).success,
    ).toBe(false)
  })

  it('requires a rejection reason only for rejected ideas', () => {
    expect(document({ ...idea(), planningState: 'rejected' }).success).toBe(false)
    expect(document({ ...idea(), planningState: 'rejected', rejectionReason: 'Too far' }).success).toBe(true)
    expect(document({ ...idea(), rejectionReason: 'Too far' }).success).toBe(false)
  })

  it('rejects duplicate relationship links', () => {
    expect(document({ ...idea(), waypointIds: ['waypoint-1', 'waypoint-1'] }).success).toBe(false)
    expect(document({ ...idea(), referenceIds: ['reference-1', 'reference-1'] }).success).toBe(false)
  })
})
