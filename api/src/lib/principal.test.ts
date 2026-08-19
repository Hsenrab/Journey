import { describe, expect, it } from 'vitest'
import { assertOwnerPrincipal, parseClientPrincipalHeader, PrincipalValidationError } from './principal.js'

function encodePrincipal(principal: Record<string, unknown>): string {
  return Buffer.from(JSON.stringify(principal)).toString('base64')
}

function ownerHeader(overrides: Record<string, unknown> = {}): string {
  return encodePrincipal({
    identityProvider: 'aad',
    userId: 'user-1',
    userDetails: 'owner@example.com',
    userRoles: ['anonymous', 'authenticated', 'owner'],
    ...overrides,
  })
}

describe('parseClientPrincipalHeader', () => {
  it('throws when the header is missing', () => {
    expect(() => parseClientPrincipalHeader(null)).toThrow(PrincipalValidationError)
  })

  it('throws when the header is not valid base64 JSON', () => {
    expect(() => parseClientPrincipalHeader('not-base64-json')).toThrow(PrincipalValidationError)
  })

  it('throws when required fields are missing', () => {
    const header = encodePrincipal({ identityProvider: 'aad' })
    expect(() => parseClientPrincipalHeader(header)).toThrow(PrincipalValidationError)
  })

  it('parses a well-formed header', () => {
    const principal = parseClientPrincipalHeader(ownerHeader())
    expect(principal.identityProvider).toBe('aad')
    expect(principal.userRoles).toContain('owner')
  })
})

describe('assertOwnerPrincipal', () => {
  it('accepts the assigned owner', () => {
    const principal = parseClientPrincipalHeader(ownerHeader())
    expect(() => assertOwnerPrincipal(principal)).not.toThrow()
  })

  it('rejects a different identity provider', () => {
    const principal = parseClientPrincipalHeader(ownerHeader({ identityProvider: 'github' }))
    expect(() => assertOwnerPrincipal(principal)).toThrow(PrincipalValidationError)
  })

  it('rejects a principal missing the owner role', () => {
    const principal = parseClientPrincipalHeader(ownerHeader({ userRoles: ['anonymous', 'authenticated'] }))
    expect(() => assertOwnerPrincipal(principal)).toThrow(PrincipalValidationError)
  })
})
