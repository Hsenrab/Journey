import { act, renderHook } from '@testing-library/react'
import { beforeEach, describe, expect, it } from 'vitest'
import { WaypointsProvider, useWaypoints } from './JourneyContext'
import { createDefaultData, load, save } from '../../services/storage'

const lacockId = 'lacock-abbey-fox-talbot-museum-and-village'

const draft = {
  waypointId: lacockId,
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

  it('reloads persisted data and restores an explicit dataset', () => {
    const { result } = renderHook(() => useWaypoints(), { wrapper: WaypointsProvider })
    const replacement = createDefaultData()
    replacement.activities = []
    save(replacement)

    act(() => result.current.reload())
    expect(result.current.data.waypoints).toHaveLength(replacement.waypoints.length)

    act(() => result.current.restore({ ...replacement, waypoints: [] }))
    expect(result.current.data.waypoints).toEqual([])
  })
})
