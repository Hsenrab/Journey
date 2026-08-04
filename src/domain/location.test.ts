import { describe, expect, it } from 'vitest'
import type { JourneyData, Location } from './location'
import {
  LocationSchema,
  parseLocations,
  progressTowards,
  recentlyVisited,
  statusCounts,
  statusOf,
  stillToVisit,
  suggestedNext,
} from './location'

const valid = {
  locationId: 'chedworth-roman-villa',
  name: 'Chedworth Roman Villa',
  area: 'Gloucestershire',
  category: 'Roman villa',
  travel: { distanceMiles: 13, driveTimeMinutes: 30 },
  url: 'https://www.nationaltrust.org.uk/visit/gloucestershire-cotswolds/chedworth-roman-villa',
  notes: 'Excavated remains of a Roman villa.',
  createdAt: '2026-08-04',
  updatedAt: '2026-08-04',
}

describe('LocationSchema', () => {
  it('accepts a well-formed location record', () => {
    expect(LocationSchema.parse(valid)).toMatchObject({ locationId: 'chedworth-roman-villa' })
  })

  it('rejects a record missing a stable locationId', () => {
    const { locationId, ...rest } = valid
    void locationId
    expect(() => LocationSchema.parse(rest)).toThrow()
  })

  it('rejects an unrecognised category', () => {
    expect(() => LocationSchema.parse({ ...valid, category: 'Café' })).toThrow()
  })

  it('rejects a malformed visitor url', () => {
    expect(() => LocationSchema.parse({ ...valid, url: 'not-a-url' })).toThrow()
  })
})

describe('parseLocations', () => {
  it('parses an empty list', () => {
    expect(parseLocations([])).toEqual([])
  })

  it('does not mutate the source data', () => {
    const source = [valid]
    const frozenSource = JSON.parse(JSON.stringify(source))
    const parsed = parseLocations(source)
    expect(source).toEqual(frozenSource)
    expect(parsed).not.toBe(source)
  })

  it('throws a clear error for invalid records', () => {
    expect(() => parseLocations([{ ...valid, name: '' }])).toThrow()
  })
})

const locations: Location[] = ['a', 'b', 'c'].map((locationId, index) => ({
  ...valid,
  locationId,
  name: locationId.toUpperCase(),
  travel: { distanceMiles: index + 1, driveTimeMinutes: index + 1 },
}))

describe('location domain logic', () => {
  it('reports not-started status when no visit is recorded', () => {
    expect(statusOf({}, 'a')).toBe('not-started')
  })

  it('counts locations by status', () => {
    const data: JourneyData = {
      a: { status: 'bronze', date: '2026-01-01', notes: '', photos: [] },
      b: { status: 'gold', date: '2026-01-02', notes: '', photos: [] },
    }
    expect(statusCounts(locations, data)).toEqual({ 'not-started': 1, bronze: 1, silver: 0, gold: 1 })
  })

  it('calculates progress towards a status as a percentage', () => {
    const data: JourneyData = {
      a: { status: 'silver', date: '2026-01-01', notes: '', photos: [] },
      b: { status: 'gold', date: '2026-01-02', notes: '', photos: [] },
    }
    expect(progressTowards(locations, data, 'silver')).toBe(67)
    expect(progressTowards(locations, data, 'gold')).toBe(33)
  })

  it('orders recently visited locations by most recent date first', () => {
    const data: JourneyData = {
      a: { status: 'bronze', date: '2026-01-01', notes: '', photos: [] },
      b: { status: 'silver', date: '2026-02-01', notes: '', photos: [] },
    }
    expect(recentlyVisited(locations, data).map((location) => location.locationId)).toEqual(['b', 'a'])
  })

  it('lists locations that are still not started', () => {
    const data: JourneyData = { a: { status: 'bronze', date: '2026-01-01', notes: '', photos: [] } }
    expect(stillToVisit(locations, data).map((location) => location.locationId)).toEqual(['b', 'c'])
  })

  it('suggests next locations from those not yet started', () => {
    const data: JourneyData = { a: { status: 'bronze', date: '2026-01-01', notes: '', photos: [] } }
    expect(suggestedNext(locations, data, 1).map((location) => location.locationId)).toEqual(['b'])
  })
})
