import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import type { HttpRequest, InvocationContext } from '@azure/functions'
import { journey } from './journey.js'
import { JourneyDataSchema } from '../lib/journeySchema.js'
import { StoredJourneyRelationshipError } from '../lib/cosmos.js'

const {
  loadDataset,
  journeyContainer,
  createDocument,
  deleteEntity,
  replaceEntities,
  replaceDocument,
  replaceDataset,
  acquireMapsAccessToken,
} = vi.hoisted(() => ({
  loadDataset: vi.fn(),
  journeyContainer: vi.fn(),
  createDocument: vi.fn(),
  deleteEntity: vi.fn(),
  replaceEntities: vi.fn(),
  replaceDocument: vi.fn(),
  replaceDataset: vi.fn(),
  acquireMapsAccessToken: vi.fn(),
}))

vi.mock('../lib/cosmos.js', async () => {
  const actual = await vi.importActual<typeof import('../lib/cosmos.js')>('../lib/cosmos.js')
  return {
    datasetIdFor: (container: string) => container,
    journeyContainer,
    loadDataset,
    createDocument,
    deleteEntity,
    replaceEntities,
    documentFor: actual.documentFor,
    documentsFor: actual.documentsFor,
    emptyJourneyData: actual.emptyJourneyData,
    StoredJourneyRelationshipError: actual.StoredJourneyRelationshipError,
    replaceDocument,
    replaceDataset,
    savedDocument: actual.savedDocument,
  }
})

vi.mock('@azure/identity', () => ({ DefaultAzureCredential: vi.fn() }))
vi.mock('../lib/mapsAuth.js', () => ({
  acquireMapsAccessToken,
}))

function principal(roles = ['authenticated', 'admin'], overrides: Record<string, unknown> = {}) {
  return Buffer.from(
    JSON.stringify({
      identityProvider: 'aad',
      userId: 'admin',
      userDetails: 'admin@example.com',
      userRoles: roles,
      ...overrides,
    }),
  ).toString('base64')
}

function request(
  container: string,
  method = 'GET',
  body?: unknown,
  roles?: string[],
  header: string | null = principal(roles),
) {
  return {
    method,
    params: { container },
    json: async () => body,
    headers: { get: (name: string) => (name === 'x-ms-client-principal' ? header : null) },
  } as HttpRequest
}

const context = () => ({ error: vi.fn() }) as never

function searchResults(results: unknown[]) {
  vi.stubGlobal('fetch', vi.fn().mockResolvedValue({ ok: true, json: () => ({ results }) }))
}

const emptyData = {
  waypoints: [],
  challenges: [],
  ideas: [],
  activities: [],
  references: [],
  photoReferences: [],
}

const activity = {
  activityId: 'activity-1',
  name: 'Orangery tour',
  ideaIds: ['idea-1'],
  date: '2026-08-02',
  location: { kind: 'postcode', postcode: 'GL3 4AQ' },
  notes: '',
  referenceIds: [],
  photoReferenceIds: [],
  createdAt: '2026-08-02T00:00:00.000Z',
  updatedAt: '2026-08-02T00:00:00.000Z',
}

const waypoint = {
  waypointId: 'waypoint-1',
  title: 'Lacock Abbey',
  description: 'Abbey, museum and village.',
  category: 'House',
  tags: ['Wiltshire'],
  challengeIds: [],
  completion: { mode: 'once' },
  location: { placeName: 'Lacock Abbey', addressOrRegion: 'Wiltshire' },
  referenceIds: [],
  photoReferenceIds: [],
}

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
}

