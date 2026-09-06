import { CosmosClient, type Container, type Database, type ItemResponse } from '@azure/cosmos'
import { DefaultAzureCredential } from '@azure/identity'
import { readFile } from 'node:fs/promises'
import { deletionPlan, entityId, entityKey, entityTypeFor } from './journeyGraph.js'
import {
  JourneyDataSchema,
  JourneyDocumentSchema,
  schemaVersions,
  type EntityType,
  type JourneyData,
  type JourneyDocument,
} from './journeySchema.js'

let client: CosmosClient | undefined
let database: Database | undefined

function required(name: string): string {
  const value = process.env[name]
  if (!value) throw new Error(`Required application setting "${name}" is not configured.`)
  return value
}

export function journeyContainer(name: 'production' | 'demo' = 'production'): Container {
  client ??= new CosmosClient({ endpoint: required('COSMOS_ENDPOINT'), aadCredentials: new DefaultAzureCredential() })
  if (!database) database = client.database(required('COSMOS_DATABASE_NAME'))
  return database.container(name)
}

export function datasetIdFor(name: 'production' | 'demo'): string {
  return required(`COSMOS_${name.toUpperCase()}_DATASET_ID`)
}

export function documentsToData(documents: JourneyDocument[]): JourneyData {
  const data: JourneyData = {
    waypoints: [],
    challenges: [],
    ideas: [],
    activities: [],
    references: [],
    photoReferences: [],
  }
  for (const document of documents) data[entityKey(document.type)].push(document.entity as never)
  return data
}

export async function loadDataset(
  container: Container,
  datasetId: string,
): Promise<{ data: JourneyData; etags: Record<string, string> }> {
  const documents: JourneyDocument[] = []
  const etags: Record<string, string> = {}
  let continuation: string | undefined
  do {
    const response = await container.items
      .query<JourneyDocument>(
        {
          query: 'SELECT * FROM c WHERE c.datasetId = @datasetId',
          parameters: [{ name: '@datasetId', value: datasetId }],
        },
        { continuationToken: continuation },
      )
      .fetchNext()
    for (const item of response.resources) {
      const raw = item as JourneyDocument & Record<string, unknown>
      const etag = raw._etag
      for (const key of ['_etag', '_rid', '_self', '_attachments', '_ts']) delete raw[key]
      const domainDocument = raw
      const document = JourneyDocumentSchema.parse(domainDocument)
      documents.push(document)
      if (typeof etag === 'string') etags[document.id] = etag
    }
    continuation = response.continuationToken
  } while (continuation)
  return { data: documentsToData(documents), etags }
}

export function documentFor(datasetId: string, type: EntityType, entity: Record<string, unknown>): JourneyDocument {
  const id = entityId(type, entity)
  return JourneyDocumentSchema.parse({
    id,
    datasetId,
    type,
    schemaVersion: schemaVersions[type],
    entity,
  }) as JourneyDocument
}

export function emptyJourneyData(): JourneyData {
  return { waypoints: [], challenges: [], ideas: [], activities: [], references: [], photoReferences: [] }
}

export function documentsFor(datasetId: string, data: JourneyData): Record<string, JourneyDocument> {
  const documents: Record<string, JourneyDocument> = {}
  for (const [key, entities] of Object.entries(data)) {
    const type = entityTypeFor(key as keyof JourneyData)
    for (const entity of entities) {
      const document = documentFor(datasetId, type, entity)
      documents[document.id] = document
    }
  }
  return documents
}

async function runBatch(container: Container, datasetId: string, operations: unknown[]) {
  if (operations.length > 100)
    throw new Error(`${operations.length} operations exceed the Cosmos transactional batch limit of 100 operations.`)
  if (operations.length === 0) return
  const response = await container.items.batch(operations as never, datasetId)
  if (response.code !== 200) {
    const failed = response.result?.find((result) => result.statusCode >= 400)
    throw Object.assign(new Error('Cosmos transactional batch failed.'), {
      code: failed?.statusCode ?? response.code,
    })
  }
}

export async function replaceDataset(
  container: Container,
  datasetId: string,
  documents: Record<string, JourneyDocument>,
  etags: Record<string, string>,
) {
  await runBatch(container, datasetId, [
    ...Object.entries(documents).map(([id, document]) =>
      etags[id]
        ? { operationType: 'Replace' as const, id, resourceBody: document, ifMatch: etags[id] }
        : { operationType: 'Create' as const, resourceBody: document },
    ),
    ...Object.entries(etags)
      .filter(([id]) => !documents[id])
      .map(([id, ifMatch]) => ({ operationType: 'Delete' as const, id, ifMatch })),
  ])
}

export async function deleteEntity(
  container: Container,
  datasetId: string,
  type: EntityType,
  id: string,
  ifMatch: string,
  loaded: { data: JourneyData; etags: Record<string, string> },
) {
  const plan = deletionPlan(loaded.data, type, id)
  const etagFor = (documentId: string) => {
    const etag = documentId === id ? ifMatch : loaded.etags[documentId]
    if (!etag) throw new Error(`Journey document "${documentId}" has no ETag for a transactional delete.`)
    return etag
  }
  await runBatch(container, datasetId, [
    ...plan.deletes.map((deletedId) => ({
      operationType: 'Delete' as const,
      id: deletedId,
      ifMatch: etagFor(deletedId),
    })),
    ...plan.updates.map((update) => {
      const document = documentFor(datasetId, update.type, update.entity)
      return {
        operationType: 'Replace' as const,
        id: document.id,
        resourceBody: document,
        ifMatch: etagFor(document.id),
      }
    }),
  ])
}

export async function seedDemoDataset(container: Container, datasetId: string): Promise<void> {
  const raw = await readFile(new URL('../data/demo.json', import.meta.url), 'utf8')
  const data = JourneyDataSchema.parse(JSON.parse(raw))
  await replaceDataset(container, datasetId, documentsFor(datasetId, data), {})
}

export async function createDocument(container: Container, document: JourneyDocument) {
  return container.items.create(document)
}

export async function replaceDocument(container: Container, document: JourneyDocument, ifMatch: string) {
  return container
    .item(document.id, document.datasetId)
    .replace(document, { accessCondition: { type: 'IfMatch', condition: ifMatch } })
}

export function savedDocument(response: ItemResponse<JourneyDocument>) {
  return { entity: response.resource?.entity, etag: response.headers.etag }
}
