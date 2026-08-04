import { beforeEach, describe, expect, it } from 'vitest'
import { load, parseImport, save } from './storage'

const visit = {
  visitId: 'v1',
  locationId: 'lyme',
  date: '2026-08-01',
  status: 'silver' as const,
  notes: 'Great day',
  photos: ['lyme.jpg'],
  createdAt: '2026-08-01T10:00:00.000Z',
  updatedAt: '2026-08-01T10:00:00.000Z',
}

const importOf = (override: Record<string, unknown> = {}) => JSON.stringify({ visits: [{ ...visit, ...override }] })

describe('parseImport', () => {
  it('accepts a portable visit export', () => {
    expect(parseImport(importOf())).toMatchObject({ visits: [{ locationId: 'lyme', status: 'silver' }] })
  })

  it('accepts an empty export', () => {
    expect(parseImport('{"visits":[]}')).toEqual({ visits: [] })
  })

  it('rejects files that are not JSON', () => {
    expect(() => parseImport('not json')).toThrow()
  })

  it('rejects malformed imports', () => {
    expect(() => parseImport('{"visits":[{"status":"done"}]}')).toThrow()
  })

  it('rejects an unknown location', () => {
    expect(() => parseImport(importOf({ locationId: 'unknown-place' }))).toThrow()
  })

  it('rejects dates that are not YYYY-MM-DD', () => {
    expect(() => parseImport(importOf({ date: '01/08/2026' }))).toThrow()
  })

  it('rejects impossible calendar dates', () => {
    expect(() => parseImport(importOf({ date: '2026-02-30' }))).toThrow()
  })

  it('rejects unknown status values', () => {
    expect(() => parseImport(importOf({ status: 'platinum' }))).toThrow()
  })
})

describe('load', () => {
  beforeEach(() => localStorage.clear())

  it('returns empty visit history when nothing is stored', () => {
    expect(load()).toEqual({ visits: [] })
  })

  it('returns previously saved visit history', () => {
    save({ visits: [visit] })
    expect(load()).toMatchObject({ visits: [{ locationId: 'lyme', status: 'silver' }] })
  })

  it('falls back to empty visit history when stored data is corrupted', () => {
    localStorage.setItem('national-trust-tracker-v2', '{not valid json')
    expect(load()).toEqual({ visits: [] })
  })
})

describe('save', () => {
  beforeEach(() => localStorage.clear())

  it('persists visit history to localStorage as JSON', () => {
    const data = { visits: [visit] }
    save(data)
    expect(JSON.parse(localStorage.getItem('national-trust-tracker-v2')!)).toEqual(data)
  })
})