import { describe, expect, it } from 'vitest'
import type { Location } from './location'
import {
  createVisit,
  progressTowards,
  recentlyVisited,
  statusCounts,
  statusForLocation,
  stillToVisit,
  suggestedNext,
  visitsForLocation,
} from './visit'

describe('visit rules', () => {
  it('creates a visit with a stable id and timestamps', () => {
    const visit = createVisit({ locationId: 'lacock-abbey', date: '2026-08-01', status: 'bronze' })
    expect(visit.visitId).not.toHaveLength(0)
    expect(visit.createdAt).toBe(visit.updatedAt)
  })

  it('rejects an invalid visit date', () => {
    expect(() => createVisit({ locationId: 'lacock-abbey', date: 'yesterday', status: 'bronze' })).toThrow()
  })

  it('reports Not Started when no visit exists', () => {
    expect(statusForLocation([], 'lacock-abbey')).toBe('not-started')
  })

  it('derives the highest awarded status across multiple visits', () => {
    const visits = [
      createVisit({ locationId: 'lacock-abbey', date: '2026-08-01', status: 'bronze' }),
      createVisit({ locationId: 'lacock-abbey', date: '2026-08-02', status: 'gold' }),
      createVisit({ locationId: 'lacock-abbey', date: '2026-08-03', status: 'silver' }),
      createVisit({ locationId: 'cliveden', date: '2026-08-03', status: 'bronze' }),
    ]
    expect(statusForLocation(visits, 'lacock-abbey')).toBe('gold')
    expect(statusForLocation(visits, 'cliveden')).toBe('bronze')
    expect(visitsForLocation(visits, 'lacock-abbey')).toHaveLength(3)
  })
})

const location = (locationId: string, index: number): Location => ({
  locationId,
  name: locationId.toUpperCase(),
  area: 'Gloucestershire',
  category: 'Roman villa',
  travel: { distanceMiles: index + 1, driveTimeMinutes: index + 1 },
  url: 'https://www.nationaltrust.org.uk/visit/gloucestershire-cotswolds/chedworth-roman-villa',
  notes: 'Excavated remains of a Roman villa.',
  createdAt: '2026-08-04',
  updatedAt: '2026-08-04',
})

const locations: Location[] = ['a', 'b', 'c'].map(location)

describe('progress across locations', () => {
  it('counts locations by derived status', () => {
    const visits = [
      createVisit({ locationId: 'a', date: '2026-01-01', status: 'bronze' }),
      createVisit({ locationId: 'b', date: '2026-01-02', status: 'gold' }),
    ]
    expect(statusCounts(locations, visits)).toEqual({ 'not-started': 1, bronze: 1, silver: 0, gold: 1 })
  })

  it('calculates progress towards a status as a percentage', () => {
    const visits = [
      createVisit({ locationId: 'a', date: '2026-01-01', status: 'silver' }),
      createVisit({ locationId: 'b', date: '2026-01-02', status: 'gold' }),
    ]
    expect(progressTowards(locations, visits, 'silver')).toBe(67)
    expect(progressTowards(locations, visits, 'gold')).toBe(33)
  })

  it('orders recently visited locations by most recent visit first', () => {
    const visits = [
      createVisit({ locationId: 'a', date: '2026-01-01', status: 'bronze' }),
      createVisit({ locationId: 'b', date: '2026-02-01', status: 'silver' }),
    ]
    expect(recentlyVisited(locations, visits).map((item) => item.locationId)).toEqual(['b', 'a'])
  })

  it('lists locations that are still not started', () => {
    const visits = [createVisit({ locationId: 'a', date: '2026-01-01', status: 'bronze' })]
    expect(stillToVisit(locations, visits).map((item) => item.locationId)).toEqual(['b', 'c'])
  })

  it('suggests next locations from those not yet started', () => {
    const visits = [createVisit({ locationId: 'a', date: '2026-01-01', status: 'bronze' })]
    expect(suggestedNext(locations, visits, 1).map((item) => item.locationId)).toEqual(['b'])
  })
})
