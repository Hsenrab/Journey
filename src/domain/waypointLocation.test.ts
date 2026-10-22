import { describe, expect, it } from 'vitest'
import type { Waypoint } from './visit'
import { effectiveWaypointLocation } from './waypointLocation'

type Location = NonNullable<Waypoint['location']>
const named: Location = {
  placeName: 'Old place',
  addressOrRegion: 'Old address',
  latitude: 51,
  longitude: -2,
  source: 'Survey',
  approximate: true,
}

describe('effectiveWaypointLocation', () => {
  it.each([
    { name: 'absent', initial: undefined, current: undefined, expected: undefined },
    { name: 'new searchable text', initial: undefined, current: { placeName: 'New' }, expected: { placeName: 'New' } },
    {
      name: 'new coordinates',
      initial: undefined,
      current: { latitude: 0, longitude: 0 },
      expected: { latitude: 0, longitude: 0 },
    },
    {
      name: 'changed name',
      initial: named,
      current: { ...named, placeName: 'New' },
      expected: { ...named, placeName: 'New', latitude: undefined, longitude: undefined },
    },
    {
      name: 'changed address',
      initial: named,
      current: { ...named, addressOrRegion: 'New' },
      expected: { ...named, addressOrRegion: 'New', latitude: undefined, longitude: undefined },
    },
    {
      name: 'cleared identifying fields',
      initial: named,
      current: { ...named, placeName: undefined, addressOrRegion: undefined },
      expected: undefined,
    },
    {
      name: 'explicit changed pair wins with cleared text',
      initial: named,
      current: { latitude: 52, longitude: -2 },
      expected: { latitude: 52, longitude: -2 },
    },
    {
      name: 'unchanged coordinate-only',
      initial: { latitude: 51, longitude: -2 },
      current: { latitude: 51, longitude: -2 },
      expected: { latitude: 51, longitude: -2 },
    },
    {
      name: 'metadata change',
      initial: named,
      current: { ...named, source: 'Manual', approximate: false },
      expected: { ...named, source: 'Manual', approximate: false },
    },
    {
      name: 'trimmed-equivalent text and numeric equality',
      initial: named,
      current: { ...named, placeName: ' Old place ', latitude: 51.0 },
      expected: { ...named, placeName: 'Old place' },
    },
    {
      name: 'cleared coordinates retain search text',
      initial: named,
      current: { placeName: 'Old place' },
      expected: { placeName: 'Old place' },
    },
  ])('$name', ({ initial, current, expected }) => {
    const before = JSON.stringify({ initial, current })
    expect(effectiveWaypointLocation(initial, current)).toEqual(expected)
    expect(JSON.stringify({ initial, current })).toBe(before)
  })
})
