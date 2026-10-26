import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import type { HttpRequest, InvocationContext } from '@azure/functions'
import { journey } from './journey.js'
import { JourneyDataSchema, type JourneyData, type JourneyDocument } from '../lib/journeySchema.js'
import { StoredJourneyRelationshipError } from '../lib/cosmos.js'

const { loadDataset, journeyContainer, replaceDataset, acquireMapsAccessToken } = vi.hoisted(() => ({
  loadDataset: vi.fn(),
  journeyContainer: vi.fn(),
  replaceDataset: vi.fn(),
  acquireMapsAccessToken: vi.fn(),
}))

vi.mock('../lib/cosmos.js', async () => {
  const actual = await vi.importActual<typeof import('../lib/cosmos.js')>('../lib/cosmos.js')
  return {
    datasetIdFor: (container: string) => container,
    journeyContainer,
    loadDataset,
    documentFor: actual.documentFor,
    documentsFor: actual.documentsFor,
    documentsToData: actual.documentsToData,
    emptyJourneyData: actual.emptyJourneyData,
    StoredJourneyRelationshipError: actual.StoredJourneyRelationshipError,
    replaceDataset,
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

const awardDescriptions = { bronze: 'Afternoon', silver: 'Full day', gold: 'Overnight' }

function awardData(awarded = true, shared = false): JourneyData {
  return JourneyDataSchema.parse({
    ...emptyData,
    challenges: [
      {
        challengeId: 'challenge-1',
        title: 'Heritage',
        description: 'Heritage visits',
        supportsActivityCategories: true,
        awardDescriptions,
      },
      ...(shared
        ? [
            {
              challengeId: 'challenge-2',
              title: 'Gardens',
              description: 'Garden visits',
              supportsActivityCategories: true,
              awardDescriptions,
            },
          ]
        : []),
    ],
    waypoints: [
      {
        ...waypoint,
        location: { latitude: 51.4, longitude: -2.1 },
        challengeIds: shared ? ['challenge-1', 'challenge-2'] : ['challenge-1'],
      },
    ],
    activities: awarded
      ? [
          {
            ...activity,
            ideaIds: [],
            waypointId: 'waypoint-1',
            challengeId: 'challenge-1',
            category: 'gold',
            location: { kind: 'coordinates', latitude: 51.4, longitude: -2.1 },
          },
        ]
      : [],
  })
}

type BatchOperation = {
  operationType: 'Create' | 'Replace' | 'Delete'
  id?: string
  resourceBody?: JourneyDocument
  ifMatch?: string
}

async function memoryDataset(initial: JourneyData) {
  const cosmos = await vi.importActual<typeof import('../lib/cosmos.js')>('../lib/cosmos.js')
  let revision = 1
  let stored = new Map(
    Object.values(cosmos.documentsFor('production', initial)).map((document) => [
      document.id,
      { ...document, _etag: `initial-${document.id}` },
    ]),
  )
  function commit(operations: BatchOperation[]) {
    const failure = operations.findIndex((operation) => {
      const id = operation.id ?? operation.resourceBody!.id
      return operation.operationType === 'Create' ? stored.has(id) : stored.get(id)?._etag !== operation.ifMatch
    })
    if (failure !== -1)
      return {
        code: 207,
        result: operations.map((_, index) => ({ statusCode: index === failure ? 412 : 424 })),
      }
    const next = new Map(stored)
    const result = operations.map((operation) => {
      const id = operation.id ?? operation.resourceBody!.id
      if (operation.operationType === 'Delete') {
        next.delete(id)
        return { statusCode: 204 }
      }
      const eTag = `revision-${revision++}`
      next.set(id, { ...structuredClone(operation.resourceBody!), _etag: eTag })
      return { statusCode: operation.operationType === 'Create' ? 201 : 200, eTag }
    })
    stored = next
    return { code: 200, result }
  }
  const batch = vi.fn(async (operations: BatchOperation[], _datasetId: string) => commit(operations))
  const container = {
    items: {
      batch,
      query: () => ({ fetchNext: async () => ({ resources: structuredClone([...stored.values()]) }) }),
    },
  }
  journeyContainer.mockReturnValue(container)
  loadDataset.mockImplementation(cosmos.loadDataset)
  replaceDataset.mockImplementation(cosmos.replaceDataset)
  return {
    batch,
    commit,
    snapshot: () => structuredClone([...stored.values()]),
    loaded: () => cosmos.loadDataset(container as never, 'production'),
  }
}

describe('journey', () => {
  beforeEach(() => {
    loadDataset.mockReset()
    journeyContainer.mockReset()
    replaceDataset.mockReset()
    replaceDataset.mockImplementation(async (_container, _datasetId, documents) =>
      Object.fromEntries(Object.keys(documents).map((id) => [id, 'saved-etag'])),
    )
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
      expect(replaceDataset).not.toHaveBeenCalled()
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
      loadDataset.mockResolvedValue(
        operation === 'create'
          ? { data: emptyData, etags: {} }
          : { data: { ...emptyData, activities: [entity] }, etags: { 'activity-1': 'original-etag' } },
      )
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
      expect(replaceDataset.mock.calls[0]?.[2]['activity-1']).toMatchObject({ schemaVersion: 5 })
      if (operation === 'update') expect(replaceDataset.mock.calls[0]?.[3]).toEqual({ 'activity-1': 'original-etag' })
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
      const etags = { 'activity-1': 'original-etag' }
      loadDataset.mockResolvedValueOnce(
        operation === 'import'
          ? { data: emptyData, etags: {} }
          : { data: { ...emptyData, activities: [{ ...entity, name: 'Orangery tour' }] }, etags },
      )
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
    loadDataset
      .mockResolvedValueOnce({
        data: { ...emptyData, ideas: [{ ...idea, ideaId: '__proto__' }] },
        etags: JSON.parse('{"__proto__":"proto-etag"}'),
      })
      .mockResolvedValue({ data: emptyData, etags: {} })
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
      loadDataset.mockResolvedValue({ data, etags })
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
    expect(replaceDataset).not.toHaveBeenCalled()
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
    expect(replaceDataset).not.toHaveBeenCalled()
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
    replaceDataset.mockResolvedValue({ 'activity-1': 'created-etag' })

    const result = await journey(
      request('production', 'POST', { operation: 'create', type: 'activity', entity: { ...activity, ideaIds: [] } }),
      context(),
    )

    expect(result).toMatchObject({
      status: 201,
      jsonBody: { entity: { activityId: 'activity-1' }, etag: 'created-etag' },
    })
    expect(replaceDataset).toHaveBeenCalledWith(
      {},
      'production',
      {
        'activity-1': expect.objectContaining({
          entity: expect.objectContaining({
            location: { kind: 'postcode', postcode: 'GL3 4AQ', latitude: 51.844, longitude: -2.153 },
          }),
        }),
      },
      {},
    )
    expect(fetch).toHaveBeenCalledWith(
      'https://atlas.microsoft.com/search/address/json?api-version=1.0&query=GL3+4AQ',
      expect.anything(),
    )
  })

  it('allows demo creates against the demo dataset', async () => {
    loadDataset.mockResolvedValue({ data: emptyData, etags: {} })
    replaceDataset.mockResolvedValue({ 'activity-1': 'demo-etag' })

    expect(
      await journey(
        request('demo', 'POST', { operation: 'create', type: 'activity', entity: { ...activity, ideaIds: [] } }),
        context(),
      ),
    ).toMatchObject({
      status: 201,
      jsonBody: { entity: { activityId: 'activity-1' }, etag: 'demo-etag' },
    })
    expect(replaceDataset).toHaveBeenCalledWith(
      {},
      'demo',
      {
        'activity-1': expect.objectContaining({
          datasetId: 'demo',
          entity: expect.objectContaining({ activityId: 'activity-1' }),
        }),
      },
      {},
    )
  })

  it('geocodes a place-only waypoint before it is persisted', async () => {
    loadDataset.mockResolvedValue({ data: emptyData, etags: {} })

    const result = await journey(
      request('production', 'POST', { operation: 'create', type: 'waypoint', entity: waypoint }),
      context(),
    )

    expect(result).toMatchObject({ status: 201 })
    expect(replaceDataset).toHaveBeenCalledWith(
      {},
      'production',
      {
        'waypoint-1': expect.objectContaining({
          entity: expect.objectContaining({
            location: {
              placeName: 'Lacock Abbey',
              addressOrRegion: 'Wiltshire',
              latitude: 51.844,
              longitude: -2.153,
            },
          }),
        }),
      },
      {},
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
    expect(replaceDataset).not.toHaveBeenCalled()
  })

  it.each(['production', 'demo'])(
    'deletes an idea in %s transactionally and reports ETag conflicts',
    async (containerName) => {
      const loaded = {
        data: {
          ...emptyData,
          ideas: [idea],
          activities: [{ ...activity, location: { ...activity.location, latitude: 51.844, longitude: -2.153 } }],
        },
        etags: { 'idea-1': 'etag', 'activity-1': 'activity-etag' },
      }
      loadDataset.mockResolvedValue(loaded)
      const deleteRequest = request(containerName, 'DELETE', {
        operation: 'delete',
        type: 'idea',
        id: 'idea-1',
        ifMatch: 'etag',
      })

      expect(await journey(deleteRequest, context())).toEqual({ status: 204 })
      expect(replaceDataset).toHaveBeenCalledWith(
        {},
        containerName,
        { 'activity-1': expect.objectContaining({ entity: expect.objectContaining({ ideaIds: [] }) }) },
        loaded.etags,
      )

      replaceDataset.mockRejectedValueOnce(Object.assign(new Error('conflict'), { code: 412 }))
      expect(await journey(deleteRequest, context())).toEqual({ status: 409, jsonBody: { error: 'conflict' } })
    },
  )

  it.each(['production', 'demo'])(
    'updates the waypoint and guards unchanged Challenges in %s transactionally',
    async (containerName) => {
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
      expect(replaceDataset).toHaveBeenCalledWith(
        {},
        containerName,
        {
          'waypoint-1': expect.objectContaining({ entity: expect.objectContaining({ title: 'Updated waypoint' }) }),
          'challenge-1': expect.objectContaining({ entity: challenge }),
        },
        loaded.etags,
      )
    },
  )

  it('rejects a waypoint update that invalidates an activity category', async () => {
    const challenge = {
      challengeId: 'challenge-1',
      title: 'Heritage weekend',
      description: 'Heritage weekend',
      supportsActivityCategories: true,
      awardDescriptions: { bronze: 'Afternoon', silver: 'Full day', gold: 'Overnight' },
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
    ).toMatchObject({
      status: 400,
      jsonBody: {
        error: expect.stringContaining('Activity "activity-1" at Waypoint "waypoint-1"'),
      },
    })
    expect(replaceDataset).not.toHaveBeenCalled()
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
    expect(replaceDataset).not.toHaveBeenCalled()
  })

  it('deletes a waypoint transactionally after detaching linked entities', async () => {
    const challenge = {
      challengeId: 'challenge-1',
      title: 'Heritage weekend',
      description: 'Heritage weekend',
      supportsActivityCategories: false,
    }
    const linkedIdea = { ...idea, waypointIds: ['waypoint-1'] }
    const linkedActivity = {
      ...activity,
      ideaIds: [],
      waypointId: 'waypoint-1',
      location: { ...activity.location, latitude: 51.844, longitude: -2.153 },
    }
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
    expect(replaceDataset).toHaveBeenCalledWith(
      {},
      'production',
      {
        'challenge-1': expect.objectContaining({ entity: challenge }),
        'idea-1': expect.objectContaining({ entity: expect.objectContaining({ waypointIds: [] }) }),
        'activity-1': expect.objectContaining({
          entity: expect.not.objectContaining({ waypointId: expect.anything() }),
        }),
      },
      loaded.etags,
    )
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
    expect(replaceDataset).not.toHaveBeenCalled()
  })

  describe('award graph writes', () => {
    it('preserves the raw Waypoint update dataset/ETag envelope from its committed batch snapshot', async () => {
      const original = awardData()
      const memory = await memoryDataset(original)
      const { etags } = await memory.loaded()
      loadDataset.mockClear()
      const entity = { ...original.waypoints[0]!, title: 'Updated awarded Waypoint' }
      const response = await journey(
        request('production', 'PUT', {
          operation: 'update',
          type: 'waypoint',
          id: 'waypoint-1',
          entity,
          ifMatch: etags['waypoint-1'],
        }),
        context(),
      )
      expect(loadDataset).toHaveBeenCalledTimes(1)
      const committed = await memory.loaded()
      expect(response).toEqual({ status: 200, jsonBody: committed })
      expect(committed.data.waypoints[0]).toEqual(entity)
      expect(committed.data.activities).toEqual(original.activities)
      expect(Object.keys(committed.etags)).toHaveLength(3)
      for (const [id, etag] of Object.entries(committed.etags)) expect(etag).not.toBe(etags[id])
      expect(memory.batch).toHaveBeenCalledTimes(1)
    })

    it.each(['create', 'update', 'import', 'replace'] as const)(
      'rejects invalid Challenge award configurations on %s before any writes',
      async (operation) => {
        for (const fields of [
          { supportsActivityCategories: true, awardDescriptions: undefined },
          { supportsActivityCategories: true, awardDescriptions: { bronze: 'Visit', silver: 'Day' } },
          { supportsActivityCategories: true, awardDescriptions: { ...awardDescriptions, bronze: ' \t ' } },
          { supportsActivityCategories: true, awardDescriptions: { ...awardDescriptions, platinum: 'Extra' } },
          { supportsActivityCategories: false, awardDescriptions },
        ]) {
          const original = awardData()
          const candidate = { ...original, challenges: [{ ...original.challenges[0]!, ...fields }] }
          const memory = await memoryDataset(operation === 'import' ? JourneyDataSchema.parse(emptyData) : original)
          const before = memory.snapshot()
          const { etags } = await memory.loaded()
          const body =
            operation === 'import' || operation === 'replace'
              ? { operation, data: candidate, etags }
              : {
                  operation,
                  type: 'challenge',
                  id: 'challenge-1',
                  entity: candidate.challenges[0],
                  ifMatch: etags['challenge-1'],
                }
          expect(
            (await journey(request('production', operation === 'update' ? 'PUT' : 'POST', body), context())).status,
          ).toBe(400)
          expect(memory.batch).not.toHaveBeenCalled()
          expect(memory.snapshot()).toEqual(before)
        }
      },
    )

    it.each(['create', 'update', 'import', 'replace'] as const)(
      'rejects missing eligible categories and ineligible supplied categories on %s without writes',
      async (operation) => {
        for (const eligible of [true, false]) {
          const original = awardData(true)
          const candidate = structuredClone(original)
          if (eligible) delete candidate.activities[0]!.category
          else candidate.waypoints[0]!.challengeIds = []
          const stored = operation === 'import' ? emptyData : original
          const memory = await memoryDataset(JourneyDataSchema.parse(stored))
          const before = memory.snapshot()
          const loaded = await memory.loaded()
          const entity = eligible ? candidate.activities[0]! : { ...candidate.activities[0]!, waypointId: undefined }
          const data = eligible ? candidate : { ...candidate, activities: [entity] }
          const body =
            operation === 'import' || operation === 'replace'
              ? { operation, data, etags: loaded.etags }
              : { operation, type: 'activity', id: 'activity-1', entity, ifMatch: loaded.etags['activity-1'] }
          if (operation === 'create') {
            body.entity = { ...entity, activityId: 'activity-new' }
          }
          const response = await journey(
            request('production', operation === 'update' ? 'PUT' : 'POST', body),
            context(),
          )
          expect(response.status).toBe(400)
          expect(response.jsonBody).toMatchObject({
            error: expect.stringContaining(eligible ? 'requires a Bronze' : 'not linked to a waypoint'),
          })
          expect(memory.batch).not.toHaveBeenCalled()
          expect(memory.snapshot()).toEqual(before)
        }
      },
    )

    it.each(['enable', 'membership'] as const)(
      'rejects %s with unawarded retained history and explains the blocking Activity',
      async (operation) => {
        const original = awardData(true)
        delete original.activities[0]!.category
        if (operation === 'enable') {
          original.challenges[0]!.supportsActivityCategories = false
          delete original.challenges[0]!.awardDescriptions
        } else original.waypoints[0]!.challengeIds = []
        const memory = await memoryDataset(original)
        const loaded = await memory.loaded()
        const type = operation === 'enable' ? 'challenge' : 'waypoint'
        const entity =
          operation === 'enable'
            ? { ...original.challenges[0]!, supportsActivityCategories: true, awardDescriptions }
            : { ...original.waypoints[0]!, challengeIds: ['challenge-1'] }
        const id = operation === 'enable' ? 'challenge-1' : 'waypoint-1'
        const response = await journey(
          request('production', 'PUT', {
            operation: 'update',
            type,
            id,
            entity,
            ifMatch: loaded.etags[id],
          }),
          context(),
        )
        expect(response).toMatchObject({
          status: 400,
          jsonBody: { error: expect.stringContaining('Activity "activity-1" at Waypoint "waypoint-1" requires') },
        })
        expect(response.jsonBody.error).toContain('cannot convert unawarded history')
        expect(memory.batch).not.toHaveBeenCalled()
      },
    )

    it('edits descriptions without changing awards and returns the committed target ETag', async () => {
      const original = awardData()
      const memory = await memoryDataset(original)
      const loaded = await memory.loaded()
      const entity = {
        ...original.challenges[0]!,
        awardDescriptions: { ...awardDescriptions, gold: '  Overnight expedition  ' },
      }
      const response = await journey(
        request('production', 'PUT', {
          operation: 'update',
          type: 'challenge',
          id: 'challenge-1',
          ifMatch: loaded.etags['challenge-1'],
          entity,
        }),
        context(),
      )
      const saved = await memory.loaded()
      expect(response).toEqual({
        status: 200,
        jsonBody: { entity: saved.data.challenges[0], etag: saved.etags['challenge-1'] },
      })
      expect(saved.data.challenges[0]!.awardDescriptions!.gold).toBe('Overnight expedition')
      expect(saved.data.activities).toEqual(original.activities)
      expect(memory.batch.mock.calls[0]![0]).toHaveLength(3)
      expect(memory.batch.mock.calls[0]![0]).toContainEqual(
        expect.objectContaining({
          operationType: 'Replace',
          id: 'activity-1',
          ifMatch: loaded.etags['activity-1'],
        }),
      )
    })

    it.each(['disable', 'delete', 'membership', 'waypoint'] as const)(
      'blocks raw %s that destroys an existing award without partial writes',
      async (operation) => {
        const original = awardData()
        const memory = await memoryDataset(original)
        const before = memory.snapshot()
        const { etags } = await memory.loaded()
        const isDelete = operation === 'delete' || operation === 'waypoint'
        const type = operation === 'membership' || operation === 'waypoint' ? 'waypoint' : 'challenge'
        const id = type === 'waypoint' ? 'waypoint-1' : 'challenge-1'
        const entity =
          operation === 'disable'
            ? { ...original.challenges[0]!, supportsActivityCategories: false, awardDescriptions: undefined }
            : { ...original.waypoints[0]!, challengeIds: [] }
        const response = await journey(
          request('production', isDelete ? 'DELETE' : 'PUT', {
            operation: isDelete ? 'delete' : 'update',
            type,
            id,
            ifMatch: etags[id],
            entity,
          }),
          context(),
        )
        expect(response).toMatchObject({
          status: 400,
          jsonBody: { error: expect.stringContaining('Activity "activity-1" at Waypoint "waypoint-1"') },
        })
        expect(memory.batch).not.toHaveBeenCalled()
        expect(memory.snapshot()).toEqual(before)
      },
    )

    it.each(['disable', 'delete', 'membership', 'waypoint'] as const)(
      'rejects full replacement disguising %s by stripping the retained award',
      async (operation) => {
        const original = awardData()
        const memory = await memoryDataset(original)
        const before = memory.snapshot()
        const { etags } = await memory.loaded()
        const candidate = structuredClone(original)
        delete candidate.activities[0]!.category
        if (operation === 'disable') {
          candidate.challenges[0]!.supportsActivityCategories = false
          delete candidate.challenges[0]!.awardDescriptions
        } else if (operation === 'delete') {
          candidate.challenges = []
          candidate.waypoints[0]!.challengeIds = []
          delete candidate.activities[0]!.challengeId
        } else if (operation === 'membership') candidate.waypoints[0]!.challengeIds = []
        else {
          candidate.waypoints = []
          delete candidate.activities[0]!.waypointId
        }
        const response = await journey(
          request('production', 'POST', {
            operation: 'replace',
            data: candidate,
            etags,
          }),
          context(),
        )
        expect(response).toMatchObject({
          status: 400,
          jsonBody: { error: expect.stringContaining('Handle these Activities separately') },
        })
        expect(memory.batch).not.toHaveBeenCalled()
        expect(memory.snapshot()).toEqual(before)
      },
    )

    it.each(['disable', 'delete'] as const)(
      'allows Challenge %s with shared eligibility, detaching direct links only on delete',
      async (operation) => {
        const original = awardData(true, true)
        const memory = await memoryDataset(original)
        const { etags } = await memory.loaded()
        const response = await journey(
          request('production', operation === 'delete' ? 'DELETE' : 'PUT', {
            operation: operation === 'delete' ? 'delete' : 'update',
            type: 'challenge',
            id: 'challenge-1',
            ifMatch: etags['challenge-1'],
            entity: { ...original.challenges[0]!, supportsActivityCategories: false, awardDescriptions: undefined },
          }),
          context(),
        )
        expect(response.status).toBe(operation === 'delete' ? 204 : 200)
        const saved = await memory.loaded()
        expect(saved.data.activities[0]!.category).toBe('gold')
        if (operation === 'delete') {
          expect(saved.data.waypoints[0]!.challengeIds).toEqual(['challenge-2'])
          expect(saved.data.activities[0]).not.toHaveProperty('challengeId')
        } else expect(saved.data.activities).toEqual(original.activities)
      },
    )

    it('permits deliberately removing Activity eligibility first and then deleting its Waypoint', async () => {
      const original = awardData()
      const memory = await memoryDataset(original)
      const { etags } = await memory.loaded()
      const { waypointId: _waypoint, category: _award, ...entity } = original.activities[0]!
      expect(
        (
          await journey(
            request('production', 'PUT', {
              operation: 'update',
              type: 'activity',
              id: 'activity-1',
              ifMatch: etags['activity-1'],
              entity,
            }),
            context(),
          )
        ).status,
      ).toBe(200)
      const refreshed = await memory.loaded()
      expect(
        await journey(
          request('production', 'DELETE', {
            operation: 'delete',
            type: 'waypoint',
            id: 'waypoint-1',
            ifMatch: refreshed.etags['waypoint-1'],
          }),
          context(),
        ),
      ).toEqual({ status: 204 })
      expect((await memory.loaded()).data.activities[0]).not.toHaveProperty('category')
    })

    it('allows a full replacement that deliberately edits an Activity tier without changing eligibility', async () => {
      const original = awardData()
      const memory = await memoryDataset(original)
      const { etags } = await memory.loaded()
      const candidate = structuredClone(original)
      candidate.activities[0]!.category = 'silver'
      const response = await journey(
        request('production', 'POST', {
          operation: 'replace',
          data: candidate,
          etags,
        }),
        context(),
      )
      expect(response).toMatchObject({ status: 200, jsonBody: { data: candidate } })
      expect(memory.batch).toHaveBeenCalledTimes(1)
      expect((await memory.loaded()).data.activities[0]!.category).toBe('silver')
    })

    it('requires awarded Activities to be handled separately before deleting their Waypoint, even in a replacement', async () => {
      const original = awardData()
      const memory = await memoryDataset(original)
      const { etags } = await memory.loaded()
      expect(
        await journey(
          request('production', 'POST', {
            operation: 'replace',
            data: { ...original, activities: [], waypoints: [] },
            etags,
          }),
          context(),
        ),
      ).toMatchObject({
        status: 400,
        jsonBody: { error: expect.stringContaining('Activity "activity-1" at Waypoint "waypoint-1"') },
      })
      expect(memory.batch).not.toHaveBeenCalled()
    })

    it('allows explicit Clear of an awarded dataset', async () => {
      const memory = await memoryDataset(awardData())
      expect(await journey(request('production', 'POST', { operation: 'clear' }), context())).toEqual({
        status: 200,
        jsonBody: { data: emptyData, etags: {} },
      })
      expect(memory.snapshot()).toEqual([])
      expect(memory.batch).toHaveBeenCalledTimes(1)
    })

    it.each(['create', 'update', 'delete', 'replace'] as const)(
      'fails an oversized raw/full %s explicitly without submitting or changing any document',
      async (operation) => {
        const original = awardData(false)
        original.references = Array.from({ length: 99 }, (_, index) => ({
          referenceId: `reference-${index}`,
          title: 'Reference',
          url: 'https://example.test/',
        }))
        const memory = await memoryDataset(original)
        const before = memory.snapshot()
        const { etags } = await memory.loaded()
        const body =
          operation === 'replace'
            ? { operation, data: original, etags }
            : operation === 'create'
              ? { operation, type: 'activity', entity: awardData().activities[0] }
              : {
                  operation,
                  type: 'challenge',
                  id: 'challenge-1',
                  ifMatch: etags['challenge-1'],
                  entity: original.challenges[0],
                }
        await expect(
          journey(
            request('production', operation === 'update' ? 'PUT' : operation === 'delete' ? 'DELETE' : 'POST', body),
            context(),
          ),
        ).rejects.toThrow(
          `${operation === 'create' ? 102 : 101} operations exceed the Cosmos transactional batch limit of 100 operations.`,
        )
        expect(memory.batch).not.toHaveBeenCalled()
        expect(memory.snapshot()).toEqual(before)
      },
    )

    it.each(['update', 'delete', 'replace'] as const)(
      'rejects stale %s preconditions before building any batch',
      async (operation) => {
        const original = awardData()
        const memory = await memoryDataset(original)
        const before = memory.snapshot()
        const body =
          operation === 'replace'
            ? { operation, data: original, etags: { 'challenge-1': 'stale' } }
            : { operation, type: 'challenge', id: 'challenge-1', entity: original.challenges[0], ifMatch: 'stale' }
        expect(
          await journey(
            request('production', operation === 'update' ? 'PUT' : operation === 'delete' ? 'DELETE' : 'POST', body),
            context(),
          ),
        ).toEqual({
          status: 409,
          jsonBody: { error: 'conflict' },
        })
        expect(memory.batch).not.toHaveBeenCalled()
        expect(memory.snapshot()).toEqual(before)
      },
    )

    it.each([
      ['disable', 'activity'],
      ['disable', 'structural'],
      ['delete', 'activity'],
      ['delete', 'structural'],
    ] as const)('atomically resolves new awarded Activity racing with %s (%s wins)', async (operation, winner) => {
      const original = awardData(false)
      const memory = await memoryDataset(original)
      const { etags } = await memory.loaded()
      type Result = ReturnType<typeof memory.commit>
      const pending: { operations: BatchOperation[]; resolve: (value: Result) => void }[] = []
      let bothSubmitted!: () => void
      const submitted = new Promise<void>((resolve) => {
        bothSubmitted = resolve
      })
      memory.batch.mockImplementation(
        (operations) =>
          new Promise<Result>((resolve) => {
            pending.push({ operations, resolve })
            if (pending.length === 2) bothSubmitted()
          }),
      )
      const activityRequest = journey(
        request('production', 'POST', {
          operation: 'create',
          type: 'activity',
          entity: awardData().activities[0],
        }),
        context(),
      )
      const structuralRequest = journey(
        request('production', operation === 'delete' ? 'DELETE' : 'PUT', {
          operation: operation === 'delete' ? 'delete' : 'update',
          type: 'challenge',
          id: 'challenge-1',
          ifMatch: etags['challenge-1'],
          entity: { ...original.challenges[0]!, supportsActivityCategories: false, awardDescriptions: undefined },
        }),
        context(),
      )
      await submitted
      const activityIndex = pending.findIndex(({ operations }) =>
        operations.some((op) => op.resourceBody?.type === 'activity'),
      )
      const winningIndex = winner === 'activity' ? activityIndex : 1 - activityIndex
      const losingIndex = 1 - winningIndex
      pending[winningIndex]!.resolve(memory.commit(pending[winningIndex]!.operations))
      pending[losingIndex]!.resolve(memory.commit(pending[losingIndex]!.operations))
      const [created, structural] = await Promise.all([activityRequest, structuralRequest])
      expect(winner === 'activity' ? created.status : structural.status).toBe(
        winner === 'activity' ? 201 : operation === 'delete' ? 204 : 200,
      )
      expect(winner === 'activity' ? structural : created).toEqual({ status: 409, jsonBody: { error: 'conflict' } })
      const saved = await memory.loaded()
      expect(saved.data.activities).toHaveLength(winner === 'activity' ? 1 : 0)
      expect(saved.data.challenges.some((challenge) => challenge.supportsActivityCategories)).toBe(
        winner === 'activity',
      )
      expect(memory.batch).toHaveBeenCalledTimes(2)
    })
  })
})
