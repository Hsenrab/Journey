import { afterEach, describe, expect, it, vi } from 'vitest'
import { readFileSync } from 'node:fs'
import { JourneyDataSchema, JourneyDocumentSchema, JourneyMutationSchema } from './journeySchema.js'

afterEach(() => vi.useRealTimers())

function activity() {
  return {
    activityId: 'activity-1',
    name: 'Abbey visit',
    ideaIds: [],
    date: '2026-01-01',
    location: { kind: 'coordinates', latitude: 51.415, longitude: -2.123 },
    notes: '',
    referenceIds: [],
    photoReferenceIds: [],
    createdAt: '2026-01-01T00:00:00.000Z',
    updatedAt: '2026-01-01T00:00:00.000Z',
  }
}

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

function waypoint(location?: Record<string, unknown>) {
  return {
    waypointId: 'waypoint-1',
    title: 'Waypoint',
    description: 'Description',
    category: 'Historic site',
    tags: [],
    challengeIds: [],
    completion: { mode: 'once' },
    ...(location === undefined ? {} : { location }),
    referenceIds: [],
    photoReferenceIds: [],
  }
}

function emptyData() {
  return { waypoints: [], challenges: [], ideas: [], activities: [], references: [], photoReferences: [] }
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
  it.each([null, [], 'etag', { id: '' }, { '': 'etag' }, { id: 123 }, JSON.parse('{"__proto__":123}')])(
    'rejects invalid replacement ETags: %j',
    (etags) => {
      expect(
        JourneyMutationSchema.safeParse({
          operation: 'replace',
          data: { waypoints: [], challenges: [], ideas: [], activities: [], references: [], photoReferences: [] },
          etags,
        }).success,
      ).toBe(false)
    },
  )
  it('allows replacement Waypoints with absent, resolved, or searchable unresolved locations only', () => {
    const replacement = (entity: Record<string, unknown>) =>
      JourneyMutationSchema.safeParse({
        operation: 'replace',
        data: { ...emptyData(), waypoints: [entity] },
        etags: {},
      })

    expect(replacement(waypoint()).success).toBe(true)
    expect(replacement(waypoint({ latitude: 51.4, longitude: -2.1 })).success).toBe(true)
    expect(replacement(waypoint({ placeName: 'Lacock Abbey' })).success).toBe(true)
    expect(replacement(waypoint({ addressOrRegion: 'Wiltshire', source: 'manual', approximate: true })).success).toBe(
      true,
    )

    for (const location of [
      { latitude: 51.4 },
      { longitude: -2.1 },
      { latitude: 91, longitude: -2.1 },
      { latitude: 51.4, longitude: -181 },
      { source: 'manual' },
      { approximate: true },
      { placeName: '   ' },
      { placeName: 'Lacock Abbey', unknown: true },
    ]) {
      expect(replacement(waypoint(location)).success).toBe(false)
    }
    expect(replacement({ ...waypoint(), unexpected: true }).success).toBe(false)
  })

  it('keeps imports, persisted Waypoints, and Activity replacements strict', () => {
    const unresolved = waypoint({ placeName: 'Lacock Abbey' })
    expect(
      JourneyMutationSchema.safeParse({
        operation: 'import',
        data: { ...emptyData(), waypoints: [unresolved] },
      }).success,
    ).toBe(false)
    expect(
      JourneyDocumentSchema.safeParse({
        id: 'waypoint-1',
        datasetId: 'production',
        type: 'waypoint',
        schemaVersion: 2,
        entity: unresolved,
      }).success,
    ).toBe(false)
    expect(
      JourneyMutationSchema.safeParse({
        operation: 'replace',
        data: {
          ...emptyData(),
          activities: [
            {
              activityId: 'activity-1',
              name: 'Abbey visit',
              ideaIds: [],
              date: '2026-09-04',
              location: { kind: 'postcode', postcode: 'SN15 2LG' },
              notes: '',
              referenceIds: [],
              photoReferenceIds: [],
              createdAt: '2026-09-04T00:00:00.000Z',
              updatedAt: '2026-09-04T00:00:00.000Z',
            },
          ],
        },
        etags: {},
      }).success,
    ).toBe(false)
  })

  it('requires the partition and entity discriminator', () => {
    expect(
      JourneyDocumentSchema.parse({
        id: 'activity-1',
        datasetId: 'production',
        type: 'activity',
        schemaVersion: 5,
        entity: {
          activityId: 'activity-1',
          name: 'Abbey visit',
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

  it('accepts persisted Challenge GPX geometry', () => {
    const entity = {
      challengeId: 'challenge-1',
      title: 'Challenge',
      description: 'A route challenge',
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
        schemaVersion: 3,
        entity,
      }).success,
    ).toBe(true)
    const routeWithFileName = (fileName: string) =>
      JourneyDocumentSchema.safeParse({
        id: 'challenge-1',
        datasetId: 'production',
        type: 'challenge',
        schemaVersion: 3,
        entity: { ...entity, plannedRoute: { ...entity.plannedRoute, fileName } },
      })
    expect(routeWithFileName('a'.repeat(255)).success).toBe(true)
    expect(routeWithFileName('a'.repeat(256)).success).toBe(false)
    expect(
      JourneyDocumentSchema.safeParse({
        id: 'challenge-1',
        datasetId: 'production',
        type: 'challenge',
        schemaVersion: 1,
        entity,
      }).success,
    ).toBe(false)
    expect(
      JourneyDocumentSchema.safeParse({
        id: 'challenge-1',
        datasetId: 'production',
        type: 'challenge',
        schemaVersion: 2,
        entity,
      }).success,
    ).toBe(false)
  })

  it('rejects Challenge routes exceeding the segment and total-point limits', () => {
    const routeDocument = (coordinates: [number, number][][]) =>
      JourneyDocumentSchema.safeParse({
        id: 'challenge-1',
        datasetId: 'production',
        type: 'challenge',
        schemaVersion: 3,
        entity: {
          challengeId: 'challenge-1',
          title: 'Challenge',
          description: 'A route challenge',
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

  it.each([1, 2])('rejects Challenge document schema version %s', (schemaVersion) => {
    expect(
      JourneyDocumentSchema.safeParse({
        id: 'challenge-1',
        datasetId: 'production',
        type: 'challenge',
        schemaVersion,
        entity: {
          challengeId: 'challenge-1',
          title: 'Challenge',
          description: 'A challenge',
          supportsActivityCategories: false,
        },
      }).success,
    ).toBe(false)
  })

  it('rejects obsolete Challenge membership even when its list is empty', () => {
    const result = JourneyDocumentSchema.safeParse({
      id: 'challenge-1',
      datasetId: 'production',
      type: 'challenge',
      schemaVersion: 3,
      entity: {
        challengeId: 'challenge-1',
        title: 'Challenge',
        description: 'A challenge',
        waypointIds: [],
        supportsActivityCategories: false,
      },
    })

    expect(result.success).toBe(false)
    expect(result.error?.issues.map(({ message }) => message)).toContain(
      'Challenge "challenge-1" contains obsolete field "waypointIds"; review its links and correct them separately before use.',
    )
  })

  it('requires distinct nonempty Waypoint Challenge assignments', () => {
    for (const challengeIds of [['challenge-1', 'challenge-1'], ['']]) {
      expect(
        JourneyDocumentSchema.safeParse({
          id: 'waypoint-1',
          datasetId: 'production',
          type: 'waypoint',
          schemaVersion: 2,
          entity: { ...waypoint(), challengeIds },
        }).success,
      ).toBe(false)
    }
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
      name: 'Abbey visit',
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

    expect(document(5, entity).success).toBe(true)
    for (const version of [3, 4]) {
      expect(document(version, entity).error?.issues[0]?.message).toBe(
        `Document type "activity" requires schema version 5, received ${version}.`,
      )
      const withoutTrack = { ...entity }
      delete (withoutTrack as { recordedTrack?: unknown }).recordedTrack
      expect(document(version, withoutTrack).success).toBe(false)
    }
    expect(
      document(5, {
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
    expect(document(5, { ...entity, recordedTrack: { ...geometry, coordinates: [[[-2, 0]]] } }).success).toBe(false)
  })

  it.each([
    { name: undefined },
    { name: null },
    { name: '' },
    { name: ' \t\n ' },
    { date: undefined },
    { date: null },
    { date: '' },
    { date: '2026-1-01' },
    { date: '2026-02-29' },
    { date: '2026-04-31' },
    { date: '2026-07-17' },
  ])('rejects invalid Activity fields across stored, import and replacement schemas: %j', (fields) => {
    vi.useFakeTimers()
    vi.setSystemTime(new Date('2026-07-15T23:30:00Z'))
    const entity = { ...activity(), ...fields }
    expect(
      JourneyDocumentSchema.safeParse({
        id: entity.activityId,
        datasetId: 'production',
        type: 'activity',
        schemaVersion: 5,
        entity,
      }).success,
    ).toBe(false)
    for (const operation of ['import', 'replace']) {
      expect(
        JourneyMutationSchema.safeParse({
          operation,
          data: { ...emptyData(), activities: [activity(), { ...entity, activityId: 'activity-2' }] },
          etags: {},
        }).success,
      ).toBe(false)
    }
  })

  it('normalizes the title without changing the calendar date or imposing title/date uniqueness', () => {
    const entity = { ...activity(), name: '  Abbey visit \t' }
    const parsed = JourneyDocumentSchema.parse({
      id: entity.activityId,
      datasetId: 'production',
      type: 'activity',
      schemaVersion: 5,
      entity,
    })
    expect(parsed.entity).toMatchObject({ name: 'Abbey visit', date: '2026-01-01' })
    const data = JourneyDataSchema.parse({
      ...emptyData(),
      activities: [entity, { ...entity, activityId: 'activity-2' }],
    })
    expect(data.activities.map(({ name, date }) => ({ name, date }))).toEqual([
      { name: 'Abbey visit', date: '2026-01-01' },
      { name: 'Abbey visit', date: '2026-01-01' },
    ])
  })

  it('re-evaluates UK today through the same document schema across midnight', () => {
    vi.useFakeTimers()
    const input = {
      id: 'activity-1',
      datasetId: 'production',
      type: 'activity',
      schemaVersion: 5,
      entity: { ...activity(), date: '2026-07-16' },
    }
    vi.setSystemTime(new Date('2026-07-15T22:59:59Z'))
    expect(JourneyDocumentSchema.safeParse(input).success).toBe(false)
    vi.setSystemTime(new Date('2026-07-15T23:00:00Z'))
    expect(JourneyDocumentSchema.parse(input).entity).toMatchObject({ date: '2026-07-16' })
  })

  it('validates the complete bundled Demo fixture against current API rules', () => {
    const fixture: unknown = JSON.parse(readFileSync(new URL('../../../src/data/demo.json', import.meta.url), 'utf8'))
    expect(JourneyDataSchema.safeParse(fixture).success).toBe(true)
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
