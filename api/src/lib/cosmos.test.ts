import { describe, expect, it, vi } from 'vitest'
import { documentsFor, documentsToData, replaceDataset } from './cosmos.js'
import type { JourneyData, JourneyDocument } from './journeySchema.js'

const data: JourneyData = {
  waypoints: [],
  challenges: [],
  ideas: [],
  activities: [],
  references: [],
  photoReferences: [],
}

describe('Cosmos Journey persistence', () => {
  it('converts a complete dataset to typed documents and back', () => {
    const documents = documentsFor('dataset', data)
    expect(documents).toEqual({})
    expect(documentsToData(Object.values(documents))).toEqual(data)
  })

  it('uses a transactional batch and reports failed operations', async () => {
    const batch = vi.fn().mockResolvedValue({ code: 412, result: [{ statusCode: 412 }] })
    const document = {
      id: 'id',
      datasetId: 'dataset',
      type: 'idea',
      schemaVersion: 1,
      entity: {
        ideaId: 'id',
        title: 'Idea',
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
