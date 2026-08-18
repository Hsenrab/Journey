import { describe, expect, it } from 'vitest'
import config from '../staticwebapp.config.json'

describe('staticwebapp.config.json', () => {
  it('requires the invited owner role while preserving auth endpoints', () => {
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
        allowedRoles: ['owner'],
      },
      {
        route: '/*',
        allowedRoles: ['owner'],
      },
    ])
    expect(config.responseOverrides['401']).toEqual({
      statusCode: 302,
      redirect: '/.auth/login/aad?post_login_redirect_uri=.referrer',
    })
  })

  it('uses the built-in identity providers', () => {
    expect(config).not.toHaveProperty('auth.identityProviders')
  })
})
