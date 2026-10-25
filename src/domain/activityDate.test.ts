import { describe, expect, it, vi } from 'vitest'
import { activityDateError, ukToday } from './activityDate'

describe('UK Activity dates', () => {
  it.each([
    ['2026-01-15T23:30:00Z', '2026-01-15'],
    ['2026-07-15T23:30:00Z', '2026-07-16'],
    ['2026-03-29T00:30:00Z', '2026-03-29'],
    ['2026-03-29T01:30:00Z', '2026-03-29'],
    ['2026-10-25T00:30:00Z', '2026-10-25'],
    ['2026-10-25T01:30:00Z', '2026-10-25'],
  ])('uses UK today at %s', (instant, expected) => {
    const now = new Date(instant)
    expect(ukToday(now)).toBe(expected)
    expect(activityDateError(expected, now)).toBeUndefined()
    expect(activityDateError('2027-01-01', now)).toContain('future')
  })

  it('rejects missing, malformed and impossible dates but accepts leap days', () => {
    const now = new Date('2026-10-25T12:00:00Z')
    for (const value of ['', '2026-1-01', '2026-02-29', '2026-04-31', 'nonsense'])
      expect(activityDateError(value, now)).toBeDefined()
    expect(activityDateError('2024-02-29', now)).toBeUndefined()
  })

  it('evaluates the clock on each call', () => {
    vi.useFakeTimers()
    try {
      vi.setSystemTime(new Date('2026-07-15T22:59:59Z'))
      expect(activityDateError('2026-07-16')).toContain('future')
      vi.setSystemTime(new Date('2026-07-15T23:00:00Z'))
      expect(activityDateError('2026-07-16')).toBeUndefined()
    } finally {
      vi.useRealTimers()
    }
  })
})
