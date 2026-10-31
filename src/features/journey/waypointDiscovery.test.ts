import { describe, expect, it } from 'vitest'
import { createWaypointDiscovery, waypointDiscoveryState, type DiscoveryCriteria } from './waypointDiscovery'

const criteria: DiscoveryCriteria = {
  query: '  Caf\u00e9 & garden?  ',
  area: 'Long area',
  category: 'Garden',
  sort: 'lastActivity',
  status: 'silver',
  challengeId: 'challenge',
}

describe('Waypoint discovery session', () => {
  it('captures exact independent snapshots and resolves only the namespaced matching route', () => {
    const session = createWaypointDiscovery('production')
    session.capture('first', criteria, 'one')
    session.capture('second', { ...criteria, query: 'different' }, 'two')
    expect(session.lookup('first')).toMatchObject({ kind: 'current', criteria, waypointId: 'one' })
    expect(session.lookup('second')).toMatchObject({ kind: 'current', criteria: { query: 'different' } })
    const state = waypointDiscoveryState('first', 'one')
    expect(session.resolveOrigin(state, 'one')).toMatchObject({ kind: 'current', criteria })
    expect(session.resolveOrigin(state, 'two')).toEqual({ kind: 'absent' })
    expect(session.resolveOrigin({ challengeOrigin: { waypointId: 'one' } }, 'one')).toEqual({ kind: 'absent' })
    expect(session.resolveOrigin(undefined, 'one')).toEqual({ kind: 'absent' })
    expect(createWaypointDiscovery('production').resolveOrigin(state, 'one')).toEqual({ kind: 'absent' })
  })

  it('does not retain mutable input or entity snapshots', () => {
    const session = createWaypointDiscovery('production')
    const input = { ...criteria }
    session.capture('list', input, 'one')
    input.query = 'changed'
    expect(session.lookup('list')).toMatchObject({ criteria })
    expect(Object.keys(session.lookup('list')).sort()).toEqual(['criteria', 'kind', 'scope', 'waypointId'])
  })

  it.each(['selected', 'effective'] as const)('invalidates irreversibly on %s A -> B -> A', (transition) => {
    const session = createWaypointDiscovery('production')
    const scope = session.scope
    session.capture('list', criteria, 'one')
    if (transition === 'selected') {
      session.select('demo-cosmos')
      session.select('production')
    } else {
      session.settle('demo-local')
      session.settle('production')
    }
    expect(session.scope).not.toBe(scope)
    expect(session.lookup('list')).toEqual({ kind: 'invalidated' })
    expect(session.resolveOrigin(waypointDiscoveryState('list', 'one'), 'one')).toEqual({ kind: 'invalidated' })
    expect(session.lookup('unknown')).toEqual({ kind: 'absent' })
  })

  it('follows return and own PUSH/REPLACE entries without reviving an invalidated origin', () => {
    const session = createWaypointDiscovery('production')
    session.capture('source', criteria, 'one')
    const hint = waypointDiscoveryState('source', 'one')
    session.follow('return', session.lookup('return', hint), { ...criteria, status: 'all' })
    session.follow('own-query', session.lookup('return'), { ...criteria, status: 'gold' })
    expect(session.lookup('own-query')).toMatchObject({ kind: 'current', criteria: { status: 'gold' } })
    session.select('demo-local')
    session.follow('late-return', session.lookup('source'), criteria)
    expect(session.lookup('own-query')).toEqual({ kind: 'invalidated' })
    expect(session.lookup('late-return')).toEqual({ kind: 'invalidated' })
  })

  it('retains the scope for same-mode settlement and selection', () => {
    const session = createWaypointDiscovery('production')
    const scope = session.scope
    session.capture('list', criteria, 'one')
    session.select('production')
    session.settle('production')
    expect(session.scope).toBe(scope)
    expect(session.lookup('list')).toMatchObject({ kind: 'current' })
  })

  it.each([
    { waypointDiscoveryOrigin: null },
    { waypointDiscoveryOrigin: {} },
    { waypointDiscoveryOrigin: { entryKey: '', waypointId: 'one' } },
    { waypointDiscoveryOrigin: { entryKey: 'list', waypointId: 7 } },
  ])('rejects malformed owned metadata: %j', (state) => {
    expect(() => createWaypointDiscovery('production').resolveOrigin(state, 'one')).toThrow()
  })

  it('rejects unsupported criteria instead of silently defaulting', () => {
    expect(() =>
      createWaypointDiscovery('production').capture('list', { ...criteria, sort: 'invalid' }, 'one'),
    ).toThrow()
  })
})
