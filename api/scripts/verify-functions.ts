import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { pathToFileURL } from 'node:url'

export const expectedFunctions = [
  {
    name: 'journey',
    route: 'journey/{container}',
    path: 'journey/production',
    methods: ['GET', 'POST', 'PUT', 'DELETE'],
  },
  { name: 'mapsSearch', route: 'maps/search', path: 'maps/search?query=London', methods: ['GET'] },
  { name: 'mapsToken', route: 'maps/token', path: 'maps/token', methods: ['GET'] },
]

interface RegisteredFunction {
  name: string
  isDisabled?: boolean
  config: {
    bindings: {
      type: string
      direction: string
      route: string
      methods: string[]
      authLevel: string
    }[]
  }
}

export function verifyRegisteredFunctions(functions: RegisteredFunction[]) {
  for (const expected of expectedFunctions) {
    const registered = functions.find((fn) => fn.name.split('/').at(-1) === expected.name)
    assert(registered, `Function "${expected.name}" is not registered.`)
    assert(!registered.isDisabled, `Function "${expected.name}" is disabled.`)
    const trigger = registered.config.bindings.find((binding) => binding.type === 'httpTrigger')
    assert(trigger, `Function "${expected.name}" has no HTTP trigger.`)
    assert.equal(trigger.direction.toLowerCase(), 'in')
    assert.equal(trigger.route, expected.route, `Function "${expected.name}" has the wrong route.`)
    assert.equal(trigger.authLevel.toLowerCase(), 'anonymous')
    assert.deepEqual(trigger.methods.map((method) => method.toUpperCase()).sort(), [...expected.methods].sort())
  }
}

export function verifyLinkedBackend(backends: string[], functionAppId: string) {
  assert.deepEqual(
    backends.map((id) => id.toLowerCase()),
    [functionAppId.toLowerCase()],
    'Incorrect linked backend.',
  )
}

export async function verifyUnauthorizedRoutes(baseUrl: string) {
  for (const expected of expectedFunctions) {
    const response = await fetch(`${baseUrl}/api/${expected.path}`, {
      redirect: 'manual',
      signal: AbortSignal.timeout(10_000),
    })
    assert.equal(
      response.status,
      403,
      `${expected.name}: expected authorization rejection, got HTTP ${response.status}.`,
    )
    assert.deepEqual(await response.json(), { error: 'forbidden' })
  }
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  const [functionsFile, backendsFile, functionAppId] = process.argv.slice(2)
  assert(
    functionsFile && backendsFile && functionAppId,
    'Expected functions JSON, backend IDs JSON, and Function App ID.',
  )
  verifyRegisteredFunctions(JSON.parse(readFileSync(functionsFile, 'utf8')))
  verifyLinkedBackend(JSON.parse(readFileSync(backendsFile, 'utf8')), functionAppId)
  console.log(
    'Registered Journey/Maps HTTP triggers and linked backend verified (not an authenticated API invocation).',
  )
}
