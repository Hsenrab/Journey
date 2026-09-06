import { describe, expect, it, vi } from 'vitest'
import { deleteEntity, documentsFor, documentsToData, replaceDataset } from './cosmos.js'
import type { JourneyData, JourneyDocument } from './journeySchema.js'

const activity = {
  activityId: 'activity-1',
  ideaIds: ['idea-1'],
  date: '2026-08-02',
  location: { kind: 'postcode', postcode: 'GL3 4AQ' },
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
  waypoints: [],
  challenges: [],
  ideas: [idea],
  activities: [activity],
  references: [],
  photoReferences: [],
}

describe('Cosmos Journey persistence', () => {
  it('converts a complete dataset to typed documents and back', () => {
    const documents = documentsFor('dataset', data)
    expect(documents['activity-1']).toMatchObject({ type: 'activity', schemaVersion: 2 })
    expect(documents['idea-1']).toMatchObject({ type: 'idea', schemaVersion: 2 })
    expect(documentsToData(Object.values(documents))).toEqual(data)
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
    await expect(replaceDataset({} as never, 'dataset', documents, {})).rejects.toThrow('transactional batch limit')
  })
})
