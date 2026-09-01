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

@description('''
SKU used for the Static Web App. Always Standard: the Free SKU cannot host
the Microsoft Entra ID authentication configuration that
staticwebapp.config.json always includes, so Free is not a supported option.
''')
@allowed([
  'Standard'
])
param skuName string = 'Standard'

@description('URL of the source repository, recorded as resource metadata.')
param repositoryUrl string

@description('Branch published to this environment.')
param repositoryBranch string = 'main'

@description('Additional tags merged with the standard ownership tags.')
param additionalTags object = {}

@description('''
Provisions the managed-identity API boundary (linked Functions app and Azure
Maps account) alongside the Static Web App. Linking a Functions backend
requires the Standard plan, which skuName always is, so this defaults to on.
''')
param enableApi bool = true

var tags = union(
  {
    environment: environmentName
    owner: owner
    application: 'journey'
    managedBy: 'bicep'
  },
  additionalTags
)

var functionAppName = '${staticWebAppName}-api'
var storageAccountPrefix = replace(take(toLower(staticWebAppName), 9), '-', '')
var storageAccountName = '${storageAccountPrefix}${uniqueString(resourceGroup().id, staticWebAppName)}st'
var hostingPlanName = '${staticWebAppName}-api-plan'
var mapsAccountName = '${staticWebAppName}-maps'
var appInsightsName = '${staticWebAppName}-appi'
var networkSecurityPerimeterName = '${staticWebAppName}-nsp'
var networkSecurityPerimeterProfileName = 'function-storage'

@description('Built-in role: Azure Maps Search and Render Data Reader.')
var azureMapsSearchAndRenderDataReaderRoleId = '6be48352-4f82-47c9-ad5e-0acacefdb005'

@description('Built-in role: Storage Blob Data Owner. Required for the Functions host to use an identity-based AzureWebJobsStorage connection.')
var storageBlobDataOwnerRoleId = 'b7e6dc6d-f1e8-4753-8033-0f276bb0955b'

@description('Built-in role: Storage Blob Data Contributor. Required by the deploying principal, which uploads the Functions package to this storage account itself because AzureWebJobsStorage is identity-based.')
var storageBlobDataContributorRoleId = 'ba92f5b4-2d11-453d-a403-e96b0029c9fe'

@description('Built-in role: Storage Queue Data Contributor. Required for Functions trigger/queue bindings with an identity-based connection.')
var storageQueueDataContributorRoleId = '974c5e8b-45b9-4653-ba55-5f855dd0fb88'

@description('Built-in role: Storage Table Data Contributor. Required for the Functions host lock/lease tables with an identity-based connection.')
var storageTableDataContributorRoleId = '0a9a7e1f-b9d0-4cc4-a60d-0319b160aaa3'

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

resource storageAccount 'Microsoft.Storage/storageAccounts@2023-05-01' = if (enableApi) {
  name: storageAccountName
  location: location
  tags: tags
  sku: {
    name: 'Standard_LRS'
  }
  kind: 'StorageV2'
  properties: {
    minimumTlsVersion: 'TLS1_2'
    allowBlobPublicAccess: false
    allowSharedKeyAccess: false
    publicNetworkAccess: 'SecuredByPerimeter'
    supportsHttpsTrafficOnly: true
  }
}

resource networkSecurityPerimeter 'Microsoft.Network/networkSecurityPerimeters@2024-07-01' = if (enableApi) {
  name: networkSecurityPerimeterName
  location: location
  tags: tags
}

resource functionStorageProfile 'Microsoft.Network/networkSecurityPerimeters/profiles@2024-07-01' = if (enableApi) {
  parent: networkSecurityPerimeter
  name: networkSecurityPerimeterProfileName
}

resource functionStorageSubscriptionRule 'Microsoft.Network/networkSecurityPerimeters/profiles/accessRules@2024-07-01' = if (enableApi) {
  parent: functionStorageProfile
  name: 'function-host-subscription'
  properties: {
    direction: 'Inbound'
    subscriptions: [
      {
        id: subscription().id
      }
    ]
  }
}

