@description('Azure region for the Static Web App.')
param location string = resourceGroup().location

@description('Name of the Static Web App resource.')
param staticWebAppName string

@description('Deployment environment. Controls the environment tag and the default SKU.')
@allowed([
  'dev'
  'prod'
])
param environmentName string = 'dev'

@description('Owner recorded in resource tags (for example a team name or distribution list).')
param owner string

@description('SKU used for the Static Web App.')
@allowed([
  'Free'
  'Standard'
])
param skuName string = environmentName == 'prod' ? 'Standard' : 'Free'

@description('URL of the source repository, recorded as resource metadata.')
param repositoryUrl string

@description('Branch published to this environment.')
param repositoryBranch string = 'main'

@description('Additional tags merged with the standard ownership tags.')
param additionalTags object = {}

var tags = union(
  {
    environment: environmentName
    owner: owner
    application: 'journey'
    managedBy: 'bicep'
  },
  additionalTags
)

resource staticWebApp 'Microsoft.Web/staticSites@2023-12-01' = {
  name: staticWebAppName
  location: location
  tags: tags
  sku: {
    name: skuName
    tier: skuName
  }
  properties: {
    repositoryUrl: repositoryUrl
    branch: repositoryBranch
    // GitHub Actions owns the build and upload, so Azure must not generate or
    // run a workflow of its own when the template is redeployed.
    provider: 'Custom'
    stagingEnvironmentPolicy: 'Enabled'
    allowConfigFileUpdates: true
    buildProperties: {
      appLocation: '/'
      outputLocation: 'dist'
      skipGithubActionWorkflowGeneration: true
    }
  }
}

@description('Name of the deployed Static Web App.')
output staticWebAppName string = staticWebApp.name

@description('Default hostname of the deployed Static Web App.')
output defaultHostname string = staticWebApp.properties.defaultHostname

@description('Public URL of the deployed application.')
output applicationUrl string = 'https://${staticWebApp.properties.defaultHostname}'
