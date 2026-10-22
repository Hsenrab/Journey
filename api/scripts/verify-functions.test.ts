import { readFileSync } from 'node:fs'
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

  it('reads primary-environment backend IDs in the deployment workflow', () => {
    const workflow = readFileSync(new URL('../../.github/workflows/deploy-environment.yml', import.meta.url), 'utf8')

    expect(workflow).toContain(
      '--url "https://management.azure.com${static_app_id}/builds/default/linkedBackends?api-version=2023-12-01"',
    )
    expect(workflow).toContain("--query 'value[].properties.backendResourceId'")
  })

  it('preserves deployment-owned package settings when infrastructure replaces app settings', () => {
    const template: {
      variables: { functionPackageSettingNames: string[] }
      resources: {
        type: string
        name: string
        properties: {
          parameters?: { appSettings: { value: string } }
          template?: {
            parameters: { appSettings: { type: string } }
            resources: { type: string; properties: string }[]
          }
        }
        dependsOn?: string[]
      }[]
    } = JSON.parse(readFileSync(new URL('../../infra/main.json', import.meta.url), 'utf8'))
    const deployment = template.resources.find(
      (resource) => resource.type === 'Microsoft.Resources/deployments' && resource.name === 'function-app-settings',
    )
    const preservedSettings = deployment?.properties.parameters?.appSettings.value

    expect(template.variables.functionPackageSettingNames).toEqual([
      'WEBSITE_RUN_FROM_PACKAGE',
      'WEBSITE_RUN_FROM_PACKAGE_BLOB_MI_RESOURCE_ID',
    ])
    expect(preservedSettings).toContain("[union(if(parameters('enableApi'), toObject(filter(items(list(")
    expect(preservedSettings).toContain(
      "list(format('{0}/config/appsettings', resourceId('Microsoft.Web/sites', variables('functionAppName'))), '2023-12-01').properties",
    )
    expect(preservedSettings).toContain(
      "contains(variables('functionPackageSettingNames'), lambdaVariables('setting').key)",
    )
    expect(preservedSettings).toContain("lambda('setting', lambdaVariables('setting').value)), createObject())")
    expect(deployment?.dependsOn).toContain("[resourceId('Microsoft.Web/sites', variables('functionAppName'))]")
    expect(deployment?.properties.template?.parameters.appSettings.type).toBe('secureObject')
    expect(deployment?.properties.template?.resources).toContainEqual(
      expect.objectContaining({
        type: 'Microsoft.Web/sites/config',
        properties: "[parameters('appSettings')]",
      }),
    )
    expect(template.resources.some((resource) => resource.type === 'Microsoft.Web/sites/config')).toBe(false)
  })
})
