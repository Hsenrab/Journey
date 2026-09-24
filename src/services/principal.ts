export type JourneyRole = 'viewer' | 'editor' | 'owner'

/** Sentinel `ownerId` marking an entity as commonly owned, so every editor may mutate it. */
export const SHARED_OWNER_ID = 'shared'

type ClientPrincipalResponse = {
  clientPrincipal: {
    identityProvider: string
    userId: string
    userDetails: string
    userRoles: string[]
  } | null
}

export type JourneyPrincipal = {
  role: JourneyRole
  userId: string
  userDetails: string
}

function highestJourneyRole(userRoles: string[]): JourneyRole | null {
  return (['owner', 'editor', 'viewer'] as const).find((candidate) => userRoles.includes(candidate)) ?? null
}

export async function getClientPrincipal(): Promise<JourneyPrincipal | null> {
  const response = await fetch('/.auth/me')
  if (!response.ok) return null

  const body = (await response.json()) as ClientPrincipalResponse
  const principal = body.clientPrincipal
  if (!principal || principal.identityProvider !== 'aad') return null

  const role = highestJourneyRole(principal.userRoles)
  if (!role) return null

  return { role, userId: principal.userId, userDetails: principal.userDetails }
}
