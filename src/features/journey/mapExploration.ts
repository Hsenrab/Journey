import { z } from 'zod'
import type { JourneyDataMode } from '../../services/storage'

const identifier = z.string().min(1)
const coordinates = z.strictObject({
  latitude: z.number().min(-90).max(90),
  longitude: z.number().min(-180).max(180),
})
const record = z.strictObject({ kind: z.enum(['waypoint', 'activity']), id: identifier })
const metadataSchema = z.strictObject({
  mode: z.enum(['waypoints', 'activities']),
  progressFilter: z.enum(['all', 'started', 'not-started']),
  medalFilter: z.enum(['all', 'bronze', 'silver', 'gold']),
  mobilePanel: z.enum(['map', 'list']),
  originQuery: z.string(),
  origin: coordinates.optional(),
  originChoices: z.array(coordinates.extend({ label: z.string() })),
  searchFeedback: z.string().optional(),
  camera: z
    .strictObject({
      center: z.tuple([z.number(), z.number()]),
      zoom: z.number(),
      bearing: z.number().optional(),
      pitch: z.number().optional(),
    })
    .optional(),
  selectedRouteChallengeId: identifier.optional(),
  trackActivityId: identifier.optional(),
  selection: record.optional(),
  openedRecord: record,
  entryPath: z.enum(['nearby', 'marker', 'cluster']),
})
const originSchema = z.strictObject({ entryKey: identifier, openedRecord: record, scope: identifier })

export type MapRecord = z.infer<typeof record>
export type MapExplorationMetadata = z.infer<typeof metadataSchema>
export type MapExplorationEntry =
  | { kind: 'current'; metadata: MapExplorationMetadata; openedRecord: MapRecord; scope: string }
  | { kind: 'invalidated'; openedRecord: MapRecord; scope: string }
  | { kind: 'absent' }

export function mapExplorationState(entryKey: string, openedRecord: MapRecord, scope: string) {
  return { mapExplorationOrigin: originSchema.parse({ entryKey, openedRecord, scope }) }
}

export function mapExplorationTarget(entry: MapExplorationEntry) {
  const track = entry.kind === 'current' ? entry.metadata.trackActivityId : undefined
  return track ? `/map?${new URLSearchParams({ activityId: track })}` : '/map'
}

export function createMapExploration(initialMode: JourneyDataMode) {
  let selected = initialMode
  let effective = initialMode
  let scope = crypto.randomUUID()
  const entries = new Map<string, Exclude<MapExplorationEntry, { kind: 'absent' }>>()
  const origins = new Map<string, Map<string, Exclude<MapExplorationEntry, { kind: 'absent' }>>>()
  const remember = (entryKey: string, entry: Exclude<MapExplorationEntry, { kind: 'absent' }>) => {
    entries.set(entryKey, entry)
    let scopes = origins.get(entryKey)
    if (!scopes) {
      scopes = new Map()
      origins.set(entryKey, scopes)
    }
    scopes.set(entry.scope, entry)
  }
  const invalidate = () => {
    scope = crypto.randomUUID()
    for (const [key, entry] of entries) {
      entries.set(key, { kind: 'invalidated', openedRecord: entry.openedRecord, scope: entry.scope })
    }
    for (const scopes of origins.values()) {
      for (const [key, entry] of scopes) {
        scopes.set(key, { kind: 'invalidated', openedRecord: entry.openedRecord, scope: entry.scope })
      }
    }
  }
  const fromState = (state: unknown, target?: MapRecord): MapExplorationEntry => {
    if (typeof state !== 'object' || state === null || !('mapExplorationOrigin' in state)) return { kind: 'absent' }
    const hint = originSchema.parse(state.mapExplorationOrigin)
    if (target && (hint.openedRecord.kind !== target.kind || hint.openedRecord.id !== target.id))
      return { kind: 'absent' }
    const entry = origins.get(hint.entryKey)?.get(hint.scope)
    if (
      !entry ||
      entry.openedRecord.kind !== hint.openedRecord.kind ||
      entry.openedRecord.id !== hint.openedRecord.id
    ) {
      return { kind: 'absent' }
    }
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
    capture(entryKey: string, metadata: unknown) {
      identifier.parse(entryKey)
      const parsed = metadataSchema.parse(metadata)
      remember(entryKey, { kind: 'current', metadata: parsed, openedRecord: parsed.openedRecord, scope })
      return mapExplorationState(entryKey, parsed.openedRecord, scope)
    },
    lookup(entryKey: string, state?: unknown): MapExplorationEntry {
      const origin = fromState(state)
      return entries.get(entryKey) ?? origin
    },
    resolveOrigin(state: unknown, kind: MapRecord['kind'], id: string): MapExplorationEntry {
      return fromState(state, { kind, id })
    },
    follow(entryKey: string, source: MapExplorationEntry) {
      if (source.kind === 'absent') return
      remember(
        entryKey,
        source.kind === 'invalidated' || source.scope !== scope
          ? { kind: 'invalidated', openedRecord: source.openedRecord, scope: source.scope }
          : source,
      )
    },
  }
}
