param location string = resourceGroup().location
param staticWebAppName string
param repositoryUrl string
param repositoryBranch string = 'main'

resource staticWebApp 'Microsoft.Web/staticSites@2023-12-01' = {
  name: staticWebAppName
  location: location
  sku: { name: 'Free', tier: 'Free' }
  properties: {
    repositoryUrl: repositoryUrl
    branch: repositoryBranch
    buildProperties: {
      appLocation: '/'
      outputLocation: 'dist'
    }
  }
}
