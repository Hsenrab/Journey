import { DataSchema, type WaypointsData } from '../domain/visit'

type Container = 'production' | 'demo' | 'test'
type EntityType = 'waypoint' | 'challenge' | 'idea' | 'activity' | 'reference' | 'photoReference'

function responseError(response: Response): Error {
  return new Error(`Journey API request failed with ${response.status}: ${response.statusText}`)
}

async function request<T>(container: Container, init?: RequestInit): Promise<T> {
  const response = await fetch(`/api/journey/${container}`, {
    ...init,
    headers: { 'content-type': 'application/json', ...init?.headers },
  })
  if (!response.ok) throw responseError(response)
  if (response.status === 204) return undefined as T
  return (await response.json()) as T
}

export async function loadJourney(
  container: Container,
): Promise<{ data: WaypointsData; etags: Record<string, string> }> {
  const result = await request<{ data: unknown; etags: Record<string, string> }>(container)
  return { data: DataSchema.parse(result.data), etags: result.etags }
}

export async function createJourneyEntity(
  container: Container,
  type: EntityType,
  entity: Record<string, unknown>,
): Promise<{ etag?: string }> {
  return request(container, { method: 'POST', body: JSON.stringify({ operation: 'create', type, entity }) })
}

export async function updateJourneyEntity(
  container: Container,
  type: EntityType,
  entity: Record<string, unknown>,
  id: string,
  etag: string,
): Promise<{ etag?: string }> {
  return request(container, {
    method: 'PUT',
    body: JSON.stringify({ operation: 'update', type, id, entity, ifMatch: etag }),
  })
}

export async function deleteJourneyEntity(
  container: Container,
  type: EntityType,
  id: string,
  etag: string,
): Promise<void> {
  await request(container, { method: 'DELETE', body: JSON.stringify({ operation: 'delete', type, id, ifMatch: etag }) })
}

export async function importJourney(container: Container, data: WaypointsData): Promise<void> {
  await request(container, { method: 'POST', body: JSON.stringify({ operation: 'import', data }) })
}

export async function clearJourney(container: Container): Promise<void> {
  await request(container, { method: 'POST', body: JSON.stringify({ operation: 'clear' }) })
}
