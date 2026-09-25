import { describe, expect, it } from 'vitest'
import { journeyRoleForPrincipal, parseClientPrincipalHeader, PrincipalValidationError } from './principal.js'

function encodePrincipal(principal: Record<string, unknown>): string {
  return Buffer.from(JSON.stringify(principal)).toString('base64')
}

function principalHeader(overrides: Record<string, unknown> = {}): string {
  return encodePrincipal({
    identityProvider: 'aad',
    userId: 'user-1',
    userDetails: 'admin@example.com',
    userRoles: ['anonymous', 'authenticated', 'admin'],
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
    const principal = parseClientPrincipalHeader(principalHeader())
    expect(principal.identityProvider).toBe('aad')
    expect(principal.userRoles).toContain('admin')
  })
})

describe('journeyRoleForPrincipal', () => {
  it('returns the single assigned Journey role', () => {
    expect(journeyRoleForPrincipal(parseClientPrincipalHeader(principalHeader()))).toBe('admin')
    expect(journeyRoleForPrincipal(parseClientPrincipalHeader(principalHeader({ userRoles: ['authenticated', 'viewer'] })))).toBe(
      'viewer',
    )
  })

  it('rejects a different identity provider', () => {
    const principal = parseClientPrincipalHeader(principalHeader({ identityProvider: 'github' }))
    expect(() => journeyRoleForPrincipal(principal)).toThrow(PrincipalValidationError)
  })

  it('fails closed for anonymous, unassigned, and ambiguously assigned principals', () => {
    expect(() => journeyRoleForPrincipal(parseClientPrincipalHeader(principalHeader({ userRoles: ['anonymous'] })))).toThrow(
      PrincipalValidationError,
    )
    expect(() =>
      journeyRoleForPrincipal(parseClientPrincipalHeader(principalHeader({ userRoles: ['authenticated'] }))),
    ).toThrow(PrincipalValidationError)
    expect(() =>
      journeyRoleForPrincipal(parseClientPrincipalHeader(principalHeader({ userRoles: ['authenticated', 'admin', 'viewer'] }))),
    ).toThrow(PrincipalValidationError)
  })
})
