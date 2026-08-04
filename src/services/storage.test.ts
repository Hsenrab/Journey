import { beforeEach, describe, expect, it } from 'vitest'
import { load, parseImport, save } from './storage'

describe('parseImport', () => {
  it('accepts a portable visit export', () => {
    expect(
      parseImport('{"lyme":{"status":"silver","date":"2026-08-01","notes":"Great day","photos":["lyme.jpg"]}}'),
    ).toMatchObject({ lyme: { status: 'silver' } })
  })

  it('accepts an empty export', () => {
    expect(parseImport('{}')).toEqual({})
  })

  it('rejects malformed imports with an invalid status', () => {
    expect(() => parseImport('{"lyme":{"status":"done","date":"2026-08-01","notes":"","photos":[]}}')).toThrow()
  })

  it('rejects imports missing required fields', () => {
    expect(() => parseImport('{"lyme":{"status":"gold"}}')).toThrow()
  })

  it('rejects imports that are not valid JSON', () => {
    expect(() => parseImport('not json')).toThrow()
  })

  it('rejects imports where photos is not an array', () => {
    expect(() => parseImport('{"lyme":{"status":"gold","date":"2026-08-01","notes":"","photos":"lyme.jpg"}}')).toThrow()
  })
})

describe('load', () => {
  beforeEach(() => localStorage.clear())

  it('returns an empty object when nothing is stored', () => {
    expect(load()).toEqual({})
  })

  it('returns previously saved data', () => {
    save({ lyme: { status: 'gold', date: '2026-08-01', notes: 'Lovely', photos: [] } })
    expect(load()).toMatchObject({ lyme: { status: 'gold' } })
  })

  it('falls back to an empty object when stored data is corrupted', () => {
    localStorage.setItem('national-trust-tracker-v1', '{not valid json')
    expect(load()).toEqual({})
  })

  it('falls back to an empty object when stored data fails validation', () => {
    localStorage.setItem('national-trust-tracker-v1', '{"lyme":{"status":"unknown"}}')
    expect(load()).toEqual({})
  })
})

describe('save', () => {
  beforeEach(() => localStorage.clear())

  it('persists data to localStorage as JSON', () => {
    const data = { lyme: { status: 'bronze' as const, date: '2026-08-01', notes: '', photos: [] } }
    save(data)
    expect(JSON.parse(localStorage.getItem('national-trust-tracker-v1')!)).toEqual(data)
  })
})
