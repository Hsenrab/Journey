import { describe, expect, it } from 'vitest'
import { filterActivityHistory } from './activityHistory'
import { createActivity, type Waypoint } from './visit'
import { createAwardTestData } from '../test/demoData'

const waypoint: Waypoint = {
  ...createAwardTestData().waypoints[0]!,
  title: 'Foxglove Manor',
  description: 'excluded-description',
  location: { placeName: 'hidden-geography' },
}
const linked = createActivity({
  activityId: 'linked',
  name: 'Morning WALK',
  notes: `${'x'.repeat(150)} Botanical GARDEN`,
  waypointId: waypoint.waypointId,
  date: '2026-08-01',
  category: 'bronze',
  ideaIds: ['excluded-idea'],
  referenceIds: ['excluded-reference'],
  photoReferenceIds: ['excluded-photo'],
  location: { kind: 'postcode', postcode: 'GL1 1AA', latitude: 51.987654, longitude: -2 },
})
const independent = createActivity({
  activityId: 'independent',
  name: 'Evening stroll',
  date: '2026-08-02',
  location: { kind: 'coordinates', latitude: 51.123456, longitude: -2.654321 },
})
const records = Object.freeze([Object.freeze(linked), Object.freeze(independent)])
const waypoints = new Map([[waypoint.waypointId, waypoint]])

describe('filterActivityHistory', () => {
  it.each(['', '   ', '\t\n'])('preserves the supplied records for whitespace query %j', (query) => {
    expect(filterActivityHistory(records, waypoints, query)).toEqual(records)
  })

  it.each([
    'walk',
    'WALK',
    'garden',
    'Foxglove',
    'GL1',
    'Postcode',
    'walk garden',
    ' GARDEN\twalk\nfoxglove ',
    'garden walk walk',
  ])('matches all supported words in the same record for %j', (query) => {
    expect(filterActivityHistory(records, waypoints, query)).toEqual([linked])
  })

  it.each(['stroll', '51.12346', '-2.65432', '51.12346 evening'])('uses displayed coordinates for %j', (query) => {
    expect(filterActivityHistory(records, waypoints, query)).toEqual([independent])
  })

  it.each([
    'walk stroll',
    'walkgarden',
    '2026-08-01',
    'bronze',
    'excluded-idea',
    'excluded-reference',
    'excluded-photo',
    'excluded-description',
    'hidden-geography',
    '51.987654',
    '51.123456',
    '*',
    '"garden"',
    'café',
  ])('does not broaden matching for excluded or literal query %j', (query) => {
    expect(filterActivityHistory(records, waypoints, query)).toEqual([])
  })

  it('reads the current Waypoint title and tolerates a disappeared optional link', () => {
    expect(filterActivityHistory(records, new Map(), 'garden')).toEqual([linked])
    expect(filterActivityHistory(records, new Map(), 'Foxglove')).toEqual([])
    const current = new Map([[waypoint.waypointId, { ...waypoint, title: 'Renamed destination' }]])
    expect(filterActivityHistory(records, current, 'renamed walk')).toEqual([linked])
    expect(filterActivityHistory(records, current, 'Foxglove')).toEqual([])
  })

  it('preserves duplicate-title identity, input order and all input collections', () => {
    const duplicate = { ...linked, activityId: 'duplicate' }
    const input = Object.freeze([duplicate, linked])
    const before = structuredClone(input)
    const result = filterActivityHistory(input, waypoints, 'walk')
    expect(result.map((record) => record.activityId)).toEqual(['duplicate', 'linked'])
    expect(result[0]).toBe(duplicate)
    expect(result[1]).toBe(linked)
    expect(input).toEqual(before)
    expect([...waypoints]).toEqual([[waypoint.waypointId, waypoint]])
  })
})
