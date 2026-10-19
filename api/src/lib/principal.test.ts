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

  it.each([
    { identityProvider: null },
    { identityProvider: 1 },
    { userId: null },
    { userId: 1 },
    { userRoles: null },
    { userRoles: 'authenticated,admin' },
  ])('rejects incorrect required-field types: %j', (overrides) => {
    expect(() => parseClientPrincipalHeader(principalHeader(overrides))).toThrow(
      'x-ms-client-principal header is missing required fields.',
    )
  })

  it.each([null, [], 'principal', 1])('rejects an incomplete decoded principal: %j', (value) => {
    const header = Buffer.from(JSON.stringify(value)).toString('base64')
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
    expect(
      journeyRoleForPrincipal(parseClientPrincipalHeader(principalHeader({ userRoles: ['authenticated', 'viewer'] }))),
    ).toBe('viewer')
  })

  it('rejects a different identity provider', () => {
    const principal = parseClientPrincipalHeader(principalHeader({ identityProvider: 'github' }))
    expect(() => journeyRoleForPrincipal(principal)).toThrow(PrincipalValidationError)
  })

  it('rejects an empty immutable user ID', () => {
    const principal = parseClientPrincipalHeader(principalHeader({ userId: '' }))
    expect(() => journeyRoleForPrincipal(principal)).toThrow('Principal has no immutable user ID.')
  })

  it.each(['admin', 'viewer'])('rejects %s without the authenticated role', (role) => {
    const principal = parseClientPrincipalHeader(principalHeader({ userRoles: ['anonymous', role] }))
    expect(() => journeyRoleForPrincipal(principal)).toThrow('Principal is missing the authenticated role.')
  })

  it('fails closed for anonymous, unassigned, and ambiguously assigned principals', () => {
    expect(() =>
      journeyRoleForPrincipal(parseClientPrincipalHeader(principalHeader({ userRoles: ['anonymous'] }))),
    ).toThrow(PrincipalValidationError)
    expect(() =>
      journeyRoleForPrincipal(parseClientPrincipalHeader(principalHeader({ userRoles: ['authenticated'] }))),
    ).toThrow(PrincipalValidationError)
    expect(() =>
      journeyRoleForPrincipal(
        parseClientPrincipalHeader(principalHeader({ userRoles: ['authenticated', 'admin', 'viewer'] })),
      ),
    ).toThrow(PrincipalValidationError)
  })
})
