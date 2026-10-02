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

describe('Journey document validation', () => {
  it('requires the partition and entity discriminator', () => {
    expect(
      JourneyDocumentSchema.parse({
        id: 'activity-1',
        datasetId: 'production',
        type: 'activity',
        schemaVersion: 4,
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

  it('accepts persisted Challenge GPX geometry and GPX-free legacy Challenges', () => {
    const entity = {
      challengeId: 'challenge-1',
      title: 'Challenge',
      description: 'A route challenge',
      waypointIds: [],
      supportsActivityCategories: false,
      plannedRoute: {
        fileName: 'route.gpx',
        geometry: {
          type: 'MultiLineString',
          coordinates: [
            [
              [-2.1, 51.1],
              [-2.2, 51.2],
            ],
          ],
        },
      },
    }
    expect(
      JourneyDocumentSchema.safeParse({
        id: 'challenge-1',
        datasetId: 'production',
        type: 'challenge',
        schemaVersion: 2,
        entity,
      }).success,
    ).toBe(true)
    expect(
      JourneyDocumentSchema.safeParse({
        id: 'challenge-1',
        datasetId: 'production',
        type: 'challenge',
        schemaVersion: 1,
        entity,
      }).success,
    ).toBe(false)
    const legacyEntity = { ...entity }
    delete (legacyEntity as { plannedRoute?: unknown }).plannedRoute
    expect(
      JourneyDocumentSchema.safeParse({
        id: 'challenge-1',
        datasetId: 'production',
        type: 'challenge',
        schemaVersion: 1,
        entity: legacyEntity,
      }).success,
    ).toBe(true)
  })

  it('rejects Challenge routes exceeding the segment and total-point limits', () => {
    const routeDocument = (coordinates: [number, number][][]) =>
      JourneyDocumentSchema.safeParse({
        id: 'challenge-1',
        datasetId: 'production',
        type: 'challenge',
        schemaVersion: 2,
        entity: {
          challengeId: 'challenge-1',
          title: 'Challenge',
          description: 'A route challenge',
          waypointIds: [],
          supportsActivityCategories: false,
          plannedRoute: {
            fileName: 'route.gpx',
            geometry: { type: 'MultiLineString', coordinates },
          },
        },
      })

    const point: [number, number] = [-2.1, 51.1]

    expect(routeDocument(Array.from({ length: 101 }, () => [point, point])).success).toBe(false)
    expect(routeDocument([Array.from({ length: 10_001 }, () => point)]).success).toBe(false)
  })

  it('validates Activity tracks and accepts only matching document versions', () => {
    const geometry = {
      type: 'MultiLineString',
      coordinates: [
        [
          [-2.1, 51.1],
          [-2.2, 51.2],
        ],
        [
          [-3.1, 52.1],
          [-3.2, 52.2],
        ],
      ],
    }
    const entity = {
      activityId: 'activity-1',
      ideaIds: [],
      date: '2026-09-04',
      location: { kind: 'postcode', postcode: 'SN15 2LG', latitude: 51.415, longitude: -2.123 },
      recordedTrack: geometry,
      notes: '',
      referenceIds: [],
      photoReferenceIds: [],
      createdAt: '2026-09-04T00:00:00.000Z',
      updatedAt: '2026-09-04T00:00:00.000Z',
    }
    const document = (schemaVersion: number, activity: Record<string, unknown>) =>
      JourneyDocumentSchema.safeParse({
        id: 'activity-1',
        datasetId: 'production',
        type: 'activity',
        schemaVersion,
        entity: activity,
      })

    expect(document(4, entity).success).toBe(true)
    expect(document(3, entity).success).toBe(false)
    const legacyEntity = { ...entity }
    delete (legacyEntity as { recordedTrack?: unknown }).recordedTrack
    expect(document(3, legacyEntity).success).toBe(true)
    expect(
      document(4, {
        ...entity,
        recordedTrack: {
          ...geometry,
          coordinates: [
            [
              [-181, 0],
              [0, 0],
            ],
          ],
        },
      }).success,
    ).toBe(false)
    expect(document(4, { ...entity, recordedTrack: { ...geometry, coordinates: [[[-2, 0]]] } }).success).toBe(false)
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
