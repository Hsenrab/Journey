import { CosmosClient, type Container, type Database } from '@azure/cosmos'
import { DefaultAzureCredential } from '@azure/identity'
import { readFile } from 'node:fs/promises'
import { entityId, entityKey, entityTypeFor, referenceIntegrityError } from './journeyGraph.js'
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

export class StoredJourneyRelationshipError extends Error {
  constructor(message: string) {
    super(message)
    this.name = 'StoredJourneyRelationshipError'
  }
}

function storedRelationshipError(document: Record<string, unknown>): string | undefined {
  if (document.type === 'challenge') {
    if (document.schemaVersion === 1 || document.schemaVersion === 2 || document.schemaVersion === 3)
      return `Challenge document "${String(document.id)}" uses unsupported schema version ${document.schemaVersion}; stored Challenge data must be corrected separately before loading.`
    const entity = document.entity
    if (typeof entity === 'object' && entity !== null && 'waypointIds' in entity) {
      const challengeId =
        'challengeId' in entity && typeof entity.challengeId === 'string' ? entity.challengeId : String(document.id)
      return `Challenge "${challengeId}" contains obsolete field "waypointIds"; review its links and correct them separately before loading.`
    }
  }
  if (document.type === 'waypoint') {
    const entity = document.entity
    if (typeof entity !== 'object' || entity === null) return
    const waypointId =
      'waypointId' in entity && typeof entity.waypointId === 'string' ? entity.waypointId : String(document.id)
    const challengeIds = 'challengeIds' in entity ? entity.challengeIds : undefined
    if (!Array.isArray(challengeIds) || challengeIds.some((id) => typeof id !== 'string' || id.length === 0))
      return `Waypoint "${waypointId}" has invalid Challenge assignments; stored relationship data must be corrected separately before loading.`
    if (new Set(challengeIds).size !== challengeIds.length)
      return `Waypoint "${waypointId}" repeats a Challenge assignment; stored relationship data must be corrected separately before loading.`
  }
  return undefined
}

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
  const etags: Record<string, string> = Object.create(null)
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
      const relationshipError = storedRelationshipError(domainDocument)
      if (relationshipError) throw new StoredJourneyRelationshipError(relationshipError)
      const document = JourneyDocumentSchema.parse(domainDocument)
      documents.push(document)
      if (typeof etag === 'string') etags[document.id] = etag
    }
    continuation = response.continuationToken
  } while (continuation)
  const data = JourneyDataSchema.parse(documentsToData(documents))
  const graphError = referenceIntegrityError(data)
  if (graphError) {
    throw new StoredJourneyRelationshipError(
      `${graphError} Stored relationship data must be corrected separately before loading.`,
    )
  }
  return { data, etags }
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
  const documents: Record<string, JourneyDocument> = Object.create(null)
  const validatedData = JourneyDataSchema.parse(data)
  const graphError = referenceIntegrityError(validatedData)
  if (graphError) throw new Error(graphError)
  for (const [key, entities] of Object.entries(validatedData)) {
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
  if (operations.length === 0) return []
  const response = await container.items.batch(operations as never, datasetId)
  if (response.code !== 200) {
    const failed = response.result?.find((result) => result.statusCode >= 400 && result.statusCode !== 424)
    throw Object.assign(new Error('Cosmos transactional batch failed.'), {
      code: failed?.statusCode ?? response.code,
    })
  }
  return response.result
}

export async function replaceDataset(
  container: Container,
  datasetId: string,
  documents: Record<string, JourneyDocument>,
  etags: Record<string, string>,
) {
  const results = await runBatch(container, datasetId, [
    ...Object.entries(documents).map(([id, document]) =>
      Object.hasOwn(etags, id)
        ? { operationType: 'Replace' as const, id, resourceBody: document, ifMatch: etags[id] }
        : { operationType: 'Create' as const, resourceBody: document },
    ),
    ...Object.entries(etags)
      .filter(([id]) => !Object.hasOwn(documents, id))
      .map(([id, ifMatch]) => ({ operationType: 'Delete' as const, id, ifMatch })),
  ])
  return Object.fromEntries(Object.keys(documents).map((id, index) => [id, results?.[index]?.eTag]))
}

export async function seedDemoDataset(container: Container, datasetId: string): Promise<void> {
  const raw = await readFile(new URL('../data/demo.json', import.meta.url), 'utf8')
  const data = JourneyDataSchema.parse(JSON.parse(raw))
  await replaceDataset(container, datasetId, documentsFor(datasetId, data), {})
}
