import { beforeEach, describe, expect, it } from 'vitest'
import { backupVersion, createBackup, load, parseImport, save } from './storage'
import type { Visit } from '../domain/visit'

const visit: Visit = {
  visitId: 'v1',
  locationId: 'dyrham-park',
  date: '2026-08-01',
  status: 'silver',
  notes: 'Great day',
  photos: ['dyrham-park.jpg'],
  createdAt: '2026-08-01T10:00:00.000Z',
  updatedAt: '2026-08-01T10:00:00.000Z',
}

const backup = (overrides: Record<string, unknown> = {}) =>
  JSON.stringify({
    version: backupVersion,
    exportedAt: '2026-08-01T00:00:00.000Z',
    visits: [visit],
    ...overrides,
  })

describe('load', () => {
  beforeEach(() => localStorage.clear())

  it('returns empty visit history when nothing is stored', () => {
    expect(load()).toEqual({ visits: [] })
  })

  it('returns previously saved visit history', () => {
    save({ visits: [{ ...visit, status: 'gold' }] })
    expect(load()).toMatchObject({ visits: [{ locationId: 'dyrham-park', status: 'gold' }] })
  })

  it('falls back to empty visit history when stored data is corrupted', () => {
    localStorage.setItem('national-trust-tracker-v2', '{not valid json')
    expect(load()).toEqual({ visits: [] })
  })

  it('falls back to empty visit history when stored data fails validation', () => {
    localStorage.setItem('national-trust-tracker-v2', '{"visits":[{"status":"unknown"}]}')
    expect(load()).toEqual({ visits: [] })
  })
})

describe('save', () => {
  beforeEach(() => localStorage.clear())

  it('persists visit history to localStorage as JSON', () => {
    const data = { visits: [{ ...visit, status: 'bronze' as const }] }
    save(data)
    expect(JSON.parse(localStorage.getItem('national-trust-tracker-v2')!)).toEqual(data)
  })
})

describe('createBackup', () => {
  it('wraps visits in a versioned envelope that can be imported back', () => {
    const exported = createBackup({ visits: [visit] })
    expect(exported.version).toBe(backupVersion)
    expect(parseImport(JSON.stringify(exported))).toMatchObject({
      visits: [{ locationId: 'dyrham-park', status: 'silver' }],
    })
  })
})

describe('parseImport', () => {
  it('accepts a portable visit backup', () => {
    expect(parseImport(backup())).toMatchObject({ visits: [{ locationId: 'dyrham-park', status: 'silver' }] })
  })

  it('accepts an empty backup', () => {
    expect(parseImport(backup({ visits: [] }))).toEqual({ visits: [] })
  })

  it('rejects files that are not JSON', () => {
    expect(() => parseImport('not json')).toThrow()
  })

  it('rejects unsupported versions', () => {
    expect(() => parseImport(backup({ version: backupVersion + 1 }))).toThrow()
  })

  it('rejects malformed visit records', () => {
    expect(() => parseImport(backup({ visits: [{ status: 'silver' }] }))).toThrow()
  })

  it('rejects unknown statuses', () => {
    expect(() => parseImport(backup({ visits: [{ ...visit, status: 'platinum' }] }))).toThrow()
  })

  it('rejects dates that are not YYYY-MM-DD', () => {
    expect(() => parseImport(backup({ visits: [{ ...visit, date: '01/08/2026' }] }))).toThrow()
  })

  it('rejects impossible calendar dates', () => {
    expect(() => parseImport(backup({ visits: [{ ...visit, date: '2026-02-30' }] }))).toThrow()
  })

  it('rejects unknown location references', () => {
    expect(() => parseImport(backup({ visits: [{ ...visit, locationId: 'atlantis' }] }))).toThrow()
  })
})
