import { afterEach, describe, expect, it, vi } from 'vitest'
import { getUkToday, isValidActivityDate } from './activityDate.js'

afterEach(() => {
  vi.useRealTimers()
  vi.unstubAllEnvs()
})

describe('Activity UK calendar dates', () => {
  it.each([
    ['2026-01-15T23:30:00Z', '2026-01-15', '2026-01-16'],
    ['2026-01-16T00:00:00Z', '2026-01-16', '2026-01-17'],
    ['2026-07-15T22:59:59Z', '2026-07-15', '2026-07-16'],
    ['2026-07-15T23:30:00Z', '2026-07-16', '2026-07-17'],
    ['2026-03-29T00:30:00Z', '2026-03-29', '2026-03-30'],
    ['2026-03-29T01:30:00Z', '2026-03-29', '2026-03-30'],
    ['2026-10-25T00:30:00Z', '2026-10-25', '2026-10-26'],
    ['2026-10-25T01:30:00Z', '2026-10-25', '2026-10-26'],
  ])('uses UK today at %s', (instant, today, future) => {
    const now = new Date(instant)
    expect(getUkToday(now)).toBe(today)
    expect(isValidActivityDate(today, now)).toBe(true)
    expect(isValidActivityDate(future, now)).toBe(false)
    expect(isValidActivityDate('2024-02-29', now)).toBe(true)
  })

  it.each(['America/Los_Angeles', 'Asia/Tokyo', 'Pacific/Auckland'])(
    'does not use the process time zone %s',
    (zone) => {
      vi.stubEnv('TZ', zone)
      const now = new Date('2026-07-15T23:30:00Z')
      expect(getUkToday(now)).toBe('2026-07-16')
      expect(isValidActivityDate('2026-07-16', now)).toBe(true)
      expect(isValidActivityDate('2026-07-17', now)).toBe(false)
    },
  )

  it.each([
    '',
    '2026-1-01',
    '26-01-01',
    '2026-01-01T00:00:00Z',
    ' 2026-01-01',
    '2026-01-01 ',
    '2026-02-29',
    '2024-02-30',
    '1900-02-29',
    '2026-04-31',
    '2026-00-15',
    '2026-13-01',
    '2026-01-00',
    '2026-01-32',
    '0000-01-01',
    '2027-01-01',
  ])('rejects invalid or future date %j', (value) => {
    expect(isValidActivityDate(value, new Date('2026-10-25T12:00:00Z'))).toBe(false)
  })

  it('accepts leap days under Gregorian century rules', () => {
    expect(isValidActivityDate('2000-02-29', new Date('2026-10-25T12:00:00Z'))).toBe(true)
  })

  it('evaluates today for each validation rather than module initialization', () => {
    vi.useFakeTimers()
    vi.setSystemTime(new Date('2026-07-15T22:59:59Z'))
    expect(isValidActivityDate('2026-07-16')).toBe(false)
    vi.setSystemTime(new Date('2026-07-15T23:00:00Z'))
    expect(getUkToday()).toBe('2026-07-16')
    expect(isValidActivityDate('2026-07-16')).toBe(true)
  })
})
