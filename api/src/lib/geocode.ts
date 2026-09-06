import type { TokenCredential } from '@azure/identity'
import { z } from 'zod'
import { acquireMapsAccessToken } from './mapsAuth.js'
import type { EntityType } from './journeySchema.js'

export interface Coordinates {
  latitude: number
  longitude: number
}

export interface SearchResult {
  position?: { lat?: number; lon?: number }
}

export class MapsSearchError extends Error {
  constructor(
    readonly status: number,
    message: string,
  ) {
    super(message)
    this.name = 'MapsSearchError'
  }
}

export class GeocodeError extends Error {
  constructor(message: string) {
    super(message)
    this.name = 'GeocodeError'
  }
}

function requireEnv(name: string): string {
  const value = process.env[name]
  if (!value) throw new Error(`Required application setting "${name}" is not configured.`)
  return value
}

export async function searchAddress(query: string, credential: TokenCredential): Promise<SearchResult[]> {
  const token = await acquireMapsAccessToken(credential)
  const parameters = new URLSearchParams({ 'api-version': '1.0', query })
  const response = await fetch(`https://atlas.microsoft.com/search/address/json?${parameters}`, {
    headers: {
      Authorization: `Bearer ${token.token}`,
      'x-ms-client-id': requireEnv('AZURE_MAPS_CLIENT_ID'),
    },
  })
  if (!response.ok) throw new MapsSearchError(response.status, await response.text())
  const body = (await response.json()) as { results?: SearchResult[] }
  return body.results ?? []
}

export async function geocode(query: string, credential: TokenCredential): Promise<Coordinates> {
  const position = (await searchAddress(query, credential))[0]?.position
  if (typeof position?.lat !== 'number' || typeof position?.lon !== 'number')
    throw new GeocodeError(`Azure Maps found no coordinates for "${query}".`)
  return { latitude: position.lat, longitude: position.lon }
}

const placeInput = z.looseObject({
  placeName: z.string().optional(),
  addressOrRegion: z.string().optional(),
  latitude: z.number().optional(),
  longitude: z.number().optional(),
})

const activityLocationInput = z.looseObject({
  kind: z.string(),
  postcode: z.string().optional(),
  latitude: z.number().optional(),
  longitude: z.number().optional(),
})

function hasCoordinates(location: { latitude?: number; longitude?: number }): boolean {
  return typeof location.latitude === 'number' && typeof location.longitude === 'number'
}

function waypointQuery(location: { placeName?: string; addressOrRegion?: string }): string {
  const query = [location.placeName, location.addressOrRegion].filter(Boolean).join(', ')
  if (!query) throw new GeocodeError('A waypoint location needs a place name or address before it can be geocoded.')
  return query
}

function activityQuery(location: { kind: string; postcode?: string }): string {
  if (location.kind !== 'postcode' || !location.postcode?.trim())
    throw new GeocodeError('An activity location needs a postcode or coordinates before it can be saved.')
  return location.postcode.trim()
}

/**
 * Resolves the coordinates a Waypoint or Activity must carry before it is persisted,
 * geocoding postcode/place-only input once with Azure Maps Search. Other entity types
 * are returned unchanged.
 */
export async function resolveEntityCoordinates(
  type: EntityType,
  entity: Record<string, unknown>,
  credential: TokenCredential,
): Promise<Record<string, unknown>> {
  if (type !== 'waypoint' && type !== 'activity') return entity
  if (entity.location === undefined || entity.location === null) return entity

  if (type === 'waypoint') {
    const location = placeInput.parse(entity.location)
    if (hasCoordinates(location)) return entity
    return { ...entity, location: { ...location, ...(await geocode(waypointQuery(location), credential)) } }
  }

  const location = activityLocationInput.parse(entity.location)
  if (hasCoordinates(location)) return entity
  return { ...entity, location: { ...location, ...(await geocode(activityQuery(location), credential)) } }
}
