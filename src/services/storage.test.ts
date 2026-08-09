import { beforeEach, describe, expect, it } from 'vitest'
import { backupVersion, createBackup, createDefaultData, load, parseImport, save } from './storage'
import type { Activity, WaypointsData } from '../domain/visit'

const activity: Activity = {
  activityId: 'a1',
  waypointId: 'dyrham-park',
  challengeId: 'national-trust',
  date: '2026-08-01',
  status: 'silver',
  location: { placeName: 'Dyrham Park', addressOrRegion: 'South Gloucestershire' },
  notes: 'Great day',
  photos: ['dyrham-park.jpg'],
  referenceIds: [],
  photoReferenceIds: [],
  createdAt: '2026-08-01T10:00:00.000Z',
  updatedAt: '2026-08-01T10:00:00.000Z',
}

const backup = (overrides: { version?: number; data?: Partial<WaypointsData> } = {}) =>
  JSON.stringify({
    version: overrides.version ?? backupVersion,
    exportedAt: '2026-08-01T00:00:00.000Z',
    data: { ...createDefaultData(), activities: [activity], ...(overrides.data ?? {}) },
  })

describe('load', () => {
  beforeEach(() => localStorage.clear())

  it('returns seeded waypoints when nothing is stored', () => {
    expect(load().waypoints.length).toBeGreaterThan(0)
  })

  it('returns previously saved data', () => {
    const seed = createDefaultData()
    save({ ...seed, activities: [{ ...activity, status: 'gold' }] })
    expect(load()).toMatchObject({ activities: [{ waypointId: 'dyrham-park', status: 'gold' }] })
  })

  it('falls back to seeded data when stored data is corrupted', () => {
    localStorage.setItem('waypoints-v1', '{not valid json')
    expect(load().waypoints.length).toBeGreaterThan(0)
  })

  it('falls back to seeded data when stored data fails validation', () => {
    localStorage.setItem('waypoints-v1', '{"activities":[{"status":"unknown"}]}')
    expect(load().waypoints.length).toBeGreaterThan(0)
  })
})

describe('save', () => {
  beforeEach(() => localStorage.clear())

  it('persists waypoints data to localStorage as JSON', () => {
    const data: WaypointsData = { ...createDefaultData(), activities: [{ ...activity, status: 'bronze' as const }] }
    save(data)
    expect(JSON.parse(localStorage.getItem('waypoints-v1')!)).toEqual(data)
  })
})

describe('createBackup', () => {
  it('wraps data in a versioned envelope that can be imported back', () => {
    const exported = createBackup({ ...createDefaultData(), activities: [activity] })
    expect(exported.version).toBe(backupVersion)
    expect(parseImport(JSON.stringify(exported))).toMatchObject({
      activities: [{ waypointId: 'dyrham-park', status: 'silver' }],
    })
  })
})

describe('parseImport', () => {
  it('accepts a portable waypoints backup', () => {
    expect(parseImport(backup())).toMatchObject({ activities: [{ waypointId: 'dyrham-park', status: 'silver' }] })
  })

  it('accepts an empty activities list', () => {
    expect(parseImport(backup({ data: { activities: [] } })).activities).toEqual([])
  })

  it('rejects files that are not JSON', () => {
    expect(() => parseImport('not json')).toThrow()
  })

  it('rejects unsupported versions', () => {
    expect(() => parseImport(backup({ version: backupVersion + 1 }))).toThrow()
  })

  it('rejects malformed activity records', () => {
    expect(() =>
      parseImport(backup({ data: { activities: [{ status: 'silver' } as unknown as Activity] } })),
    ).toThrow()
  })

  it('rejects activities without location data', () => {
    expect(() => parseImport(backup({ data: { activities: [{ ...activity, location: {} }] } }))).toThrow()
  })

  it('rejects dates that are not YYYY-MM-DD', () => {
    expect(() =>
      parseImport(backup({ data: { activities: [{ ...activity, date: '01/08/2026' }] } })),
    ).toThrow()
  })

  it('rejects impossible calendar dates', () => {
    expect(() =>
      parseImport(backup({ data: { activities: [{ ...activity, date: '2026-02-30' }] } })),
    ).toThrow()
  })
})
