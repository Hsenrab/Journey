import { describe, expect, it } from 'vitest'
import { createVisit, statusForLocation, visitsForLocation } from './visit'

describe('visit rules', () => {
  it('creates a visit with a stable id and timestamps', () => {
    const visit = createVisit({ locationId: 'lyme', date: '2026-08-01', status: 'bronze' })
    expect(visit.visitId).not.toHaveLength(0)
    expect(visit.createdAt).toBe(visit.updatedAt)
  })

  it('rejects an invalid visit date', () => {
    expect(() => createVisit({ locationId: 'lyme', date: 'yesterday', status: 'bronze' })).toThrow()
  })

  it('reports Not Started when no visit exists', () => {
    expect(statusForLocation([], 'lyme')).toBe('not-started')
  })

  it('derives the highest awarded status across multiple visits', () => {
    const visits = [
      createVisit({ locationId: 'lyme', date: '2026-08-01', status: 'bronze' }),
      createVisit({ locationId: 'lyme', date: '2026-08-02', status: 'gold' }),
      createVisit({ locationId: 'lyme', date: '2026-08-03', status: 'silver' }),
      createVisit({ locationId: 'hare-hill', date: '2026-08-03', status: 'bronze' }),
    ]
    expect(statusForLocation(visits, 'lyme')).toBe('gold')
    expect(statusForLocation(visits, 'hare-hill')).toBe('bronze')
    expect(visitsForLocation(visits, 'lyme')).toHaveLength(3)
  })
})
