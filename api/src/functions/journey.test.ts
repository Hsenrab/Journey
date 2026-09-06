import { beforeEach, describe, expect, it, vi } from 'vitest'
import type { InvocationContext } from '@azure/functions'

const loadDataset = vi.fn()
const journeyContainer = vi.fn()
const createDocument = vi.fn()
const deleteEntity = vi.fn()

vi.mock('../lib/cosmos.js', async () => {
  const actual = await vi.importActual<typeof import('../lib/cosmos.js')>('../lib/cosmos.js')
  return {
    datasetIdFor: (container: string) => container,
    journeyContainer,
    loadDataset,
    createDocument,
    deleteEntity,
    documentFor: actual.documentFor,
    documentsFor: vi.fn(),
    emptyJourneyData: vi.fn(),
    replaceDocument: vi.fn(),
    replaceDataset: vi.fn(),
    savedDocument: vi.fn(),
  }
})

vi.mock('@azure/identity', () => ({ DefaultAzureCredential: vi.fn() }))
vi.mock('../lib/mapsAuth.js', () => ({
  acquireMapsAccessToken: vi.fn().mockResolvedValue({ token: 'entra-token', expiresOn: '2026-01-01T00:00:00.000Z' }),
}))

const principal = Buffer.from(
  JSON.stringify({ identityProvider: 'aad', userId: 'owner', userDetails: 'owner@example.com', userRoles: ['owner'] }),
).toString('base64')

function request(container: string, method = 'GET', body?: unknown) {
  return {
    method,
    params: { container },
    json: async () => body,
    headers: { get: (name: string) => (name === 'x-ms-client-principal' ? principal : null) },
  } as never
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
    journeyContainer.mockReturnValue({})
    process.env.AZURE_MAPS_CLIENT_ID = 'maps-client-id'
    searchResults([{ position: { lat: 51.844, lon: -2.153 } }])
  })

  it('uses the route container for a production read', async () => {
    const container = {}
    journeyContainer.mockReturnValue(container)
    loadDataset.mockResolvedValue({ data: { activities: [] }, etags: {} })
    const { journey } = await import('./journey.js')

    expect(await journey(request('production'), { error: vi.fn() } as unknown as InvocationContext)).toMatchObject({
      status: 200,
      jsonBody: { datasetId: 'production' },
    })
    expect(journeyContainer).toHaveBeenCalledWith('production')
    expect(loadDataset).toHaveBeenCalledWith(container, 'production')
  })

  it('rejects unsupported route containers', async () => {
    const { journey } = await import('./journey.js')
    await expect(journey(request('test'), { error: vi.fn() } as unknown as InvocationContext)).rejects.toThrow(
      'Unsupported Journey container "test".',
    )
    await expect(journey(request('unknown'), { error: vi.fn() } as unknown as InvocationContext)).rejects.toThrow(
      'Unsupported Journey container "unknown".',
    )
  })

  it('rejects a create that references an unknown idea', async () => {
    loadDataset.mockResolvedValue({ data: emptyData, etags: {} })
    const { journey } = await import('./journey.js')

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
    const { journey } = await import('./journey.js')

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

  it('geocodes a postcode-only activity before it is persisted', async () => {
    loadDataset.mockResolvedValue({ data: emptyData, etags: {} })
    createDocument.mockResolvedValue({ resource: {}, headers: {} })
    const { journey } = await import('./journey.js')

    const result = await journey(
      request('production', 'POST', { operation: 'create', type: 'activity', entity: { ...activity, ideaIds: [] } }),
      context(),
    )

    expect(result).toMatchObject({ status: 201 })
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

  it('geocodes a place-only waypoint before it is persisted', async () => {
    loadDataset.mockResolvedValue({ data: emptyData, etags: {} })
    createDocument.mockResolvedValue({ resource: {}, headers: {} })
    const { journey } = await import('./journey.js')

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
    const { journey } = await import('./journey.js')

    expect(
      await journey(
        request('production', 'POST', { operation: 'create', type: 'activity', entity: { ...activity, ideaIds: [] } }),
        context(),
      ),
    ).toEqual({ status: 400, jsonBody: { error: 'Azure Maps found no coordinates for "GL3 4AQ".' } })
    expect(createDocument).not.toHaveBeenCalled()
  })

  it('deletes an idea transactionally and returns ETag conflicts explicitly', async () => {
    const loaded = { data: { ...emptyData, ideas: [idea], activities: [activity] }, etags: { 'idea-1': 'etag' } }
    loadDataset.mockResolvedValue(loaded)
    const { journey } = await import('./journey.js')
    const deleteRequest = request('production', 'DELETE', {
      operation: 'delete',
      type: 'idea',
      id: 'idea-1',
      ifMatch: 'etag',
    })

    expect(await journey(deleteRequest, context())).toEqual({ status: 204 })
    expect(deleteEntity).toHaveBeenCalledWith({}, 'production', 'idea', 'idea-1', 'etag', loaded)

    deleteEntity.mockRejectedValueOnce(Object.assign(new Error('conflict'), { code: 412 }))
    expect(await journey(deleteRequest, context())).toEqual({ status: 409, jsonBody: { error: 'conflict' } })
  })
})
