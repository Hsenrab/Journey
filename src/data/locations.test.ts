import { describe, expect, it } from 'vitest'
import { locations, MAX_DRIVE_TIME_MINUTES } from './locations'

describe('location catalogue', () => {
  it('contains a substantially expanded catalogue', () => {
    expect(locations).toHaveLength(126)
  })

  it('keeps unique stable ids and National Trust URLs', () => {
    const ids = new Set(locations.map((location) => location.locationId))

    expect(ids.size).toBe(locations.length)
    expect(locations.every((location) => location.url.startsWith('https://www.nationaltrust.org.uk/'))).toBe(true)
  })

  it('keeps every location within the 150-minute drive boundary', () => {
    expect(locations.every((location) => location.travel.driveTimeMinutes <= MAX_DRIVE_TIME_MINUTES)).toBe(true)
  })

  it('includes catalogue metadata needed by the UI', () => {
    expect(
      locations.every(
        (location) =>
          location.name &&
          location.area &&
          location.category &&
          location.travel.distanceMiles > 0 &&
          location.notes &&
          location.createdAt &&
          location.updatedAt,
      ),
    ).toBe(true)
  })
})
