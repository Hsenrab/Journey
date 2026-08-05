import { beforeEach, describe, expect, it } from 'vitest'
import { backupVersion, createBackup, load, parseImport, save } from './storage'

const visit = { status: 'silver' as const, date: '2026-08-01', notes: 'Great day', photos: ['dyrham-park.jpg'] }
const backup = (overrides: Record<string, unknown> = {}) =>
  JSON.stringify({
    version: backupVersion,
    exportedAt: '2026-08-01T00:00:00.000Z',
    visits: { 'dyrham-park': visit },
    ...overrides,
  })

describe('load', () => {
  beforeEach(() => localStorage.clear())

  it('returns an empty object when nothing is stored', () => {
    expect(load()).toEqual({})
  })

  it('returns previously saved data', () => {
    save({ 'dyrham-park': { ...visit, status: 'gold' } })
    expect(load()).toMatchObject({ 'dyrham-park': { status: 'gold' } })
  })

  it('falls back to an empty object when stored data is corrupted', () => {
    localStorage.setItem('national-trust-tracker-v1', '{not valid json')
    expect(load()).toEqual({})
  })

  it('falls back to an empty object when stored data fails validation', () => {
    localStorage.setItem('national-trust-tracker-v1', '{"dyrham-park":{"status":"unknown"}}')
    expect(load()).toEqual({})
  })
})

describe('save', () => {
  beforeEach(() => localStorage.clear())

  it('persists data to localStorage as JSON', () => {
    const data = { 'dyrham-park': { ...visit, status: 'bronze' as const } }
    save(data)
    expect(JSON.parse(localStorage.getItem('national-trust-tracker-v1')!)).toEqual(data)
  })
})

describe('createBackup', () => {
  it('wraps visits in a versioned envelope that can be imported back', () => {
    const exported = createBackup({ 'dyrham-park': visit })
    expect(exported.version).toBe(backupVersion)
    expect(parseImport(JSON.stringify(exported))).toMatchObject({ 'dyrham-park': { status: 'silver' } })
  })
})

describe('parseImport', () => {
  it('accepts a portable visit backup', () => {
    expect(parseImport(backup())).toMatchObject({ 'dyrham-park': { status: 'silver' } })
  })

  it('rejects files that are not JSON', () => {
    expect(() => parseImport('not json')).toThrow()
  })

  it('rejects unsupported versions', () => {
    expect(() => parseImport(backup({ version: backupVersion + 1 }))).toThrow()
  })

  it('rejects unknown statuses', () => {
    expect(() => parseImport(backup({ visits: { 'dyrham-park': { ...visit, status: 'done' } } }))).toThrow()
  })

  it('rejects invalid dates', () => {
    expect(() => parseImport(backup({ visits: { 'dyrham-park': { ...visit, date: '01/08/2026' } } }))).toThrow()
  })

  it('rejects unknown location references', () => {
    expect(() => parseImport(backup({ visits: { atlantis: visit } }))).toThrow()
  })
})
