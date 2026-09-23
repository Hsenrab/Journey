import { app, type HttpRequest, type HttpResponseInit, type InvocationContext } from '@azure/functions'
import {
  assertJourneyPrincipal,
  parseClientPrincipalHeader,
  PrincipalValidationError,
  type JourneyRole,
} from '../lib/principal.js'
import {
  createDocument,
  datasetIdFor,
  deleteEntity,
  documentFor,
  documentsFor,
  emptyJourneyData,
  journeyContainer,
  loadDataset,
  replaceDocument,
  replaceDataset,
  savedDocument,
} from '../lib/cosmos.js'
import { JourneyMutationSchema, type EntityType } from '../lib/journeySchema.js'
import { GeocodeError, resolveEntityCoordinates } from '../lib/geocode.js'
import { DefaultAzureCredential } from '@azure/identity'
import { entityId, entityKey, referenceIntegrityError, upsertEntity } from '../lib/journeyGraph.js'
import { ZodError } from 'zod'

type ContainerName = 'production' | 'demo'

function containerName(request: HttpRequest): ContainerName {
  const value = request.params.container
  if (value !== 'production' && value !== 'demo') throw new Error(`Unsupported Journey container "${value}".`)
  return value
}

function auth(request: HttpRequest): { role: JourneyRole; ownerId: string } {
  try {
    return assertJourneyPrincipal(parseClientPrincipalHeader(request.headers.get('x-ms-client-principal')))
  } catch (error) {
    if (error instanceof PrincipalValidationError) throw new ResponseError(403, 'forbidden')
    throw error
  }
}

class ResponseError extends Error {
  constructor(
    readonly status: number,
    readonly code: string,
  ) {
    super(code)
  }
}

function entityDocument(datasetId: string, type: EntityType, entity: Record<string, unknown>) {
  try {
    return documentFor(datasetId, type, entity)
  } catch (error) {
    if (error instanceof ZodError) throw new ResponseError(400, error.issues[0]?.message ?? 'Invalid entity.')
    if (error instanceof Error && error.message.includes('missing its identifier.'))
      throw new ResponseError(400, error.message)
    throw error
  }
}

async function geocodedEntity(type: EntityType, entity: Record<string, unknown>): Promise<Record<string, unknown>> {
  try {
    return await resolveEntityCoordinates(type, entity, new DefaultAzureCredential())
  } catch (error) {
    if (error instanceof GeocodeError) throw new ResponseError(400, error.message)
    if (error instanceof ZodError) throw new ResponseError(400, error.issues[0]?.message ?? 'Invalid location.')
    throw error
  }
}

export async function journey(request: HttpRequest, context: InvocationContext): Promise<HttpResponseInit> {
  try {
    const { role, ownerId } = auth(request)
    const container = containerName(request)
    const datasetId = datasetIdFor(container)
    const cosmos = journeyContainer(container)

    if (request.method === 'GET') {
      const loaded = await loadDataset(cosmos, datasetId)
      return { status: 200, jsonBody: { data: loaded.data, etags: loaded.etags, datasetId } }
    }

    const parsed = JourneyMutationSchema.safeParse(await request.json())
    if (!parsed.success)
      return { status: 400, jsonBody: { error: parsed.error.issues[0]?.message ?? 'Invalid request.' } }
    if (parsed.data.operation === 'clear') {
      if (role !== 'owner') throw new ResponseError(403, 'forbidden')
      const loaded = await loadDataset(cosmos, datasetId)
      await replaceDataset(cosmos, datasetId, {}, loaded.etags)
      return { status: 200, jsonBody: { data: emptyJourneyData(), etags: {} } }
    }
    if (parsed.data.operation === 'import') {
      if (role !== 'owner') throw new ResponseError(403, 'forbidden')
      const invalid = referenceIntegrityError(parsed.data.data)
      if (invalid) return { status: 400, jsonBody: { error: invalid } }
      const loaded = await loadDataset(cosmos, datasetId)
      if (Object.keys(loaded.etags).length > 0) throw new ResponseError(409, 'data_not_empty')
      await replaceDataset(cosmos, datasetId, documentsFor(datasetId, parsed.data.data), {})
      return { status: 200, jsonBody: await loadDataset(cosmos, datasetId) }
    }
    if (parsed.data.operation === 'replace') {
      if (role !== 'owner') throw new ResponseError(403, 'forbidden')
      const invalid = referenceIntegrityError(parsed.data.data)
      if (invalid) return { status: 400, jsonBody: { error: invalid } }
      await replaceDataset(cosmos, datasetId, documentsFor(datasetId, parsed.data.data), parsed.data.etags)
      return { status: 200, jsonBody: await loadDataset(cosmos, datasetId) }
    }
    if (parsed.data.operation === 'create' || parsed.data.operation === 'update') {
      if (role === 'viewer') throw new ResponseError(403, 'forbidden')
      const method = parsed.data.operation === 'create' ? 'POST' : 'PUT'
      if (request.method !== method) throw new ResponseError(405, 'method_not_allowed')
      const loaded = await loadDataset(cosmos, datasetId)
      const type = parsed.data.type
      const entities = loaded.data[entityKey(type)]
      let existing: (typeof entities)[number] | undefined
      if (parsed.data.operation === 'update') {
        const id = parsed.data.id
        existing = entities.find((item) => entityId(type, item) === id)
      }
      if (existing && role !== 'owner' && existing.ownerId !== ownerId) throw new ResponseError(403, 'forbidden')
      const sourceEntity =
        parsed.data.operation === 'create'
          ? { ...parsed.data.entity, ownerId }
          : { ...parsed.data.entity, ownerId: existing?.ownerId ?? ownerId }
      const entity = await geocodedEntity(parsed.data.type, sourceEntity)
      const document = entityDocument(datasetId, parsed.data.type, entity)
      const invalid = referenceIntegrityError(upsertEntity(loaded.data, document.type, document.entity))
      if (invalid) return { status: 400, jsonBody: { error: invalid } }
      if (parsed.data.operation === 'create') {
        return { status: 201, jsonBody: savedDocument(await createDocument(cosmos, document)) }
      }
      return { status: 200, jsonBody: savedDocument(await replaceDocument(cosmos, document, parsed.data.ifMatch)) }
    }
    if (role === 'viewer') throw new ResponseError(403, 'forbidden')
    if (request.method !== 'DELETE') throw new ResponseError(405, 'method_not_allowed')
    const loaded = await loadDataset(cosmos, datasetId)
    const deleteType = parsed.data.type
    const deleteId = parsed.data.id
    const existing = loaded.data[entityKey(deleteType)].find((item) => entityId(deleteType, item) === deleteId)
    if (existing && role !== 'owner' && existing.ownerId !== ownerId) throw new ResponseError(403, 'forbidden')
    await deleteEntity(cosmos, datasetId, parsed.data.type, parsed.data.id, parsed.data.ifMatch, loaded)
    return { status: 204 }
  } catch (error) {
    if (error instanceof ResponseError) return { status: error.status, jsonBody: { error: error.code } }
    if (typeof error === 'object' && error !== null && 'code' in error && error.code === 412) {
      return { status: 409, jsonBody: { error: 'conflict' } }
    }
    context.error(`Journey API failed: ${error instanceof Error ? error.message : String(error)}`)
    throw error
  }
}

app.http('journey', {
  methods: ['GET', 'POST', 'PUT', 'DELETE'],
  authLevel: 'anonymous',
  route: 'journey/{container}',
  handler: journey,
})
