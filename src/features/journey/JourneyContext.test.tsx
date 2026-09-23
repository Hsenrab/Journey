import { act, renderHook, waitFor } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { WaypointsProvider, useWaypoints } from './JourneyContext'
import { createDefaultData, createDemoModeData, load, save, setDataMode } from '../../services/storage'
import { createActivity, createIdea } from '../../domain/visit'
import type { WaypointsData } from '../../domain/visit'
import type { JourneyRole } from '../../services/principal'

const lacockId = 'lacock-abbey-fox-talbot-museum-and-village'

const draft = {
  name: 'Abbey visit',
  waypointId: lacockId,
  ideaIds: [],
  date: '2026-08-01',
  category: 'silver' as const,
  location: { kind: 'postcode' as const, postcode: 'SN15 2LG' },
  notes: 'Great day',
  references: [{ title: 'Official page', url: 'https://example.com/ref' }],
  photoReferences: [{ title: 'Front gate', url: 'https://example.com/photo.jpg' }],
}

const entityCollections = {
  waypoint: 'waypoints',
  challenge: 'challenges',
  idea: 'ideas',
  activity: 'activities',
  reference: 'references',
  photoReference: 'photoReferences',
} as const

type MutableCollection = typeof entityCollections
type EntityType = keyof MutableCollection

function entityIdValue(entity: Record<string, unknown>) {
  return [
    entity.waypointId,
    entity.challengeId,
    entity.ideaId,
    entity.activityId,
    entity.referenceId,
    entity.photoReferenceId,
  ]
}

function etagsFor(data: WaypointsData): Record<string, string> {
  return {
    ...Object.fromEntries(data.waypoints.map((entity) => [entity.waypointId, `etag-${entity.waypointId}`])),
    ...Object.fromEntries(data.challenges.map((entity) => [entity.challengeId, `etag-${entity.challengeId}`])),
    ...Object.fromEntries(data.ideas.map((entity) => [entity.ideaId, `etag-${entity.ideaId}`])),
    ...Object.fromEntries(data.activities.map((entity) => [entity.activityId, `etag-${entity.activityId}`])),
    ...Object.fromEntries(data.references.map((entity) => [entity.referenceId, `etag-${entity.referenceId}`])),
    ...Object.fromEntries(
      data.photoReferences.map((entity) => [entity.photoReferenceId, `etag-${entity.photoReferenceId}`]),
    ),
  }
}

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), { status, headers: { 'content-type': 'application/json' } })
}

function emptyData(): WaypointsData {
  return {
    waypoints: [],
    challenges: [],
    ideas: [],
    activities: [],
    references: [],
    photoReferences: [],
  }
}

function setEntity(state: WaypointsData, type: EntityType, entity: Record<string, unknown>, id: string) {
  const collection = entityCollections[type]
  const current = state[collection] as Array<Record<string, unknown>>
  const index = current.findIndex((item) => entityIdValue(item).includes(id))
  if (index === -1) (state[collection] as Array<Record<string, unknown>>).push(entity)
  else (state[collection] as Array<Record<string, unknown>>)[index] = entity
}

function deleteEntity(state: WaypointsData, type: EntityType, id: string) {
  const collection = entityCollections[type]
  ;(state as Record<string, unknown[]>)[collection] = (state[collection] as Array<Record<string, unknown>>).filter(
    (item) => !entityIdValue(item).includes(id),
  )
}

