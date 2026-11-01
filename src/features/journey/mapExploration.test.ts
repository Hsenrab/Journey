import { describe, expect, it } from 'vitest'
import { createMapExploration, mapExplorationState, mapExplorationTarget } from './mapExploration'

const metadata = {
  mode: 'waypoints',
  progressFilter: 'started',
  medalFilter: 'bronze',
  mobilePanel: 'list',
  originQuery: '  edited query  ',
  origin: { latitude: 51.5, longitude: -1.2 },
  originChoices: [{ label: 'Unchosen place', latitude: 52, longitude: -2 }],
  searchFeedback: 'No places matched that search.',
  camera: { center: [-1.2, 51.5], zoom: 12.5, bearing: 34, pitch: 20 },
  selectedRouteChallengeId: 'route',
  trackActivityId: 'track',
  selection: { kind: 'waypoint', id: 'waypoint' },
  openedRecord: { kind: 'activity', id: 'activity' },
  entryPath: 'marker',
}

describe('Map exploration session', () => {
  it('captures independent typed metadata without retaining mutable input or entity content', () => {
    const session = createMapExploration('production')
    const input = structuredClone(metadata)
    session.capture('first', input)
    session.capture('second', { ...metadata, originQuery: 'second' })
    input.camera.center[0] = 90
    input.originChoices[0]!.label = 'changed'
    expect(session.lookup('first')).toMatchObject({ kind: 'current', metadata })
    expect(session.lookup('second')).toMatchObject({ metadata: { originQuery: 'second' } })
    const entry = session.lookup('first')
    expect(Object.keys(entry).sort()).toEqual(['kind', 'metadata', 'openedRecord', 'scope'])
    expect(
      session.resolveOrigin(
        mapExplorationState('first', { kind: 'activity', id: 'activity' }, session.scope),
        'activity',
        'activity',
      ),
    ).toMatchObject({ kind: 'current' })
    expect(
      session.resolveOrigin(
        mapExplorationState('first', { kind: 'waypoint', id: 'activity' }, session.scope),
        'waypoint',
        'activity',
      ),
    ).toEqual({ kind: 'absent' })
    expect(
      session.resolveOrigin(
        mapExplorationState('first', { kind: 'activity', id: 'other' }, session.scope),
        'activity',
        'other',
      ),
    ).toEqual({ kind: 'absent' })
  })

  it('limits hints to their namespace and exact opened kind/ID, including after invalidation', () => {
    const session = createMapExploration('production')
    session.capture('source', metadata)
    const hint = mapExplorationState('source', { kind: 'activity', id: 'activity' }, session.scope)
    expect(session.resolveOrigin(hint, 'waypoint', 'activity')).toEqual({ kind: 'absent' })
    expect(session.resolveOrigin({ waypointDiscoveryOrigin: {} }, 'activity', 'activity')).toEqual({ kind: 'absent' })
    session.select('demo-local')
    expect(session.resolveOrigin(hint, 'activity', 'activity')).toMatchObject({ kind: 'invalidated' })
    expect(
      session.resolveOrigin(
        mapExplorationState('source', { kind: 'activity', id: 'other' }, hint.mapExplorationOrigin.scope),
        'activity',
        'other',
      ),
    ).toEqual({ kind: 'absent' })
    expect(createMapExploration('production').lookup('source', hint)).toEqual({ kind: 'absent' })
  })

  it.each(['select', 'settle'] as const)(
    'permanently invalidates through %s A -> B -> A and late following',
    (method) => {
      const session = createMapExploration('production')
      session.capture('source', metadata)
      const original = session.lookup('source')
      session.follow('return', original)
      const scope = session.scope
      session[method]('demo-cosmos')
      session[method]('production')
      session.follow('late-return', original)
      expect(session.scope).not.toBe(scope)
      for (const key of ['source', 'return', 'late-return']) {
        expect(session.lookup(key)).toMatchObject({ kind: 'invalidated' })
        expect(mapExplorationTarget(session.lookup(key))).toBe('/map')
      }
      session.capture('new', metadata)
      expect(session.lookup('new')).toMatchObject({ kind: 'current', scope: session.scope })
      expect(session.lookup('source')).toMatchObject({ kind: 'invalidated' })
    },
  )

  it('follows explicit returns and retains scope for same-dataset reloads', () => {
    const session = createMapExploration('production')
    session.capture('source', metadata)
    const hint = mapExplorationState('source', { kind: 'activity', id: 'activity' }, session.scope)
    session.follow('return', session.lookup('return', hint))
    const scope = session.scope
    session.select('production')
    session.settle('production')
    expect(session.lookup('return')).toMatchObject({ kind: 'current', metadata, scope })
    expect(mapExplorationTarget(session.lookup('return'))).toBe('/map?activityId=track')
    session.follow('absent', { kind: 'absent' })
    expect(session.lookup('absent')).toEqual({ kind: 'absent' })
  })

  it('never lets an old hint adopt a new capture under a reused history key', () => {
    const session = createMapExploration('production')
    const originalHint = session.capture('source', metadata)
    session.select('demo-local')
    session.select('production')
    const freshHint = session.capture('source', { ...metadata, originQuery: 'Fresh exploration' })
    expect(session.resolveOrigin(originalHint, 'activity', 'activity')).toMatchObject({ kind: 'invalidated' })
    expect(session.resolveOrigin(freshHint, 'activity', 'activity')).toMatchObject({
      kind: 'current',
      metadata: { originQuery: 'Fresh exploration' },
    })
    const restarted = createMapExploration('production')
    restarted.capture('source', metadata)
    expect(restarted.resolveOrigin(originalHint, 'activity', 'activity')).toEqual({ kind: 'absent' })
  })

  it('accepts absent camera before readiness and preserves available camera components', () => {
    const session = createMapExploration('production')
    const { camera: _camera, ...beforeReady } = metadata
    session.capture('before-ready', beforeReady)
    expect(session.lookup('before-ready')).toMatchObject({ metadata: beforeReady })
    session.capture('ready', { ...metadata, camera: { center: [1, 2], zoom: 9 } })
    expect(session.lookup('ready')).toMatchObject({ metadata: { camera: { center: [1, 2], zoom: 9 } } })
  })

  it.each([
    { mode: 'invalid' },
    { progressFilter: 'completed' },
    { medalFilter: 'platinum' },
    { mobilePanel: 'hidden' },
    { origin: { latitude: 91, longitude: 0 } },
    { originChoices: [{ label: 'Place', latitude: 0, longitude: Infinity }] },
    { camera: { center: [0, 0], zoom: NaN } },
    { camera: { zoom: 8 } },
    { camera: { center: [0, 0], zoom: 8, bearing: Infinity } },
    { selection: { kind: 'cluster', id: '1' } },
    { openedRecord: { kind: 'activity', id: '' } },
    { entryPath: 'direct' },
    { entities: [] },
    { geometry: [] },
    { token: 'secret' },
    { sdk: {} },
    { resultSet: [] },
  ])('rejects unsupported or malformed metadata: %j', (change) => {
    expect(() => createMapExploration('production').capture('source', { ...metadata, ...change })).toThrow()
  })

  it.each([
    null,
    {},
    { entryKey: '', openedRecord: { kind: 'activity', id: 'activity' } },
    { entryKey: 'source', openedRecord: { kind: 'cluster', id: 'activity' } },
  ])('rejects malformed supplied hints even when an own entry exists: %j', (hint) => {
    const session = createMapExploration('production')
    session.capture('source', metadata)
    expect(() => session.lookup('source', { mapExplorationOrigin: hint })).toThrow()
    expect(() => session.resolveOrigin({ mapExplorationOrigin: hint }, 'activity', 'activity')).toThrow()
  })
})
