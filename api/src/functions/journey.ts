import { app, type HttpRequest, type HttpResponseInit, type InvocationContext } from '@azure/functions'
import {
  journeyRoleForPrincipal,
  parseClientPrincipalHeader,
  PrincipalValidationError,
  type JourneyRole,
} from '../lib/principal.js'
import {
  datasetIdFor,
  documentFor,
  documentsFor,
  documentsToData,
  emptyJourneyData,
  journeyContainer,
  loadDataset,
  replaceDataset,
  StoredJourneyRelationshipError,
} from '../lib/cosmos.js'
import { JourneyDataSchema, JourneyMutationSchema, type EntityType } from '../lib/journeySchema.js'
import { GeocodeError, resolveEntityCoordinates } from '../lib/geocode.js'
import { DefaultAzureCredential } from '@azure/identity'
import {
  applyPlan,
  awardTransitionError,
  deletionPlan,
  referenceIntegrityError,
  upsertEntity,
} from '../lib/journeyGraph.js'
import { ZodError } from 'zod'

type ContainerName = 'production' | 'demo'

function containerName(request: HttpRequest): ContainerName {
  const value = request.params.container
  if (value !== 'production' && value !== 'demo') throw new Error(`Unsupported Journey container "${value}".`)
  return value
}

function auth(request: HttpRequest): JourneyRole {
  try {
    return journeyRoleForPrincipal(parseClientPrincipalHeader(request.headers.get('x-ms-client-principal')))
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
    const role = auth(request)
    const container = containerName(request)
    const datasetId = datasetIdFor(container)
    const cosmos = journeyContainer(container)

    if (request.method === 'GET') {
      const loaded = await loadDataset(cosmos, datasetId)
      return { status: 200, jsonBody: { data: loaded.data, etags: loaded.etags, datasetId, role } }
    }
    if (role !== 'admin') throw new ResponseError(403, 'forbidden')

    const parsed = JourneyMutationSchema.safeParse(await request.json())
    if (!parsed.success)
      return { status: 400, jsonBody: { error: parsed.error.issues[0]?.message ?? 'Invalid request.' } }
    if (parsed.data.operation === 'clear') {
      const loaded = await loadDataset(cosmos, datasetId)
      await replaceDataset(cosmos, datasetId, {}, loaded.etags)
      return { status: 200, jsonBody: { data: emptyJourneyData(), etags: {} } }
    }
    if (parsed.data.operation === 'import') {
      const invalid = referenceIntegrityError(parsed.data.data)
      if (invalid) return { status: 400, jsonBody: { error: invalid } }
      const loaded = await loadDataset(cosmos, datasetId)
      if (Object.keys(loaded.etags).length > 0) throw new ResponseError(409, 'data_not_empty')
      await replaceDataset(cosmos, datasetId, documentsFor(datasetId, parsed.data.data), {})
      return { status: 200, jsonBody: await loadDataset(cosmos, datasetId) }
    }
    if (parsed.data.operation === 'replace') {
      const invalid = referenceIntegrityError(parsed.data.data)
      if (invalid) return { status: 400, jsonBody: { error: invalid } }

      const resolvedWaypoints: unknown[] = []
      for (const waypoint of parsed.data.data.waypoints) {
        const location = waypoint.location
        if (
          location === undefined ||
          ('latitude' in location &&
            'longitude' in location &&
            typeof location.latitude === 'number' &&
            typeof location.longitude === 'number')
        ) {
          resolvedWaypoints.push(waypoint)
        } else {
          resolvedWaypoints.push(await geocodedEntity('waypoint', waypoint))
        }
      }

      const finalData = JourneyDataSchema.safeParse({ ...parsed.data.data, waypoints: resolvedWaypoints })
      if (!finalData.success)
        return { status: 400, jsonBody: { error: finalData.error.issues[0]?.message ?? 'Invalid request.' } }
      const finalGraphError = referenceIntegrityError(finalData.data)
      if (finalGraphError) return { status: 400, jsonBody: { error: finalGraphError } }

      const loaded = await loadDataset(cosmos, datasetId)
      const expectedEtags = parsed.data.etags
      if (
        Object.keys(loaded.etags).length !== Object.keys(expectedEtags).length ||
        Object.entries(loaded.etags).some(
          ([id, etag]) => !Object.hasOwn(expectedEtags, id) || expectedEtags[id] !== etag,
        )
      )
        throw new ResponseError(409, 'conflict')
      const transitionError = awardTransitionError(loaded.data, finalData.data)
      if (transitionError) throw new ResponseError(400, transitionError)
      await replaceDataset(cosmos, datasetId, documentsFor(datasetId, finalData.data), expectedEtags)
      return { status: 200, jsonBody: await loadDataset(cosmos, datasetId) }
    }
    if (parsed.data.operation === 'create' || parsed.data.operation === 'update') {
      const method = parsed.data.operation === 'create' ? 'POST' : 'PUT'
      if (request.method !== method) throw new ResponseError(405, 'method_not_allowed')
      const entity = await geocodedEntity(parsed.data.type, parsed.data.entity)
      const document = entityDocument(datasetId, parsed.data.type, entity)
      if (parsed.data.operation === 'update' && document.id !== parsed.data.id)
        throw new ResponseError(400, 'Entity ID does not match update ID.')
      const loaded = await loadDataset(cosmos, datasetId)
      if (parsed.data.operation === 'update' && loaded.etags[document.id] !== parsed.data.ifMatch)
        throw new ResponseError(409, 'conflict')
      if (parsed.data.operation === 'create' && Object.hasOwn(loaded.etags, document.id))
        throw new ResponseError(409, 'conflict')
      const candidate = upsertEntity(loaded.data, document.type, document.entity)
      const invalid = awardTransitionError(loaded.data, candidate) ?? referenceIntegrityError(candidate)
      if (invalid) return { status: 400, jsonBody: { error: invalid } }
      const documents = documentsFor(datasetId, candidate)
      const etags = await replaceDataset(cosmos, datasetId, documents, loaded.etags)
      if (!etags[document.id]) throw new Error(`Journey document "${document.id}" has no ETag in its batch response.`)
      if (parsed.data.operation === 'update' && document.type === 'waypoint') {
        for (const [id, etag] of Object.entries(etags))
          if (!etag) throw new Error(`Journey document "${id}" has no ETag in its batch response.`)
        return { status: 200, jsonBody: { data: documentsToData(Object.values(documents)), etags } }
      }
      return {
        status: parsed.data.operation === 'create' ? 201 : 200,
        jsonBody: { entity: document.entity, etag: etags[document.id] },
      }
    }
    if (request.method !== 'DELETE') throw new ResponseError(405, 'method_not_allowed')
    const loaded = await loadDataset(cosmos, datasetId)
    if (loaded.etags[parsed.data.id] !== parsed.data.ifMatch) throw new ResponseError(409, 'conflict')
    const plan = deletionPlan(loaded.data, parsed.data.type, parsed.data.id)
    const candidate = applyPlan(loaded.data, plan)
    const invalid = awardTransitionError(loaded.data, candidate) ?? referenceIntegrityError(candidate)
    if (invalid) return { status: 400, jsonBody: { error: invalid } }
    await replaceDataset(cosmos, datasetId, documentsFor(datasetId, candidate), loaded.etags)
    return { status: 204 }
  } catch (error) {
    if (error instanceof ResponseError) return { status: error.status, jsonBody: { error: error.code } }
    if (error instanceof StoredJourneyRelationshipError) return { status: 422, jsonBody: { error: error.message } }
    if (typeof error === 'object' && error !== null && 'code' in error && (error.code === 412 || error.code === 409)) {
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
