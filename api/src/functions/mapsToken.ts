/**
 * GET /api/maps/token
 *
 * Returns a short-lived, constrained Azure Maps SAS token for browser
 * rendering/search. Callers reach this endpoint only through Static Web
 * Apps' authenticated `/api/*` proxy; the function additionally validates
 * the forwarded principal's tenant and immutable user id so a
 * direct-hostname request (or a request from any other assigned tenant
 * user) is rejected even if network isolation is bypassed.
 */
import { app, type HttpRequest, type HttpResponseInit, type InvocationContext } from '@azure/functions'
import { DefaultAzureCredential } from '@azure/identity'
import { assertOwnerPrincipal, parseClientPrincipalHeader, PrincipalValidationError } from '../lib/principal.js'
import { issueMapsSasToken, MapsSasError } from '../lib/mapsSas.js'

const TOKEN_LIFETIME_MINUTES = 15
const MAX_RATE_PER_SECOND = 5

function requireEnv(name: string): string {
  const value = process.env[name]
  if (!value) {
    throw new Error(`Required application setting "${name}" is not configured.`)
  }
  return value
}

export async function mapsToken(request: HttpRequest, context: InvocationContext): Promise<HttpResponseInit> {
  let principal
  try {
    principal = parseClientPrincipalHeader(request.headers.get('x-ms-client-principal'))
    assertOwnerPrincipal(principal, {
      tenantId: requireEnv('JOURNEY_ENTRA_TENANT_ID'),
      objectId: requireEnv('JOURNEY_OWNER_OBJECT_ID'),
    })
  } catch (error) {
    if (error instanceof PrincipalValidationError) {
      context.warn(`Rejected maps token request: ${error.message}`)
      return { status: 403, jsonBody: { error: 'forbidden' } }
    }
    throw error
  }

  const credential = new DefaultAzureCredential()
  const token = await issueMapsSasToken(credential, {
    subscriptionId: requireEnv('AZURE_SUBSCRIPTION_ID'),
    resourceGroupName: requireEnv('AZURE_RESOURCE_GROUP'),
    accountName: requireEnv('AZURE_MAPS_ACCOUNT_NAME'),
    principalId: requireEnv('AZURE_MAPS_PRINCIPAL_ID'),
    lifetimeMinutes: TOKEN_LIFETIME_MINUTES,
    maxRatePerSecond: MAX_RATE_PER_SECOND,
  }).catch((error: unknown) => {
    if (error instanceof MapsSasError) {
      context.error(`Azure Maps token issuance failed: ${error.message}`)
      throw error
    }
    throw error
  })

  return { status: 200, jsonBody: token }
}

app.http('mapsToken', {
  methods: ['GET'],
  authLevel: 'anonymous',
  route: 'maps/token',
  handler: mapsToken,
})
