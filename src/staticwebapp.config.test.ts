import { describe, expect, it } from 'vitest'
import config from '../staticwebapp.config.json'

describe('staticwebapp.config.json', () => {
  it('requires Entra sign-in for application routes while preserving auth and API endpoints', () => {
    expect(config.navigationFallback).toEqual({
      rewrite: '/index.html',
      exclude: ['/.auth/*', '/api/*'],
    })
    expect(config.routes).toEqual([
      {
        route: '/.auth/*',
        allowedRoles: ['anonymous', 'authenticated'],
      },
      {
        route: '/api/*',
        allowedRoles: ['authenticated'],
      },
      {
        route: '/*',
        allowedRoles: ['authenticated'],
      },
    ])
    expect(config.responseOverrides['401']).toEqual({
      statusCode: 302,
      redirect: '/.auth/login/aad?post_login_redirect_uri=.referrer',
    })
  })

  it('keeps the single-tenant Microsoft Entra identity provider configuration', () => {
    expect(config.auth.identityProviders.azureActiveDirectory.registration).toEqual({
      openIdIssuer: 'https://login.microsoftonline.com/AAD_TENANT_ID/v2.0',
      clientIdSettingName: 'AAD_CLIENT_ID',
      clientSecretSettingName: 'AAD_CLIENT_SECRET',
    })
  })
})
