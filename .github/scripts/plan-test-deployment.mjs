import { execFileSync } from 'node:child_process'
import { appendFileSync } from 'node:fs'

const components = {
  infra: {
    job: 'Deploy journey test environment / Resolve infrastructure',
    step: 'Deploy Bicep (provision Static Web App and API boundary)',
    paths:
      /^(infra\/|\.github\/(?:scripts\/plan-test-deployment(?:\.test)?\.mjs|workflows\/(?:deploy-test|deploy-environment)\.yml)$)/,
  },
  api: {
    job: 'Deploy journey test environment / Deploy Functions API',
    step: 'Deploy to Azure Functions',
    paths:
      /^(api\/|infra\/|staticwebapp\.config\.json$|\.github\/(?:scripts\/plan-test-deployment(?:\.test)?\.mjs|workflows\/(?:deploy-test|deploy-environment)\.yml)$)/,
  },
}

export function planTestDeployment({ repository, inputs, run }) {
  const automatic = Object.keys(components).filter((component) => inputs[component] === 'auto')
  for (const [component, input] of Object.entries(inputs)) {
    if (!['auto', 'true', 'false'].includes(input)) {
      throw new Error(`Invalid ${component} deployment input "${input}".`)
    }
  }

  const baselines = {}
  const summary = ['### Deploy test environment plan']
  const api = (path, projection) => JSON.parse(run('gh', ['api', path, '--jq', projection]))
  for (let page = 1; automatic.some((component) => !baselines[component]); page++) {
    const { workflow_runs: runs } = api(
      `/repos/${repository}/actions/workflows/deploy-test.yml/runs?status=completed&per_page=100&page=${page}`,
      '{workflow_runs: [.workflow_runs[] | {id, head_sha}]}',
    )
    for (const workflowRun of runs) {
      const jobs = []
      for (let jobPage = 1; ; jobPage++) {
        const response = api(
          `/repos/${repository}/actions/runs/${workflowRun.id}/jobs?per_page=100&page=${jobPage}`,
          '{jobs: [.jobs[] | {name, conclusion, steps: [.steps[] | {name, conclusion}]}]}',
        )
        jobs.push(...response.jobs)
        if (response.jobs.length < 100) break
      }
      for (const component of automatic) {
        const { job, step } = components[component]
        if (
          !baselines[component] &&
          jobs.some(
            (candidate) =>
              candidate.name === job &&
              candidate.conclusion === 'success' &&
              candidate.steps.some(
                (candidateStep) => candidateStep.name === step && candidateStep.conclusion === 'success',
              ),
          )
        ) {
          baselines[component] = workflowRun.head_sha
        }
      }
      if (automatic.every((component) => baselines[component])) break
    }
    if (runs.length < 100) break
  }

  const decisions = {}
  for (const [component, { paths }] of Object.entries(components)) {
    if (inputs[component] !== 'auto') {
      decisions[component] = inputs[component]
      summary.push(`\`deploy_${component}\` input explicitly set to \`${inputs[component]}\`.`)
    } else if (!baselines[component]) {
      decisions[component] = 'true'
      summary.push(`No successful ${component} deployment found; deploying ${component}.`)
    } else {
      const baseline = baselines[component]
      const changedPaths = run('git', ['diff', '--name-only', baseline, 'HEAD']).trim()
      decisions[component] = changedPaths.split('\n').some((path) => paths.test(path)) ? 'true' : 'false'
      summary.push(
        `Changed paths since successful ${component} deployment (${baseline}):`,
        '```',
        changedPaths || '<none>',
        '```',
      )
    }
  }
  summary.push(`Decision: deploy_infra=${decisions.infra}, deploy_api=${decisions.api}.`)
  return { decisions, summary: `${summary.join('\n')}\n` }
}

if (import.meta.main) {
  const { decisions, summary } = planTestDeployment({
    repository: process.env.GITHUB_REPOSITORY,
    inputs: {
      infra: process.env.INPUT_DEPLOY_INFRA || 'auto',
      api: process.env.INPUT_DEPLOY_API || 'auto',
    },
    run: (command, args) => execFileSync(command, args, { encoding: 'utf8' }),
  })
  appendFileSync(process.env.GITHUB_OUTPUT, `deploy_infra=${decisions.infra}\ndeploy_api=${decisions.api}\n`)
  appendFileSync(process.env.GITHUB_STEP_SUMMARY, summary)
}
