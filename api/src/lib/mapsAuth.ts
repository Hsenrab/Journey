import type { TokenCredential } from '@azure/identity'

const MAPS_SCOPE = 'https://atlas.microsoft.com/.default'

export interface MapsAccessToken {
  token: string
  expiresOn: string
}

export class MapsAuthError extends Error {
  constructor(message: string) {
    super(message)
    this.name = 'MapsAuthError'
  }
}

export async function acquireMapsAccessToken(credential: TokenCredential): Promise<MapsAccessToken> {
  const accessToken = await credential.getToken(MAPS_SCOPE)
  if (!accessToken) {
    throw new MapsAuthError('Failed to acquire a Microsoft Entra access token for Azure Maps.')
  }

  return {
    token: accessToken.token,
    expiresOn: new Date(accessToken.expiresOnTimestamp).toISOString(),
  }
}
