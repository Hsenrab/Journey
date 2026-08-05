import { act, renderHook } from '@testing-library/react'
import { beforeEach, describe, expect, it } from 'vitest'
import { JourneyProvider, useJourney } from './JourneyContext'
import { load } from '../../services/storage'
import type { AwardedStatus, Visit } from '../../domain/visit'

function visit(locationId: string, status: AwardedStatus, date = '2026-08-01'): Visit {
  return {
    visitId: `${locationId}-${status}`,
    locationId,
    status,
    date,
    notes: '',
    photos: [],
    createdAt: '2026-08-01T10:00:00.000Z',
    updatedAt: '2026-08-01T10:00:00.000Z',
  }
}

describe('JourneyContext', () => {
  beforeEach(() => localStorage.clear())

  it('starts with any previously persisted data', () => {
    localStorage.setItem('national-trust-tracker-v2', JSON.stringify({ visits: [visit('lacock-abbey', 'gold')] }))
    const { result } = renderHook(() => useJourney(), { wrapper: JourneyProvider })
    expect(result.current.statusFor('lacock-abbey')).toBe('gold')
  })

  it('saves a visit and persists it to localStorage', () => {
    const { result } = renderHook(() => useJourney(), { wrapper: JourneyProvider })

    act(() => {
      result.current.addVisit({ ...visit('lacock-abbey', 'silver'), notes: 'Great day' })
    })

    expect(result.current.statusFor('lacock-abbey')).toBe('silver')
    expect(load().visits).toContainEqual(expect.objectContaining({ locationId: 'lacock-abbey', status: 'silver' }))
  })

  it('restores a full data set, replacing existing entries', () => {
    const { result } = renderHook(() => useJourney(), { wrapper: JourneyProvider })

    act(() => {
      result.current.addVisit(visit('lacock-abbey', 'silver'))
    })
    act(() => {
      result.current.restore({ visits: [visit('stourhead', 'gold', '2026-08-02')] })
    })

    expect(result.current.statusFor('lacock-abbey')).toBe('not-started')
    expect(result.current.statusFor('stourhead')).toBe('gold')
  })

  it('throws when used outside of a provider', () => {
    expect(() => renderHook(() => useJourney())).toThrow('useJourney must be used inside JourneyProvider')
  })
})
