import { beforeEach, describe, expect, it } from 'vitest'
import {
  backupVersion,
  createBackup,
  createDefaultData,
  createDemoModeData,
  load,
  parseImport,
  save,
  setDemoMode,
} from './storage'
import { type Activity, type WaypointsData } from '../domain/visit'

const activity: Activity = {
  activityId: 'a1',
  waypointId: 'dyrham-park',
  challengeId: 'national-trust',
  date: '2026-08-01',
  category: 'silver',
  location: { kind: 'postcode', postcode: 'GL1 1AA' },
  notes: 'Great day',
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
    save({ ...createDefaultData(), activities: [activity] })
    expect(load().activities).toEqual([activity])
  })

  it('throws when stored json is invalid', () => {
    localStorage.setItem('waypoints-v1', '{not valid json')
    expect(() => load()).toThrow()
  })

  it('throws when stored data fails schema validation', () => {
    localStorage.setItem('waypoints-v1', '{"activities":[{"status":"unknown"}]}')
    expect(() => load()).toThrow()
  })

  it('loads demo data when demo mode is enabled', () => {
    setDemoMode(true)
    expect(load()).toMatchObject({ waypoints: createDemoModeData().waypoints })
  })
})

describe('save', () => {
  beforeEach(() => localStorage.clear())

  it('persists waypoints data to localStorage as JSON', () => {
    const data: WaypointsData = { ...createDefaultData(), activities: [activity] }
    save(data)
    expect(JSON.parse(localStorage.getItem('waypoints-v1')!)).toEqual(data)
  })
})

describe('createBackup/parseImport', () => {
  it('round-trips a valid backup', () => {
    const exported = createBackup({ ...createDefaultData(), activities: [activity] })
    expect(parseImport(JSON.stringify(exported))).toMatchObject({ activities: [activity] })
  })

  it('rejects unsupported versions', () => {
    expect(() => parseImport(backup({ version: backupVersion + 1 }))).toThrow()
  })

  it('rejects malformed activity records', () => {
    expect(() =>
      parseImport(backup({ data: { activities: [{ category: 'silver' } as unknown as Activity] } })),
    ).toThrow()
  })
})
