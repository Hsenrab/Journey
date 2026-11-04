import assert from 'node:assert/strict'
import { execFileSync } from 'node:child_process'
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { test } from 'node:test'
import { planTestDeployment } from './plan-test-deployment.mjs'

const deploymentJob = (component, conclusion = 'success', stepConclusion = 'success') => ({
  name: `Deploy journey test environment / ${component === 'api' ? 'Deploy Functions API' : 'Resolve infrastructure'}`,
  conclusion,
  steps: [
    {
      name:
        component === 'api' ? 'Deploy to Azure Functions' : 'Deploy Bicep (provision Static Web App and API boundary)',
      conclusion: stepConclusion,
    },
  ],
})

function fixture({ runs = [], jobs = {}, changes = {}, inputs = { infra: 'auto', api: 'auto' } } = {}) {
  const calls = []
  const run = (command, args) => {
    calls.push([command, args])
    if (command === 'git') {
      assert.deepEqual(args.slice(0, 2), ['diff', '--name-only'])
      assert.equal(args[3], 'HEAD')
      assert.ok(Object.hasOwn(changes, args[2]), `Unexpected baseline ${args[2]}`)
      return changes[args[2]]
    }
    assert.equal(command, 'gh')
    assert.equal(args[2], '--jq')
    const url = new URL(args[1], 'https://api.github.com')
    const page = Number(url.searchParams.get('page'))
    if (url.pathname.endsWith('/runs')) {
      assert.equal(url.searchParams.get('status'), 'completed')
      return JSON.stringify({ workflow_runs: runs.slice((page - 1) * 100, page * 100) })
    }
    const id = url.pathname.split('/').at(-2)
    return JSON.stringify({ jobs: (jobs[id] || []).slice((page - 1) * 100, page * 100) })
  }
  return { plan: () => planTestDeployment({ repository: 'Hsenrab/Journey', inputs, run }), calls }
}

test('skipped PR, frontend-only and close runs do not replace deployment baselines', () => {
  const { plan } = fixture({
    runs: [
      { id: 4, head_sha: 'close', event: 'pull_request' },
      { id: 3, head_sha: 'frontend', event: 'workflow_dispatch' },
      { id: 2, head_sha: 'preview', event: 'pull_request' },
      { id: 1, head_sha: 'deployed', event: 'workflow_dispatch' },
    ],
    jobs: {
      3: [deploymentJob('infra', 'success', 'skipped'), deploymentJob('api', 'skipped')],
      2: [deploymentJob('infra', 'success', 'skipped'), deploymentJob('api', 'skipped')],
      1: [deploymentJob('infra'), deploymentJob('api')],
    },
    changes: { deployed: 'api/src/lib/journeySchema.ts\n' },
  })
  assert.deepEqual(plan().decisions, { infra: 'false', api: 'true' })
})

test('API and infrastructure use independent successful deployment baselines', () => {
  const { plan } = fixture({
    runs: [
      { id: 2, head_sha: 'api-only' },
      { id: 1, head_sha: 'infra-only' },
    ],
    jobs: { 2: [deploymentJob('api')], 1: [deploymentJob('infra')] },
    changes: { 'api-only': 'docs/operations.md\n', 'infra-only': 'infra/main.bicep\n' },
  })
  const result = plan()
  assert.deepEqual(result.decisions, { infra: 'true', api: 'false' })
  assert.match(result.summary, /successful infra deployment \(infra-only\)/)
  assert.match(result.summary, /successful api deployment \(api-only\)/)
})

test('successful component deployment counts even when a later job fails the run', () => {
  const { plan } = fixture({
    runs: [{ id: 1, head_sha: 'deployed', conclusion: 'failure' }],
    jobs: { 1: [deploymentJob('api'), deploymentJob('infra')] },
    changes: { deployed: '' },
  })
  assert.deepEqual(plan().decisions, { infra: 'false', api: 'false' })
})

test('failed deployment jobs and skipped deployment steps cannot establish a baseline', () => {
  const { plan } = fixture({
    runs: [{ id: 1, head_sha: 'not-deployed' }],
    jobs: { 1: [deploymentJob('api', 'failure'), deploymentJob('infra', 'success', 'skipped')] },
  })
  const result = plan()
  assert.deepEqual(result.decisions, { infra: 'true', api: 'true' })
  assert.match(result.summary, /No successful api deployment found/)
})

test('explicit inputs bypass history discovery', () => {
  const { plan, calls } = fixture({ inputs: { infra: 'false', api: 'true' } })
  assert.deepEqual(plan().decisions, { infra: 'false', api: 'true' })
  assert.equal(calls.length, 0)
})

