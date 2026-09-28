import type { JourneyRole } from '../services/journeyApi'
import type { JourneyDataMode } from '../services/storage'

export type DataModeState = {
  activeDataMode: JourneyDataMode
  dataMode: JourneyDataMode
  loadError?: string
  readOnly: boolean
  role: JourneyRole | 'local'
}

export type ReadOnlyReason = 'fallback' | 'error' | 'viewer' | 'demoLocal'
export type DataModeStatus = ReadOnlyReason | 'readOnly' | 'demoWritable' | 'production'

/** Status of the active dataset, used for the app bar chip. */
export function dataModeStatus(state: DataModeState): DataModeStatus {
  if (state.dataMode === 'demo-cosmos' && state.activeDataMode === 'demo-local' && state.loadError) return 'fallback'
  if (state.loadError) return 'error'
  if (state.role === 'viewer') return 'viewer'
  if (state.activeDataMode === 'demo-local') return 'demoLocal'
  if (state.readOnly) return 'readOnly'
  if (state.activeDataMode === 'demo-cosmos') return 'demoWritable'
  return 'production'
}

/** Why writes are unavailable, or undefined when there is no explainable read-only reason. */
export function readOnlyReason(state: DataModeState, loading: boolean): ReadOnlyReason | undefined {
  if (loading || !state.readOnly) return undefined
  const status = dataModeStatus(state)
  switch (status) {
    case 'fallback':
    case 'error':
    case 'viewer':
    case 'demoLocal':
      return status
    default:
      return undefined
  }
}
