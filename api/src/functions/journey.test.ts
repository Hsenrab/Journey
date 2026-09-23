import { beforeEach, describe, expect, it, vi } from 'vitest'
import type { InvocationContext } from '@azure/functions'

const loadDataset = vi.fn()
const journeyContainer = vi.fn()
const createDocument = vi.fn()
const deleteEntity = vi.fn()
const replaceDataset = vi.fn()
const replaceDocument = vi.fn()

vi.mock('../lib/cosmos.js', async () => {
  const actual = await vi.importActual<typeof import('../lib/cosmos.js')>('../lib/cosmos.js')
  return {
    datasetIdFor: (container: string) => container,
    journeyContainer,
    loadDataset,
    createDocument,
    deleteEntity,
    documentFor: actual.documentFor,
    documentsFor: actual.documentsFor,
    emptyJourneyData: actual.emptyJourneyData,
    replaceDataset,
    replaceDocument,
    savedDocument: (response: { resource?: { entity?: unknown }; headers?: { etag?: string } }) => ({
      entity: response.resource?.entity,
      etag: response.headers?.etag,
    }),
  }
})

vi.mock('@azure/identity', () => ({ DefaultAzureCredential: vi.fn() }))

function encodePrincipal(principal: Record<string, unknown>): string {
  return Buffer.from(JSON.stringify(principal)).toString('base64')
}

function principal(role: 'viewer' | 'editor' | 'owner', userId = `${role}-user`) {
  return encodePrincipal({
    identityProvider: 'aad',
    userId,
    userDetails: `${userId}@example.com`,
    userRoles: ['authenticated', role],
  })
}

function request(
  container: string,
  { method = 'GET', body, header = principal('owner') }: { method?: string; body?: unknown; header?: string } = {},
) {
  return {
    method,
    params: { container },
    json: async () => body,
    headers: { get: (name: string) => (name === 'x-ms-client-principal' ? header : null) },
  } as never
}

const context = () => ({ error: vi.fn() }) as never

const emptyData = {
  waypoints: [],
  challenges: [],
  ideas: [],
  activities: [],
  references: [],
  photoReferences: [],
}

const ownedActivity = {
  activityId: 'activity-1',
  ownerId: 'editor-user',
  ideaIds: [],
  date: '2026-08-02',
  location: { kind: 'coordinates', latitude: 51.844, longitude: -2.153 },
  notes: '',
  referenceIds: [],
  photoReferenceIds: [],
  createdAt: '2026-08-02T00:00:00.000Z',
  updatedAt: '2026-08-02T00:00:00.000Z',
}

const otherOwnedActivity = { ...ownedActivity, ownerId: 'other-user', activityId: 'activity-2' }

