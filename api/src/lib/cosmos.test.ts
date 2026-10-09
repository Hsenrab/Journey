import { describe, expect, it, vi } from 'vitest'
import { deleteEntity, documentsFor, documentsToData, loadDataset, replaceDataset } from './cosmos.js'
import type { JourneyData, JourneyDocument } from './journeySchema.js'
import { entityId, entityTypeFor } from './journeyGraph.js'

const activity = {
  activityId: 'activity-1',
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
      challengeIds: [],
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
      waypointIds: [],
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
  it('converts a complete dataset to typed documents and back', () => {
    const documents = documentsFor('dataset', data)
    expect(Object.keys(documents)).toHaveLength(6)
    expect(documents['activity-1']).toMatchObject({ type: 'activity', schemaVersion: 4 })
    expect(documents['challenge-1']).toMatchObject({ type: 'challenge', schemaVersion: 2 })
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

  it('deletes an idea, its activity links and orphaned references in one batch', async () => {
    const batch = vi.fn().mockResolvedValue({ code: 200, result: [] })
    await deleteEntity({ items: { batch } } as never, 'dataset', 'idea', 'idea-1', 'idea-etag', {
      data,
      etags: { 'idea-1': 'idea-etag', 'activity-1': 'activity-etag' },
    })

    expect(batch).toHaveBeenCalledWith(
      [
        { operationType: 'Delete', id: 'idea-1', ifMatch: 'idea-etag' },
        {
          operationType: 'Replace',
          id: 'activity-1',
          resourceBody: expect.objectContaining({ entity: expect.objectContaining({ ideaIds: [] }) }),
          ifMatch: 'activity-etag',
        },
      ],
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
})