resource functionStorageAssociation 'Microsoft.Network/networkSecurityPerimeters/resourceAssociations@2024-07-01' = if (enableApi) {
  parent: networkSecurityPerimeter
  name: 'function-storage'
  properties: {
    accessMode: 'Enforced'
    privateLinkResource: {
      id: storageAccount.id
    }
    profile: {
      id: functionStorageProfile.id
    }
  }
  dependsOn: [functionStorageSubscriptionRule]
}

resource appInsights 'Microsoft.Insights/components@2020-02-02' = if (enableApi) {
  name: appInsightsName
  location: location
  tags: tags
  kind: 'web'
  properties: {
    Application_Type: 'web'
    Flow_Type: 'Bluefield'
    Request_Source: 'rest'
  }
}

resource hostingPlan 'Microsoft.Web/serverfarms@2023-12-01' = if (enableApi) {
  name: hostingPlanName
  location: location
  tags: tags
  sku: {
    name: 'Y1'
    tier: 'Dynamic'
  }
  properties: {
    reserved: true
  }
}

resource functionApp 'Microsoft.Web/sites@2023-12-01' = if (enableApi) {
  name: functionAppName
  location: location
  tags: tags
  kind: 'functionapp,linux'
  identity: {
    type: 'SystemAssigned'
  }
  properties: {
    serverFarmId: enableApi ? hostingPlan.id : null
    httpsOnly: true
    siteConfig: {
      linuxFxVersion: 'Node|24'
      ftpsState: 'Disabled'
      minTlsVersion: '1.2'
    }
  }
}

resource functionAppSettings 'Microsoft.Web/sites/config@2023-12-01' = if (enableApi) {
  parent: functionApp
  name: 'appsettings'
  properties: {
    FUNCTIONS_EXTENSION_VERSION: '~4'
    FUNCTIONS_WORKER_RUNTIME: 'node'
    AzureWebJobsStorage__accountName: storageAccount.name
    AzureWebJobsStorage__credential: 'managedidentity'
    AZURE_MAPS_CLIENT_ID: mapsAccount!.properties.uniqueId
    APPLICATIONINSIGHTS_CONNECTION_STRING: appInsights!.properties.ConnectionString
  }
}

// Links the Functions app as the exclusive backend for /api/* so it is
// proxied same-origin from the Static Web App. Per Azure's documented
// behavior, linking automatically restricts the Functions app to Static Web
// Apps traffic (an "Azure Static Web Apps (Linked)" identity provider) as
// long as the Functions app has no other authentication provider configured
// here, which is why this template does not add one.
resource linkedFunctionApp 'Microsoft.Web/staticSites/userProvidedFunctionApps@2023-12-01' = if (enableApi) {
  parent: staticWebApp
  name: 'journey-api'
  properties: {
    functionAppResourceId: functionApp!.id
    functionAppRegion: location
  }
}

resource mapsAccount 'Microsoft.Maps/accounts@2023-06-01' = if (enableApi) {
  name: mapsAccountName
  location: 'global'
  tags: tags
  sku: {
    name: 'G2'
  }
  kind: 'Gen2'
  properties: {
    disableLocalAuth: true
  }
}

resource mapsSearchAndRenderDataReaderAssignment 'Microsoft.Authorization/roleAssignments@2022-04-01' = if (enableApi) {
  name: guid(mapsAccount.id, functionAppName, azureMapsSearchAndRenderDataReaderRoleId)
  scope: mapsAccount
  properties: {
    roleDefinitionId: subscriptionResourceId(
      'Microsoft.Authorization/roleDefinitions',
      azureMapsSearchAndRenderDataReaderRoleId
    )
    principalId: functionApp!.identity.principalId
    principalType: 'ServicePrincipal'
  }
}