test('mixed explicit and automatic inputs only require the automatic baseline', () => {
  const { plan, calls } = fixture({
    inputs: { infra: 'false', api: 'auto' },
    runs: [{ id: 1, head_sha: 'api-only' }],
    jobs: { 1: [deploymentJob('api')] },
    changes: { 'api-only': '' },
  })
  assert.deepEqual(plan().decisions, { infra: 'false', api: 'false' })
  assert.equal(calls.length, 3)
})

test('history and job discovery follow pagination', () => {
  const runs = Array.from({ length: 101 }, (_, index) => ({ id: index, head_sha: `sha-${index}` }))
  const jobs = {
    100: [...Array.from({ length: 100 }, () => ({ name: 'Other job' })), deploymentJob('infra'), deploymentJob('api')],
  }
  const { plan, calls } = fixture({ runs, jobs, changes: { 'sha-100': '' } })
  assert.deepEqual(plan().decisions, { infra: 'false', api: 'false' })
  assert.ok(calls.some(([, args]) => args[1].endsWith('/runs?status=completed&per_page=100&page=2')))
  assert.ok(calls.some(([, args]) => args[1].endsWith('/runs/100/jobs?per_page=100&page=2')))
})

for (const [path, decisions] of [
  ['infra/main.bicep', { infra: 'true', api: 'true' }],
  ['api/package-lock.json', { infra: 'false', api: 'true' }],
  ['staticwebapp.config.json', { infra: 'false', api: 'true' }],
  ['.github/workflows/deploy-test.yml', { infra: 'true', api: 'true' }],
  ['.github/workflows/deploy-environment.yml', { infra: 'true', api: 'true' }],
  ['.github/scripts/plan-test-deployment.mjs', { infra: 'true', api: 'true' }],
  ['.github/scripts/plan-test-deployment.test.mjs', { infra: 'true', api: 'true' }],
  ['src/pages/MapPage.tsx', { infra: 'false', api: 'false' }],
]) {
  test(`deployment selectors cover ${path}`, () => {
    const { plan } = fixture({
      runs: [{ id: 1, head_sha: 'deployed' }],
      jobs: { 1: [deploymentJob('infra'), deploymentJob('api')] },
      changes: { deployed: `${path}\n` },
    })
    assert.deepEqual(plan().decisions, decisions)
  })
}

test('invalid inputs and GitHub or Git errors fail explicitly', () => {
  assert.throws(() => fixture({ inputs: { infra: 'invalid', api: 'false' } }).plan(), /Invalid infra/)
  const inputs = { infra: 'auto', api: 'false' }
  assert.throws(
    () =>
      planTestDeployment({
        repository: 'Hsenrab/Journey',
        inputs,
        run: () => {
          throw new Error('GitHub denied access')
        },
      }),
    /GitHub denied access/,
  )
  assert.throws(
    () =>
      planTestDeployment({
        repository: 'Hsenrab/Journey',
        inputs,
        run: (command, args) => {
          if (command === 'git') throw new Error('fatal: bad object deployed')
          return args[1].includes('/jobs?')
            ? JSON.stringify({ jobs: [deploymentJob('infra')] })
            : JSON.stringify({ workflow_runs: [{ id: 1, head_sha: 'deployed' }] })
        },
      }),
    /fatal: bad object deployed/,
  )
})

test('compares deployed and current trees, including changes undone on a diverging branch', () => {
  const directory = mkdtempSync(join(tmpdir(), 'journey-deployment-plan-'))
  const git = (...args) => execFileSync('git', args, { cwd: directory, encoding: 'utf8' })
  try {
    git('init', '--quiet')
    git('config', 'user.name', 'Deployment test')
    git('config', 'user.email', 'test@example.invalid')
    mkdirSync(join(directory, 'api'))
    const schemaFile = join(directory, 'api', 'schema.txt')
    writeFileSync(schemaFile, 'original\n')
    git('add', '.')
    git('commit', '--quiet', '-m', 'initial')
    const original = git('rev-parse', 'HEAD').trim()
    writeFileSync(schemaFile, 'deployed\n')
    git('commit', '--quiet', '-am', 'deployed')
    const deployed = git('rev-parse', 'HEAD').trim()
    git('checkout', '--quiet', '-b', 'current', original)
    writeFileSync(join(directory, 'frontend.txt'), 'current\n')
    git('add', '.')
    git('commit', '--quiet', '-m', 'current')
    const result = planTestDeployment({
      repository: 'Hsenrab/Journey',
      inputs: { infra: 'false', api: 'auto' },
      run: (command, args) => {
        if (command === 'git') return git(...args)
        return args[1].includes('/jobs?')
          ? JSON.stringify({ jobs: [deploymentJob('api')] })
          : JSON.stringify({ workflow_runs: [{ id: 1, head_sha: deployed }] })
      },
    })
    assert.match(result.summary, /api\/schema.txt/)
    assert.deepEqual(result.decisions, { infra: 'false', api: 'true' })
  } finally {
    rmSync(directory, { recursive: true, force: true })
  }
})
