import { describe, expect, it } from 'vitest'
import { expectedFunctions, verifyLinkedBackend, verifyRegisteredFunctions } from './verify-functions.ts'

const registrations = () =>
  expectedFunctions.map((fn) => ({
    name: `journey-api/${fn.name}`,
    isDisabled: false,
    config: {
      bindings: [
        { type: 'httpTrigger', direction: 'in', route: fn.route, methods: fn.methods, authLevel: 'anonymous' },
      ],
    },
  }))

describe('deployment registration checks', () => {
  it('accepts the expected registered HTTP triggers', () => {
    expect(() => verifyRegisteredFunctions(registrations())).not.toThrow()
  })

  it('rejects successful trigger sync with no registered functions', () => {
    expect(() => verifyRegisteredFunctions([])).toThrow('Function "journey" is not registered.')
  })

  it.each(expectedFunctions)('rejects a missing $name function', ({ name }) => {
    expect(() => verifyRegisteredFunctions(registrations().filter((fn) => !fn.name.endsWith(`/${name}`)))).toThrow(
      `Function "${name}" is not registered.`,
    )
  })

  it('rejects the wrong route, disabled functions, and missing HTTP triggers', () => {
    const wrongRoute = registrations()
    wrongRoute[0].config.bindings[0].route = 'wrong'
    expect(() => verifyRegisteredFunctions(wrongRoute)).toThrow('wrong route')
    const disabled = registrations()
    disabled[0].isDisabled = true
    expect(() => verifyRegisteredFunctions(disabled)).toThrow('disabled')
    const noTrigger = registrations()
    noTrigger[0].config.bindings = []
    expect(() => verifyRegisteredFunctions(noTrigger)).toThrow('no HTTP trigger')
  })

  it('rejects missing GET support or key-based authorization', () => {
    const wrongMethod = registrations()
    wrongMethod[0].config.bindings[0].methods = ['POST']
    expect(() => verifyRegisteredFunctions(wrongMethod)).toThrow()
    const keyRequired = registrations()
    keyRequired[0].config.bindings[0].authLevel = 'function'
    expect(() => verifyRegisteredFunctions(keyRequired)).toThrow()
  })

  it('requires exactly the intended linked backend', () => {
    expect(() => verifyLinkedBackend(['/sites/Journey-api'], '/sites/journey-api')).not.toThrow()
    expect(() => verifyLinkedBackend([], '/sites/journey-api')).toThrow('Incorrect linked backend')
    expect(() => verifyLinkedBackend(['/sites/other-api'], '/sites/journey-api')).toThrow('Incorrect linked backend')
    expect(() => verifyLinkedBackend(['/sites/journey-api', '/sites/other-api'], '/sites/journey-api')).toThrow()
  })
})
