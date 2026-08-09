import { describe, expect, it, vi, beforeEach, afterEach } from 'vitest'
import type { InvocationContext } from '@azure/functions'

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
  process.env.JOURNEY_ENTRA_TENANT_ID = OWNER_TENANT
  process.env.JOURNEY_OWNER_OBJECT_ID = OWNER_OBJECT_ID
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
})
