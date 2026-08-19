import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import type { InvocationContext } from '@azure/functions'

const issueMapsSasToken = vi.fn()
vi.mock('@azure/identity', () => ({ DefaultAzureCredential: vi.fn() }))
vi.mock('../lib/mapsSas.js', () => ({ issueMapsSasToken }))

const originalEnv = { ...process.env }
const principal = Buffer.from(
  JSON.stringify({
    identityProvider: 'aad',
    userId: 'user',
    userDetails: 'owner@example.com',
    userRoles: ['authenticated', 'owner'],
  }),
).toString('base64')

function request(query: string, header = principal) {
  return {
    query: new URLSearchParams(query),
    headers: { get: (name: string) => (name === 'x-ms-client-principal' ? header : null) },
  } as never
}

beforeEach(() => {
  Object.assign(process.env, {
    AZURE_SUBSCRIPTION_ID: 'sub',
    AZURE_RESOURCE_GROUP: 'group',
    AZURE_MAPS_ACCOUNT_NAME: 'maps',
    AZURE_MAPS_PRINCIPAL_ID: 'principal',
  })
  issueMapsSasToken.mockResolvedValue({ token: 'sas', expiresOn: '2026-01-01T00:00:00.000Z' })
})
afterEach(() => {
  process.env = { ...originalEnv }
  vi.restoreAllMocks()
})

describe('mapsSearch', () => {
  it('rejects unauthorized and invalid search requests', async () => {
    const { mapsSearch } = await import('./mapsSearch.js')
    expect((await mapsSearch(request('query=Oxford', ''), {} as InvocationContext)).status).toBe(403)
    const result = await mapsSearch(request('query=x'), {} as InvocationContext)
    expect(result).toMatchObject({ status: 400, jsonBody: { error: 'Enter at least two characters.' } })
  })

  it('returns Azure Maps search results without exposing the SAS token', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({ ok: true, json: () => ({ results: [{ id: 'result' }] }) }))
    const { mapsSearch } = await import('./mapsSearch.js')
    const result = await mapsSearch(request('query=Oxford'), { error: vi.fn() } as unknown as InvocationContext)
    expect(result).toEqual({ status: 200, jsonBody: { results: [{ id: 'result' }] } })
    expect(issueMapsSasToken).toHaveBeenCalledOnce()
  })
})
