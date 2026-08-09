/**
 * Parsing and validation for the client principal that Azure Static Web Apps
 * injects into proxied `/api/*` requests via the `x-ms-client-principal`
 * header. This is the only trustworthy source of "who is calling" for a
 * linked Functions backend: Static Web Apps overwrites any client-supplied
 * copy of this header before proxying the request.
 */

export interface ClientPrincipalClaim {
  typ: string
  val: string
}

export interface ClientPrincipal {
  identityProvider: string
  userId: string
  userDetails: string
  userRoles: string[]
  claims: ClientPrincipalClaim[]
}

const TENANT_CLAIM_TYPES = ['tid', 'http://schemas.microsoft.com/identity/claims/tenantid']
const OBJECT_ID_CLAIM_TYPES = ['oid', 'http://schemas.microsoft.com/identity/claims/objectidentifier']

export class PrincipalValidationError extends Error {
  constructor(message: string) {
    super(message)
    this.name = 'PrincipalValidationError'
  }
}

/** Decodes the `x-ms-client-principal` header into a {@link ClientPrincipal}. */
export function parseClientPrincipalHeader(headerValue: string | null): ClientPrincipal {
  if (!headerValue) {
    throw new PrincipalValidationError('Missing x-ms-client-principal header.')
  }

  let decoded: unknown
  try {
    decoded = JSON.parse(Buffer.from(headerValue, 'base64').toString('utf-8'))
  } catch (error) {
    throw new PrincipalValidationError(
      `x-ms-client-principal header is not valid base64-encoded JSON: ${String(error)}`,
    )
  }

  if (typeof decoded !== 'object' || decoded === null) {
    throw new PrincipalValidationError('x-ms-client-principal header did not decode to an object.')
  }

  const principal = decoded as Partial<ClientPrincipal>
  if (
    typeof principal.identityProvider !== 'string' ||
    typeof principal.userId !== 'string' ||
    !Array.isArray(principal.userRoles) ||
    !Array.isArray(principal.claims)
  ) {
    throw new PrincipalValidationError('x-ms-client-principal header is missing required fields.')
  }

  return {
    identityProvider: principal.identityProvider,
    userId: principal.userId,
    userDetails: typeof principal.userDetails === 'string' ? principal.userDetails : '',
    userRoles: principal.userRoles.filter((role): role is string => typeof role === 'string'),
    claims: principal.claims.filter(
      (claim): claim is ClientPrincipalClaim =>
        typeof claim === 'object' &&
        claim !== null &&
        typeof (claim as ClientPrincipalClaim).typ === 'string' &&
        typeof (claim as ClientPrincipalClaim).val === 'string',
    ),
  }
}

function findClaim(principal: ClientPrincipal, claimTypes: string[]): string | undefined {
  return principal.claims.find((claim) => claimTypes.includes(claim.typ))?.val
}

/**
 * Validates that a parsed principal is the single, explicitly assigned owner
 * work identity: signed in via Microsoft Entra ID (`aad`), assigned the
 * `authenticated` role by Static Web Apps, and matching both the required
 * tenant and the required immutable object id exactly.
 *
 * Throws {@link PrincipalValidationError} with a specific reason on any
 * mismatch; it never silently downgrades to an anonymous or degraded result.
 */
export function assertOwnerPrincipal(
  principal: ClientPrincipal,
  expected: { tenantId: string; objectId: string },
): void {
  if (principal.identityProvider !== 'aad') {
    throw new PrincipalValidationError(
      `Unsupported identity provider "${principal.identityProvider}"; only aad is permitted.`,
    )
  }

  if (!principal.userRoles.includes('authenticated')) {
    throw new PrincipalValidationError('Principal is not assigned the authenticated role.')
  }

  const tenantId = findClaim(principal, TENANT_CLAIM_TYPES)
  if (tenantId !== expected.tenantId) {
    throw new PrincipalValidationError('Principal tenant does not match the required tenant.')
  }

  const objectId = findClaim(principal, OBJECT_ID_CLAIM_TYPES)
  if (objectId !== expected.objectId) {
    throw new PrincipalValidationError('Principal identity does not match the assigned owner.')
  }
}
