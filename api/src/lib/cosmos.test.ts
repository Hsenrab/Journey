import { afterEach, describe, expect, it, vi } from 'vitest'
import {
  documentsFor,
  documentsToData,
  loadDataset,
  replaceDataset,
  seedDemoDataset,
  StoredJourneyRelationshipError,
} from './cosmos.js'
import type { JourneyData, JourneyDocument } from './journeySchema.js'
import { applyPlan, deletionPlan, entityId, entityTypeFor } from './journeyGraph.js'

const { readDemoFile } = vi.hoisted(() => ({ readDemoFile: vi.fn() }))
vi.mock('node:fs/promises', () => ({ readFile: readDemoFile }))

const activity = {
  activityId: 'activity-1',
  name: 'Orangery tour',
  ideaIds: ['idea-1'],
  date: '2026-08-02',
  location: { kind: 'postcode', postcode: 'GL3 4AQ', latitude: 51.844, longitude: -2.153 },
  recordedTrack: {
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
  },
  notes: '',
  referenceIds: [],
  photoReferenceIds: [],
  createdAt: '2026-08-02T00:00:00.000Z',
  updatedAt: '2026-08-02T00:00:00.000Z',
} as const

afterEach(() => vi.useRealTimers())

const idea = {
  ideaId: 'idea-1',
  title: 'Orangery tour',
  description: '',
  notes: '',
  waypointIds: [],
  planningState: 'active',
  difficulty: 2,
  referenceIds: [],
  createdAt: '2026-08-01T00:00:00.000Z',
  updatedAt: '2026-08-01T00:00:00.000Z',
} as const

