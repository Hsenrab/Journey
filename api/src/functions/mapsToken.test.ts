import { describe, expect, it, vi, beforeEach, afterEach } from 'vitest'
import type { InvocationContext } from '@azure/functions'

const acquireMapsAccessToken = vi.fn()

vi.mock('@azure/identity', () => ({
  DefaultAzureCredential: vi.fn(),
}))

vi.mock('../lib/mapsAuth.js', () => ({ acquireMapsAccessToken }))

const encodePrincipal = (principal: Record<string, unknown>): string =>
  Buffer.from(JSON.stringify(principal)).toString('base64')

function principalHeader(overrides: Record<string, unknown> = {}): string {
  return encodePrincipal({
    identityProvider: 'aad',
    userId: 'user-1',
    userDetails: 'admin@example.com',
    userRoles: ['anonymous', 'authenticated', 'admin'],
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
  it.each([
    ['missing', null],
    ['malformed', 'not-base64-json'],
    ['incomplete', encodePrincipal({ identityProvider: 'aad' })],
    ['incorrect field type', principalHeader({ userRoles: 'admin' })],
    ['unsupported provider', principalHeader({ identityProvider: 'github' })],
    ['empty user ID', principalHeader({ userId: '' })],
    ['unauthenticated role', principalHeader({ userRoles: ['admin'] })],
    ['unassigned', principalHeader({ userRoles: ['authenticated'] })],
    ['both roles', principalHeader({ userRoles: ['authenticated', 'admin', 'viewer'] })],
  ])('rejects a %s principal before acquiring a token', async (_category, header) => {
    const { mapsToken } = await import('./mapsToken.js')
    const result = await mapsToken(requestWithPrincipal(header), fakeContext())
    expect(result).toEqual({ status: 403, jsonBody: { error: 'forbidden' } })
    expect(acquireMapsAccessToken).not.toHaveBeenCalled()
  })

  it.each(['admin', 'viewer'])('returns a Maps Entra token and client ID for %s', async (role) => {
    acquireMapsAccessToken.mockResolvedValueOnce({ token: 'entra-token-value', expiresOn: '2024-01-01T00:15:00.000Z' })

    const { mapsToken } = await import('./mapsToken.js')
    const result = await mapsToken(
      requestWithPrincipal(principalHeader({ userRoles: ['authenticated', role] })),
      fakeContext(),
    )

    expect(result.status).toBe(200)
    expect(result.jsonBody).toEqual({
      token: 'entra-token-value',
      expiresOn: '2024-01-01T00:15:00.000Z',
      clientId: 'maps-client-id',
    })
    expect(acquireMapsAccessToken).toHaveBeenCalledWith(expect.anything())
    expect(acquireMapsAccessToken).toHaveBeenCalledOnce()
  })

  it('fails explicitly when a required application setting is missing', async () => {
    delete process.env.AZURE_MAPS_CLIENT_ID

    const { mapsToken } = await import('./mapsToken.js')

    await expect(mapsToken(requestWithPrincipal(principalHeader()), fakeContext())).rejects.toThrow(
      /AZURE_MAPS_CLIENT_ID/,
    )
  })
})
