/**
 * GET /api/maps/token
 *
 * Returns a short-lived, constrained Azure Maps SAS token for browser
 * rendering/search. Callers reach this endpoint only through Static Web
 * Apps' authenticated `/api/*` proxy; the function additionally validates
 * the forwarded principal's Entra provider and assigned owner role.
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
    assertOwnerPrincipal(principal)
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
