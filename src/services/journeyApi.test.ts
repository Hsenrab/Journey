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
  JourneyInputError,
} from './journeyApi'

describe('journey API client', () => {
  it('classifies only input rejections as handled input errors and preserves exact messages', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn().mockImplementation(() =>
        Promise.resolve(
          new Response(JSON.stringify({ error: 'Specific input failure' }), {
            status: 400,
            headers: { 'content-type': 'application/json' },
          }),
        ),
      ),
    )
    await expect(createJourneyEntity('demo', 'activity', {})).rejects.toBeInstanceOf(JourneyInputError)
    await expect(createJourneyEntity('demo', 'activity', {})).rejects.toThrow('Specific input failure')
    vi.stubGlobal(
      'fetch',
      vi.fn().mockImplementation(() =>
        Promise.resolve(
          new Response(JSON.stringify({ error: 'Specific server failure' }), {
            status: 500,
            headers: { 'content-type': 'application/json' },
          }),
        ),
      ),
    )
    await expect(createJourneyEntity('demo', 'activity', {})).rejects.not.toBeInstanceOf(JourneyInputError)
    const original = new Error('Network disconnected')
    vi.stubGlobal('fetch', vi.fn().mockRejectedValue(original))
    await expect(createJourneyEntity('demo', 'activity', {})).rejects.toBe(original)
  })
  it('preserves stored relationship incompatibility messages', async () => {
    vi.stubGlobal(
      'fetch',
      vi
        .fn()
        .mockResolvedValue(
          new Response(
            JSON.stringify({ error: 'Challenge schema version 3 is required; correct existing data separately.' }),
            { status: 422, headers: { 'content-type': 'application/json' } },
          ),
        ),
    )
    await expect(loadJourney('production')).rejects.toThrow('correct existing data separately')
  })

  beforeEach(() => {
    vi.restoreAllMocks()
  })

  it('loads and validates the server representation', async () => {
    const data = createDefaultData()
    vi.stubGlobal(
      'fetch',
      vi
        .fn()
        .mockResolvedValue(
          new Response(JSON.stringify({ data, etags: { one: 'etag' }, role: 'admin' }), { status: 200 }),
        ),
    )
    await expect(loadJourney('production')).resolves.toEqual({ data, etags: { one: 'etag' }, role: 'admin' })
  })

  it('fails closed when the server does not return a supported Journey role', async () => {
    vi.stubGlobal(
      'fetch',
      vi
        .fn()
        .mockResolvedValue(new Response(JSON.stringify({ data: createDefaultData(), etags: {} }), { status: 200 })),
    )

    await expect(loadJourney('production')).rejects.toThrow()
  })

  it('returns saved entity metadata and sends concurrency conditions', async () => {
    const data = createDefaultData()
    const fetch = vi
      .fn()
      .mockResolvedValueOnce(new Response(JSON.stringify({ etag: 'next' }), { status: 201 }))
      .mockResolvedValueOnce(new Response(JSON.stringify({ etag: 'next' }), { status: 200 }))
      .mockResolvedValueOnce(new Response(JSON.stringify({ data, etags: { waypoint: 'next' } }), { status: 200 }))
      .mockResolvedValueOnce(new Response(null, { status: 204 }))
    vi.stubGlobal('fetch', fetch)
    await expect(createJourneyEntity('production', 'activity', { activityId: 'a' })).resolves.toEqual({ etag: 'next' })
    await expect(updateJourneyEntity('production', 'activity', { activityId: 'a' }, 'a', 'old')).resolves.toEqual({
      etag: 'next',
    })
    await expect(
      updateJourneyEntity('production', 'waypoint', { waypointId: 'waypoint' }, 'waypoint', 'old'),
    ).resolves.toEqual({
      data,
      etags: { waypoint: 'next' },
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
          new Response(JSON.stringify({ error: 'data_not_empty' }), { status: 409, statusText: 'Conflict' }),
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
          new Response(JSON.stringify({ error: 'unknown_conflict' }), { status: 409, statusText: 'Conflict' }),
        )
        .mockResolvedValueOnce(new Response(null, { status: 500, statusText: 'Internal Server Error' })),
    )

    await expect(clearJourney('production')).rejects.toThrow('409: Conflict: unknown_conflict')
    await expect(clearJourney('production')).rejects.toThrow('500: Internal Server Error')
  })

  it.each([
    [400, undefined],
    [400, 'text/html'],
    [400, 'application/json'],
    [500, 'Application/JSON; charset=utf-8'],
    [502, 'application/problem+json; charset=UTF-8'],
    [409, undefined],
  ])('surfaces validated JSON messages for %s with %s', async (status, contentType) => {
    const headers = contentType ? { 'content-type': contentType } : undefined
    const response = new Response(JSON.stringify({ error: '  No position found for New place  ', detail: 'extra' }), {
      status,
      statusText: 'Failure',
      headers,
    })
    if (!contentType) response.headers.delete('content-type')
    expect(response.headers.get('content-type')).toBe(contentType ?? null)
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(response))
    await expect(replaceJourney('demo', createDefaultData(), {})).rejects.toThrow(
      `${status}: Failure: No position found for New place`,
    )
  })

  it.each(['conflict', 'data_not_empty'])('does not type %s outside HTTP 409', async (error) => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(new Response(JSON.stringify({ error }), { status: 400 })))
    const failure = await clearJourney('demo').catch((reason: unknown) => reason)
    expect(failure).toBeInstanceOf(Error)
    expect(failure).not.toBeInstanceOf(JourneyConflictError)
    expect(failure).not.toBeInstanceOf(JourneyImportNotEmptyError)
  })

  it.each([400, 409, 500])('preserves required JSON parsing errors for %s', async (status) => {
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue(
        new Response('{invalid', {
          status,
          headers: { 'content-type': 'application/json' },
        }),
      ),
    )
    await expect(clearJourney('demo')).rejects.toBeInstanceOf(SyntaxError)
  })

  it.each([{}, { error: 4 }, { error: '' }, { error: '  ' }, null, []])(
    'rejects malformed error envelopes: %j',
    async (body) => {
      vi.stubGlobal('fetch', vi.fn().mockResolvedValue(new Response(JSON.stringify(body), { status: 400 })))
      await expect(clearJourney('demo')).rejects.toHaveProperty('name', 'ZodError')
    },
  )

  it.each([undefined, 'text/html'])('does not parse non-JSON 502 bodies: %s', async (contentType) => {
    const response = new Response('<html>Gateway failed</html>', {
      status: 502,
      statusText: 'Bad Gateway',
      headers: contentType ? { 'content-type': contentType } : undefined,
    })
    const parse = vi.spyOn(response, 'json')
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(response))
    await expect(clearJourney('demo')).rejects.toThrow('502: Bad Gateway')
    expect(parse).not.toHaveBeenCalled()
  })
})
