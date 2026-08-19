/**
 * GET /api/maps/token
 *
 * Returns a Microsoft Entra access token for Azure Maps browser rendering.
 * Callers reach this endpoint only through Static Web
 * Apps' authenticated `/api/*` proxy; the function additionally validates
 * the forwarded principal's Entra provider and assigned owner role.
 */
import { app, type HttpRequest, type HttpResponseInit, type InvocationContext } from '@azure/functions'
import { DefaultAzureCredential } from '@azure/identity'
import { assertOwnerPrincipal, parseClientPrincipalHeader, PrincipalValidationError } from '../lib/principal.js'
import { acquireMapsAccessToken } from '../lib/mapsAuth.js'

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

  const token = await acquireMapsAccessToken(new DefaultAzureCredential())

  return { status: 200, jsonBody: { ...token, clientId: requireEnv('AZURE_MAPS_CLIENT_ID') } }
}

app.http('mapsToken', {
  methods: ['GET'],
  authLevel: 'anonymous',
  route: 'maps/token',
  handler: mapsToken,
})
