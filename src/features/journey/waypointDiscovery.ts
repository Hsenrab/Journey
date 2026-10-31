import { z } from 'zod'
import { statusOrder } from '../../domain/visit'
import type { JourneyDataMode } from '../../services/storage'

const CriteriaSchema = z.strictObject({
  query: z.string(),
  area: z.string().min(1),
  category: z.string().min(1),
  sort: z.enum(['name', 'status', 'lastActivity']),
  status: z.enum(['all', ...statusOrder]),
  challengeId: z.string().min(1).optional(),
})
const OriginSchema = z.strictObject({ entryKey: z.string().min(1), waypointId: z.string().min(1) })

export type DiscoveryCriteria = z.infer<typeof CriteriaSchema>
export type DiscoveryEntry =
  | { kind: 'current'; criteria: DiscoveryCriteria; waypointId: string; scope: symbol }
  | { kind: 'invalidated' }
  | { kind: 'absent' }

export function waypointDiscoveryState(entryKey: string, waypointId: string) {
  return { waypointDiscoveryOrigin: { entryKey, waypointId } }
}

export function isPlainDiscoveryActivation(event: {
  button: number
  defaultPrevented: boolean
  ctrlKey: boolean
  metaKey: boolean
  shiftKey: boolean
  altKey: boolean
}) {
  return (
    event.button === 0 &&
    !event.defaultPrevented &&
    !event.ctrlKey &&
    !event.metaKey &&
    !event.shiftKey &&
    !event.altKey
  )
}

export function createWaypointDiscovery(initialMode: JourneyDataMode) {
  let selected = initialMode
  let effective = initialMode
  let scope = Symbol('Waypoint discovery dataset')
  const entries = new Map<string, Exclude<DiscoveryEntry, { kind: 'absent' }>>()
  const invalidate = () => {
    scope = Symbol('Waypoint discovery dataset')
    for (const key of entries.keys()) entries.set(key, { kind: 'invalidated' })
  }
  const fromState = (state: unknown, routeId?: string): DiscoveryEntry => {
    if (typeof state !== 'object' || state === null || !('waypointDiscoveryOrigin' in state)) return { kind: 'absent' }
    const hint = OriginSchema.parse(state.waypointDiscoveryOrigin)
    if (routeId !== undefined && hint.waypointId !== routeId) return { kind: 'absent' }
    const entry = entries.get(hint.entryKey)
    if (!entry || (entry.kind === 'current' && entry.waypointId !== hint.waypointId)) return { kind: 'absent' }
    return entry
  }
  return {
    get scope() {
      return scope
    },
    select(mode: JourneyDataMode) {
      if (mode === selected) return
      selected = mode
      invalidate()
    },
    settle(mode: JourneyDataMode) {
      if (mode === effective) return
      effective = mode
      invalidate()
    },
    capture(entryKey: string, criteria: unknown, waypointId: string) {
      entries.set(entryKey, { kind: 'current', criteria: CriteriaSchema.parse(criteria), waypointId, scope })
    },
    lookup(entryKey: string, state?: unknown): DiscoveryEntry {
      return entries.get(entryKey) ?? fromState(state)
    },
    resolveOrigin(state: unknown, routeId: string): DiscoveryEntry {
      return fromState(state, routeId)
    },
    follow(entryKey: string, source: DiscoveryEntry, criteria: unknown) {
      if (source.kind === 'absent') return
      entries.set(
        entryKey,
        source.kind === 'invalidated' || source.scope !== scope
          ? { kind: 'invalidated' }
          : { ...source, criteria: CriteriaSchema.parse(criteria) },
      )
    },
  }
}
