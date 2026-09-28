import { act, renderHook, waitFor } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { WaypointsProvider, useWaypoints } from './JourneyContext'
import { createDefaultData, createDemoModeData, load, save, setDataMode } from '../../services/storage'
import { createActivity, createIdea } from '../../domain/visit'

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

  it('updates and deletes a waypoint while detaching linked records', () => {
    const { result } = renderHook(() => useWaypoints(), { wrapper: WaypointsProvider })

    act(() => {
      result.current.addIdea({
        title: 'Waypoint idea',
        description: '',
        notes: '',
        waypointIds: [lacockId],
        planningState: 'active',
        difficulty: 2,
        references: [],
      })
    })
    act(() => {
      result.current.addActivity(draft)
    })

    act(() => {
      result.current.updateWaypoint(lacockId, {
        title: 'Updated Lacock',
        description: 'Updated description',
        category: 'Updated category',
        tags: ['updated'],
        challengeIds: ['national-trust'],
        completion: { mode: 'count', target: 2 },
        references: [],
        photoReferences: [],
      })
    })

    expect(result.current.data.waypoints.find((waypoint) => waypoint.waypointId === lacockId)).toEqual(
      expect.objectContaining({
        title: 'Updated Lacock',
        challengeIds: ['national-trust'],
        completion: { mode: 'count', target: 2 },
      }),
    )
    expect(
      result.current.data.challenges.find((challenge) => challenge.challengeId === 'national-trust')?.waypointIds,
    ).toContain(lacockId)

    act(() => {
      result.current.deleteWaypoint(lacockId)
    })

    expect(result.current.data.waypoints.some((waypoint) => waypoint.waypointId === lacockId)).toBe(false)
    expect(result.current.data.activities[0]?.waypointId).toBeUndefined()
    expect(result.current.data.activities[0]?.category).toBeUndefined()
    expect(result.current.data.ideas[0]?.waypointIds).toEqual([])
    expect(result.current.data.challenges.some((challenge) => challenge.waypointIds.includes(lacockId))).toBe(false)
  })

  it('adds, updates and deletes a challenge while keeping waypoint links consistent', async () => {
    const { result } = renderHook(() => useWaypoints(), { wrapper: WaypointsProvider })

    await act(async () => {
      await result.current.addChallenge({
        title: 'Gardens',
        description: 'Garden visits',
        supportsActivityCategories: false,
      })
    })
    const created = result.current.data.challenges.find((challenge) => challenge.title === 'Gardens')!
    expect(created).toEqual(expect.objectContaining({ waypointIds: [], supportsActivityCategories: false }))

    await act(async () => {
      await result.current.updateWaypoint(lacockId, {
        ...result.current.data.waypoints.find((waypoint) => waypoint.waypointId === lacockId)!,
        challengeIds: ['national-trust', created.challengeId],
        references: [],
        photoReferences: [],
      })
    })
    await act(async () => {
      await result.current.updateChallenge(created.challengeId, {
        title: 'Great gardens',
        description: 'Updated',
        supportsActivityCategories: true,
      })
    })
    expect(result.current.data.challenges.find((challenge) => challenge.challengeId === created.challengeId)).toEqual({
      challengeId: created.challengeId,
      title: 'Great gardens',
      description: 'Updated',
      waypointIds: [lacockId],
      supportsActivityCategories: true,
    })

    await act(async () => {
      await result.current.deleteChallenge(created.challengeId)
    })
    expect(result.current.data.challenges.some((challenge) => challenge.challengeId === created.challengeId)).toBe(
      false,
    )
    expect(result.current.data.waypoints.find((waypoint) => waypoint.waypointId === lacockId)?.challengeIds).toEqual([
      'national-trust',
    ])
    expect(load().challenges.map((challenge) => challenge.challengeId)).toEqual(['national-trust'])
  })

  it('rejects turning off categories that activities depend on', async () => {
    const { result } = renderHook(() => useWaypoints(), { wrapper: WaypointsProvider })
    await act(async () => {
      await result.current.addActivity(draft)
    })

    await expect(
      result.current.updateChallenge('national-trust', {
        title: 'National Trust',
        description: 'No categories',
        supportsActivityCategories: false,
      }),
    ).rejects.toThrow('Activity categories cannot be turned off')
    expect(result.current.data.challenges[0]?.supportsActivityCategories).toBe(true)
  })

  it('rejects waypoint updates that invalidate an activity category', async () => {
    const { result } = renderHook(() => useWaypoints(), { wrapper: WaypointsProvider })

    await act(async () => {
      await result.current.addActivity(draft)
    })

    await expect(
      result.current.updateWaypoint(lacockId, {
        ...result.current.data.waypoints.find((waypoint) => waypoint.waypointId === lacockId)!,
        challengeIds: [],
        references: [],
        photoReferences: [],
      }),
    ).rejects.toThrow('Selected waypoint does not support Bronze, Silver or Gold categories.')
    expect(result.current.data.waypoints.find((waypoint) => waypoint.waypointId === lacockId)?.challengeIds).toEqual([
      'national-trust',
    ])
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
      waypointId: lacockId,
      ideaIds: [],
      date: '2026-08-01',
      location: draft.location,
      notes: '',
    })
    const idea = createIdea({
      title: 'Existing idea',
      description: '',
      notes: '',
      waypointIds: [lacockId],
      planningState: 'active',
      difficulty: 1,
    })
    seeded.activities = [activity]
    seeded.ideas = [idea]
    const fetch = vi
      .fn()
      .mockImplementation(
        () => new Response(JSON.stringify({ data: seeded, etags: {}, role: 'admin' }), { status: 200 }),
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

    expect(fetch).toHaveBeenCalledTimes(9)
  })

  it('persists waypoint reference edits, additions, and removals with the waypoint in remote mode', async () => {
    const seeded = createDefaultData()
    const waypoint = seeded.waypoints.find((item) => item.waypointId === lacockId)!
    seeded.waypoints = [waypoint]
    seeded.challenges = seeded.challenges.map((challenge) => ({ ...challenge, waypointIds: [lacockId] }))
    waypoint.referenceIds = ['ref-keep', 'ref-remove']
    waypoint.photoReferenceIds = ['photo-keep', 'photo-remove']
    seeded.references = [
      { referenceId: 'ref-keep', title: 'Old guide', url: 'https://example.com/guide' },
      { referenceId: 'ref-remove', title: 'Remove guide', url: 'https://example.com/removed' },
    ]
    seeded.photoReferences = [
      { photoReferenceId: 'photo-keep', title: 'Old photo', url: 'https://example.com/photo.jpg' },
      { photoReferenceId: 'photo-remove', title: 'Remove photo', url: 'https://example.com/removed.jpg' },
    ]
    const etags = {
      [lacockId]: 'waypoint-etag',
      'ref-keep': 'ref-etag',
      'ref-remove': 'removed-ref-etag',
      'photo-keep': 'photo-etag',
      'photo-remove': 'removed-photo-etag',
    }
    const fetch = vi.fn().mockImplementation((_url: string, init?: RequestInit) => {
      const body = init?.body ? JSON.parse(init.body as string) : undefined
      return new Response(JSON.stringify({ data: body?.data ?? seeded, etags, role: 'admin' }), { status: 200 })
    })
    vi.stubGlobal('fetch', fetch)

    const { result } = renderHook(() => useWaypoints(), { wrapper: WaypointsProvider })
    await waitFor(() => expect(result.current.data.waypoints).toHaveLength(seeded.waypoints.length))

    await act(async () => {
      await result.current.updateWaypoint(lacockId, {
        title: 'Updated Lacock',
        description: waypoint.description,
        category: waypoint.category,
        tags: waypoint.tags,
        challengeIds: waypoint.challengeIds,
        completion: waypoint.completion,
        location: waypoint.location,
        references: [
          { referenceId: 'ref-keep', title: 'Edited guide', url: 'https://example.com/guide' },
          { title: 'New guide', url: 'https://example.com/new-guide' },
        ],
        photoReferences: [
          { photoReferenceId: 'photo-keep', title: 'Edited photo', url: 'https://example.com/photo.jpg' },
          { title: 'New photo', url: 'https://example.com/new-photo.jpg' },
        ],
      })
    })

    const requestBody = JSON.parse(fetch.mock.calls[1]![1].body)
    expect(fetch.mock.calls[1]![1].method).toBe('POST')
    expect(requestBody.operation).toBe('replace')
    expect(requestBody.etags).toEqual(etags)
    expect(requestBody.data.waypoints.find((item: { waypointId: string }) => item.waypointId === lacockId)).toEqual(
      expect.objectContaining({
        title: 'Updated Lacock',
        referenceIds: ['ref-keep', expect.any(String)],
        photoReferenceIds: ['photo-keep', expect.any(String)],
      }),
    )
    expect(requestBody.data.references).toEqual([
      expect.objectContaining({ referenceId: 'ref-keep', title: 'Edited guide' }),
      expect.objectContaining({ title: 'New guide' }),
    ])
    expect(requestBody.data.photoReferences).toEqual([
      expect.objectContaining({ photoReferenceId: 'photo-keep', title: 'Edited photo' }),
      expect.objectContaining({ title: 'New photo' }),
    ])
    expect(result.current.data.references).toEqual(requestBody.data.references)
    expect(result.current.data.photoReferences).toEqual(requestBody.data.photoReferences)
  })

  it('keeps viewer data read-only even when mutation methods are called directly', async () => {
    const seeded = createDefaultData()
    const fetch = vi
      .fn()
      .mockResolvedValue(new Response(JSON.stringify({ data: seeded, etags: {}, role: 'viewer' }), { status: 200 }))
    vi.stubGlobal('fetch', fetch)

    const { result } = renderHook(() => useWaypoints(), { wrapper: WaypointsProvider })
    await waitFor(() => expect(result.current.role).toBe('viewer'))

    expect(result.current.readOnly).toBe(true)
    await expect(result.current.addActivity(draft)).rejects.toThrow('Viewer access is read-only.')
    expect(fetch).toHaveBeenCalledTimes(1)
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
    const fetch = vi
      .fn()
      .mockImplementation(
        () => new Response(JSON.stringify({ data: seeded, etags: {}, role: 'admin' }), { status: 200 }),
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
    await waitFor(() => expect(fetch).toHaveBeenCalledTimes(1))

    expect(result.current.readOnly).toBe(true)
    await expect(result.current.addActivity(draft)).rejects.toThrow('Journey data is still loading')

    await act(async () => {
      await result.current.setDataMode('demo-local')
    })
    await waitFor(() => expect(result.current.activeDataMode).toBe('demo-local'))

    await act(async () => {
      resolvers[0]?.(
        new Response(JSON.stringify({ data: createDefaultData(), etags: {}, role: 'admin' }), { status: 200 }),
      )
    })

    expect(result.current.activeDataMode).toBe('demo-local')
    expect(result.current.data).toEqual(createDemoModeData())
  })

  it('reports a superseded reload distinctly from a successful reload', async () => {
    const seeded = createDefaultData()
    const resolvers: ((response: Response) => void)[] = []
    const rejecters: ((error: Error) => void)[] = []
    const fetch = vi
      .fn()
      .mockResolvedValueOnce(new Response(JSON.stringify({ data: seeded, etags: {}, role: 'admin' }), { status: 200 }))
      .mockImplementation(
        () =>
          new Promise<Response>((resolve, reject) => {
            resolvers.push(resolve)
            rejecters.push(reject)
          }),
      )
    vi.stubGlobal('fetch', fetch)

    const { result } = renderHook(() => useWaypoints(), { wrapper: WaypointsProvider })
    await waitFor(() => expect(result.current.data.waypoints).toHaveLength(seeded.waypoints.length))

    const firstReload = result.current.reload()
    const secondReload = result.current.reload()

    rejecters[0]?.(new Error('First reload failed'))
    await expect(firstReload).resolves.toEqual({ status: 'superseded' })

    resolvers[1]?.(new Response(JSON.stringify({ data: seeded, etags: {}, role: 'admin' }), { status: 200 }))
    await expect(secondReload).resolves.toEqual({ status: 'success' })
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

  it('keeps the loaded production data when a later reload fails', async () => {
    setDataMode('production')
    const seeded = createDefaultData()
    seeded.activities = [
      createActivity({
        waypointId: lacockId,
        ideaIds: [],
        date: '2026-08-01',
        location: draft.location,
        notes: '',
      }),
    ]
    const fetch = vi
      .fn()
      .mockResolvedValueOnce(new Response(JSON.stringify({ data: seeded, etags: {}, role: 'admin' }), { status: 200 }))
      .mockResolvedValue(new Response(JSON.stringify({ error: 'unavailable' }), { status: 500, statusText: 'Broken' }))
    vi.stubGlobal('fetch', fetch)

    const { result } = renderHook(() => useWaypoints(), { wrapper: WaypointsProvider })
    await waitFor(() => expect(result.current.data.activities).toHaveLength(1))
    const loaded = result.current.data

    await act(async () => {
      await expect(result.current.reload()).resolves.toEqual({
        status: 'failure',
        message: expect.stringContaining('Production data could not be loaded'),
      })
    })

    expect(result.current.loadState).toEqual({
      status: 'failed',
      message: expect.stringContaining('Production data could not be loaded'),
    })
    expect(result.current.data).toEqual(loaded)
    expect(result.current.data.activities).toHaveLength(1)
  })
})
