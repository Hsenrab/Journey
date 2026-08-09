import { act, renderHook } from '@testing-library/react'
import { beforeEach, describe, expect, it } from 'vitest'
import { WaypointsProvider, useWaypoints } from './JourneyContext'
import { load } from '../../services/storage'
import type { Activity } from '../../domain/visit'

const lacockId = 'lacock-abbey-fox-talbot-museum-and-village'

function activity(waypointId: string, status: 'bronze' | 'silver' | 'gold', date = '2026-08-01'): Activity {
  return {
    activityId: `${waypointId}-${status}`,
    waypointId,
    challengeId: 'national-trust',
    date,
    status,
    location: { placeName: waypointId },
    notes: '',
    photos: [],
    referenceIds: [],
    photoReferenceIds: [],
    createdAt: '2026-08-01T10:00:00.000Z',
    updatedAt: '2026-08-01T10:00:00.000Z',
  }
}

describe('WaypointsContext', () => {
  beforeEach(() => localStorage.clear())

  it('starts with any previously persisted data', () => {
    const seed = load()
    localStorage.setItem('waypoints-v1', JSON.stringify({ ...seed, activities: [activity(lacockId, 'gold')] }))
    const { result } = renderHook(() => useWaypoints(), { wrapper: WaypointsProvider })
    expect(result.current.statusFor(lacockId)).toBe('gold')
  })

  it('saves an activity and persists it to localStorage', () => {
    const { result } = renderHook(() => useWaypoints(), { wrapper: WaypointsProvider })

    act(() => {
      result.current.addActivity({ ...activity(lacockId, 'silver'), notes: 'Great day' })
    })

    expect(result.current.statusFor(lacockId)).toBe('silver')
    expect(load().activities).toContainEqual(expect.objectContaining({ waypointId: lacockId, status: 'silver' }))
  })

  it('restores a full data set, replacing existing entries', () => {
    const { result } = renderHook(() => useWaypoints(), { wrapper: WaypointsProvider })

    act(() => {
      result.current.addActivity(activity(lacockId, 'silver'))
    })
    act(() => {
      const seed = load()
      result.current.restore({ ...seed, activities: [activity('stourhead', 'gold', '2026-08-02')] })
    })

    expect(result.current.statusFor(lacockId)).toBe('not-started')
    expect(result.current.statusFor('stourhead')).toBe('gold')
  })

  it('throws when used outside of a provider', () => {
    expect(() => renderHook(() => useWaypoints())).toThrow('useWaypoints must be used inside WaypointsProvider')
  })
})