const ownedIdea = {
  ideaId: 'idea-1',
  ownerId: 'editor-user',
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
    replaceDataset.mockReset()
    replaceDocument.mockReset()
    journeyContainer.mockReturnValue({})
  })

  it('allows viewers to read the dataset', async () => {
    loadDataset.mockResolvedValue({ data: emptyData, etags: {} })
    const { journey } = await import('./journey.js')

    await expect(
      journey(request('production', { header: principal('viewer', 'viewer-user') }), context() as InvocationContext),
    ).resolves.toMatchObject({ status: 200, jsonBody: { datasetId: 'production' } })
  })

  it('forbids viewer mutations', async () => {
    const { journey } = await import('./journey.js')
    const header = principal('viewer', 'viewer-user')

    const mutationBodies = [
      { method: 'POST', body: { operation: 'create', type: 'activity', entity: ownedActivity } },
      {
        method: 'PUT',
        body: {
          operation: 'update',
          type: 'activity',
          id: ownedActivity.activityId,
          entity: ownedActivity,
          ifMatch: 'etag',
        },
      },
      {
        method: 'DELETE',
        body: { operation: 'delete', type: 'activity', id: ownedActivity.activityId, ifMatch: 'etag' },
      },
      { method: 'POST', body: { operation: 'clear' } },
      { method: 'POST', body: { operation: 'import', data: emptyData } },
      { method: 'POST', body: { operation: 'replace', data: emptyData, etags: {} } },
    ] as const

    for (const mutation of mutationBodies) {
      expect(await journey(request('production', { ...mutation, header }), context() as InvocationContext)).toEqual({
        status: 403,
        jsonBody: { error: 'forbidden' },
      })
    }
  })

  it('stamps ownerId from the editor principal on create', async () => {
    loadDataset.mockResolvedValue({ data: emptyData, etags: {} })
    createDocument.mockImplementation(async (_container, document) => ({
      resource: { entity: document.entity },
      headers: { etag: 'created-etag' },
    }))
    const { journey } = await import('./journey.js')

    const result = await journey(
      request('production', {
        method: 'POST',
        header: principal('editor', 'editor-user'),
        body: {
          operation: 'create',
          type: 'activity',
          entity: { ...ownedActivity, ownerId: 'malicious-user' },
        },
      }),
      context() as InvocationContext,
    )

    expect(result).toEqual({
      status: 201,
      jsonBody: { entity: { ...ownedActivity, ownerId: 'editor-user' }, etag: 'created-etag' },
    })
    expect(createDocument).toHaveBeenCalledWith(
      {},
      expect.objectContaining({ entity: expect.objectContaining({ ownerId: 'editor-user' }) }),
    )
  })

  it('allows an editor to update and delete their own entity', async () => {
    loadDataset.mockResolvedValue({
      data: { ...emptyData, activities: [ownedActivity] },
      etags: { [ownedActivity.activityId]: 'etag-1' },
    })
    replaceDocument.mockImplementation(async (_container, document) => ({
      resource: { entity: document.entity },
      headers: { etag: 'etag-2' },
    }))
    const { journey } = await import('./journey.js')

    const updated = { ...ownedActivity, notes: 'Updated' }
    expect(
      await journey(
        request('production', {
          method: 'PUT',
          header: principal('editor', 'editor-user'),
          body: {
            operation: 'update',
            type: 'activity',
            id: ownedActivity.activityId,
            entity: updated,
            ifMatch: 'etag-1',
          },
        }),
        context() as InvocationContext,
      ),
    ).toEqual({ status: 200, jsonBody: { entity: updated, etag: 'etag-2' } })

    expect(
      await journey(
        request('production', {
          method: 'DELETE',
          header: principal('editor', 'editor-user'),
          body: { operation: 'delete', type: 'activity', id: ownedActivity.activityId, ifMatch: 'etag-1' },
        }),
        context() as InvocationContext,
      ),
    ).toEqual({ status: 204 })
    expect(deleteEntity).toHaveBeenCalledWith(
      {},
      'production',
      'activity',
      ownedActivity.activityId,
      'etag-1',
      expect.objectContaining({ data: expect.objectContaining({ activities: [ownedActivity] }) }),
    )
  })

  it('forbids an editor from updating or deleting another user’s entity', async () => {
    loadDataset.mockResolvedValue({
      data: { ...emptyData, activities: [otherOwnedActivity] },
      etags: { [otherOwnedActivity.activityId]: 'etag-1' },
    })
    const { journey } = await import('./journey.js')
    const header = principal('editor', 'editor-user')

    expect(
      await journey(
        request('production', {
          method: 'PUT',
          header,
          body: {
            operation: 'update',
            type: 'activity',
            id: otherOwnedActivity.activityId,
            entity: { ...otherOwnedActivity, notes: 'Blocked' },
            ifMatch: 'etag-1',
          },
        }),
        context() as InvocationContext,
      ),
    ).toEqual({ status: 403, jsonBody: { error: 'forbidden' } })

    expect(
      await journey(
        request('production', {
          method: 'DELETE',
          header,
          body: { operation: 'delete', type: 'activity', id: otherOwnedActivity.activityId, ifMatch: 'etag-1' },
        }),
        context() as InvocationContext,
      ),
    ).toEqual({ status: 403, jsonBody: { error: 'forbidden' } })
  })

  it('forbids editor clear, import, and replace', async () => {
    const { journey } = await import('./journey.js')
    const header = principal('editor', 'editor-user')

    expect(
      await journey(request('production', { method: 'POST', header, body: { operation: 'clear' } }), context()),
    ).toEqual({ status: 403, jsonBody: { error: 'forbidden' } })
    expect(
      await journey(
        request('production', { method: 'POST', header, body: { operation: 'import', data: emptyData } }),
        context(),
      ),
    ).toEqual({ status: 403, jsonBody: { error: 'forbidden' } })
    expect(
      await journey(
        request('production', { method: 'POST', header, body: { operation: 'replace', data: emptyData, etags: {} } }),
        context(),
      ),
    ).toEqual({ status: 403, jsonBody: { error: 'forbidden' } })
  })

  it('allows the owner to update or delete any entity', async () => {
    loadDataset.mockResolvedValue({
      data: { ...emptyData, activities: [otherOwnedActivity] },
      etags: { [otherOwnedActivity.activityId]: 'etag-1' },
    })
    replaceDocument.mockImplementation(async (_container, document) => ({
      resource: { entity: document.entity },
      headers: { etag: 'etag-2' },
    }))
    const { journey } = await import('./journey.js')

    expect(
      await journey(
        request('production', {
          method: 'PUT',
          header: principal('owner', 'owner-user'),
          body: {
            operation: 'update',
            type: 'activity',
            id: otherOwnedActivity.activityId,
            entity: { ...otherOwnedActivity, notes: 'Owner update' },
            ifMatch: 'etag-1',
          },
        }),
        context() as InvocationContext,
      ),
    ).toMatchObject({ status: 200 })

    expect(
      await journey(
        request('production', {
          method: 'DELETE',
          header: principal('owner', 'owner-user'),
          body: { operation: 'delete', type: 'activity', id: otherOwnedActivity.activityId, ifMatch: 'etag-1' },
        }),
        context() as InvocationContext,
      ),
    ).toEqual({ status: 204 })
  })

  it('preserves the stored ownerId on update even when the client supplies a different one', async () => {
    loadDataset.mockResolvedValue({
      data: { ...emptyData, ideas: [ownedIdea] },
      etags: { [ownedIdea.ideaId]: 'etag-idea' },
    })
    replaceDocument.mockImplementation(async (_container, document) => ({
      resource: { entity: document.entity },
      headers: { etag: 'etag-next' },
    }))
    const { journey } = await import('./journey.js')

    const result = await journey(
      request('production', {
        method: 'PUT',
        header: principal('editor', 'editor-user'),
        body: {
          operation: 'update',
          type: 'idea',
          id: ownedIdea.ideaId,
          entity: { ...ownedIdea, ownerId: 'other-user', notes: 'Updated notes' },
          ifMatch: 'etag-idea',
        },
      }),
      context() as InvocationContext,
    )

    expect(result).toEqual({
      status: 200,
      jsonBody: { entity: { ...ownedIdea, notes: 'Updated notes' }, etag: 'etag-next' },
    })
    expect(replaceDocument).toHaveBeenCalledWith(
      {},
      expect.objectContaining({ entity: expect.objectContaining({ ownerId: 'editor-user', notes: 'Updated notes' }) }),
      'etag-idea',
    )
  })

  it('preserves stored ownerIds during owner replacement', async () => {
    loadDataset.mockResolvedValue({
      data: { ...emptyData, activities: [otherOwnedActivity] },
      etags: { [otherOwnedActivity.activityId]: 'etag-1' },
    })
    const { journey } = await import('./journey.js')

    await expect(
      journey(
        request('production', {
          method: 'POST',
          body: {
            operation: 'replace',
            data: { ...emptyData, activities: [{ ...otherOwnedActivity, ownerId: 'malicious-user' }] },
            etags: { [otherOwnedActivity.activityId]: 'etag-1' },
          },
        }),
        context() as InvocationContext,
      ),
    ).resolves.toMatchObject({ status: 200 })

    expect(replaceDataset).toHaveBeenCalledWith(
      {},
      'production',
      expect.objectContaining({
        [otherOwnedActivity.activityId]: expect.objectContaining({
          entity: expect.objectContaining({ ownerId: 'other-user' }),
        }),
      }),
      { [otherOwnedActivity.activityId]: 'etag-1' },
    )
  })

  it('rejects updates whose request and entity identifiers differ', async () => {
    loadDataset.mockResolvedValue({
      data: { ...emptyData, activities: [ownedActivity, otherOwnedActivity] },
      etags: { [ownedActivity.activityId]: 'etag-1', [otherOwnedActivity.activityId]: 'etag-2' },
    })
    const { journey } = await import('./journey.js')

    await expect(
      journey(
        request('production', {
          method: 'PUT',
          header: principal('editor', 'editor-user'),
          body: {
            operation: 'update',
            type: 'activity',
            id: ownedActivity.activityId,
            entity: { ...otherOwnedActivity, notes: 'Attempted overwrite' },
            ifMatch: 'etag-2',
          },
        }),
        context() as InvocationContext,
      ),
    ).resolves.toEqual({ status: 400, jsonBody: { error: 'invalid_entity_id' } })
    expect(replaceDocument).not.toHaveBeenCalled()
  })

  it('returns 404 when updating or deleting an entity that does not exist', async () => {
    loadDataset.mockResolvedValue({ data: emptyData, etags: {} })
    const { journey } = await import('./journey.js')
    const header = principal('owner', 'owner-user')

    expect(
      await journey(
        request('production', {
          method: 'PUT',
          header,
          body: {
            operation: 'update',
            type: 'activity',
            id: 'missing-activity',
            entity: { ...ownedActivity, activityId: 'missing-activity' },
            ifMatch: 'etag-1',
          },
        }),
        context() as InvocationContext,
      ),
    ).toEqual({ status: 404, jsonBody: { error: 'not_found' } })

    expect(
      await journey(
        request('production', {
          method: 'DELETE',
          header,
          body: { operation: 'delete', type: 'activity', id: 'missing-activity', ifMatch: 'etag-1' },
        }),
        context() as InvocationContext,
      ),
    ).toEqual({ status: 404, jsonBody: { error: 'not_found' } })

    expect(replaceDocument).not.toHaveBeenCalled()
    expect(deleteEntity).not.toHaveBeenCalled()
  })
})
