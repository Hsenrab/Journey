import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

const acquireMapsAccessToken = vi.fn()
vi.mock('./mapsAuth.js', () => ({ acquireMapsAccessToken }))

const originalEnv = { ...process.env }
const credential = {} as never

beforeEach(() => {
  process.env.AZURE_MAPS_CLIENT_ID = 'maps-client-id'
  acquireMapsAccessToken.mockResolvedValue({ token: 'entra-token', expiresOn: '2026-01-01T00:00:00.000Z' })
})
afterEach(() => {
  process.env = { ...originalEnv }
  vi.restoreAllMocks()
})

function searchResults(results: unknown[]) {
  vi.stubGlobal('fetch', vi.fn().mockResolvedValue({ ok: true, json: () => ({ results }) }))
}

describe('save-time geocoding', () => {
  it('resolves postcode and place-only locations once', async () => {
    searchResults([{ position: { lat: 51.415, lon: -2.123 } }])
    const { resolveEntityCoordinates } = await import('./geocode.js')

    expect(
      await resolveEntityCoordinates('activity', { location: { kind: 'postcode', postcode: 'SN15 2LG' } }, credential),
    ).toEqual({ location: { kind: 'postcode', postcode: 'SN15 2LG', latitude: 51.415, longitude: -2.123 } })
    expect(
      await resolveEntityCoordinates(
        'waypoint',
        { location: { placeName: 'Lacock Abbey', addressOrRegion: 'Wiltshire' } },
        credential,
      ),
    ).toEqual({
      location: { placeName: 'Lacock Abbey', addressOrRegion: 'Wiltshire', latitude: 51.415, longitude: -2.123 },
    })
    expect(fetch).toHaveBeenLastCalledWith(
      'https://atlas.microsoft.com/search/address/json?api-version=1.0&query=Lacock+Abbey%2C+Wiltshire',
      expect.anything(),
    )
  })

  it('leaves resolved and non-located entities untouched', async () => {
    searchResults([{ position: { lat: 51.415, lon: -2.123 } }])
    const { resolveEntityCoordinates } = await import('./geocode.js')
    const resolved = { location: { kind: 'coordinates', latitude: 51.1, longitude: -2.1 } }

    expect(await resolveEntityCoordinates('activity', resolved, credential)).toBe(resolved)
    expect(await resolveEntityCoordinates('waypoint', { title: 'No location' }, credential)).toEqual({
      title: 'No location',
    })
    expect(await resolveEntityCoordinates('idea', { location: { placeName: 'Somewhere' } }, credential)).toEqual({
      location: { placeName: 'Somewhere' },
    })
    expect(fetch).not.toHaveBeenCalled()
  })

  it('fails when Azure Maps returns no coordinates or the location cannot be searched', async () => {
    searchResults([])
    const { GeocodeError, resolveEntityCoordinates } = await import('./geocode.js')

    await expect(
      resolveEntityCoordinates('activity', { location: { kind: 'postcode', postcode: 'SN15 2LG' } }, credential),
    ).rejects.toThrow('Azure Maps found no coordinates for "SN15 2LG".')
    await expect(
      resolveEntityCoordinates('waypoint', { location: { source: 'Manual' } }, credential),
    ).rejects.toBeInstanceOf(GeocodeError)
  })

  it('reports an Azure Maps search failure with its status', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({ ok: false, status: 429, text: () => 'Too many requests' }))
    const { MapsSearchError, searchAddress } = await import('./geocode.js')

    await expect(searchAddress('SN15 2LG', credential)).rejects.toMatchObject(
      new MapsSearchError(429, 'Too many requests'),
    )
  })
})
