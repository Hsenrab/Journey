import { beforeEach, describe, expect, it, vi } from 'vitest'
import { createDefaultData } from './storage'
import {
  clearJourney,
  createJourneyEntity,
  deleteJourneyEntity,
  importJourney,
  loadJourney,
  replaceJourney,
  updateJourneyEntity,
  JourneyConflictError,
  JourneyImportNotEmptyError,
} from './journeyApi'

describe('journey API client', () => {
  beforeEach(() => {
    vi.restoreAllMocks()
  })

  it('loads and validates the server representation', async () => {
    const data = createDefaultData()
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue(new Response(JSON.stringify({ data, etags: { one: 'etag' } }), { status: 200 })),
    )
    await expect(loadJourney('production')).resolves.toEqual({ data, etags: { one: 'etag' } })
  })

  it('returns saved entity metadata and sends concurrency conditions', async () => {
    const fetch = vi
      .fn()
      .mockResolvedValueOnce(new Response(JSON.stringify({ etag: 'next' }), { status: 201 }))
      .mockResolvedValueOnce(new Response(JSON.stringify({ etag: 'next' }), { status: 201 }))
      .mockResolvedValueOnce(new Response(null, { status: 204 }))
    vi.stubGlobal('fetch', fetch)
    await expect(createJourneyEntity('production', 'activity', { activityId: 'a' })).resolves.toEqual({ etag: 'next' })
    await expect(updateJourneyEntity('production', 'activity', { activityId: 'a' }, 'a', 'old')).resolves.toEqual({
      etag: 'next',
    })
    await deleteJourneyEntity('production', 'activity', 'a', 'old')
    expect(fetch).toHaveBeenCalledWith(
      '/api/journey/production',
      expect.objectContaining({ method: 'PUT', body: expect.stringContaining('"ifMatch":"old"') }),
    )
  })

  it('supports import and clear operations', async () => {
    const data = createDefaultData()
    const fetch = vi.fn().mockImplementation(() => new Response(JSON.stringify({ data, etags: {} }), { status: 200 }))
    vi.stubGlobal('fetch', fetch)
    await importJourney('production', data)
    await clearJourney('production')
    await replaceJourney('production', data, { activity: 'etag' })
    expect(fetch).toHaveBeenCalledTimes(3)
  })

  it('distinguishes edit conflicts from non-empty imports', async () => {
    vi.stubGlobal(
      'fetch',
      vi
        .fn()
        .mockResolvedValueOnce(
          new Response(JSON.stringify({ error: 'conflict' }), { status: 409, statusText: 'Conflict' }),
        )
        .mockResolvedValueOnce(
          new Response(JSON.stringify({ error: 'production_not_empty' }), { status: 409, statusText: 'Conflict' }),
        ),
    )
    await expect(clearJourney('production')).rejects.toBeInstanceOf(JourneyConflictError)
    await expect(importJourney('production', createDefaultData())).rejects.toBeInstanceOf(JourneyImportNotEmptyError)
  })

  it('preserves non-conflict API failures', async () => {
    vi.stubGlobal(
      'fetch',
      vi
        .fn()
        .mockResolvedValueOnce(
          new Response(JSON.stringify({ error: 'demo_read_only' }), { status: 409, statusText: 'Conflict' }),
        )
        .mockResolvedValueOnce(new Response(null, { status: 500, statusText: 'Internal Server Error' })),
    )

    await expect(clearJourney('production')).rejects.toThrow('409: Conflict')
    await expect(clearJourney('production')).rejects.toThrow('500: Internal Server Error')
  })
})
