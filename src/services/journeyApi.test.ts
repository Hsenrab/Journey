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
    const data = createDefaultData()
    const fetch = vi.fn().mockImplementation(() => new Response(JSON.stringify({ data, etags: {} }), { status: 200 }))
    vi.stubGlobal('fetch', fetch)
    await importJourney('production', data)
    await clearJourney('production')
    await replaceJourney('production', data, { activity: 'etag' })
    expect(fetch).toHaveBeenCalledTimes(3)
  })

  it('surfaces API failures', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(new Response('no', { status: 409, statusText: 'Conflict' })))
    await expect(clearJourney('production')).rejects.toThrow('Your data has changed in another session.')
  })
})
