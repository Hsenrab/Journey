import { describe, expect, it, vi, beforeEach, afterEach } from 'vitest'
import type { InvocationContext } from '@azure/functions'

const acquireMapsAccessToken = vi.fn()

vi.mock('@azure/identity', () => ({
  DefaultAzureCredential: vi.fn(),
}))

vi.mock('../lib/mapsAuth.js', () => ({ acquireMapsAccessToken }))

const encodePrincipal = (principal: Record<string, unknown>): string =>
  Buffer.from(JSON.stringify(principal)).toString('base64')

function ownerHeader(overrides: Record<string, unknown> = {}): string {
  return encodePrincipal({
    identityProvider: 'aad',
    userId: 'user-1',
    userDetails: 'owner@example.com',
    userRoles: ['anonymous', 'authenticated', 'owner'],
    ...overrides,
  })
}

function requestWithPrincipal(headerValue: string | null) {
  return {
    headers: {
      get: (name: string) => (name === 'x-ms-client-principal' ? headerValue : null),
    },
  } as unknown as Parameters<typeof import('./mapsToken.js').mapsToken>[0]
}

function fakeContext(): InvocationContext {
  return { warn: vi.fn(), error: vi.fn() } as unknown as InvocationContext
}

const ORIGINAL_ENV = { ...process.env }

beforeEach(() => {
  acquireMapsAccessToken.mockReset()
  process.env.AZURE_MAPS_CLIENT_ID = 'maps-client-id'
})

afterEach(() => {
  process.env = { ...ORIGINAL_ENV }
  vi.restoreAllMocks()
})

describe('mapsToken', () => {
  it('returns 403 for an anonymous request', async () => {
    const { mapsToken } = await import('./mapsToken.js')
    const result = await mapsToken(requestWithPrincipal(null), fakeContext())
    expect(result.status).toBe(403)
  })

  it('returns 403 for a principal from a different identity provider', async () => {
    const { mapsToken } = await import('./mapsToken.js')
    const header = ownerHeader({ identityProvider: 'github' })
    const result = await mapsToken(requestWithPrincipal(header), fakeContext())
    expect(result.status).toBe(403)
  })

  it('returns 403 for a principal missing the owner role', async () => {
    const { mapsToken } = await import('./mapsToken.js')
    const header = ownerHeader({ userRoles: ['anonymous', 'authenticated'] })
    const result = await mapsToken(requestWithPrincipal(header), fakeContext())
    expect(result.status).toBe(403)
  })

  it('returns a Maps Entra token and client ID for the assigned owner', async () => {
    acquireMapsAccessToken.mockResolvedValueOnce({ token: 'entra-token-value', expiresOn: '2024-01-01T00:15:00.000Z' })

    const { mapsToken } = await import('./mapsToken.js')
    const result = await mapsToken(requestWithPrincipal(ownerHeader()), fakeContext())

    expect(result.status).toBe(200)
    expect(result.jsonBody).toEqual({
      token: 'entra-token-value',
      expiresOn: '2024-01-01T00:15:00.000Z',
      clientId: 'maps-client-id',
    })
    expect(acquireMapsAccessToken).toHaveBeenCalledWith(expect.anything())
  })

  it('fails explicitly when a required application setting is missing', async () => {
    delete process.env.AZURE_MAPS_CLIENT_ID

    const { mapsToken } = await import('./mapsToken.js')

    await expect(mapsToken(requestWithPrincipal(ownerHeader()), fakeContext())).rejects.toThrow(/AZURE_MAPS_CLIENT_ID/)
  })
})
