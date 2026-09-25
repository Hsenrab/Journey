import { DataSchema, type WaypointsData } from '../domain/visit'
import { z } from 'zod'

export type JourneyContainer = 'production' | 'demo'
const JourneyRoleSchema = z.enum(['admin', 'viewer'])
export type JourneyRole = z.infer<typeof JourneyRoleSchema>
type EntityType = 'waypoint' | 'challenge' | 'idea' | 'activity' | 'reference' | 'photoReference'

export class JourneyConflictError extends Error {
  constructor() {
    super('Your data has changed in another session.')
  }
}

export class JourneyImportNotEmptyError extends Error {
  constructor() {
    super('The active dataset must be empty before restoring a backup.')
  }
}

async function responseError(response: Response): Promise<Error> {
  if (response.status === 409) {
    const body = (await response.json().catch(() => undefined)) as { error?: unknown } | undefined
    if (body?.error === 'conflict') return new JourneyConflictError()
    if (body?.error === 'data_not_empty') return new JourneyImportNotEmptyError()
  }
  return new Error(`Journey API request failed with ${response.status}: ${response.statusText}`)
}

async function request<T>(container: JourneyContainer, init?: RequestInit): Promise<T> {
  const response = await fetch(`/api/journey/${container}`, {
    ...init,
    headers: { 'content-type': 'application/json', ...init?.headers },
  })
  if (!response.ok) throw await responseError(response)
  if (response.status === 204) return undefined as T
  return (await response.json()) as T
}

export async function loadJourney(
  container: JourneyContainer,
): Promise<{ data: WaypointsData; etags: Record<string, string>; role: JourneyRole }> {
  const result = await request<{ data: unknown; etags: Record<string, string>; role: unknown }>(container)
  return { data: DataSchema.parse(result.data), etags: result.etags, role: JourneyRoleSchema.parse(result.role) }
}

export async function createJourneyEntity(
  container: JourneyContainer,
  type: EntityType,
  entity: Record<string, unknown>,
): Promise<{ etag?: string }> {
  return request(container, { method: 'POST', body: JSON.stringify({ operation: 'create', type, entity }) })
}

export async function updateJourneyEntity(
  container: JourneyContainer,
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
  container: JourneyContainer,
  type: EntityType,
  id: string,
  etag: string,
): Promise<void> {
  await request(container, { method: 'DELETE', body: JSON.stringify({ operation: 'delete', type, id, ifMatch: etag }) })
}

export async function importJourney(
  container: JourneyContainer,
  data: WaypointsData,
): Promise<{ data: WaypointsData; etags: Record<string, string> }> {
  const result = await request<{ data: unknown; etags: Record<string, string> }>(container, {
    method: 'POST',
    body: JSON.stringify({ operation: 'import', data }),
  })
  return { data: DataSchema.parse(result.data), etags: result.etags }
}

export async function replaceJourney(
  container: JourneyContainer,
  data: WaypointsData,
  etags: Record<string, string>,
): Promise<{ data: WaypointsData; etags: Record<string, string> }> {
  const result = await request<{ data: unknown; etags: Record<string, string> }>(container, {
    method: 'POST',
    body: JSON.stringify({ operation: 'replace', data, etags }),
  })
  return { data: DataSchema.parse(result.data), etags: result.etags }
}

export async function clearJourney(
  container: JourneyContainer,
): Promise<{ data: WaypointsData; etags: Record<string, string> }> {
  const result = await request<{ data: unknown; etags: Record<string, string> }>(container, {
    method: 'POST',
    body: JSON.stringify({ operation: 'clear' }),
  })
  return { data: DataSchema.parse(result.data), etags: result.etags }
}
