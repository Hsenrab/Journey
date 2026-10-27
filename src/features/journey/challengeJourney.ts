import type { WaypointsData } from '../../domain/visit'
import type { JourneyDataMode } from '../../services/storage'

type JourneyScope = {
  dataMode: JourneyDataMode
  activeDataMode: JourneyDataMode
  loaded: boolean
}

const documentId = crypto.randomUUID()

export function challengeJourneyState(challengeId: string, waypointId: string, scope: JourneyScope) {
  return {
    challengeOrigin: {
      challengeId,
      waypointId,
      dataMode: scope.dataMode,
      activeDataMode: scope.activeDataMode,
      documentId,
    },
  }
}

export function resolveChallengeOrigin(state: unknown, waypointId: string, scope: JourneyScope, data: WaypointsData) {
  if (!scope.loaded || typeof state !== 'object' || state === null || !('challengeOrigin' in state)) return undefined
  const origin = state.challengeOrigin
  if (
    typeof origin !== 'object' ||
    origin === null ||
    !('challengeId' in origin) ||
    typeof origin.challengeId !== 'string' ||
    !('waypointId' in origin) ||
    origin.waypointId !== waypointId ||
    !('documentId' in origin) ||
    origin.documentId !== documentId ||
    !('dataMode' in origin) ||
    origin.dataMode !== scope.dataMode ||
    !('activeDataMode' in origin) ||
    origin.activeDataMode !== scope.activeDataMode
  )
    return undefined
  const challengeId = origin.challengeId
  const waypoint = data.waypoints.find((item) => item.waypointId === waypointId)
  if (!waypoint?.challengeIds.includes(challengeId)) return undefined
  return data.challenges.find((item) => item.challengeId === challengeId)
}
