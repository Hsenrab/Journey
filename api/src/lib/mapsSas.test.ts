import { describe, expect, it, vi } from 'vitest'
import type { TokenCredential } from '@azure/identity'
import { issueMapsSasToken, MapsSasError } from './mapsSas.js'

const CONFIG = {
  subscriptionId: 'sub-1',
  resourceGroupName: 'rg-1',
  accountName: 'maps-1',
  principalId: 'principal-1',
  lifetimeMinutes: 15,
  maxRatePerSecond: 5,
}

function credentialReturning(token: string | null): TokenCredential {
  return {
    getToken: vi.fn().mockResolvedValue(token ? { token, expiresOnTimestamp: Date.now() } : null),
  }
}

describe('issueMapsSasToken', () => {
  it('throws when an Azure Resource Manager token cannot be acquired', async () => {
    const credential = credentialReturning(null)
    await expect(issueMapsSasToken(credential, CONFIG, vi.fn())).rejects.toThrow(MapsSasError)
  })

  it('throws with the response body when listSas fails', async () => {
    const credential = credentialReturning('arm-token')
    const fetchImpl = vi.fn().mockResolvedValue({
      ok: false,
      status: 403,
      text: () => Promise.resolve('Forbidden: missing Microsoft.Maps/accounts/listSas/action'),
    })

    await expect(issueMapsSasToken(credential, CONFIG, fetchImpl as unknown as typeof fetch)).rejects.toThrow(
      /listSas request failed with status 403/,
    )
  })

  it('throws when the response is missing the SAS token', async () => {
    const credential = credentialReturning('arm-token')
    const fetchImpl = vi.fn().mockResolvedValue({
      ok: true,
      json: () => Promise.resolve({}),
    })

    await expect(issueMapsSasToken(credential, CONFIG, fetchImpl as unknown as typeof fetch)).rejects.toThrow(
      /did not include an accountSasToken/,
    )
  })

  it('returns the issued token and a short-lived expiry', async () => {
    const credential = credentialReturning('arm-token')
    const fetchImpl = vi.fn().mockResolvedValue({
      ok: true,
      json: () => Promise.resolve({ accountSasToken: 'sas-token-value' }),
    })

    const result = await issueMapsSasToken(credential, CONFIG, fetchImpl as unknown as typeof fetch)

    expect(result.token).toBe('sas-token-value')
    expect(new Date(result.expiresOn).getTime()).toBeGreaterThan(Date.now())

    const [url, requestInit] = fetchImpl.mock.calls[0] as [string, RequestInit]
    expect(url).toContain(`/subscriptions/${CONFIG.subscriptionId}`)
    expect(url).toContain('listSas')
    expect((requestInit.headers as Record<string, string>).Authorization).toBe('Bearer' + ' arm-token')
    const body = JSON.parse(requestInit.body as string) as { principalId: string }
    expect(body.principalId).toBe(CONFIG.principalId)
  })
})
