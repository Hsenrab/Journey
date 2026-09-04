import { beforeEach, describe, expect, it, vi } from 'vitest'
import type { InvocationContext } from '@azure/functions'

const loadDataset = vi.fn()
const journeyContainer = vi.fn()

vi.mock('../lib/cosmos.js', () => ({
  datasetIdFor: (container: string) => container,
  journeyContainer,
  loadDataset,
  createDocument: vi.fn(),
  deleteDocument: vi.fn(),
  documentFor: vi.fn(),
  documentsFor: vi.fn(),
  emptyJourneyData: vi.fn(),
  replaceDocument: vi.fn(),
  replaceDataset: vi.fn(),
  savedDocument: vi.fn(),
}))

const principal = Buffer.from(
  JSON.stringify({ identityProvider: 'aad', userId: 'owner', userDetails: 'owner@example.com', userRoles: ['owner'] }),
).toString('base64')

function request(container: string) {
  return {
    method: 'GET',
    params: { container },
    headers: { get: (name: string) => (name === 'x-ms-client-principal' ? principal : null) },
  } as never
}

describe('journey', () => {
  beforeEach(() => {
    loadDataset.mockReset()
    journeyContainer.mockReset()
  })

  it('uses the route container for a production read', async () => {
    const container = {}
    journeyContainer.mockReturnValue(container)
    loadDataset.mockResolvedValue({ data: { activities: [] }, etags: {} })
    const { journey } = await import('./journey.js')

    expect(await journey(request('production'), { error: vi.fn() } as unknown as InvocationContext)).toMatchObject({
      status: 200,
      jsonBody: { datasetId: 'production' },
    })
    expect(journeyContainer).toHaveBeenCalledWith('production')
    expect(loadDataset).toHaveBeenCalledWith(container, 'production')
  })

  it('rejects unsupported route containers', async () => {
    const { journey } = await import('./journey.js')
    await expect(journey(request('unknown'), { error: vi.fn() } as unknown as InvocationContext)).rejects.toThrow(
      'Unsupported Journey container "unknown".',
    )
  })
})