const data: JourneyData = {
  waypoints: [
    {
      waypointId: 'waypoint-1',
      title: 'Waypoint',
      description: 'A waypoint',
      category: 'Walk',
      tags: [],
      challengeIds: ['challenge-1'],
      completion: { mode: 'once' },
      referenceIds: [],
      photoReferenceIds: [],
    },
  ],
  challenges: [
    {
      challengeId: 'challenge-1',
      title: 'Route challenge',
      description: 'A planned GPX route',
      supportsActivityCategories: false,
      plannedRoute: {
        fileName: 'planned.gpx',
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
    },
  ],
  ideas: [idea],
  activities: [activity],
  references: [{ referenceId: 'reference-1', title: 'Reference', url: 'https://example.com/reference' }],
  photoReferences: [{ photoReferenceId: 'photo-1', title: 'Photo', url: 'https://example.com/photo' }],
}

describe('Cosmos Journey persistence', () => {
  it('seeds enabled Challenges with descriptions using the existing typed batch path', async () => {
    const seeded = structuredClone(data)
    seeded.challenges[0]!.supportsActivityCategories = true
    seeded.challenges[0]!.awardDescriptions = { bronze: 'Afternoon', silver: 'Full day', gold: 'Overnight' }
    readDemoFile.mockResolvedValue(JSON.stringify(seeded))
    const batch = vi.fn().mockResolvedValue({ code: 200, result: [] })
    await seedDemoDataset({ items: { batch } } as never, 'demo')
    expect(readDemoFile).toHaveBeenCalledWith(expect.any(URL), 'utf8')
    expect(batch).toHaveBeenCalledWith(
      expect.arrayContaining([
        expect.objectContaining({
          operationType: 'Create',
          resourceBody: expect.objectContaining({
            datasetId: 'demo',
            type: 'challenge',
            schemaVersion: 4,
            entity: expect.objectContaining({ awardDescriptions: seeded.challenges[0]!.awardDescriptions }),
          }),
        }),
      ]),
      'demo',
    )
  })

  it.each(['descriptions', 'category', 'json'] as const)(
    'rejects malformed %s seed data before any batch',
    async (kind) => {
      const seeded = structuredClone(data)
      seeded.challenges[0]!.supportsActivityCategories = true
      if (kind !== 'descriptions')
        seeded.challenges[0]!.awardDescriptions = { bronze: 'Afternoon', silver: 'Full day', gold: 'Overnight' }
      if (kind === 'category') seeded.activities[0]!.waypointId = 'waypoint-1'
      readDemoFile.mockResolvedValue(kind === 'json' ? '{' : JSON.stringify(seeded))
      const batch = vi.fn()
      await expect(seedDemoDataset({ items: { batch } } as never, 'demo')).rejects.toThrow()
      expect(batch).not.toHaveBeenCalled()
    },
  )

  it.each(['missing', 'ineligible', 'direct-only', 'dangling'] as const)(
    'rejects stored %s award graphs explicitly instead of returning an empty dataset',
    async (kind) => {
      const stored = structuredClone(data)
      stored.challenges[0]!.supportsActivityCategories = true
      stored.challenges[0]!.awardDescriptions = { bronze: 'Afternoon', silver: 'Full day', gold: 'Overnight' }
      stored.activities[0]!.waypointId = 'waypoint-1'
      stored.activities[0]!.category = 'gold'
      const documents = Object.values(documentsFor('dataset', stored))
      const activityDocument = documents.find((document) => document.type === 'activity')!
      const waypointDocument = documents.find((document) => document.type === 'waypoint')!
      if (kind === 'missing') delete activityDocument.entity.category
      if (kind === 'ineligible') waypointDocument.entity.challengeIds = []
      if (kind === 'direct-only') {
        delete activityDocument.entity.waypointId
        activityDocument.entity.challengeId = 'challenge-1'
      }
      if (kind === 'dangling') activityDocument.entity.waypointId = 'missing'
      const fetchNext = vi.fn().mockResolvedValue({ resources: documents })
      await expect(loadDataset({ items: { query: () => ({ fetchNext }) } } as never, 'dataset')).rejects.toBeInstanceOf(
        StoredJourneyRelationshipError,
      )
      await expect(loadDataset({ items: { query: () => ({ fetchNext }) } } as never, 'dataset')).rejects.toThrow(
        'Activity "activity-1"',
      )
    },
  )

  it('returns committed ETags in document order and guards every unchanged snapshot document', async () => {
    const documents = documentsFor('dataset', data)
    const etags = Object.fromEntries(Object.keys(documents).map((id) => [id, `old-${id}`]))
    const batch = vi.fn().mockImplementation(async (operations) => ({
      code: 200,
      result: operations.map((operation: { id: string }) => ({ statusCode: 200, eTag: `new-${operation.id}` })),
    }))
    expect(await replaceDataset({ items: { batch } } as never, 'dataset', documents, etags)).toEqual(
      Object.fromEntries(Object.keys(documents).map((id) => [id, `new-${id}`])),
    )
    expect(batch.mock.calls[0]![0]).toEqual(
      Object.entries(documents).map(([id, resourceBody]) => ({
        operationType: 'Replace',
        id,
        resourceBody,
        ifMatch: etags[id],
      })),
    )
  })

  it('converts a complete dataset to typed documents and back', () => {
    const documents = documentsFor('dataset', data)
    expect(Object.keys(documents)).toHaveLength(6)
    expect(documents['activity-1']).toMatchObject({ type: 'activity', schemaVersion: 5 })
    expect(documents['challenge-1']).toMatchObject({ type: 'challenge', schemaVersion: 4 })
    expect(documents['idea-1']).toMatchObject({ type: 'idea', schemaVersion: 2 })
    expect(documentsToData(Object.values(documents))).toEqual(data)
  })

  it.each(Object.keys(data) as (keyof JourneyData)[])('rejects duplicate IDs within %s before mapping', (key) => {
    const entities = data[key]
    const id = entityId(entityTypeFor(key), entities[0])
    expect(() => documentsFor('dataset', { ...data, [key]: [...entities, ...entities] })).toThrowError(
      expect.objectContaining({
        issues: [
          expect.objectContaining({
            message: `Duplicate entity ID "${id}". IDs must be unique across all entity types in a dataset.`,
          }),
        ],
      }),
    )
  })

  it('rejects duplicate IDs across entity types before mapping', () => {
    expect(() =>
      documentsFor('dataset', { ...data, ideas: [{ ...data.ideas[0], ideaId: 'activity-1' }] }),
    ).toThrowError(
      expect.objectContaining({
        issues: [
          expect.objectContaining({
            message: 'Duplicate entity ID "activity-1". IDs must be unique across all entity types in a dataset.',
          }),
        ],
      }),
    )
  })

  it('preserves IDs that match JavaScript object properties through import and replacement', async () => {
    const specialData: JourneyData = {
      ...data,
      references: [
        { ...data.references[0], referenceId: '__proto__' },
        { ...data.references[0], referenceId: 'constructor' },
        { ...data.references[0], referenceId: 'toString' },
      ],
    }
    const documents = documentsFor('dataset', specialData)
    const batch = vi.fn().mockResolvedValue({ code: 200, result: [] })
    const container = { items: { batch } } as never
    await replaceDataset(container, 'dataset', documents, {})
    expect(batch.mock.calls[0][0]).toEqual(
      Object.values(documents).map((resourceBody) => ({ operationType: 'Create', resourceBody })),
    )
    const etags = Object.fromEntries(Object.keys(documents).map((id) => [id, `${id}-etag`]))
    await replaceDataset(container, 'dataset', documents, etags)
    expect(batch.mock.calls[1][0]).toEqual(
      Object.entries(documents).map(([id, resourceBody]) => ({
        operationType: 'Replace',
        id,
        resourceBody,
        ifMatch: etags[id],
      })),
    )
    expect(documentsToData(Object.values(documents))).toEqual(specialData)
    const fetchNext = vi.fn().mockResolvedValue({
      resources: Object.values(documents).map((document) => ({ ...document, _etag: `${document.id}-etag` })),
    })
    const loaded = await loadDataset({ items: { query: () => ({ fetchNext }) } } as never, 'dataset')
    expect(loaded.data).toEqual(specialData)
    expect(loaded.etags).toEqual(etags)
    await replaceDataset(container, 'dataset', {}, loaded.etags)
    expect(batch.mock.calls[2][0]).toEqual(
      Object.entries(etags).map(([id, ifMatch]) => ({ operationType: 'Delete', id, ifMatch })),
    )
  })

  it('reads back every record from a valid dataset', async () => {
    const documents = documentsFor('dataset', data)
    const fetchNext = vi.fn().mockResolvedValue({
      resources: Object.values(documents).map((document) => ({ ...document, _etag: `${document.id}-etag` })),
    })
    const loaded = await loadDataset({ items: { query: () => ({ fetchNext }) } } as never, 'dataset')
    expect(loaded.data).toEqual(data)
    expect(Object.keys(loaded.etags)).toHaveLength(6)
  })

  it.each([
    { name: undefined },
    { name: '' },
    { name: ' \t ' },
    { date: undefined },
    { date: '' },
    { date: '2026-02-29' },
    { date: '2026-07-17' },
  ])('rejects invalid loaded Activities instead of returning empty data: %j', async (fields) => {
    vi.useFakeTimers()
    vi.setSystemTime(new Date('2026-07-15T23:30:00Z'))
    const fetchNext = vi.fn().mockResolvedValue({
      resources: [
        {
          id: activity.activityId,
          datasetId: 'dataset',
          type: 'activity',
          schemaVersion: 5,
          entity: { ...activity, ideaIds: [], date: '2026-01-01', ...fields },
        },
      ],
    })
    await expect(loadDataset({ items: { query: () => ({ fetchNext }) } } as never, 'dataset')).rejects.toMatchObject({
      name: 'ZodError',
    })
  })

  it.each([3, 4])('rejects stored Activity version %s without migration', async (schemaVersion) => {
    const fetchNext = vi.fn().mockResolvedValue({
      resources: [
        {
          id: activity.activityId,
          datasetId: 'dataset',
          type: 'activity',
          schemaVersion,
          entity: { ...activity, ideaIds: [] },
        },
      ],
    })
    await expect(loadDataset({ items: { query: () => ({ fetchNext }) } } as never, 'dataset')).rejects.toThrow(
      `Document type \\"activity\\" requires schema version 5, received ${schemaVersion}.`,
    )
  })

  it('trims Activity titles while reading and constructing documents', async () => {
    const namedData = {
      ...data,
      activities: [{ ...activity, name: '  Orangery tour  ' }],
    }
    const documents = documentsFor('dataset', namedData)
    expect(documents['activity-1']?.entity.name).toBe('Orangery tour')
    const fetchNext = vi.fn().mockResolvedValue({
      resources: Object.values(documents).map((document) => ({
        ...document,
        entity: document.type === 'activity' ? { ...document.entity, name: '  Orangery tour  ' } : document.entity,
      })),
    })
    const loaded = await loadDataset({ items: { query: () => ({ fetchNext }) } } as never, 'dataset')
    expect(loaded.data.activities[0]?.name).toBe('Orangery tour')
  })

  it('rejects obsolete Challenge fields and versions as stored relationship errors', async () => {
    const challengeEntity = {
      challengeId: 'challenge-1',
      title: 'Challenge',
      description: 'A challenge',
      supportsActivityCategories: false,
    }
    const challenge = {
      id: 'challenge-1',
      datasetId: 'dataset',
      type: 'challenge',
      schemaVersion: 4,
      entity: { ...challengeEntity, waypointIds: [] },
    }
    for (const document of [
      challenge,
      ...[1, 2, 3].map((schemaVersion) => ({ ...challenge, schemaVersion, entity: challengeEntity })),
    ]) {
      const fetchNext = vi.fn().mockResolvedValue({ resources: [document] })
      await expect(loadDataset({ items: { query: () => ({ fetchNext }) } } as never, 'dataset')).rejects.toBeInstanceOf(
        StoredJourneyRelationshipError,
      )
    }
  })

  it('rejects duplicate or dangling Challenge assignments before returning a loaded dataset', async () => {
    const makeWaypoint = (challengeIds: string[]) => ({
      id: 'waypoint-1',
      datasetId: 'dataset',
      type: 'waypoint',
      schemaVersion: 2,
      entity: {
        waypointId: 'waypoint-1',
        title: 'Waypoint',
        description: 'A waypoint',
        category: 'Walk',
        tags: [],
        challengeIds,
        completion: { mode: 'once' },
        referenceIds: [],
        photoReferenceIds: [],
      },
    })
    const challenge = documentsFor('dataset', { ...data, waypoints: [] })['challenge-1']
    for (const [waypoint, message] of [
      [makeWaypoint(['challenge-1', 'challenge-1']), 'repeats a Challenge assignment'],
      [makeWaypoint(['challenge-missing']), 'references unknown challenge "challenge-missing"'],
    ] as const) {
      const fetchNext = vi.fn().mockResolvedValue({ resources: [waypoint, challenge] })
      await expect(loadDataset({ items: { query: () => ({ fetchNext }) } } as never, 'dataset')).rejects.toThrow(
        message,
      )
    }
  })

  it('deletes a waypoint while guarding unchanged Challenges in the snapshot', async () => {
    const batch = vi.fn().mockResolvedValue({ code: 200, result: [] })
    const linkedData: JourneyData = {
      ...data,
      ideas: [{ ...idea, waypointIds: ['waypoint-1'] }],
      activities: [{ ...activity, waypointId: 'waypoint-1' }],
    }
    const etags = Object.fromEntries(Object.keys(documentsFor('dataset', linkedData)).map((id) => [id, `${id}-etag`]))
    await replaceDataset(
      { items: { batch } } as never,
      'dataset',
      documentsFor('dataset', applyPlan(linkedData, deletionPlan(linkedData, 'waypoint', 'waypoint-1'))),
      etags,
    )

    const operations = batch.mock.calls[0][0]
    expect(operations).toContainEqual(
      expect.objectContaining({ id: 'challenge-1', operationType: 'Replace', ifMatch: 'challenge-1-etag' }),
    )
    expect(operations).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ operationType: 'Delete', id: 'waypoint-1' }),
        expect.objectContaining({ operationType: 'Replace', id: 'idea-1' }),
        expect.objectContaining({ operationType: 'Replace', id: 'activity-1' }),
      ]),
    )
  })

  it('deletes an idea, its activity links and orphaned references in one batch', async () => {
    const batch = vi.fn().mockResolvedValue({ code: 200, result: [] })
    const etags = Object.fromEntries(Object.keys(documentsFor('dataset', data)).map((id) => [id, `${id}-etag`]))
    await replaceDataset(
      { items: { batch } } as never,
      'dataset',
      documentsFor('dataset', applyPlan(data, deletionPlan(data, 'idea', 'idea-1'))),
      etags,
    )

    expect(batch).toHaveBeenCalledWith(
      expect.arrayContaining([
        { operationType: 'Delete', id: 'idea-1', ifMatch: 'idea-1-etag' },
        expect.objectContaining({
          operationType: 'Replace',
          id: 'activity-1',
          resourceBody: expect.objectContaining({ entity: expect.objectContaining({ ideaIds: [] }) }),
          ifMatch: 'activity-1-etag',
        }),
      ]),
      'dataset',
    )
  })

  it('uses a transactional batch and reports failed operations', async () => {
    const batch = vi.fn().mockResolvedValue({ code: 412, result: [{ statusCode: 412 }] })
    const document = {
      id: 'id',
      datasetId: 'dataset',
      type: 'idea',
      schemaVersion: 2,
      entity: {
        ideaId: 'id',
        title: 'Idea',
        description: '',
        notes: '',
        waypointIds: [],
        planningState: 'active',
        difficulty: 1,
        referenceIds: [],
        createdAt: '2026-01-01T00:00:00.000Z',
        updatedAt: '2026-01-01T00:00:00.000Z',
      },
    } as JourneyDocument

    await expect(replaceDataset({ items: { batch } } as never, 'dataset', { id: document }, {})).rejects.toMatchObject({
      code: 412,
    })
    expect(batch).toHaveBeenCalledWith([expect.objectContaining({ operationType: 'Create' })], 'dataset')
  })

  it('rejects datasets that exceed the transactional batch limit', async () => {
    const documents = Object.fromEntries(
      Array.from({ length: 101 }, (_, index) => [`id-${index}`, {} as JourneyDocument]),
    )
    await expect(replaceDataset({} as never, 'dataset', documents, {})).rejects.toThrow(
      '101 operations exceed the Cosmos transactional batch limit of 100 operations.',
    )
  })

  it('counts retained replacements, creates and deletes together toward the same operation limit', async () => {
    const document = documentsFor('dataset', data)['challenge-1']!
    const documents = Object.fromEntries(
      Array.from({ length: 99 }, (_, index) => {
        const id = `challenge-${index}`
        return [id, { ...document, id, entity: { ...document.entity, challengeId: id } }]
      }),
    )
    const etags = Object.fromEntries(
      [...Object.keys(documents).slice(0, 98), 'removed-1', 'removed-2'].map((id) => [id, `old-${id}`]),
    )
    const batch = vi.fn()
    await expect(replaceDataset({ items: { batch } } as never, 'dataset', documents, etags)).rejects.toThrow(
      '101 operations exceed the Cosmos transactional batch limit of 100 operations.',
    )
    expect(batch).not.toHaveBeenCalled()
    delete etags['removed-2']
    batch.mockResolvedValue({ code: 200, result: [] })
    await replaceDataset({ items: { batch } } as never, 'dataset', documents, etags)
    expect(batch.mock.calls[0]![0]).toHaveLength(100)
  })
})