resource storageBlobDataOwnerAssignment 'Microsoft.Authorization/roleAssignments@2022-04-01' = if (enableApi) {
  name: guid(storageAccount.id, functionAppName, storageBlobDataOwnerRoleId)
  scope: storageAccount
  properties: {
    roleDefinitionId: subscriptionResourceId('Microsoft.Authorization/roleDefinitions', storageBlobDataOwnerRoleId)
    principalId: functionApp!.identity.principalId
    principalType: 'ServicePrincipal'
  }
}

// Azure/functions-action uploads the deployment package to this storage
// account from the workflow runner using the deploying principal's own
// credentials, not the Function App's managed identity, because
// AzureWebJobsStorage is identity-based. Without data-plane blob access the
// upload fails with "This request is not authorized to perform this operation".
resource deployerStorageBlobDataContributorAssignment 'Microsoft.Authorization/roleAssignments@2022-04-01' = if (enableApi) {
  name: guid(storageAccount.id, deployer().objectId, storageBlobDataContributorRoleId)
  scope: storageAccount
  properties: {
    roleDefinitionId: subscriptionResourceId(
      'Microsoft.Authorization/roleDefinitions',
      storageBlobDataContributorRoleId
    )
    principalId: deployer().objectId
    principalType: 'ServicePrincipal'
  }
}

resource storageQueueDataContributorAssignment 'Microsoft.Authorization/roleAssignments@2022-04-01' = if (enableApi) {
  name: guid(storageAccount.id, functionAppName, storageQueueDataContributorRoleId)
  scope: storageAccount
  properties: {
    roleDefinitionId: subscriptionResourceId(
      'Microsoft.Authorization/roleDefinitions',
      storageQueueDataContributorRoleId
    )
    principalId: functionApp!.identity.principalId
    principalType: 'ServicePrincipal'
  }
}

resource storageTableDataContributorAssignment 'Microsoft.Authorization/roleAssignments@2022-04-01' = if (enableApi) {
  name: guid(storageAccount.id, functionAppName, storageTableDataContributorRoleId)
  scope: storageAccount
  properties: {
    roleDefinitionId: subscriptionResourceId(
      'Microsoft.Authorization/roleDefinitions',
      storageTableDataContributorRoleId
    )
    principalId: functionApp!.identity.principalId
    principalType: 'ServicePrincipal'
  }
}

@description('Name of the deployed Static Web App.')
output staticWebAppName string = staticWebApp.name

@description('Default hostname of the deployed Static Web App.')
output defaultHostname string = staticWebApp.properties.defaultHostname

@description('Public URL of the deployed application.')
output applicationUrl string = 'https://${staticWebApp.properties.defaultHostname}'

@description('Name of the linked Function App, or empty when enableApi is false.')
output functionAppName string = enableApi ? functionApp.name : ''

@description('Default (unlinked) hostname of the Function App, or empty when enableApi is false. Direct requests to this hostname are expected to be rejected once the Static Web Apps link is established.')
output functionAppHostname string = enableApi ? functionApp!.properties.defaultHostName : ''

@description('Name of the provisioned Azure Maps Gen2 account, or empty when enableApi is false.')
output mapsAccountName string = enableApi ? mapsAccount.name : ''

@description('Name of the provisioned Application Insights component, or empty when enableApi is false.')
output appInsightsName string = enableApi ? appInsights.name : ''

@description('Name of the Function host storage account, or empty when enableApi is false.')
output storageAccountName string = enableApi ? storageAccount.name : ''

@description('Name of the storage Network Security Perimeter, or empty when enableApi is false.')
output networkSecurityPerimeterName string = enableApi ? networkSecurityPerimeter.name : ''

@description('Name of the storage Network Security Perimeter profile, or empty when enableApi is false.')
output networkSecurityPerimeterProfileName string = enableApi ? functionStorageProfile.name : ''
