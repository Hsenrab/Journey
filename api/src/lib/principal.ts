/**
 * Parsing and validation for the client principal that Azure Static Web Apps
 * injects into proxied `/api/*` requests via the `x-ms-client-principal`
 * header. This is the only trustworthy source of "who is calling" for a
 * linked Functions backend: Static Web Apps overwrites any client-supplied
 * copy of this header before proxying the request.
 */

export interface ClientPrincipal {
  identityProvider: string
  userId: string
  userDetails: string
  userRoles: string[]
}

export type JourneyRole = 'viewer' | 'editor' | 'owner'

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
    !Array.isArray(principal.userRoles)
  ) {
    throw new PrincipalValidationError('x-ms-client-principal header is missing required fields.')
  }

  return {
    identityProvider: principal.identityProvider,
    userId: principal.userId,
    userDetails: typeof principal.userDetails === 'string' ? principal.userDetails : '',
    userRoles: principal.userRoles.filter((role): role is string => typeof role === 'string'),
  }
}

export function assertJourneyPrincipal(principal: ClientPrincipal): { role: JourneyRole; ownerId: string } {
  if (principal.identityProvider !== 'aad') {
    throw new PrincipalValidationError(
      `Unsupported identity provider "${principal.identityProvider}"; only aad is permitted.`,
    )
  }

  const role = (['owner', 'editor', 'viewer'] as const).find((candidate) => principal.userRoles.includes(candidate))
  if (!role) throw new PrincipalValidationError('Principal is not assigned a viewer, editor, or owner role.')

  return { role, ownerId: principal.userId }
}
