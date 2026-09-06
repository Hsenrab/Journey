import { app, type HttpRequest, type HttpResponseInit, type InvocationContext } from '@azure/functions'
import { assertOwnerPrincipal, parseClientPrincipalHeader, PrincipalValidationError } from '../lib/principal.js'
import {
  createDocument,
  datasetIdFor,
  deleteDocument,
  documentFor,
  documentsFor,
  emptyJourneyData,
  journeyContainer,
  loadDataset,
  replaceDocument,
  replaceDataset,
  savedDocument,
} from '../lib/cosmos.js'
import { JourneyMutationSchema } from '../lib/journeySchema.js'

type ContainerName = 'production' | 'demo'

function containerName(request: HttpRequest): ContainerName {
  const value = request.params.container
  if (value !== 'production' && value !== 'demo') throw new Error(`Unsupported Journey container "${value}".`)
  return value
}

function auth(request: HttpRequest): void {
  try {
    assertOwnerPrincipal(parseClientPrincipalHeader(request.headers.get('x-ms-client-principal')))
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

export async function journey(request: HttpRequest, context: InvocationContext): Promise<HttpResponseInit> {
  try {
    auth(request)
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
    if (container === 'demo') throw new ResponseError(405, 'demo_read_only')
    if (parsed.data.operation === 'clear') {
      const loaded = await loadDataset(cosmos, datasetId)
      await replaceDataset(cosmos, datasetId, {}, loaded.etags)
      return { status: 200, jsonBody: { data: emptyJourneyData(), etags: {} } }
    }
    if (parsed.data.operation === 'import') {
      const loaded = await loadDataset(cosmos, datasetId)
      if (Object.keys(loaded.etags).length > 0) throw new ResponseError(409, 'production_not_empty')
      await replaceDataset(cosmos, datasetId, documentsFor(datasetId, parsed.data.data), {})
      return { status: 200, jsonBody: await loadDataset(cosmos, datasetId) }
    }
    if (parsed.data.operation === 'replace') {
      await replaceDataset(cosmos, datasetId, documentsFor(datasetId, parsed.data.data), parsed.data.etags)
      return { status: 200, jsonBody: await loadDataset(cosmos, datasetId) }
    }
    if (parsed.data.operation === 'create') {
      if (request.method !== 'POST') throw new ResponseError(405, 'method_not_allowed')
      const response = await createDocument(cosmos, documentFor(datasetId, parsed.data.type, parsed.data.entity))
      return { status: 201, jsonBody: savedDocument(response) }
    }
    if (parsed.data.operation === 'update') {
      if (request.method !== 'PUT') throw new ResponseError(405, 'method_not_allowed')
      const response = await replaceDocument(
        cosmos,
        documentFor(datasetId, parsed.data.type, parsed.data.entity),
        parsed.data.ifMatch,
      )
      return { status: 200, jsonBody: savedDocument(response) }
    }
    if (request.method !== 'DELETE') throw new ResponseError(405, 'method_not_allowed')
    await deleteDocument(cosmos, parsed.data.id, datasetId, parsed.data.ifMatch)
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
