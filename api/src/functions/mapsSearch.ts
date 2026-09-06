import { app, type HttpRequest, type HttpResponseInit, type InvocationContext } from '@azure/functions'
import { DefaultAzureCredential } from '@azure/identity'
import { z } from 'zod'
import { MapsSearchError, searchAddress } from '../lib/geocode.js'
import { assertOwnerPrincipal, parseClientPrincipalHeader, PrincipalValidationError } from '../lib/principal.js'

const SearchQuerySchema = z.object({ query: z.string().trim().min(2, 'Enter at least two characters.').max(200) })

export async function mapsSearch(request: HttpRequest, context: InvocationContext): Promise<HttpResponseInit> {
  try {
    assertOwnerPrincipal(parseClientPrincipalHeader(request.headers.get('x-ms-client-principal')))
  } catch (error) {
    if (error instanceof PrincipalValidationError) return { status: 403, jsonBody: { error: 'forbidden' } }
    throw error
  }

  const parsed = SearchQuerySchema.safeParse(Object.fromEntries(request.query.entries()))
  if (!parsed.success) return { status: 400, jsonBody: { error: parsed.error.issues[0]?.message } }

  try {
    return { status: 200, jsonBody: { results: await searchAddress(parsed.data.query, new DefaultAzureCredential()) } }
  } catch (error) {
    if (error instanceof MapsSearchError) {
      context.error(`Azure Maps search failed with status ${error.status}`)
      return { status: error.status, jsonBody: { error: error.message } }
    }
    throw error
  }
}

app.http('mapsSearch', { methods: ['GET'], authLevel: 'anonymous', route: 'maps/search', handler: mapsSearch })
