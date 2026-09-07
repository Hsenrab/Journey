import { execFileSync } from 'node:child_process'
import { readFile, writeFile } from 'node:fs/promises'
import { pathToFileURL } from 'node:url'

/**
 * One-time backfill for the static seed catalogue in `src/data/locations.json`.
 * Every location is geocoded once with Azure Maps Search and the coordinates are
 * written back into the checked-in file, so the application never bulk geocodes
 * static content at runtime. Run it manually when catalogue entries are added:
 *
 *   az login
 *   AZURE_MAPS_CLIENT_ID=<maps account client id> \
 *     node --experimental-strip-types scripts/backfill-location-coordinates.ts
 */

export interface SeedLocation {
  locationId: string
  name: string
  area: string
  latitude?: number
  longitude?: number
}

export interface Coordinates {
  latitude: number
  longitude: number
}

export type Geocoder = (query: string) => Promise<Coordinates>

export interface SearchResult {
  position?: { lat?: number; lon?: number }
}

export function geocodeQueryFor(location: SeedLocation): string {
  return `${location.name}, ${location.area}, United Kingdom`
}

export function coordinatesFrom(query: string, results: readonly SearchResult[]): Coordinates {
  const position = results[0]?.position
  if (typeof position?.lat !== 'number' || typeof position?.lon !== 'number')
    throw new Error(`Azure Maps found no coordinates for "${query}".`)
  return { latitude: position.lat, longitude: position.lon }
}

export async function backfillCoordinates<T extends SeedLocation>(
  locations: readonly T[],
  geocode: Geocoder,
): Promise<T[]> {
  const filled: T[] = []
  for (const location of locations) {
    if (typeof location.latitude === 'number' && typeof location.longitude === 'number') {
      filled.push(location)
      continue
    }
    filled.push({ ...location, ...(await geocode(geocodeQueryFor(location))) })
  }
  return filled
}

function mapsToken(): string {
  const output = execFileSync(
    'az',
    ['account', 'get-access-token', '--resource', 'https://atlas.microsoft.com', '--output', 'json'],
    { encoding: 'utf8' },
  )
  return (JSON.parse(output) as { accessToken: string }).accessToken
}

async function main(): Promise<void> {
  const clientId = process.env.AZURE_MAPS_CLIENT_ID
  if (!clientId) throw new Error('AZURE_MAPS_CLIENT_ID must be set to the Azure Maps account client ID.')
  const token = mapsToken()
  const path = new URL('../src/data/locations.json', import.meta.url)
  const locations = JSON.parse(await readFile(path, 'utf8')) as SeedLocation[]

  const geocode: Geocoder = async (query) => {
    const parameters = new URLSearchParams({ 'api-version': '1.0', query })
    const response = await fetch(`https://atlas.microsoft.com/search/address/json?${parameters}`, {
      headers: { Authorization: `Bearer ${token}`, 'x-ms-client-id': clientId },
    })
    if (!response.ok) throw new Error(`Azure Maps search failed with status ${response.status}.`)
    const body = (await response.json()) as { results?: SearchResult[] }
    return coordinatesFrom(query, body.results ?? [])
  }

  const filled = await backfillCoordinates(locations, geocode)
  await writeFile(path, `${JSON.stringify(filled, null, 2)}\n`)
  console.log(`Backfilled coordinates for ${filled.length} seed locations.`)
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) await main()