function stubJourneyApi({
  role,
  userId = 'editor-1',
  data = createDefaultData(),
}: {
  role: JourneyRole | null
  userId?: string
  data?: WaypointsData
}) {
  let state = structuredClone(data)
  const mutations: Array<{ method: string; body: Record<string, unknown> }> = []
  const fetch = vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
    const url = String(input)
    if (url === '/.auth/me') {
      return json({
        clientPrincipal: role ? { identityProvider: 'aad', userId, userDetails: userId, userRoles: [role] } : null,
      })
    }

    if (url !== '/api/journey/production') return new Response(null, { status: 404, statusText: 'Not Found' })
    if (!init?.method || init.method === 'GET') return json({ data: state, etags: etagsFor(state) })

    const body = JSON.parse(String(init.body)) as Record<string, unknown>
    mutations.push({ method: init.method, body })

    switch (body.operation) {
      case 'create':
        setEntity(
          state,
          body.type as EntityType,
          body.entity as Record<string, unknown>,
          String(
            body.type === 'waypoint'
              ? (body.entity as Record<string, unknown>).waypointId
              : body.type === 'challenge'
                ? (body.entity as Record<string, unknown>).challengeId
                : body.type === 'idea'
                  ? (body.entity as Record<string, unknown>).ideaId
                  : body.type === 'activity'
                    ? (body.entity as Record<string, unknown>).activityId
                    : body.type === 'reference'
                      ? (body.entity as Record<string, unknown>).referenceId
                      : (body.entity as Record<string, unknown>).photoReferenceId,
          ),
        )
        return json({ etag: 'created' })
      case 'update':
        setEntity(state, body.type as EntityType, body.entity as Record<string, unknown>, String(body.id))
        return json({ etag: 'updated' })
      case 'delete':
        deleteEntity(state, body.type as EntityType, String(body.id))
        return new Response(null, { status: 204 })
      case 'replace':
      case 'replaceOwned':
        state = structuredClone(body.data as WaypointsData)
        return json({ data: state, etags: etagsFor(state) })
      case 'clear':
        state = emptyData()
        return json({ data: state, etags: {} })
      case 'import':
        state = structuredClone(body.data as WaypointsData)
        return json({ data: state, etags: etagsFor(state) })
      default:
        throw new Error(`Unexpected operation: ${String(body.operation)}`)
    }
  })
  vi.stubGlobal('fetch', fetch)
  return { fetch, mutations }
}

async function renderProductionWaypoints(options: { role: JourneyRole | null; userId?: string; data?: WaypointsData }) {
  setDataMode('production')
  const server = stubJourneyApi(options)
  const hook = renderHook(() => useWaypoints(), { wrapper: WaypointsProvider })
  await waitFor(() => expect(hook.result.current.activeDataMode).toBe('production'))
  await waitFor(() => expect(hook.result.current.principal?.role ?? null).toBe(options.role))
  await waitFor(() => expect(hook.result.current.readOnly).toBe(options.role === null || options.role === 'viewer'))
  return { ...server, ...hook }
}

