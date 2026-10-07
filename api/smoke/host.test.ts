import { spawn, type ChildProcess } from 'node:child_process'
import { once } from 'node:events'
import { cp, mkdtemp, readFile, rm, symlink, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { resolve, join } from 'node:path'
import { setTimeout as delay } from 'node:timers/promises'
import { afterEach, expect, it } from 'vitest'
import { verifyRegisteredFunctions, verifyUnauthorizedRoutes } from '../scripts/verify-functions.ts'

let directory: string
let host: ChildProcess

afterEach(async () => {
  if (host && host.exitCode === null && host.signalCode === null) {
    const exited = once(host, 'exit')
    host.kill('SIGTERM')
    await exited
  }
  if (directory) await rm(directory, { recursive: true, force: true })
})

async function startHost(missingRoutes = false) {
  directory = await mkdtemp(join(tmpdir(), 'journey-functions-'))
  await cp(resolve('dist'), join(directory, 'dist'), { recursive: true })
  await cp(resolve('host.json'), join(directory, 'host.json'))
  await cp(resolve('package.json'), join(directory, 'package.json'))
  await symlink(resolve('node_modules'), join(directory, 'node_modules'), 'dir')
  if (missingRoutes) {
    const manifest = JSON.parse(await readFile(join(directory, 'package.json'), 'utf8'))
    manifest.main = 'dist/src/lib/principal.js'
    await writeFile(join(directory, 'package.json'), JSON.stringify(manifest))
  }
  host = spawn('func', ['start', '--port', '7079', '--verbose'], {
    cwd: directory,
    env: {
      PATH: process.env.PATH,
      HOME: process.env.HOME,
      FUNCTIONS_WORKER_RUNTIME: 'node',
      FUNCTIONS_CORE_TOOLS_TELEMETRY_OPTOUT: '1',
    },
    stdio: ['ignore', 'pipe', 'pipe'],
  })
  await new Promise<void>((resolveStarted, reject) => {
    let output = ''
    const timeout = setTimeout(() => reject(new Error(`Functions host startup timed out:\n${output}`)), 90_000)
    host.once('error', (error) => {
      clearTimeout(timeout)
      reject(error)
    })
    host.once('exit', (code) => {
      clearTimeout(timeout)
      reject(new Error(`Functions host exited (${code}):\n${output}`))
    })
    const capture = (chunk: Buffer) => {
      output += chunk.toString()
      if (output.includes('Host started')) {
        clearTimeout(timeout)
        resolveStarted()
      }
    }
    host.stdout!.on('data', capture)
    host.stderr!.on('data', capture)
  })
  const deadline = Date.now() + 10_000
  while (true) {
    try {
      const response = await fetch('http://127.0.0.1:7079/admin/host/status', {
        signal: AbortSignal.timeout(5_000),
      })
      expect(response.status).toBe(200)
      if ((await response.json()).state === 'Running') return
    } catch (error) {
      if (!(error instanceof TypeError && (error.cause as NodeJS.ErrnoException)?.code === 'ECONNREFUSED')) throw error
    }
    if (Date.now() >= deadline) throw new Error('Functions host did not become ready.')
    await delay(100)
  }
}

it('starts the built package and rejects unauthenticated calls to every expected route', async () => {
  await startHost()
  const functions = await fetch('http://127.0.0.1:7079/admin/functions', { signal: AbortSignal.timeout(10_000) })
  expect(functions.status).toBe(200)
  verifyRegisteredFunctions(await functions.json())
  await verifyUnauthorizedRoutes('http://127.0.0.1:7079')
})

it('fails the route check when the built package entry point registers no functions', async () => {
  await startHost(true)
  await expect(verifyUnauthorizedRoutes('http://127.0.0.1:7079')).rejects.toThrow(
    'journey: expected authorization rejection, got HTTP 404.',
  )
})
