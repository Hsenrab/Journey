import { beforeEach, describe, expect, it, vi } from 'vitest'
import { createDefaultData } from './storage'
import {
  clearJourney,
  createJourneyEntity,
  deleteJourneyEntity,
  importJourney,
  loadJourney,
  updateJourneyEntity,
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
      .mockImplementation(() => Promise.resolve(new Response(JSON.stringify({ etag: 'next' }), { status: 201 })))
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
    const fetch = vi.fn().mockResolvedValue(new Response(null, { status: 204 }))
    vi.stubGlobal('fetch', fetch)
    const data = createDefaultData()
    await importJourney('production', data)
    await clearJourney('production')
    expect(fetch).toHaveBeenCalledTimes(2)
  })

  it('surfaces API failures', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(new Response('no', { status: 409, statusText: 'Conflict' })))
    await expect(clearJourney('production')).rejects.toThrow('409: Conflict')
  })
})
