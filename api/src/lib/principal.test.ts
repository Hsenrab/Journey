import { describe, expect, it } from 'vitest'
import { assertJourneyPrincipal, parseClientPrincipalHeader, PrincipalValidationError } from './principal.js'

function encodePrincipal(principal: Record<string, unknown>): string {
  return Buffer.from(JSON.stringify(principal)).toString('base64')
}

function principalHeader(overrides: Record<string, unknown> = {}): string {
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
    const principal = parseClientPrincipalHeader(principalHeader())
    expect(principal.identityProvider).toBe('aad')
    expect(principal.userRoles).toContain('owner')
  })
})

describe('assertJourneyPrincipal', () => {
  it('accepts the assigned owner', () => {
    const principal = parseClientPrincipalHeader(principalHeader({ userRoles: ['authenticated', 'owner'] }))
    expect(assertJourneyPrincipal(principal)).toEqual({ role: 'owner', ownerId: 'user-1' })
  })

  it('accepts the assigned editor', () => {
    const principal = parseClientPrincipalHeader(principalHeader({ userRoles: ['authenticated', 'editor'] }))
    expect(assertJourneyPrincipal(principal)).toEqual({ role: 'editor', ownerId: 'user-1' })
  })

  it('accepts the assigned viewer', () => {
    const principal = parseClientPrincipalHeader(principalHeader({ userRoles: ['authenticated', 'viewer'] }))
    expect(assertJourneyPrincipal(principal)).toEqual({ role: 'viewer', ownerId: 'user-1' })
  })

  it('picks the highest Journey role', () => {
    const principal = parseClientPrincipalHeader(
      principalHeader({ userRoles: ['authenticated', 'viewer', 'editor', 'owner'] }),
    )
    expect(assertJourneyPrincipal(principal)).toEqual({ role: 'owner', ownerId: 'user-1' })
  })

  it('rejects a different identity provider', () => {
    const principal = parseClientPrincipalHeader(principalHeader({ identityProvider: 'github' }))
    expect(() => assertJourneyPrincipal(principal)).toThrow(PrincipalValidationError)
  })

  it('rejects a principal missing a Journey role', () => {
    const principal = parseClientPrincipalHeader(principalHeader({ userRoles: ['anonymous', 'authenticated'] }))
    expect(() => assertJourneyPrincipal(principal)).toThrow(PrincipalValidationError)
  })
})
