import type { JourneyRole } from '../services/journeyApi'
import type { JourneyDataMode } from '../services/storage'

export type DataModeState = {
  activeDataMode: JourneyDataMode
  dataMode: JourneyDataMode
  loadError?: string
  loading: boolean
  readOnly: boolean
  role: JourneyRole | 'local'
}

export type ReadOnlyReason = 'fallback' | 'error' | 'viewer' | 'demoLocal'
export type DataModeStatus = 'fallback' | 'error' | 'loading' | 'viewer' | 'demoLocal' | 'readOnly' | 'admin' | 'local'

/** Access or load status, kept separate from the identity of the selected dataset. */
export function dataModeStatus(state: DataModeState): DataModeStatus {
  if (state.dataMode === 'demo-cosmos' && state.activeDataMode === 'demo-local' && state.loadError) return 'fallback'
  if (state.loadError) return 'error'
  if (state.loading) return 'loading'
  if (state.role === 'viewer') return 'viewer'
  if (state.activeDataMode === 'demo-local') return 'demoLocal'
  if (state.readOnly) return 'readOnly'
  if (state.role === 'admin') return 'admin'
  return 'local'
}

/** Why writes are unavailable, or undefined while loading or without an explainable read-only reason. */
export function readOnlyReason(state: DataModeState): ReadOnlyReason | undefined {
  if (state.loading || !state.readOnly) return undefined
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
