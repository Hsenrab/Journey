import { act, renderHook, waitFor } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { WaypointsProvider, useWaypoints } from './JourneyContext'
import { createDefaultData, load, save, setDemoMode } from '../../services/storage'
import { createActivity, createIdea } from '../../domain/visit'

const lacockId = 'lacock-abbey-fox-talbot-museum-and-village'

const draft = {
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
    expect(load().activities).toContainEqual(expect.objectContaining({ waypointId: lacockId, category: 'silver' }))
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
      .mockImplementation(() => new Response(JSON.stringify({ data: seeded, etags: {} }), { status: 200 }))
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

  it('refuses to mutate demo data outside of test mode', async () => {
    setDemoMode(true)
    const fetch = vi
      .fn()
      .mockImplementation(() => new Response(JSON.stringify({ data: createDefaultData(), etags: {} }), { status: 200 }))
    vi.stubGlobal('fetch', fetch)

    const { result } = renderHook(() => useWaypoints(), { wrapper: WaypointsProvider })
    await waitFor(() => expect(fetch).toHaveBeenCalledWith('/api/journey/demo', expect.anything()))

    await expect(result.current.addActivity(draft)).rejects.toThrow('Demo data is read-only.')
  })
})
