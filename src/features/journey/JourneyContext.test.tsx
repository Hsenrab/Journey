import { act, renderHook } from '@testing-library/react'
import { beforeEach, describe, expect, it } from 'vitest'
import { JourneyProvider, useJourney } from './JourneyContext'
import { load } from '../../services/storage'

describe('JourneyContext', () => {
  beforeEach(() => localStorage.clear())

  it('starts with any previously persisted data', () => {
    localStorage.setItem(
      'national-trust-tracker-v1',
      JSON.stringify({ lyme: { status: 'gold', date: '2026-08-01', notes: '', photos: [] } }),
    )
    const { result } = renderHook(() => useJourney(), { wrapper: JourneyProvider })
    expect(result.current.data.lyme).toMatchObject({ status: 'gold' })
  })

  it('saves a visit and persists it to localStorage', () => {
    const { result } = renderHook(() => useJourney(), { wrapper: JourneyProvider })

    act(() => {
      result.current.saveVisit('lyme', { status: 'silver', date: '2026-08-01', notes: 'Great day', photos: [] })
    })

    expect(result.current.data.lyme).toMatchObject({ status: 'silver' })
    expect(load().lyme).toMatchObject({ status: 'silver' })
  })

  it('restores a full data set, replacing existing entries', () => {
    const { result } = renderHook(() => useJourney(), { wrapper: JourneyProvider })

    act(() => {
      result.current.saveVisit('lyme', { status: 'silver', date: '2026-08-01', notes: '', photos: [] })
    })
    act(() => {
      result.current.restore({ 'quarry-bank': { status: 'gold', date: '2026-08-02', notes: '', photos: [] } })
    })

    expect(result.current.data.lyme).toBeUndefined()
    expect(result.current.data['quarry-bank']).toMatchObject({ status: 'gold' })
  })

  it('throws when used outside of a provider', () => {
    expect(() => renderHook(() => useJourney())).toThrow('useJourney must be used inside JourneyProvider')
  })
})
