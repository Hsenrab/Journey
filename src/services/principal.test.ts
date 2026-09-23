import { beforeEach, describe, expect, it, vi } from 'vitest'
import { getClientPrincipal } from './principal'

describe('getClientPrincipal', () => {
  beforeEach(() => {
    vi.restoreAllMocks()
  })

  it('returns the highest Journey role from /.auth/me', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue(
        new Response(
          JSON.stringify({
            clientPrincipal: {
              identityProvider: 'aad',
              userId: 'user-1',
              userDetails: 'editor@example.com',
              userRoles: ['authenticated', 'viewer', 'editor'],
            },
          }),
        ),
      ),
    )

    await expect(getClientPrincipal()).resolves.toEqual({
      role: 'editor',
      userId: 'user-1',
      userDetails: 'editor@example.com',
    })
  })

  it('returns null for missing, unassigned, and non-aad principals', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(new Response(JSON.stringify({ clientPrincipal: null }))))
    await expect(getClientPrincipal()).resolves.toBeNull()

    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue(
        new Response(
          JSON.stringify({
            clientPrincipal: {
              identityProvider: 'aad',
              userId: 'user-1',
              userDetails: 'viewer@example.com',
              userRoles: ['authenticated'],
            },
          }),
        ),
      ),
    )
    await expect(getClientPrincipal()).resolves.toBeNull()

    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue(
        new Response(
          JSON.stringify({
            clientPrincipal: {
              identityProvider: 'github',
              userId: 'user-1',
              userDetails: 'viewer@example.com',
              userRoles: ['authenticated', 'owner'],
            },
          }),
        ),
      ),
    )
    await expect(getClientPrincipal()).resolves.toBeNull()
  })

  it('returns null when /.auth/me is unavailable', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(new Response('', { status: 404 })))
    await expect(getClientPrincipal()).resolves.toBeNull()
  })
})
