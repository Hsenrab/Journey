/**
 * Issues short-lived, constrained Azure Maps SAS tokens using the caller's
 * Azure Resource Manager credential (the Function's system-assigned managed
 * identity when deployed, the signed-in developer identity locally). This is
 * the `Microsoft.Maps/accounts/listSas/action` control-plane call: a
 * data-plane "Data Reader" role does not grant it, so the identity used here
 * must additionally hold a role such as "Azure Maps Contributor" scoped to
 * the Maps account.
 */
import type { TokenCredential } from '@azure/identity'

const ARM_SCOPE = 'https://management.azure.com/.default'
const MAPS_API_VERSION = '2023-06-01'

export interface MapsSasConfig {
  subscriptionId: string
  resourceGroupName: string
  accountName: string
  /** Object id of the principal the resulting token is scoped to for Azure Maps data-plane RBAC. */
  principalId: string
  /** Token lifetime in whole minutes. Kept short-lived per least-privilege requirements. */
  lifetimeMinutes: number
  /** Allowed operations/regions passthrough, kept minimal for browser rendering/search. */
  maxRatePerSecond: number
}

export interface MapsSasToken {
  token: string
  expiresOn: string
}

/** Thrown when Azure Resource Manager rejects the listSas call (auth, RBAC, or config error). */
export class MapsSasError extends Error {
  constructor(message: string) {
    super(message)
    this.name = 'MapsSasError'
  }
}

const AUTH_SCHEME = 'Bearer'

function authorizationHeaderValue(token: string): string {
  return `${AUTH_SCHEME} ${token}`
}

export async function issueMapsSasToken(
  credential: TokenCredential,
  config: MapsSasConfig,
  fetchImpl: typeof fetch = fetch,
): Promise<MapsSasToken> {
  const accessToken = await credential.getToken(ARM_SCOPE)
  if (!accessToken) {
    throw new MapsSasError('Failed to acquire an Azure Resource Manager access token.')
  }

  const start = new Date()
  const expiry = new Date(start.getTime() + config.lifetimeMinutes * 60_000)

  const url =
    `https://management.azure.com/subscriptions/${config.subscriptionId}` +
    `/resourceGroups/${config.resourceGroupName}` +
    `/providers/Microsoft.Maps/accounts/${config.accountName}/listSas` +
    `?api-version=${MAPS_API_VERSION}`

  const response = await fetchImpl(url, {
    method: 'POST',
    headers: {
      Authorization: authorizationHeaderValue(accessToken.token),
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      signingKey: 'primaryKey',
      principalId: config.principalId,
      maxRatePerSecond: config.maxRatePerSecond,
      start: start.toISOString(),
      expiry: expiry.toISOString(),
    }),
  })

  if (!response.ok) {
    const body = await response.text()
    throw new MapsSasError(`Azure Maps listSas request failed with status ${response.status}: ${body}`)
  }

  const result = (await response.json()) as { accountSasToken?: string }
  if (!result.accountSasToken) {
    throw new MapsSasError('Azure Maps listSas response did not include an accountSasToken.')
  }

  return { token: result.accountSasToken, expiresOn: expiry.toISOString() }
}