describe('journey', () => {
  beforeEach(() => {
    loadDataset.mockReset()
    journeyContainer.mockReset()
    createDocument.mockReset()
    deleteEntity.mockReset()
    replaceEntities.mockReset()
    replaceDocument.mockReset()
    replaceDataset.mockReset()
    acquireMapsAccessToken.mockReset()
    acquireMapsAccessToken.mockResolvedValue({ token: 'entra-token', expiresOn: '2026-01-01T00:00:00.000Z' })
    journeyContainer.mockReturnValue({})
    vi.stubEnv('AZURE_MAPS_CLIENT_ID', 'maps-client-id')
    searchResults([{ position: { lat: 51.844, lon: -2.153 } }])
  })

  afterEach(() => {
    vi.useRealTimers()
    vi.unstubAllGlobals()
    vi.unstubAllEnvs()
  })

  describe.each(['create', 'update', 'import', 'replace'] as const)('%s Activity validation', (operation) => {
    it.each([
      [{ name: undefined }, 'Activity title is required.'],
      [{ name: null }, 'Activity title is required.'],
      [{ name: '' }, 'Activity title is required.'],
      [{ name: ' \t\n ' }, 'Activity title is required.'],
      [{ date: undefined }, 'Activity date is required.'],
      [{ date: null }, 'Activity date is required.'],
      [{ date: '' }, 'Activity date must be a real YYYY-MM-DD date no later than today in UK time.'],
      [{ date: '2026-1-01' }, 'Activity date must be a real YYYY-MM-DD date no later than today in UK time.'],
      [{ date: '2026-02-29' }, 'Activity date must be a real YYYY-MM-DD date no later than today in UK time.'],
      [{ date: '2026-04-31' }, 'Activity date must be a real YYYY-MM-DD date no later than today in UK time.'],
      [{ date: '2026-07-17' }, 'Activity date must be a real YYYY-MM-DD date no later than today in UK time.'],
    ])('rejects %j before any Cosmos mutation', async (fields, message) => {
      vi.useFakeTimers()
      vi.setSystemTime(new Date('2026-07-15T23:30:00Z'))
      const valid = {
        ...activity,
        ideaIds: [],
        date: '2026-01-01',
        location: { kind: 'coordinates', latitude: 51.844, longitude: -2.153 },
      }
      const invalid = { ...valid, ...fields, activityId: 'invalid-activity' }
      const stored = { data: { ...emptyData, activities: [valid] }, etags: { 'activity-1': 'etag' } }
      const before = structuredClone(stored)
      loadDataset.mockResolvedValue(stored)
      const body =
        operation === 'import' || operation === 'replace'
          ? { operation, data: { ...emptyData, activities: [valid, invalid] }, etags: stored.etags }
          : { operation, type: 'activity', entity: invalid, id: invalid.activityId, ifMatch: 'etag' }
      expect(await journey(request('production', operation === 'update' ? 'PUT' : 'POST', body), context())).toEqual({
        status: 400,
        jsonBody: { error: message },
      })
      expect(loadDataset).not.toHaveBeenCalled()
      expect(createDocument).not.toHaveBeenCalled()
      expect(replaceDocument).not.toHaveBeenCalled()
      expect(replaceDataset).not.toHaveBeenCalled()
      expect(replaceEntities).not.toHaveBeenCalled()
      expect(deleteEntity).not.toHaveBeenCalled()
      expect(stored).toEqual(before)
    })
  })

  it.each(['create', 'update'] as const)(
    'persists a trimmed Activity title and exact UK date on %s',
    async (operation) => {
      vi.useFakeTimers()
      vi.setSystemTime(new Date('2026-07-15T23:30:00Z'))
      const entity = {
        ...activity,
        name: '  Orangery tour \t',
        ideaIds: [],
        date: '2026-07-16',
        location: { kind: 'coordinates', latitude: 51.844, longitude: -2.153 },
      }
      loadDataset.mockResolvedValue({ data: emptyData, etags: {} })
      const write = operation === 'create' ? createDocument : replaceDocument
      write.mockImplementation(async (_container, document) => ({
        resource: document,
        headers: { etag: 'saved-etag' },
      }))
      expect(
        await journey(
          request('production', operation === 'create' ? 'POST' : 'PUT', {
            operation,
            type: 'activity',
            entity,
            id: entity.activityId,
            ifMatch: 'original-etag',
          }),
          context(),
        ),
      ).toMatchObject({
        status: operation === 'create' ? 201 : 200,
        jsonBody: { entity: { name: 'Orangery tour', date: '2026-07-16' }, etag: 'saved-etag' },
      })
      expect(write.mock.calls[0]?.[1]).toMatchObject({ schemaVersion: 5 })
      if (operation === 'update') expect(write.mock.calls[0]?.[2]).toBe('original-etag')
    },
  )

  it.each(['import', 'replace'] as const)(
    'preserves named Activities, dates and deliberate duplicates on %s',
    async (operation) => {
      vi.useFakeTimers()
      vi.setSystemTime(new Date('2026-07-15T23:30:00Z'))
      const entity = {
        ...activity,
        name: '  Orangery tour \t',
        ideaIds: [],
        date: '2026-07-16',
        location: { kind: 'coordinates', latitude: 51.844, longitude: -2.153 },
      }
      const data = { ...emptyData, activities: [entity, { ...entity, activityId: 'activity-2' }] }
      const expectedData = JourneyDataSchema.parse(data)
      loadDataset.mockResolvedValue({
        data: expectedData,
        etags: { 'activity-1': 'saved-etag', 'activity-2': 'new-etag' },
      })
      if (operation === 'import') loadDataset.mockResolvedValueOnce({ data: emptyData, etags: {} })
      const etags = { 'activity-1': 'original-etag' }
      expect(await journey(request('production', 'POST', { operation, data, etags }), context())).toMatchObject({
        status: 200,
        jsonBody: { data: expectedData },
      })
      expect(replaceDataset).toHaveBeenCalledWith(
        {},
        'production',
        {
          'activity-1': expect.objectContaining({
            schemaVersion: 5,
            entity: expect.objectContaining({ name: 'Orangery tour', date: '2026-07-16' }),
          }),
          'activity-2': expect.objectContaining({
            schemaVersion: 5,
            entity: expect.objectContaining({ name: 'Orangery tour', date: '2026-07-16' }),
          }),
        },
        operation === 'import' ? {} : etags,
      )
    },
  )

  describe.each(['import', 'replace'])('%s dataset', (operation) => {
    it.each(['same-type', 'cross-type'])('rejects %s duplicate IDs without changing stored data', async (kind) => {
      const stored = { data: { ...emptyData, ideas: [idea] }, etags: { 'idea-1': 'etag' } }
      const before = structuredClone(stored)
      loadDataset.mockResolvedValue(stored)
      const data = {
        ...emptyData,
        ideas: kind === 'same-type' ? [idea, { ...idea, title: 'Duplicate' }] : [idea],
        references:
          kind === 'cross-type' ? [{ referenceId: 'idea-1', title: 'Duplicate', url: 'https://example.com' }] : [],
      }
      const { journey } = await import('./journey.js')

      expect(await journey(request('production', 'POST', { operation, data, etags: stored.etags }), context())).toEqual(
        {
          status: 400,
          jsonBody: {
            error: 'Duplicate entity ID "idea-1". IDs must be unique across all entity types in a dataset.',
          },
        },
      )
      expect(loadDataset).not.toHaveBeenCalled()
      expect(replaceDataset).not.toHaveBeenCalled()
      expect(stored).toEqual(before)
    })

    it.each(['idea-1', '__proto__', 'constructor', 'toString'])(
      'writes and reads back all records with ID %s',
      async (id) => {
        const cosmos = await vi.importActual<typeof import('../lib/cosmos.js')>('../lib/cosmos.js')
        const data = {
          ...emptyData,
          ideas: [
            { ...idea, ideaId: id },
            { ...idea, ideaId: 'idea-2' },
          ],
          references: [{ referenceId: 'reference-1', title: 'Reference', url: 'https://example.com' }],
        }
        const initial = operation === 'import' ? emptyData : { ...emptyData, ideas: [data.ideas[0]] }
        let stored = cosmos.documentsFor('production', JourneyDataSchema.parse(initial))
        const batch = vi.fn().mockImplementation(async (operations: { resourceBody: (typeof stored)[string] }[]) => {
          stored = Object.fromEntries(operations.map(({ resourceBody }) => [resourceBody.id, resourceBody]))
          return { code: 200, result: [] }
        })
        const container = { items: { batch } }
        journeyContainer.mockReturnValue(container)
        loadDataset.mockImplementation(async () => ({
          data: cosmos.documentsToData(Object.values(stored)),
          etags: Object.fromEntries(Object.keys(stored).map((id) => [id, `${id}-etag`])),
        }))
        replaceDataset.mockImplementation(cosmos.replaceDataset)
        const { journey } = await import('./journey.js')

        const response = await journey(
          request('production', 'POST', { operation, data, etags: Object.fromEntries([[id, `${id}-etag`]]) }),
          context(),
        )
        expect(response).toMatchObject({ status: 200, jsonBody: { data } })
        expect(batch).toHaveBeenCalledTimes(1)
        expect(Object.keys(stored)).toHaveLength(3)
        expect(batch.mock.calls[0][0].map((item: { operationType: string }) => item.operationType)).toEqual(
          operation === 'import' ? ['Create', 'Create', 'Create'] : ['Replace', 'Create', 'Create'],
        )
        expect(await journey(request('production'), context())).toMatchObject({ status: 200, jsonBody: { data } })
      },
    )
  })

  it('deletes a removed __proto__ record during dataset replacement', async () => {
    const cosmos = await vi.importActual<typeof import('../lib/cosmos.js')>('../lib/cosmos.js')
    const batch = vi.fn().mockResolvedValue({ code: 200, result: [] })
    journeyContainer.mockReturnValue({ items: { batch } })
    loadDataset.mockResolvedValue({ data: emptyData, etags: {} })
    replaceDataset.mockImplementation(cosmos.replaceDataset)
    const { journey } = await import('./journey.js')

    expect(
      await journey(
        request('production', 'POST', {
          operation: 'replace',
          data: emptyData,
          etags: JSON.parse('{"__proto__":"proto-etag"}'),
        }),
        context(),
      ),
    ).toMatchObject({ status: 200, jsonBody: { data: emptyData } })
    expect(batch).toHaveBeenCalledWith(
      [{ operationType: 'Delete', id: '__proto__', ifMatch: 'proto-etag' }],
      'production',
    )
  })

  describe.each(['production', 'demo'])('%s authorization', (containerName) => {
    it.each([
      ['missing', null],
      ['malformed', 'not-base64-json'],
      ['incomplete', Buffer.from(JSON.stringify({ identityProvider: 'aad' })).toString('base64')],
      ['incorrect field type', principal(undefined, { userId: 1 })],
      ['unsupported provider', principal(undefined, { identityProvider: 'github' })],
      ['empty user ID', principal(undefined, { userId: '' })],
      ['unauthenticated role', principal(['admin'])],
      ['anonymous', principal(['anonymous'])],
      ['unassigned', principal(['authenticated'])],
      ['both roles', principal(['authenticated', 'admin', 'viewer'])],
    ])('rejects a %s principal without downstream I/O', async (_category, header) => {
      expect(await journey(request(containerName, 'GET', undefined, undefined, header), context())).toEqual({
        status: 403,
        jsonBody: { error: 'forbidden' },
      })
      expect(journeyContainer).not.toHaveBeenCalled()
      expect(loadDataset).not.toHaveBeenCalled()
      expect(createDocument).not.toHaveBeenCalled()
      expect(replaceDocument).not.toHaveBeenCalled()
      expect(replaceEntities).not.toHaveBeenCalled()
      expect(deleteEntity).not.toHaveBeenCalled()
      expect(replaceDataset).not.toHaveBeenCalled()
      expect(acquireMapsAccessToken).not.toHaveBeenCalled()
      expect(fetch).not.toHaveBeenCalled()
    })

    it.each(['admin', 'viewer'])('returns the same complete dataset for %s', async (role) => {
      const loaded = { data: { ...emptyData, ideas: [idea] }, etags: { 'idea-1': 'etag' } }
      const cosmos = {}
      journeyContainer.mockReturnValue(cosmos)
      loadDataset.mockResolvedValue(loaded)

      expect(await journey(request(containerName, 'GET', undefined, ['authenticated', role]), context())).toEqual({
        status: 200,
        jsonBody: { ...loaded, datasetId: containerName, role },
      })
      expect(journeyContainer).toHaveBeenCalledWith(containerName)
      expect(loadDataset).toHaveBeenCalledWith(cosmos, containerName)
    })

    it.each([
      ['POST', { operation: 'create', type: 'idea', entity: idea }],
      ['PUT', { operation: 'update', type: 'idea', id: 'idea-1', entity: idea, ifMatch: 'etag' }],
      ['DELETE', { operation: 'delete', type: 'idea', id: 'idea-1', ifMatch: 'etag' }],
      ['POST', { operation: 'import', data: { ...emptyData, ideas: [idea] } }],
      ['POST', { operation: 'replace', data: { ...emptyData, waypoints: [waypoint] }, etags: {} }],
      ['POST', { operation: 'clear' }],
    ] as const)('denies viewer %s %j before processing the body', async (method, body) => {
      const req = request(containerName, method, body, ['authenticated', 'viewer'])
      const json = vi.spyOn(req, 'json')

      expect(await journey(req, context())).toEqual({ status: 403, jsonBody: { error: 'forbidden' } })
      expect(journeyContainer).toHaveBeenCalledWith(containerName)
      expect(json).not.toHaveBeenCalled()
      expect(loadDataset).not.toHaveBeenCalled()
      expect(createDocument).not.toHaveBeenCalled()
      expect(replaceDocument).not.toHaveBeenCalled()
      expect(replaceEntities).not.toHaveBeenCalled()
      expect(deleteEntity).not.toHaveBeenCalled()
      expect(replaceDataset).not.toHaveBeenCalled()
      expect(acquireMapsAccessToken).not.toHaveBeenCalled()
      expect(fetch).not.toHaveBeenCalled()
    })

    it.each(['import', 'replace', 'clear'] as const)(
      'allows admin %s with the existing dataset envelope',
      async (operation) => {
        const loaded = { data: { ...emptyData, ideas: [idea] }, etags: { 'idea-1': 'etag' } }
        const initial = operation === 'import' ? { data: emptyData, etags: {} } : loaded
        loadDataset.mockResolvedValueOnce(initial).mockResolvedValue(loaded)
        const body = operation === 'clear' ? { operation } : { operation, data: loaded.data, etags: initial.etags }

        expect(await journey(request(containerName, 'POST', body), context())).toEqual({
          status: 200,
          jsonBody: operation === 'clear' ? { data: emptyData, etags: {} } : loaded,
        })
        expect(replaceDataset).toHaveBeenCalledWith(
          {},
          containerName,
          operation === 'clear'
            ? {}
            : {
                'idea-1': expect.objectContaining({
                  id: 'idea-1',
                  datasetId: containerName,
                  type: 'idea',
                  entity: idea,
                }),
              },
          initial.etags,
        )
      },
    )

    it('rejects admin import into a nonempty dataset without writing', async () => {
      loadDataset.mockResolvedValue({ data: { ...emptyData, ideas: [idea] }, etags: { 'idea-1': 'etag' } })
      expect(
        await journey(request(containerName, 'POST', { operation: 'import', data: emptyData }), context()),
      ).toEqual({
        status: 409,
        jsonBody: { error: 'data_not_empty' },
      })
      expect(replaceDataset).not.toHaveBeenCalled()
    })

    it('resolves replacement Waypoints before the unchanged ETag-checked dataset batch', async () => {
      const challenge = {
        challengeId: 'challenge-1',
        title: 'Heritage weekend',
        description: 'A heritage challenge.',
        supportsActivityCategories: false,
      }
      const reference = { referenceId: 'reference-1', title: 'Source', url: 'https://example.test/source' }
      const candidate = {
        ...waypoint,
        challengeIds: ['challenge-1'],
        referenceIds: ['reference-1'],
      }
      const data = { ...emptyData, waypoints: [candidate], challenges: [challenge], references: [reference] }
      const etags = { 'waypoint-1': 'waypoint-etag', 'challenge-1': 'challenge-etag', 'reference-1': 'reference-etag' }
      const resolvedWaypoint = {
        ...candidate,
        location: { placeName: 'Lacock Abbey', addressOrRegion: 'Wiltshire', latitude: 51.844, longitude: -2.153 },
      }
      const loaded = {
        data: { ...data, waypoints: [resolvedWaypoint] },
        etags,
      }
      loadDataset.mockResolvedValue(loaded)

      expect(await journey(request('production', 'POST', { operation: 'replace', data, etags }), context())).toEqual({
        status: 200,
        jsonBody: loaded,
      })
      expect(fetch).toHaveBeenCalledTimes(1)
      expect(replaceDataset).toHaveBeenCalledWith(
        {},
        'production',
        expect.objectContaining({
          'waypoint-1': expect.objectContaining({
            datasetId: 'production',
            entity: resolvedWaypoint,
          }),
          'challenge-1': expect.objectContaining({ entity: challenge }),
          'reference-1': expect.objectContaining({ entity: reference }),
        }),
        etags,
      )
      expect(replaceDataset.mock.invocationCallOrder[0]).toBeGreaterThan(fetch.mock.invocationCallOrder[0] ?? 0)
    })

    it('does not geocode resolved or absent Waypoints, or locations on other entity types', async () => {
      const data = {
        ...emptyData,
        waypoints: [
          { ...waypoint, waypointId: 'resolved', location: { latitude: 51.4, longitude: -2.1 } },
          { ...waypoint, waypointId: 'absent', location: undefined },
        ],
        challenges: [
          {
            challengeId: 'challenge-1',
            title: 'Challenge',
            description: 'A challenge.',
            supportsActivityCategories: false,
            location: { placeName: 'A place' },
          },
        ],
        ideas: [{ ...idea, location: { placeName: 'An idea' } }],
        activities: [
          {
            ...activity,
            ideaIds: [],
            location: { kind: 'postcode', postcode: 'GL3 4AQ', latitude: 51.844, longitude: -2.153 },
          },
        ],
      }
      loadDataset.mockResolvedValue({ data, etags: {} })

      expect(
        await journey(request('production', 'POST', { operation: 'replace', data, etags: {} }), context()),
      ).toMatchObject({ status: 200 })
      expect(fetch).not.toHaveBeenCalled()
      expect(replaceDataset).toHaveBeenCalledTimes(1)
    })

    it('rejects an invalid replacement graph before resolving or writing', async () => {
      const data = {
        ...emptyData,
        waypoints: [{ ...waypoint, challengeIds: ['missing-challenge'] }],
      }

      expect(
        await journey(request('production', 'POST', { operation: 'replace', data, etags: {} }), context()),
      ).toEqual({
        status: 400,
        jsonBody: { error: 'Waypoint "waypoint-1" references unknown challenge "missing-challenge".' },
      })
      expect(fetch).not.toHaveBeenCalled()
      expect(replaceDataset).not.toHaveBeenCalled()
    })

    it('does not batch when a later Waypoint resolution returns no result', async () => {
      vi.stubGlobal(
        'fetch',
        vi
          .fn()
          .mockResolvedValueOnce({ ok: true, json: () => ({ results: [{ position: { lat: 51.4, lon: -2.1 } }] }) })
          .mockResolvedValueOnce({ ok: true, json: () => ({ results: [] }) }),
      )
      const data = {
        ...emptyData,
        waypoints: [waypoint, { ...waypoint, waypointId: 'waypoint-2', location: { placeName: 'Second place' } }],
      }

      expect(
        await journey(request('production', 'POST', { operation: 'replace', data, etags: {} }), context()),
      ).toEqual({ status: 400, jsonBody: { error: 'Azure Maps found no coordinates for "Second place".' } })
      expect(fetch).toHaveBeenCalledTimes(2)
      expect(replaceDataset).not.toHaveBeenCalled()
    })

    it('rejects invalid final Maps coordinates before creating a batch', async () => {
      searchResults([{ position: { lat: 91, lon: -2.1 } }])
      const data = { ...emptyData, waypoints: [waypoint] }

      expect(
        await journey(request('production', 'POST', { operation: 'replace', data, etags: {} }), context()),
      ).toEqual({ status: 400, jsonBody: { error: 'Too big: expected number to be <=90' } })
      expect(replaceDataset).not.toHaveBeenCalled()
    })

    it('preserves unexpected Maps failures and never writes', async () => {
      const mapsFailure = new Error('Maps credentials are unavailable.')
      vi.stubGlobal('fetch', vi.fn().mockRejectedValue(mapsFailure))
      const data = { ...emptyData, waypoints: [waypoint] }

      await expect(
        journey(request('production', 'POST', { operation: 'replace', data, etags: {} }), context()),
      ).rejects.toBe(mapsFailure)
      expect(replaceDataset).not.toHaveBeenCalled()
    })

    it('preserves stale ETag conflicts after resolution', async () => {
      const data = { ...emptyData, waypoints: [waypoint] }
      const etags = { 'waypoint-1': 'stale-etag' }
      replaceDataset.mockRejectedValue(Object.assign(new Error('stale'), { code: 412 }))

      expect(await journey(request('production', 'POST', { operation: 'replace', data, etags }), context())).toEqual({
        status: 409,
        jsonBody: { error: 'conflict' },
      })
      expect(fetch).toHaveBeenCalledTimes(1)
      expect(replaceDataset).toHaveBeenCalledWith({}, 'production', expect.any(Object), etags)
    })
  })

  it('returns expected stored relationship incompatibility as 422 without treating it as unexpected', async () => {
    const error = new StoredJourneyRelationshipError('Stored Challenge data needs correction.')
    loadDataset.mockRejectedValue(error)
    const invocation = { error: vi.fn() } as unknown as InvocationContext

    expect(await journey(request('production'), invocation)).toEqual({
      status: 422,
      jsonBody: { error: error.message },
    })
    expect(invocation.error).not.toHaveBeenCalled()
    expect(replaceDataset).not.toHaveBeenCalled()
  })

  it('propagates unexpected dataset load failures', async () => {
    const error = new Error('Cosmos query failed unexpectedly.')
    loadDataset.mockRejectedValue(error)
    const invocation = { error: vi.fn() } as unknown as InvocationContext

    await expect(journey(request('production'), invocation)).rejects.toBe(error)
    expect(invocation.error).toHaveBeenCalledWith(`Journey API failed: ${error.message}`)
  })

  it('rejects unsupported route containers', async () => {
    await expect(journey(request('test'), { error: vi.fn() } as unknown as InvocationContext)).rejects.toThrow(
      'Unsupported Journey container "test".',
    )
    await expect(journey(request('unknown'), { error: vi.fn() } as unknown as InvocationContext)).rejects.toThrow(
      'Unsupported Journey container "unknown".',
    )
  })

  it('rejects a create that references an unknown idea', async () => {
    loadDataset.mockResolvedValue({ data: emptyData, etags: {} })

    expect(
      await journey(
        request('production', 'POST', { operation: 'create', type: 'activity', entity: activity }),
        context(),
      ),
    ).toEqual({ status: 400, jsonBody: { error: 'Activity "activity-1" references unknown idea "idea-1".' } })
    expect(createDocument).not.toHaveBeenCalled()
  })

  it('rejects an entity that fails complete validation', async () => {
    loadDataset.mockResolvedValue({ data: emptyData, etags: {} })

    expect(
      await journey(
        request('production', 'POST', {
          operation: 'create',
          type: 'idea',
          entity: { ...idea, planningState: 'rejected' },
        }),
        context(),
      ),
    ).toMatchObject({ status: 400, jsonBody: { error: 'A rejected idea requires a rejection reason' } })
  })

  it('rejects obsolete Challenge membership in client writes with HTTP 400', async () => {
    const challenge = {
      challengeId: 'challenge-1',
      title: 'Challenge',
      description: 'A challenge',
      waypointIds: [],
      supportsActivityCategories: false,
    }

    expect(
      await journey(
        request('production', 'POST', { operation: 'create', type: 'challenge', entity: challenge }),
        context(),
      ),
    ).toEqual({
      status: 400,
      jsonBody: {
        error:
          'Challenge "challenge-1" contains obsolete field "waypointIds"; review its links and correct them separately before use.',
      },
    })
    expect(loadDataset).not.toHaveBeenCalled()
    expect(createDocument).not.toHaveBeenCalled()
  })

  it.each(['import', 'replace'] as const)(
    'rejects obsolete Challenge membership in %s before loading',
    async (operation) => {
      const challenge = {
        challengeId: 'challenge-1',
        title: 'Challenge',
        description: 'A challenge',
        waypointIds: [],
        supportsActivityCategories: false,
      }
      const body =
        operation === 'import'
          ? { operation, data: { ...emptyData, challenges: [challenge] } }
          : { operation, data: { ...emptyData, challenges: [challenge] }, etags: {} }

      expect(await journey(request('production', 'POST', body), context())).toMatchObject({
        status: 400,
        jsonBody: {
          error:
            'Challenge "challenge-1" contains obsolete field "waypointIds"; review its links and correct them separately before use.',
        },
      })
      expect(loadDataset).not.toHaveBeenCalled()
      expect(replaceDataset).not.toHaveBeenCalled()
    },
  )

  it('geocodes a postcode-only activity before it is persisted', async () => {
    loadDataset.mockResolvedValue({ data: emptyData, etags: {} })
    createDocument.mockImplementation(async (_container, document) => ({
      resource: document,
      headers: { etag: 'created-etag' },
    }))

    const result = await journey(
      request('production', 'POST', { operation: 'create', type: 'activity', entity: { ...activity, ideaIds: [] } }),
      context(),
    )

    expect(result).toMatchObject({
      status: 201,
      jsonBody: { entity: { activityId: 'activity-1' }, etag: 'created-etag' },
    })
    expect(createDocument).toHaveBeenCalledWith(
      {},
      expect.objectContaining({
        entity: expect.objectContaining({
          location: { kind: 'postcode', postcode: 'GL3 4AQ', latitude: 51.844, longitude: -2.153 },
        }),
      }),
    )
    expect(fetch).toHaveBeenCalledWith(
      'https://atlas.microsoft.com/search/address/json?api-version=1.0&query=GL3+4AQ',
      expect.anything(),
    )
  })

  it('allows demo creates against the demo dataset', async () => {
    loadDataset.mockResolvedValue({ data: emptyData, etags: {} })
    createDocument.mockImplementation(async (_container, document) => ({
      resource: document,
      headers: { etag: 'demo-etag' },
    }))

    expect(
      await journey(
        request('demo', 'POST', { operation: 'create', type: 'activity', entity: { ...activity, ideaIds: [] } }),
        context(),
      ),
    ).toMatchObject({
      status: 201,
      jsonBody: { entity: { activityId: 'activity-1' }, etag: 'demo-etag' },
    })
    expect(createDocument).toHaveBeenCalledWith(
      {},
      expect.objectContaining({
        datasetId: 'demo',
        entity: expect.objectContaining({ activityId: 'activity-1' }),
      }),
    )
  })

  it('geocodes a place-only waypoint before it is persisted', async () => {
    loadDataset.mockResolvedValue({ data: emptyData, etags: {} })
    createDocument.mockResolvedValue({ resource: {}, headers: {} })

    const result = await journey(
      request('production', 'POST', { operation: 'create', type: 'waypoint', entity: waypoint }),
      context(),
    )

    expect(result).toMatchObject({ status: 201 })
    expect(createDocument).toHaveBeenCalledWith(
      {},
      expect.objectContaining({
        entity: expect.objectContaining({
          location: {
            placeName: 'Lacock Abbey',
            addressOrRegion: 'Wiltshire',
            latitude: 51.844,
            longitude: -2.153,
          },
        }),
      }),
    )
  })

  it('rejects a save whose location cannot be geocoded', async () => {
    loadDataset.mockResolvedValue({ data: emptyData, etags: {} })
    searchResults([])

    expect(
      await journey(
        request('production', 'POST', { operation: 'create', type: 'activity', entity: { ...activity, ideaIds: [] } }),
        context(),
      ),
    ).toEqual({ status: 400, jsonBody: { error: 'Azure Maps found no coordinates for "GL3 4AQ".' } })
    expect(createDocument).not.toHaveBeenCalled()
  })

  it.each(['production', 'demo'])(
    'deletes an idea in %s transactionally and reports ETag conflicts',
    async (containerName) => {
      const loaded = { data: { ...emptyData, ideas: [idea], activities: [activity] }, etags: { 'idea-1': 'etag' } }
      loadDataset.mockResolvedValue(loaded)
      const deleteRequest = request(containerName, 'DELETE', {
        operation: 'delete',
        type: 'idea',
        id: 'idea-1',
        ifMatch: 'etag',
      })

      expect(await journey(deleteRequest, context())).toEqual({ status: 204 })
      expect(deleteEntity).toHaveBeenCalledWith({}, containerName, 'idea', 'idea-1', 'etag', loaded)

      deleteEntity.mockRejectedValueOnce(Object.assign(new Error('conflict'), { code: 412 }))
      expect(await journey(deleteRequest, context())).toEqual({ status: 409, jsonBody: { error: 'conflict' } })
    },
  )

  it.each(['production', 'demo'])('updates only the waypoint document in %s transactionally', async (containerName) => {
    const challenge = {
      challengeId: 'challenge-1',
      title: 'Heritage weekend',
      description: 'Heritage weekend',
      supportsActivityCategories: false,
    }
    const loaded = {
      data: { ...emptyData, waypoints: [waypoint], challenges: [challenge] },
      etags: { 'waypoint-1': 'waypoint-etag', 'challenge-1': 'challenge-etag' },
    }
    loadDataset.mockResolvedValue(loaded)
    const updated = { ...waypoint, title: 'Updated waypoint', challengeIds: ['challenge-1'] }

    expect(
      await journey(
        request(containerName, 'PUT', {
          operation: 'update',
          type: 'waypoint',
          id: 'waypoint-1',
          entity: updated,
          ifMatch: 'waypoint-etag',
        }),
        context(),
      ),
    ).toMatchObject({ status: 200 })
    expect(replaceEntities).toHaveBeenCalledWith(
      {},
      containerName,
      {
        updates: [{ type: 'waypoint', entity: expect.objectContaining({ title: 'Updated waypoint' }) }],
      },
      'waypoint-1',
      'waypoint-etag',
      loaded,
    )
  })

  it('rejects a waypoint update that invalidates an activity category', async () => {
    const challenge = {
      challengeId: 'challenge-1',
      title: 'Heritage weekend',
      description: 'Heritage weekend',
      supportsActivityCategories: true,
    }
    const categorizedActivity = {
      ...activity,
      ideaIds: [],
      waypointId: 'waypoint-1',
      category: 'silver',
    }
    loadDataset.mockResolvedValue({
      data: {
        ...emptyData,
        waypoints: [{ ...waypoint, challengeIds: ['challenge-1'] }],
        challenges: [challenge],
        activities: [categorizedActivity],
      },
      etags: {
        'waypoint-1': 'waypoint-etag',
        'challenge-1': 'challenge-etag',
        'activity-1': 'activity-etag',
      },
    })

    expect(
      await journey(
        request('production', 'PUT', {
          operation: 'update',
          type: 'waypoint',
          id: 'waypoint-1',
          entity: waypoint,
          ifMatch: 'waypoint-etag',
        }),
        context(),
      ),
    ).toEqual({
      status: 400,
      jsonBody: {
        error:
          'Activity "activity-1" has a category but its waypoint does not support Bronze, Silver or Gold categories.',
      },
    })
    expect(replaceEntities).not.toHaveBeenCalled()
  })

  it('rejects a waypoint update whose entity ID differs from the request ID', async () => {
    expect(
      await journey(
        request('production', 'PUT', {
          operation: 'update',
          type: 'waypoint',
          id: 'waypoint-1',
          entity: { ...waypoint, waypointId: 'waypoint-2' },
          ifMatch: 'waypoint-etag',
        }),
        context(),
      ),
    ).toEqual({ status: 400, jsonBody: { error: 'Entity ID does not match update ID.' } })
    expect(loadDataset).not.toHaveBeenCalled()
    expect(replaceEntities).not.toHaveBeenCalled()
  })

  it('deletes a waypoint transactionally after detaching linked entities', async () => {
    const challenge = {
      challengeId: 'challenge-1',
      title: 'Heritage weekend',
      description: 'Heritage weekend',
      supportsActivityCategories: false,
    }
    const linkedIdea = { ...idea, waypointIds: ['waypoint-1'] }
    const linkedActivity = { ...activity, ideaIds: [], waypointId: 'waypoint-1' }
    const loaded = {
      data: {
        ...emptyData,
        waypoints: [waypoint],
        challenges: [challenge],
        ideas: [linkedIdea],
        activities: [linkedActivity],
      },
      etags: {
        'waypoint-1': 'waypoint-etag',
        'challenge-1': 'challenge-etag',
        'idea-1': 'idea-etag',
        'activity-1': 'activity-etag',
      },
    }
    loadDataset.mockResolvedValue(loaded)

    expect(
      await journey(
        request('production', 'DELETE', {
          operation: 'delete',
          type: 'waypoint',
          id: 'waypoint-1',
          ifMatch: 'waypoint-etag',
        }),
        context(),
      ),
    ).toEqual({ status: 204 })
    expect(deleteEntity).toHaveBeenCalledWith({}, 'production', 'waypoint', 'waypoint-1', 'waypoint-etag', loaded)
  })

  it('rejects duplicate and dangling Challenge assignments before persistence', async () => {
    loadDataset.mockResolvedValue({
      data: {
        ...emptyData,
        challenges: [
          {
            challengeId: 'challenge-1',
            title: 'Challenge',
            description: 'A challenge',
            supportsActivityCategories: false,
          },
        ],
      },
      etags: {},
    })
    for (const [challengeIds, expected] of [
      [['challenge-1', 'challenge-1'], 'Waypoint Challenge assignments must be distinct'],
      [['missing'], 'Waypoint "waypoint-1" references unknown challenge "missing".'],
    ] as const) {
      const response = await journey(
        request('production', 'POST', {
          operation: 'create',
          type: 'waypoint',
          entity: { ...waypoint, challengeIds },
        }),
        context(),
      )
      expect(response).toMatchObject({ status: 400, jsonBody: { error: expected } })
    }
    expect(createDocument).not.toHaveBeenCalled()
  })
})