describe('WaypointsContext', () => {
  beforeEach(() => localStorage.clear())

  it('saves an activity and persists it to localStorage', () => {
    const { result } = renderHook(() => useWaypoints(), { wrapper: WaypointsProvider })

    act(() => {
      result.current.addActivity(draft)
    })

    expect(result.current.statusFor(lacockId)).toBe('silver')
    expect(load().activities).toContainEqual(
      expect.objectContaining({ name: 'Abbey visit', waypointId: lacockId, category: 'silver' }),
    )
  })

  it('adds a waypoint with its references and challenge links', () => {
    const { result } = renderHook(() => useWaypoints(), { wrapper: WaypointsProvider })

    act(() => {
      result.current.addWaypoint({
        title: 'New viewpoint',
        description: 'A quiet viewpoint',
        category: 'Scenic',
        tags: ['sunrise'],
        challengeIds: ['national-trust'],
        completion: { mode: 'count', target: 2 },
        location: { placeName: 'Brockworth' },
        references: [{ title: 'Guide', url: 'https://example.com/guide' }],
        photoReferences: [{ title: 'Photo', url: 'https://example.com/photo.jpg' }],
      })
    })

    const waypoint = result.current.data.waypoints.find((item) => item.title === 'New viewpoint')
    expect(waypoint).toEqual(
      expect.objectContaining({
        challengeIds: ['national-trust'],
        completion: { mode: 'count', target: 2 },
        referenceIds: [expect.any(String)],
        photoReferenceIds: [expect.any(String)],
      }),
    )
    expect(
      result.current.data.challenges.find((challenge) => challenge.challengeId === 'national-trust')?.waypointIds,
    ).toContain(waypoint?.waypointId)
  })

  it('updates and deletes while preserving cleanup of unreferenced records', () => {
    const { result } = renderHook(() => useWaypoints(), { wrapper: WaypointsProvider })

    act(() => {
      result.current.addActivity(draft)
    })

    const created = result.current.data.activities[0]!

    act(() => {
      result.current.updateActivity(created.activityId, {
        ...draft,
        category: 'gold',
        references: [{ title: 'Updated', url: 'https://example.com/new-ref' }],
        photoReferences: [],
      })
    })

    expect(result.current.data.activities[0]?.activityId).toBe(created.activityId)
    expect(result.current.data.activities[0]?.name).toBe('Abbey visit')
    expect(result.current.data.activities[0]?.createdAt).toBe(created.createdAt)
    expect(result.current.data.activities[0]?.updatedAt).not.toBe(created.updatedAt)
    expect(result.current.data.photoReferences).toEqual([])

    act(() => {
      result.current.deleteActivity(created.activityId)
    })

    expect(result.current.data.activities).toEqual([])
    expect(result.current.data.references.some((reference) => reference.title === 'Updated')).toBe(false)
  })

  it('throws when used outside of a provider', () => {
    expect(() => renderHook(() => useWaypoints())).toThrow('useWaypoints must be used inside WaypointsProvider')
  })

  it('adds, updates and deletes ideas while detaching activity links', () => {
    const { result } = renderHook(() => useWaypoints(), { wrapper: WaypointsProvider })

    act(() => {
      result.current.addIdea({
        title: 'Try a new walking route',
        description: '',
        notes: '',
        waypointIds: [lacockId],
        planningState: 'active',
        difficulty: 2,
        references: [{ title: 'Guide', url: 'https://example.com/guide' }],
      })
    })

    const idea = result.current.data.ideas[0]
    if (!idea) throw new Error('Idea should exist')

    act(() => {
      result.current.addActivity({
        ...draft,
        ideaIds: [idea.ideaId],
      })
    })

    act(() => {
      result.current.updateIdea(idea.ideaId, {
        title: 'Try a new route soon',
        description: 'Updated',
        notes: '',
        waypointIds: [],
        planningState: 'rejected',
        rejectionReason: 'Too expensive',
        difficulty: 3,
        references: [],
      })
    })

    expect(result.current.data.ideas[0]?.planningState).toBe('rejected')

    act(() => {
      result.current.deleteIdea(idea.ideaId)
    })

    expect(result.current.data.ideas).toEqual([])
    expect(result.current.data.activities[0]?.ideaIds).toEqual([])
  })

  it('reloads persisted data and restores an explicit dataset', async () => {
    const { result } = renderHook(() => useWaypoints(), { wrapper: WaypointsProvider })
    const replacement = createDefaultData()
    replacement.activities = []
    save(replacement)

    await act(async () => {
      await result.current.reload()
    })
    expect(result.current.data.waypoints).toHaveLength(replacement.waypoints.length)

    await act(async () => {
      await result.current.restore({ ...replacement, waypoints: [] })
    })
    expect(result.current.data.waypoints).toEqual([])
  })
})

