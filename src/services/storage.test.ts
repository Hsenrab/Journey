import { beforeEach, describe, expect, it } from 'vitest'
import {
  backupVersion,
  createBackup,
  createDefaultData,
  createDemoModeData,
  getDataMode,
  load,
  parseImport,
  save,
  setDataMode,
} from './storage'
import { GpxGeometrySchema, type Activity, type WaypointsData } from '../domain/visit'

const activity: Activity = {
  activityId: 'a1',
  ideaIds: [],
  waypointId: 'waypoint-1',
  challengeId: 'challenge-1',
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

  it('starts with empty data and does not write a legacy catalogue into local storage', () => {
    expect(load()).toEqual(createDefaultData())
    expect(load()).toEqual({
      waypoints: [],
      challenges: [],
      ideas: [],
      activities: [],
      references: [],
      photoReferences: [],
    })
    expect(localStorage.getItem('waypoints-v1')).toBeNull()
  })

  it('returns previously saved data', () => {
    save({ ...createDefaultData(), activities: [activity] })
    expect(load().activities).toEqual([activity])
  })

  it('preserves existing browser-local data without rewriting it', () => {
    const saved = JSON.stringify({
      ...createDefaultData(),
      waypoints: [
        {
          waypointId: 'saved-waypoint',
          title: 'Saved waypoint',
          description: 'Keep this record.',
          category: 'Custom',
          tags: [],
          challengeIds: [],
          completion: { mode: 'once' },
          location: { placeName: 'Saved place' },
          referenceIds: [],
          photoReferenceIds: [],
        },
      ],
    })
    localStorage.setItem('waypoints-v1', saved)

    expect(load().waypoints[0]?.waypointId).toBe('saved-waypoint')
    expect(localStorage.getItem('waypoints-v1')).toBe(saved)
  })

  it('throws when stored json is invalid', () => {
    localStorage.setItem('waypoints-v1', '{not valid json')
    expect(() => load()).toThrow()
  })

  it('throws when stored data fails schema validation', () => {
    localStorage.setItem('waypoints-v1', '{"activities":[{"status":"unknown"}]}')
    expect(() => load()).toThrow()
  })

  it('keeps production storage separate from the bundled local demo fixture', () => {
    save({ ...createDefaultData(), activities: [activity] })
    setDataMode('demo-local')

    expect(createDemoModeData()).not.toMatchObject({ activities: [activity] })
    expect(createDemoModeData().activities.every((demoActivity) => demoActivity.name)).toBe(true)
    expect(() => load()).toThrow(
      'load()/save() are only available in Production data mode; the current mode is demo-local.',
    )
    expect(() => save(createDefaultData())).toThrow(
      'load()/save() are only available in Production data mode; the current mode is demo-local.',
    )
  })

  it('defaults missing or unknown mode preferences to the deployment mode', () => {
    localStorage.setItem('journey-data-mode-v1', 'obsolete')

    expect(getDataMode('demo-cosmos')).toBe('demo-cosmos')
    localStorage.removeItem('journey-data-mode-v1')
    expect(getDataMode('demo-cosmos')).toBe('demo-cosmos')
  })

  it('uses the deployment demo mode instead of a saved production preference', () => {
    setDataMode('production')

    expect(getDataMode('demo-cosmos')).toBe('demo-cosmos')
    expect(getDataMode('production')).toBe('production')
  })

  it('rejects an unsupported deployment default', () => {
    expect(() => getDataMode('test')).toThrow('Unknown default Journey data mode: test')
  })

  it('persists the selected Cosmos demo mode without changing production storage', () => {
    save({ ...createDefaultData(), activities: [activity] })
    setDataMode('demo-cosmos')

    expect(getDataMode()).toBe('demo-cosmos')
    expect(() => load()).toThrow(
      'load()/save() are only available in Production data mode; the current mode is demo-cosmos.',
    )
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

  it('round-trips Challenge routes and Activity tracks without raw GPX content', () => {
    const geometry = GpxGeometrySchema.parse({
      type: 'MultiLineString' as const,
      coordinates: [
        [
          [-2.1, 51.1],
          [-2.2, 51.2],
        ],
        [
          [-3.1, 52.1],
          [-3.2, 52.2],
        ],
      ],
    })
    const data = createDefaultData()
    const challenge = {
      challengeId: 'challenge-1',
      title: 'Test challenge',
      description: 'A challenge used to test route backup.',
      waypointIds: [],
      supportsActivityCategories: false,
      plannedRoute: { fileName: 'planned.gpx', geometry },
    }
    const trackedActivity = { ...activity, recordedTrack: geometry }
    const exported = createBackup({
      ...data,
      challenges: [challenge, ...data.challenges.slice(1)],
      activities: [trackedActivity],
    })

    expect(parseImport(JSON.stringify(exported))).toMatchObject({
      challenges: [challenge],
      activities: [trackedActivity],
    })
    expect(JSON.stringify(exported)).not.toContain('<gpx')
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
