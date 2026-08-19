import { describe, expect, it, vi } from 'vitest'
import type { TokenCredential } from '@azure/identity'
import { acquireMapsAccessToken, MapsAuthError } from './mapsAuth.js'

function credentialReturning(token: string | null): TokenCredential {
  return {
    getToken: vi.fn().mockResolvedValue(token ? { token, expiresOnTimestamp: 1_800_000_000_000 } : null),
  }
}

describe('acquireMapsAccessToken', () => {
  it('requests an Azure Maps token and returns its expiry', async () => {
    const credential = credentialReturning('entra-token')

    await expect(acquireMapsAccessToken(credential)).resolves.toEqual({
      token: 'entra-token',
      expiresOn: '2027-01-15T08:00:00.000Z',
    })
    expect(credential.getToken).toHaveBeenCalledWith('https://atlas.microsoft.com/.default')
  })

  it('throws when the credential cannot acquire a token', async () => {
    await expect(acquireMapsAccessToken(credentialReturning(null))).rejects.toThrow(MapsAuthError)
  })
})