describe('WaypointsContext in production mode', () => {
  const ideaDraft = {
    title: 'Try a new walking route',
    description: '',
    notes: '',
    waypointIds: [lacockId],
    planningState: 'active' as const,
    difficulty: 2 as const,
    references: [],
  }

  beforeEach(() => {
    localStorage.clear()
    vi.stubEnv('MODE', 'production')
  })

  afterEach(() => {
    vi.unstubAllEnvs()
    vi.restoreAllMocks()
  })

  it('routes every mutation through the Journey API instead of localStorage', async () => {
    const seeded = createDefaultData()
    const activity = createActivity({
      ownerId: 'owner-1',
      waypointId: lacockId,
      ideaIds: [],
      date: '2026-08-01',
      location: draft.location,
      notes: '',
    })
    const idea = createIdea({
      ownerId: 'owner-1',
      title: 'Existing idea',
      description: '',
      notes: '',
      waypointIds: [lacockId],
      planningState: 'active',
      difficulty: 1,
    })
    seeded.activities = [activity]
    seeded.ideas = [idea]
    const fetch = vi.fn(
      (input: RequestInfo | URL) =>
        new Response(
          JSON.stringify(
            String(input) === '/.auth/me'
              ? {
                  clientPrincipal: {
                    identityProvider: 'aad',
                    userId: 'owner-1',
                    userDetails: 'owner-1',
                    userRoles: ['owner'],
                  },
                }
              : { data: seeded, etags: {} },
          ),
          { status: 200 },
        ),
    )
    vi.stubGlobal('fetch', fetch)

    const { result } = renderHook(() => useWaypoints(), { wrapper: WaypointsProvider })
    await waitFor(() => expect(result.current.data.activities).toHaveLength(1))
    expect(fetch).toHaveBeenCalledWith('/api/journey/production', expect.anything())

    await act(async () => {
      await result.current.addActivity(draft)
    })
    await act(async () => {
      await result.current.updateActivity(activity.activityId, draft)
    })
    await act(async () => {
      await result.current.deleteActivity(activity.activityId)
    })
    await act(async () => {
      await result.current.addIdea(ideaDraft)
    })
    await act(async () => {
      await result.current.updateIdea(idea.ideaId, ideaDraft)
    })
    await act(async () => {
      await result.current.deleteIdea(idea.ideaId)
    })
    await act(async () => {
      await result.current.restore(seeded)
    })
    await act(async () => {
      await result.current.clear()
    })

    expect(fetch).toHaveBeenCalledTimes(10)
  })

  it('refuses to mutate local demo data', async () => {
    setDataMode('demo-local')

    const { result } = renderHook(() => useWaypoints(), { wrapper: WaypointsProvider })
    await waitFor(() => expect(result.current.data).toEqual(createDemoModeData()))

    await expect(result.current.addActivity(draft)).rejects.toThrow('Demo local data is read-only.')
    expect(result.current.data).toEqual(createDemoModeData())
  })

  it('loads Demo Cosmos and routes mutations to the demo container', async () => {
    setDataMode('demo-cosmos')
    const seeded = createDefaultData()
    const fetch = vi.fn(
      (input: RequestInfo | URL) =>
        new Response(
          JSON.stringify(
            String(input) === '/.auth/me'
              ? {
                  clientPrincipal: {
                    identityProvider: 'aad',
                    userId: 'owner-1',
                    userDetails: 'owner-1',
                    userRoles: ['owner'],
                  },
                }
              : { data: seeded, etags: {} },
          ),
          { status: 200 },
        ),
    )
    vi.stubGlobal('fetch', fetch)

    const { result } = renderHook(() => useWaypoints(), { wrapper: WaypointsProvider })
    await waitFor(() => {
      expect(result.current.activeDataMode).toBe('demo-cosmos')
      expect(result.current.data.waypoints).toHaveLength(seeded.waypoints.length)
    })

    await act(async () => {
      await result.current.addActivity(draft)
    })

    expect(fetch).toHaveBeenCalledWith('/api/journey/demo', expect.anything())
    expect(fetch).toHaveBeenLastCalledWith('/api/journey/demo', expect.objectContaining({ method: 'POST' }))
  })

  it('falls back to read-only local demo data when Demo Cosmos cannot be loaded', async () => {
    setDataMode('demo-cosmos')
    vi.stubGlobal('fetch', vi.fn().mockRejectedValue(new Error('Cosmos unavailable')))

    const { result } = renderHook(() => useWaypoints(), { wrapper: WaypointsProvider })
    await waitFor(() => expect(result.current.activeDataMode).toBe('demo-local'))

    expect(result.current.data).toEqual(createDemoModeData())
    expect(result.current.readOnly).toBe(true)
    expect(result.current.loadError).toContain('Demo Cosmos could not be loaded')
    await expect(result.current.addActivity(draft)).rejects.toThrow('Demo local data is read-only.')
  })

  it('blocks mutations while a mode load is in flight and ignores the stale response', async () => {
    setDataMode('demo-cosmos')
    const resolvers: ((response: Response) => void)[] = []
    const fetch = vi.fn().mockImplementation(() => new Promise<Response>((resolve) => resolvers.push(resolve)))
    vi.stubGlobal('fetch', fetch)

    const { result } = renderHook(() => useWaypoints(), { wrapper: WaypointsProvider })
    await waitFor(() => expect(fetch).toHaveBeenCalledTimes(2))

    expect(result.current.readOnly).toBe(true)
    await expect(result.current.addActivity(draft)).rejects.toThrow('Journey data is still loading')

    await act(async () => {
      await result.current.setDataMode('demo-local')
    })
    await waitFor(() => expect(result.current.activeDataMode).toBe('demo-local'))

    await act(async () => {
      resolvers[0]?.(new Response(JSON.stringify({ data: createDefaultData(), etags: {} }), { status: 200 }))
    })

    expect(result.current.activeDataMode).toBe('demo-local')
    expect(result.current.data).toEqual(createDemoModeData())
  })

  it('does not expose demo data when Production cannot be loaded', async () => {
    setDataMode('production')
    const fetch = vi
      .fn()
      .mockResolvedValue(new Response(JSON.stringify({ error: 'unavailable' }), { status: 500, statusText: 'Broken' }))
    vi.stubGlobal('fetch', fetch)

    const { result } = renderHook(() => useWaypoints(), { wrapper: WaypointsProvider })
    await waitFor(() => expect(result.current.loadError).toContain('Production data could not be loaded'))

    expect(result.current.data).toEqual({
      waypoints: [],
      challenges: [],
      ideas: [],
      activities: [],
      references: [],
      photoReferences: [],
    })
    expect(result.current.readOnly).toBe(true)
    expect(result.current.data).not.toEqual(createDemoModeData())
    await expect(result.current.addActivity(draft)).rejects.toThrow('Production data is not loaded')
  })
})

