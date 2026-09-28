import { describe, expect, it } from 'vitest'
import { dataModeStatus, readOnlyReason, type DataModeState } from './dataMode'

const base: DataModeState = {
  activeDataMode: 'production',
  dataMode: 'production',
  loading: false,
  readOnly: false,
  role: 'admin',
}

describe('dataModeStatus', () => {
  it('reports the writable statuses', () => {
    expect(dataModeStatus(base)).toBe('production')
    expect(dataModeStatus({ ...base, activeDataMode: 'demo-cosmos', dataMode: 'demo-cosmos' })).toBe('demoWritable')
  })

  it('reports each read-only status', () => {
    expect(
      dataModeStatus({
        ...base,
        activeDataMode: 'demo-local',
        dataMode: 'demo-cosmos',
        loadError: 'Demo Cosmos could not be loaded',
        readOnly: true,
      }),
    ).toBe('fallback')
    expect(dataModeStatus({ ...base, loadError: 'Production data could not be loaded', readOnly: true })).toBe('error')
    expect(dataModeStatus({ ...base, role: 'viewer', readOnly: true })).toBe('viewer')
    expect(dataModeStatus({ ...base, activeDataMode: 'demo-local', dataMode: 'demo-local', readOnly: true })).toBe(
      'demoLocal',
    )
    expect(dataModeStatus({ ...base, readOnly: true })).toBe('readOnly')
  })
})

describe('readOnlyReason', () => {
  it('returns no reason when data is writable', () => {
    expect(readOnlyReason(base)).toBeUndefined()
  })

  it('returns no reason while a load is still in flight', () => {
    expect(readOnlyReason({ ...base, loading: true, readOnly: true })).toBeUndefined()
    expect(
      readOnlyReason({
        ...base,
        activeDataMode: 'demo-local',
        dataMode: 'production',
        loadError: 'Demo Cosmos could not be loaded',
        loading: true,
        readOnly: true,
      }),
    ).toBeUndefined()
    expect(readOnlyReason({ ...base, activeDataMode: 'demo-local', loading: true, readOnly: true })).toBeUndefined()
  })

  it('distinguishes viewer, demo local and local fallback', () => {
    expect(readOnlyReason({ ...base, role: 'viewer', readOnly: true })).toBe('viewer')
    expect(readOnlyReason({ ...base, activeDataMode: 'demo-local', dataMode: 'demo-local', readOnly: true })).toBe(
      'demoLocal',
    )
    expect(
      readOnlyReason({
        ...base,
        activeDataMode: 'demo-local',
        dataMode: 'demo-cosmos',
        loadError: 'Demo Cosmos could not be loaded',
        readOnly: true,
      }),
    ).toBe('fallback')
  })
})
