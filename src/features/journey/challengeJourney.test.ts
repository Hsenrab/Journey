import { describe, expect, it } from 'vitest'
import { createJourneyTestData } from '../../test/demoData'
import { challengeJourneyState, resolveChallengeOrigin } from './challengeJourney'

const scope = { dataMode: 'demo-cosmos', activeDataMode: 'demo-cosmos', loaded: true } as const

describe('Challenge visit origin', () => {
  it('uses explicit shared origin and current names, never first membership', () => {
    const data = createJourneyTestData()
    const state = challengeJourneyState('shared', 'once', scope)
    data.challenges[1]!.title = 'Renamed Challenge'
    expect(resolveChallengeOrigin(state, 'once', scope, data)?.title).toBe('Renamed Challenge')
    expect(resolveChallengeOrigin(undefined, 'once', scope, data)).toBeUndefined()
  })

  it.each([null, {}, { challengeOrigin: null }, { challengeOrigin: { challengeId: 1 } }])(
    'rejects malformed optional state %j',
    (state) => expect(resolveChallengeOrigin(state, 'once', scope, createJourneyTestData())).toBeUndefined(),
  )

  it('rejects document, route, selected/loaded scope, load, existence and membership mismatches', () => {
    const data = createJourneyTestData()
    const state = challengeJourneyState('journey', 'once', scope)
    expect(
      resolveChallengeOrigin(
        { challengeOrigin: { ...state.challengeOrigin, documentId: 'old-document' } },
        'once',
        scope,
        data,
      ),
    ).toBeUndefined()
    expect(resolveChallengeOrigin(state, 'counted', scope, data)).toBeUndefined()
    expect(resolveChallengeOrigin(state, 'once', { ...scope, dataMode: 'production' }, data)).toBeUndefined()
    expect(resolveChallengeOrigin(state, 'once', { ...scope, activeDataMode: 'demo-local' }, data)).toBeUndefined()
    expect(resolveChallengeOrigin(state, 'once', { ...scope, loaded: false }, data)).toBeUndefined()
    expect(resolveChallengeOrigin(state, 'once', scope, { ...data, challenges: [] })).toBeUndefined()
    expect(resolveChallengeOrigin(state, 'once', scope, { ...data, waypoints: [] })).toBeUndefined()
    data.waypoints[0]!.challengeIds = ['shared']
    expect(resolveChallengeOrigin(state, 'once', scope, data)).toBeUndefined()
  })
})
