import { act, render, renderHook, waitFor } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { useState } from 'react'
import { WaypointsProvider, useJourneyDraft, useWaypoints } from './JourneyContext'
import { createDemoModeData, getDataMode, load, save, setDataMode } from '../../services/storage'
import { createActivity, createIdea, GpxGeometrySchema, type WaypointsData } from '../../domain/visit'

const waypointId = 'demo-foxglove-manor'
const lacockId = waypointId

function testData(): WaypointsData {
  const data = createDemoModeData()
  const challenge = data.challenges[0]!
  return {
    ...data,
    challenges: [challenge],
    waypoints: data.waypoints
      .filter((waypoint) => challenge.waypointIds.includes(waypoint.waypointId))
      .map((waypoint) => ({ ...waypoint, challengeIds: [challenge.challengeId] })),
    ideas: [],
    activities: [],
    references: [],
    photoReferences: [],
  }
}

const createDefaultData = testData

function deferred<T>() {
  let resolve!: (value: T) => void
  let reject!: (error: Error) => void
  const promise = new Promise<T>((yes, no) => {
    resolve = yes
    reject = no
  })
  return { promise, resolve, reject }
}

describe('remote mode-switch boundary', () => {
  beforeEach(() => {
    localStorage.clear()
    vi.stubEnv('MODE', 'production')
  })
  afterEach(() => {
    vi.unstubAllEnvs()
    vi.unstubAllGlobals()
    vi.restoreAllMocks()
  })

  it('adopts resolved replacement coordinates and uses returned ETags on the next save', async () => {
    const seeded = testData()
    const original = seeded.waypoints[0]!
    const requests: { operation: string; data: WaypointsData; etags: Record<string, string> }[] = []
    vi.stubGlobal(
      'fetch',
      vi.fn().mockImplementation((_url: string, init?: RequestInit) => {
        if (!init?.body)
          return new Response(JSON.stringify({ data: seeded, etags: { [original.waypointId]: 'old' }, role: 'admin' }))
        const body = JSON.parse(String(init.body))
        requests.push(body)
        const data: WaypointsData = {
          ...body.data,
          waypoints: body.data.waypoints.map((waypoint: WaypointsData['waypoints'][number]) =>
            waypoint.waypointId === original.waypointId
              ? { ...waypoint, location: { ...waypoint.location, latitude: 52, longitude: -3 } }
              : waypoint,
          ),
        }
        return new Response(JSON.stringify({ data, etags: { [original.waypointId]: 'resolved' } }))
      }),
    )
    const { result } = renderHook(() => useWaypoints(), { wrapper: WaypointsProvider })
    await waitFor(() => expect(result.current.loading).toBe(false))
    const draft = { ...original, location: { placeName: 'New place' }, references: [], photoReferences: [] }
    await act(async () => {
      await result.current.updateWaypoint(original.waypointId, draft)
    })
    expect(result.current.data.waypoints.find((item) => item.waypointId === original.waypointId)?.location).toEqual({
      placeName: 'New place',
      latitude: 52,
      longitude: -3,
    })
    expect(requests[0].operation).toBe('replace')
    expect(requests[0].etags).toEqual({ [original.waypointId]: 'old' })
    expect(requests[0].data.challenges).toEqual(seeded.challenges)
    expect(requests[0].data.activities).toEqual(seeded.activities)
    await act(async () => {
      await result.current.updateWaypoint(original.waypointId, draft)
    })
    expect(requests[1].etags).toEqual({ [original.waypointId]: 'resolved' })
  })

  const operations = [
    'addChallenge',
    'updateChallengeRoute',
    'addWaypoint',
    'updateWaypoint',
    'deleteWaypoint',
    'addActivity',
    'updateActivity',
    'deleteActivity',
    'addIdea',
    'updateIdea',
    'deleteIdea',
    'restore',
    'clear',
  ] as const
  it.each(operations.flatMap((operation) => [false, true].map((fails) => ({ operation, fails }))))(
    'blocks same-tick and rendered switches during $operation (failure=$fails)',
    async ({ operation, fails }) => {
      const data = testData()
      const idea = createIdea({
        title: 'Existing',
        description: '',
        notes: '',
        waypointIds: [],
        planningState: 'active',
        difficulty: 1,
      })
      const activity = createActivity({ date: '2026-08-01', location: { kind: 'postcode', postcode: 'GL1 1AA' } })
      data.ideas = [idea]
      data.activities = [activity]
      const reply = () => new Response(JSON.stringify({ data, etags: { [waypointId]: 'etag' }, role: 'admin' }))
      const pending = deferred<Response>()
      const fetch = vi
        .fn()
        .mockImplementation((_url: string, init: RequestInit) =>
          init.method && init.method !== 'GET' ? pending.promise : Promise.resolve(reply()),
        )
      vi.stubGlobal('fetch', fetch)
      const { result } = renderHook(() => useWaypoints(), { wrapper: WaypointsProvider })
      await waitFor(() => expect(result.current.loading).toBe(false))
      const waypoint = { ...data.waypoints[0]!, references: [], photoReferences: [] }
      const ideaInput = { ...idea, references: [] }
      const calls = {
        addChallenge: () =>
          result.current.addChallenge({ title: 'New', description: 'Description', supportsActivityCategories: false }),
        updateChallengeRoute: () => result.current.updateChallengeRoute(data.challenges[0]!.challengeId),
        addWaypoint: () => result.current.addWaypoint(waypoint),
        updateWaypoint: () => result.current.updateWaypoint(waypointId, waypoint),
        deleteWaypoint: () => result.current.deleteWaypoint(waypointId),
        addActivity: () => result.current.addActivity(draft),
        updateActivity: () => result.current.updateActivity(activity.activityId, draft),
        deleteActivity: () => result.current.deleteActivity(activity.activityId),
        addIdea: () => result.current.addIdea(ideaInput),
        updateIdea: () => result.current.updateIdea(idea.ideaId, ideaInput),
        deleteIdea: () => result.current.deleteIdea(idea.ideaId),
        restore: () => result.current.restore(data),
        clear: () => result.current.clear(),
      }
      let saving!: Promise<void>
      await act(async () => {
        saving = calls[operation]()
        await expect(result.current.setDataMode('demo-local')).rejects.toThrow('mutation is pending')
      })
      expect(result.current.mutationPending).toBe(true)
      expect(getDataMode()).toBe('production')
      expect(fetch).toHaveBeenCalledTimes(2)
      await expect(result.current.setDataMode('demo-cosmos')).rejects.toThrow('mutation is pending')
      const failure = new Error('Specific remote write failure')
      const outcome = saving.catch((error: unknown) => error)
      await act(async () => {
        if (fails) pending.reject(failure)
        else pending.resolve(operation === 'deleteWaypoint' ? new Response(null, { status: 204 }) : reply())
        expect(await outcome).toBe(fails ? failure : undefined)
      })
      expect(result.current.mutationPending).toBe(false)
      await act(async () => {
        expect(await result.current.setDataMode('demo-local')).toBe('switched')
      })
      expect(getDataMode()).toBe('demo-local')
    },
  )

  it('keeps overlapping operations locked until the last settles, including delete reload', async () => {
    const data = testData()
    const reply = () => new Response(JSON.stringify({ data, etags: { [waypointId]: 'etag' }, role: 'admin' }))
    const deleting = deferred<Response>()
    const reloading = deferred<Response>()
    const clearing = deferred<Response>()
    const fetch = vi
      .fn()
      .mockResolvedValueOnce(reply())
      .mockReturnValueOnce(deleting.promise)
      .mockReturnValueOnce(clearing.promise)
      .mockReturnValueOnce(reloading.promise)
    vi.stubGlobal('fetch', fetch)
    const { result } = renderHook(() => useWaypoints(), { wrapper: WaypointsProvider })
    await waitFor(() => expect(result.current.loading).toBe(false))
    let remove!: Promise<void>
    let clear!: Promise<void>
    act(() => {
      remove = result.current.deleteWaypoint(waypointId)
      clear = result.current.clear()
    })
    await act(async () => {
      clearing.resolve(reply())
      await clear
    })
    expect(result.current.mutationPending).toBe(true)
    await act(async () => {
      deleting.resolve(new Response(null, { status: 204 }))
      await Promise.resolve()
    })
    await waitFor(() => expect(fetch).toHaveBeenCalledTimes(4))
    await expect(result.current.setDataMode('demo-local')).rejects.toThrow('mutation is pending')
    await act(async () => {
      reloading.resolve(reply())
      await remove
    })
    expect(result.current.mutationPending).toBe(false)
  })

  it.each([false, true])('keeps a write tracked when its originating page unmounts (failure=%s)', async (fails) => {
    const data = testData()
    const pending = deferred<Response>()
    const reply = () => new Response(JSON.stringify({ data, etags: {}, role: 'admin' }))
    vi.stubGlobal('fetch', vi.fn().mockResolvedValueOnce(reply()).mockReturnValueOnce(pending.promise))
    let context!: ReturnType<typeof useWaypoints>
    function Probe() {
      context = useWaypoints()
      return null
    }
    function Page() {
      useJourneyDraft(true)
      return null
    }
    const view = render(
      <WaypointsProvider>
        <Probe />
        <Page />
      </WaypointsProvider>,
    )
    await waitFor(() => expect(context.loading).toBe(false))
    let saving!: Promise<void>
    act(() => {
      saving = context.clear()
    })
    view.rerender(
      <WaypointsProvider>
        <Probe />
      </WaypointsProvider>,
    )
    expect(context.mutationPending).toBe(true)
    const confirm = vi.spyOn(window, 'confirm')
    await expect(context.setDataMode('demo-local')).rejects.toThrow('mutation is pending')
    expect(confirm).not.toHaveBeenCalled()
    const error = new Error('Unmounted page write failed')
    const outcome = saving.catch((cause: unknown) => cause)
    await act(async () => {
      if (fails) pending.reject(error)
      else pending.resolve(reply())
      expect(await outcome).toBe(fails ? error : undefined)
    })
    expect(context.mutationPending).toBe(false)
    await act(async () => {
      await context.setDataMode('demo-local')
    })
    expect(confirm).not.toHaveBeenCalled()
    view.unmount()
  })

  it('cancels direct switches, retains dirty state on failed saves, and resets confirmed drafts', async () => {
    const data = testData()
    vi.stubGlobal(
      'fetch',
      vi
        .fn()
        .mockImplementation(() => Promise.resolve(new Response(JSON.stringify({ data, etags: {}, role: 'admin' })))),
    )
    const confirm = vi.spyOn(window, 'confirm').mockReturnValue(false)
    const { result } = renderHook(
      () => {
        const [dirty, setDirty] = useState(false)
        useJourneyDraft(dirty)
        return { ...useWaypoints(), dirty, setDirty }
      },
      { wrapper: WaypointsProvider },
    )
    await waitFor(() => expect(result.current.loading).toBe(false))
    act(() => {
      result.current.setDirty(true)
    })
    await act(async () => {
      expect(await result.current.setDataMode('demo-local')).toBe('cancelled')
    })
    expect(result.current.dirty).toBe(true)
    expect(getDataMode()).toBe('production')
    const failure = new Error('Save failed')
    await act(async () => {
      await expect(result.current.runMutation(() => Promise.reject(failure))).rejects.toBe(failure)
    })
    await act(async () => {
      expect(await result.current.setDataMode('demo-local')).toBe('cancelled')
    })
    expect(confirm).toHaveBeenCalledTimes(2)
    const pending = deferred<void>()
    let saving!: Promise<void>
    act(() => {
      saving = result.current.runMutation(() => pending.promise)
    })
    await expect(result.current.setDataMode('demo-local')).rejects.toThrow('mutation is pending')
    expect(confirm).toHaveBeenCalledTimes(2)
    await act(async () => {
      pending.resolve()
      await saving
    })
    confirm.mockReturnValue(true)
    await act(async () => {
      expect(await result.current.setDataMode('demo-local')).toBe('switched')
    })
    expect(result.current.dirty).toBe(false)
    confirm.mockClear()
    await act(async () => {
      await result.current.setDataMode('production')
    })
    expect(confirm).not.toHaveBeenCalled()
  })
})

