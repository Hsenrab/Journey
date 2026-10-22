import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import type { InvocationContext } from '@azure/functions'
import { mapsSearch } from './mapsSearch.js'

const { acquireMapsAccessToken } = vi.hoisted(() => ({ acquireMapsAccessToken: vi.fn() }))
vi.mock('@azure/identity', () => ({ DefaultAzureCredential: vi.fn() }))
vi.mock('../lib/mapsAuth.js', () => ({ acquireMapsAccessToken }))

const originalEnv = { ...process.env }
function principalHeader(overrides: Record<string, unknown> = {}) {
  return Buffer.from(
    JSON.stringify({
      identityProvider: 'aad',
      userId: 'user',
      userDetails: 'admin@example.com',
      userRoles: ['authenticated', 'admin'],
      ...overrides,
    }),
  ).toString('base64')
}

function request(query: string, header: string | null = principalHeader()) {
  return {
    query: new URLSearchParams(query),
    headers: { get: (name: string) => (name === 'x-ms-client-principal' ? header : null) },
  } as never
}

beforeEach(() => {
  Object.assign(process.env, {
    AZURE_MAPS_CLIENT_ID: 'maps-client-id',
  })
  acquireMapsAccessToken.mockReset()
  acquireMapsAccessToken.mockResolvedValue({ token: 'entra-token', expiresOn: '2026-01-01T00:00:00.000Z' })
})
afterEach(() => {
  process.env = { ...originalEnv }
  vi.restoreAllMocks()
  vi.unstubAllGlobals()
})

describe('mapsSearch', () => {
  it.each([
    ['missing', null],
    ['malformed', 'not-base64-json'],
    ['incomplete', Buffer.from(JSON.stringify({ identityProvider: 'aad' })).toString('base64')],
    ['incorrect field type', principalHeader({ userId: 1 })],
    ['unsupported provider', principalHeader({ identityProvider: 'github' })],
    ['empty user ID', principalHeader({ userId: '' })],
    ['unauthenticated role', principalHeader({ userRoles: ['viewer'] })],
    ['unassigned', principalHeader({ userRoles: ['authenticated'] })],
    ['both roles', principalHeader({ userRoles: ['authenticated', 'admin', 'viewer'] })],
  ])('rejects a %s principal before downstream access', async (_category, header) => {
    const fetch = vi.fn()
    vi.stubGlobal('fetch', fetch)

    expect(await mapsSearch(request('query=Oxford', header), {} as InvocationContext)).toEqual({
      status: 403,
      jsonBody: { error: 'forbidden' },
    })
    expect(acquireMapsAccessToken).not.toHaveBeenCalled()
    expect(fetch).not.toHaveBeenCalled()
  })

  it('reports an Azure Maps failure with its status', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({ ok: false, status: 429, text: () => 'Too many requests' }))

    expect(await mapsSearch(request('query=Oxford'), { error: vi.fn() } as unknown as InvocationContext)).toEqual({
      status: 429,
      jsonBody: { error: 'Too many requests' },
    })
  })

  it('rejects unauthorized and invalid search requests', async () => {
    expect((await mapsSearch(request('query=Oxford', ''), {} as InvocationContext)).status).toBe(403)
    const result = await mapsSearch(request('query=x'), {} as InvocationContext)
    expect(result).toMatchObject({ status: 400, jsonBody: { error: 'Enter at least two characters.' } })
  })

  it.each(['admin', 'viewer'])('returns search results for %s using the Function identity token', async (role) => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({ ok: true, json: () => ({ results: [{ id: 'result' }] }) }))
    const result = await mapsSearch(request('query=Oxford', principalHeader({ userRoles: ['authenticated', role] })), {
      error: vi.fn(),
    } as unknown as InvocationContext)
    expect(result).toEqual({ status: 200, jsonBody: { results: [{ id: 'result' }] } })
    expect(acquireMapsAccessToken).toHaveBeenCalledOnce()
    expect(fetch).toHaveBeenCalledWith('https://atlas.microsoft.com/search/address/json?api-version=1.0&query=Oxford', {
      headers: { Authorization: 'Bearer entra-token', 'x-ms-client-id': 'maps-client-id' },
    })
  })
})
