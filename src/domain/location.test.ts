import { describe, expect, it } from 'vitest'
import { LocationSchema, parseLocations } from './location'

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