const draft = {
  name: 'Abbey visit',
  waypointId,
  ideaIds: [],
  date: '2026-08-01',
  category: 'silver' as const,
  location: { kind: 'postcode' as const, postcode: 'SN15 2LG' },
  notes: 'Great day',
  references: [{ title: 'Official page', url: 'https://example.com/ref' }],
  photoReferences: [{ title: 'Front gate', url: 'https://example.com/photo.jpg' }],
}

describe('WaypointsContext', () => {
  beforeEach(() => {
    localStorage.clear()
    save(testData())
  })

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

  it('adds, replaces, and removes recorded tracks during activity mutations', async () => {
    const { result } = renderHook(() => useWaypoints(), { wrapper: WaypointsProvider })

    const firstTrack = GpxGeometrySchema.parse({
      type: 'MultiLineString' as const,
      coordinates: [
        [
          [-2.1, 51.1],
          [-2.2, 51.2],
        ],
      ],
    })
    const replacementTrack = GpxGeometrySchema.parse({
      type: 'MultiLineString' as const,
      coordinates: [
        [
          [-4.1, 53.1],
          [-4.2, 53.2],
        ],
      ],
    })
    let activityId = ''

    await act(async () => {
      await result.current.addActivity({ ...draft, recordedTrack: firstTrack })
    })
    activityId = result.current.data.activities[0]!.activityId
    expect(result.current.data.activities[0]?.recordedTrack).toEqual(firstTrack)
    expect(load().activities[0]?.recordedTrack).toEqual(firstTrack)

    await act(async () => {
      await result.current.updateActivity(activityId, { ...draft, recordedTrack: replacementTrack })
    })
    expect(result.current.data.activities[0]?.recordedTrack).toEqual(replacementTrack)

    await act(async () => {
      await result.current.updateActivity(activityId, {
        ...draft,
        recordedTrack: undefined,
        references: [{ title: 'Updated', url: 'https://example.com/new-ref' }],
        photoReferences: [],
      })
    })

    expect(result.current.data.activities[0]?.activityId).toBe(activityId)
    expect(result.current.data.activities[0]?.name).toBe('Abbey visit')
    expect(result.current.data.activities[0]?.recordedTrack).toBeUndefined()
    expect(result.current.data.photoReferences).toEqual([])

    await act(async () => {
      await result.current.deleteActivity(activityId)
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
    vi.unstubAllGlobals()
    vi.restoreAllMocks()
  })

  it.each(['production', 'demo-cosmos'] as const)(
    'routes every admin mutation through %s instead of localStorage',
    async (mode) => {
      setDataMode(mode)
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
      const fetch = vi.fn().mockImplementation(
        () =>
          new Response(JSON.stringify({ data: seeded, etags: { [lacockId]: 'waypoint-etag' }, role: 'admin' }), {
            status: 200,
          }),
      )
      vi.stubGlobal('fetch', fetch)

      const { result } = renderHook(() => useWaypoints(), { wrapper: WaypointsProvider })
      await waitFor(() => expect(result.current.data.activities).toHaveLength(1))
      const endpoint = mode === 'production' ? '/api/journey/production' : '/api/journey/demo'
      expect(fetch).toHaveBeenCalledWith(endpoint, expect.anything())

      const waypointDraft = { ...seeded.waypoints[0]!, references: [], photoReferences: [] }
      await act(async () => {
        await result.current.addChallenge({
          title: 'New challenge',
          description: 'A valid admin challenge.',
          supportsActivityCategories: false,
        })
      })
      await act(async () => {
        await result.current.updateChallengeRoute(seeded.challenges[0]!.challengeId)
      })
      await act(async () => {
        await result.current.addWaypoint(waypointDraft)
      })
      await act(async () => {
        await result.current.updateWaypoint(lacockId, waypointDraft)
      })
      await act(async () => {
        await result.current.deleteWaypoint(lacockId)
      })
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

      expect(fetch).toHaveBeenCalledTimes(15)
      expect(fetch.mock.calls.every(([url]) => url === endpoint)).toBe(true)
      expect(fetch).toHaveBeenCalledWith(endpoint, expect.objectContaining({ method: 'DELETE' }))
    },
  )

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

  it.each(['production', 'demo-cosmos'] as const)(
    'blocks every viewer mutation starting in %s and after mode switches',
    async (mode) => {
      setDataMode(mode)
      const seeded = createDefaultData()
      const waypointDraft = { ...seeded.waypoints[0]!, references: [], photoReferences: [] }
      const existingIdea = createIdea(ideaDraft)
      const existingActivity = createActivity({ ...draft, referenceIds: [], photoReferenceIds: [] })
      seeded.ideas = [existingIdea]
      seeded.activities = [existingActivity]
      const fetch = vi
        .fn()
        .mockImplementation(
          () => new Response(JSON.stringify({ data: seeded, etags: {}, role: 'viewer' }), { status: 200 }),
        )
      vi.stubGlobal('fetch', fetch)

      const { result } = renderHook(() => useWaypoints(), { wrapper: WaypointsProvider })
      await waitFor(() => expect(result.current.role).toBe('viewer'))

      const mutations = [
        () =>
          result.current.addChallenge({
            title: 'New challenge',
            description: 'A valid viewer challenge draft.',
            supportsActivityCategories: false,
          }),
        () =>
          result.current.updateChallengeRoute(seeded.challenges[0]!.challengeId, {
            fileName: 'planned.gpx',
            geometry: {
              type: 'MultiLineString',
              coordinates: [
                [
                  [-2, 51],
                  [-2.1, 51.1],
                ],
              ],
            },
          }),
        () => result.current.updateChallengeRoute(seeded.challenges[0]!.challengeId),
        () => result.current.addWaypoint(waypointDraft),
        () => result.current.updateWaypoint(lacockId, waypointDraft),
        () => result.current.deleteWaypoint(lacockId),
        () => result.current.addActivity(draft),
        () => result.current.updateActivity(existingActivity.activityId, draft),
        () => result.current.deleteActivity(existingActivity.activityId),
        () => result.current.addIdea(ideaDraft),
        () => result.current.updateIdea(existingIdea.ideaId, ideaDraft),
        () => result.current.deleteIdea(existingIdea.ideaId),
        () => result.current.restore(seeded),
        () => result.current.clear(),
      ]

      for (const sharedMode of [mode, mode === 'production' ? 'demo-cosmos' : 'production', mode] as const) {
        await act(async () => {
          await result.current.setDataMode(sharedMode)
        })
        await waitFor(() => {
          expect(result.current.activeDataMode).toBe(sharedMode)
          expect(result.current.loading).toBe(false)
          expect(result.current.role).toBe('viewer')
        })
        expect(result.current.readOnly).toBe(true)
        for (const mutate of mutations) await expect(mutate()).rejects.toThrow('Viewer access is read-only.')
        expect(result.current.data).toEqual(seeded)
      }
      expect(fetch).toHaveBeenCalledTimes(3)
      expect(fetch.mock.calls.every(([, init]) => init.method === undefined || init.method === 'GET')).toBe(true)

      await act(async () => {
        await result.current.setDataMode('demo-local')
      })
      await waitFor(() => expect(result.current.role).toBe('local'))
      expect(result.current.readOnly).toBe(true)
      for (const mutate of mutations) await expect(mutate()).rejects.toThrow('Demo local data is read-only.')
      expect(fetch).toHaveBeenCalledTimes(3)
    },
  )

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

  it('starts in the deployment demo mode when production is saved', async () => {
    setDataMode('production')
    vi.stubEnv('VITE_DEFAULT_DATA_MODE', 'demo-cosmos')
    const demoData = createDemoModeData()
    const fetch = vi
      .fn()
      .mockResolvedValue(new Response(JSON.stringify({ data: demoData, etags: {}, role: 'admin' }), { status: 200 }))
    vi.stubGlobal('fetch', fetch)

    const { result } = renderHook(() => useWaypoints(), { wrapper: WaypointsProvider })
    await waitFor(() => expect(result.current.data).toEqual(demoData))

    expect(result.current.activeDataMode).toBe('demo-cosmos')
    expect(fetch).toHaveBeenCalledWith('/api/journey/demo', expect.anything())
    expect(fetch).not.toHaveBeenCalledWith('/api/journey/production', expect.anything())
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
    await expect(result.current.restore(createDefaultData())).rejects.toThrow('Journey data is still loading')
    await expect(result.current.clear()).rejects.toThrow('Journey data is still loading')
    expect(fetch).toHaveBeenCalledTimes(1)

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
    expect(fetch).toHaveBeenCalledWith('/api/journey/production', expect.anything())
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
    expect(result.current.role).toBe('admin')
    expect(result.current.readOnly).toBe(true)
    await expect(result.current.addActivity(draft)).rejects.toThrow('Production data is not loaded')
    await expect(result.current.restore(seeded)).rejects.toThrow('Production data is not loaded')
    await expect(result.current.clear()).rejects.toThrow('Production data is not loaded')
    expect(fetch).toHaveBeenCalledTimes(2)
  })
})
