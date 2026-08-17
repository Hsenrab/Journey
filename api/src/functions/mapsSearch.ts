import { app, type HttpRequest, type HttpResponseInit, type InvocationContext } from '@azure/functions'
import { DefaultAzureCredential } from '@azure/identity'
import { z } from 'zod'
import { issueMapsSasToken } from '../lib/mapsSas.js'
import { assertOwnerPrincipal, parseClientPrincipalHeader, PrincipalValidationError } from '../lib/principal.js'

const SearchQuerySchema = z.object({ query: z.string().trim().min(2, 'Enter at least two characters.').max(200) })

function requireEnv(name: string): string {
  const value = process.env[name]
  if (!value) throw new Error(`Required application setting "${name}" is not configured.`)
  return value
}

export async function mapsSearch(request: HttpRequest, context: InvocationContext): Promise<HttpResponseInit> {
  try {
    assertOwnerPrincipal(parseClientPrincipalHeader(request.headers.get('x-ms-client-principal')), {
      tenantId: requireEnv('JOURNEY_ENTRA_TENANT_ID'),
      objectId: requireEnv('JOURNEY_OWNER_OBJECT_ID'),
    })
  } catch (error) {
    if (error instanceof PrincipalValidationError) return { status: 403, jsonBody: { error: 'forbidden' } }
    throw error
  }

  const parsed = SearchQuerySchema.safeParse(Object.fromEntries(request.query.entries()))
  if (!parsed.success) return { status: 400, jsonBody: { error: parsed.error.issues[0]?.message } }

  const token = await issueMapsSasToken(new DefaultAzureCredential(), {
    subscriptionId: requireEnv('AZURE_SUBSCRIPTION_ID'),
    resourceGroupName: requireEnv('AZURE_RESOURCE_GROUP'),
    accountName: requireEnv('AZURE_MAPS_ACCOUNT_NAME'),
    principalId: requireEnv('AZURE_MAPS_PRINCIPAL_ID'),
    lifetimeMinutes: 1,
    maxRatePerSecond: 5,
  })
  const parameters = new URLSearchParams({ 'api-version': '1.0', query: parsed.data.query, sas: token.token })
  const response = await fetch(`https://atlas.microsoft.com/search/address/json?${parameters}`)
  if (!response.ok) {
    const message = await response.text()
    context.error(`Azure Maps search failed with status ${response.status}`)
    return { status: response.status, jsonBody: { error: message } }
  }

  const body = (await response.json()) as { results?: unknown[] }
  return { status: 200, jsonBody: { results: body.results ?? [] } }
}

app.http('mapsSearch', { methods: ['GET'], authLevel: 'anonymous', route: 'maps/search', handler: mapsSearch })
