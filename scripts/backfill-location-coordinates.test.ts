import { describe, expect, it, vi } from 'vitest'
import { backfillCoordinates, coordinatesFrom, geocodeQueryFor } from './backfill-location-coordinates.ts'

const location = (locationId: string, latitude?: number, longitude?: number) => ({
  locationId,
  name: 'Lacock Abbey',
  area: 'Wiltshire',
  latitude,
  longitude,
})

describe('seed location coordinate backfill', () => {
  it('searches Azure Maps for the catalogue name, area and country', () => {
    expect(geocodeQueryFor(location('lacock-abbey'))).toBe('Lacock Abbey, Wiltshire, United Kingdom')
  })

  it('fills only the locations that have no coordinates yet', async () => {
    const geocode = vi.fn().mockResolvedValue({ latitude: 51.415, longitude: -2.123 })

    expect(await backfillCoordinates([location('a'), location('b', 50, -1)], geocode)).toEqual([
      { ...location('a'), latitude: 51.415, longitude: -2.123 },
      location('b', 50, -1),
    ])
    expect(geocode).toHaveBeenCalledExactlyOnceWith('Lacock Abbey, Wiltshire, United Kingdom')
  })

  it('fails when a location cannot be geocoded', () => {
    expect(coordinatesFrom('Lacock Abbey', [{ position: { lat: 51.415, lon: -2.123 } }])).toEqual({
      latitude: 51.415,
      longitude: -2.123,
    })
    expect(() => coordinatesFrom('Lacock Abbey', [])).toThrow('Azure Maps found no coordinates for "Lacock Abbey".')
  })
})
