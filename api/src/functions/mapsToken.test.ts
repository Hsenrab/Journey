import { describe, expect, it, vi, beforeEach, afterEach } from 'vitest'
import type { InvocationContext } from '@azure/functions'

const issueMapsSasToken = vi.fn()

vi.mock('@azure/identity', () => ({
  DefaultAzureCredential: vi.fn(),
}))

vi.mock('../lib/mapsSas.js', async () => {
  const actual = await vi.importActual<typeof import('../lib/mapsSas.js')>('../lib/mapsSas.js')
  return { ...actual, issueMapsSasToken }
})

const encodePrincipal = (principal: Record<string, unknown>): string =>
  Buffer.from(JSON.stringify(principal)).toString('base64')

const OWNER_TENANT = 'tenant-1'
const OWNER_OBJECT_ID = 'owner-object-id'

function ownerHeader(overrides: Record<string, unknown> = {}): string {
  return encodePrincipal({
    identityProvider: 'aad',
    userId: 'user-1',
    userDetails: 'owner@example.com',
    userRoles: ['anonymous', 'authenticated'],
    claims: [
      { typ: 'tid', val: OWNER_TENANT },
      { typ: 'oid', val: OWNER_OBJECT_ID },
    ],
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
  issueMapsSasToken.mockReset()
  process.env.JOURNEY_ENTRA_TENANT_ID = OWNER_TENANT
  process.env.JOURNEY_OWNER_OBJECT_ID = OWNER_OBJECT_ID
  process.env.AZURE_SUBSCRIPTION_ID = 'sub-1'
  process.env.AZURE_RESOURCE_GROUP = 'rg-1'
  process.env.AZURE_MAPS_ACCOUNT_NAME = 'maps-1'
  process.env.AZURE_MAPS_PRINCIPAL_ID = 'principal-1'
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

  it('returns 403 for a principal from a different tenant', async () => {
    const { mapsToken } = await import('./mapsToken.js')
    const header = ownerHeader({
      claims: [
        { typ: 'tid', val: 'other-tenant' },
        { typ: 'oid', val: OWNER_OBJECT_ID },
      ],
    })
    const result = await mapsToken(requestWithPrincipal(header), fakeContext())
    expect(result.status).toBe(403)
  })

  it('returns 403 for a principal missing the authenticated role', async () => {
    const { mapsToken } = await import('./mapsToken.js')
    const header = ownerHeader({ userRoles: ['anonymous'] })
    const result = await mapsToken(requestWithPrincipal(header), fakeContext())
    expect(result.status).toBe(403)
  })

  it('rejects other assigned users, only the configured owner object id passes', async () => {
    const { mapsToken } = await import('./mapsToken.js')
    const header = ownerHeader({
      claims: [
        { typ: 'tid', val: OWNER_TENANT },
        { typ: 'oid', val: 'a-different-user' },
      ],
    })
    const result = await mapsToken(requestWithPrincipal(header), fakeContext())
    expect(result.status).toBe(403)
  })

  it('returns a Maps SAS token for the assigned owner', async () => {
    issueMapsSasToken.mockResolvedValueOnce({ token: 'sas-token-value', expiresOn: '2024-01-01T00:15:00.000Z' })

    const { mapsToken } = await import('./mapsToken.js')
    const result = await mapsToken(requestWithPrincipal(ownerHeader()), fakeContext())

    expect(result.status).toBe(200)
    expect(result.jsonBody).toEqual({ token: 'sas-token-value', expiresOn: '2024-01-01T00:15:00.000Z' })
    expect(issueMapsSasToken).toHaveBeenCalledWith(
      expect.anything(),
      expect.objectContaining({
        subscriptionId: 'sub-1',
        resourceGroupName: 'rg-1',
        accountName: 'maps-1',
        principalId: 'principal-1',
      }),
    )
  })

  it('fails explicitly when a required application setting is missing', async () => {
    delete process.env.AZURE_MAPS_ACCOUNT_NAME

    const { mapsToken } = await import('./mapsToken.js')

    await expect(mapsToken(requestWithPrincipal(ownerHeader()), fakeContext())).rejects.toThrow(
      /AZURE_MAPS_ACCOUNT_NAME/,
    )
    expect(issueMapsSasToken).not.toHaveBeenCalled()
  })
})
