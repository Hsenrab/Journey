import { CosmosClient, type Container, type Database, type ItemResponse } from '@azure/cosmos'
import { DefaultAzureCredential } from '@azure/identity'
import { JourneyDocumentSchema, type EntityType, type JourneyData, type JourneyDocument } from './journeySchema.js'

let client: CosmosClient | undefined
let database: Database | undefined

function required(name: string): string {
  const value = process.env[name]
  if (!value) throw new Error(`Required application setting "${name}" is not configured.`)
  return value
}

export function journeyContainer(name: 'production' | 'test' | 'demo' = 'production'): Container {
  client ??= new CosmosClient({ endpoint: required('COSMOS_ENDPOINT'), aadCredentials: new DefaultAzureCredential() })
  if (!database) database = client.database(required('COSMOS_DATABASE_NAME'))
  return database.container(name)
}

export function datasetIdFor(name: 'production' | 'test' | 'demo'): string {
  const configured = process.env[`COSMOS_${name.toUpperCase()}_DATASET_ID`]
  return configured ?? name
}

function entityKey(type: EntityType): keyof JourneyData {
  return type === 'photoReference' ? 'photoReferences' : (`${type}s` as keyof JourneyData)
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
  for (const document of documents) data[entityKey(document.type)].push(document.entity)
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
  const idKey = type === 'photoReference' ? 'photoReferenceId' : `${type}Id`
  const id = entity[idKey]
  if (typeof id !== 'string' || !id) throw new Error(`Entity "${type}" is missing its identifier.`)
  return JourneyDocumentSchema.parse({ id, datasetId, type, schemaVersion: 1, entity })
}

export async function createDocument(container: Container, document: JourneyDocument) {
  return container.items.create(document)
}

export async function replaceDocument(container: Container, document: JourneyDocument, ifMatch: string) {
  return container
    .item(document.id, document.datasetId)
    .replace(document, { accessCondition: { type: 'IfMatch', condition: ifMatch } })
}

export async function deleteDocument(container: Container, id: string, datasetId: string, ifMatch: string) {
  return container.item(id, datasetId).delete({ accessCondition: { type: 'IfMatch', condition: ifMatch } })
}

export function savedDocument(response: ItemResponse<JourneyDocument>) {
  return { entity: response.resource?.entity, etag: response.headers.etag }
}