describe('WaypointsContext editor mutations in production mode', () => {
  beforeEach(() => {
    localStorage.clear()
    vi.stubEnv('MODE', 'production')
  })

  afterEach(() => {
    vi.unstubAllEnvs()
    vi.restoreAllMocks()
  })

  it('reports canMutate for null, viewer, editor and owner principals', async () => {
    const anonymous = await renderProductionWaypoints({ role: null })
    expect(anonymous.result.current.canMutate('owner-1')).toBe(false)
    anonymous.unmount()

    const viewer = await renderProductionWaypoints({ role: 'viewer', userId: 'viewer-1' })
    expect(viewer.result.current.canMutate('viewer-1')).toBe(false)
    viewer.unmount()

    const editor = await renderProductionWaypoints({ role: 'editor', userId: 'editor-1' })
    expect(editor.result.current.canMutate('editor-1')).toBe(true)
    expect(editor.result.current.canMutate('other-owner')).toBe(false)
    editor.unmount()

    const owner = await renderProductionWaypoints({ role: 'owner', userId: 'owner-1' })
    expect(owner.result.current.canMutate('someone-else')).toBe(true)
  })

  it('routes editor mutations through transactional replacement', async () => {
    const { result, mutations } = await renderProductionWaypoints({ role: 'editor', userId: 'editor-1' })

    await act(async () => {
      await result.current.addActivity(draft)
    })

    expect(mutations).toEqual([
      expect.objectContaining({ method: 'POST', body: expect.objectContaining({ operation: 'replaceOwned' }) }),
    ])
  })

  it('fails closed until the principal resolves', async () => {
    const { result } = await renderProductionWaypoints({ role: null })

    expect(result.current.readOnly).toBe(true)
    await expect(result.current.addActivity(draft)).rejects.toThrow('Journey principal is not available')
  })
})
