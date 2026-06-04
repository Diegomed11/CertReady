/**
 * Test del validador de entorno. Reimporta el módulo en cada caso (resetModules)
 * para que el cache interno no contamine entre tests.
 */
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

const envOK: Record<string, string> = {
  OIDC_ISSUER: 'http://localhost:9099',
  OIDC_CLIENT_ID: 'web-dev',
  OIDC_REDIRECT_URI: 'http://localhost:3000/api/auth/callback',
  OIDC_POST_LOGOUT_REDIRECT_URI: 'http://localhost:3000/',
  SESSION_PASSWORD: '0123456789abcdef0123456789abcdef',
  CATALOG_BASE_URL: 'http://localhost:18090',
  USERS_BASE_URL: 'http://localhost:18091',
  ENROLLMENTS_BASE_URL: 'http://localhost:18092',
  NODE_ENV: 'test',
}

beforeEach(() => {
  vi.resetModules()
  for (const k of Object.keys(envOK)) delete process.env[k]
})

afterEach(() => {
  for (const k of Object.keys(envOK)) delete process.env[k]
})

describe('env()', () => {
  it('parsea un entorno válido', async () => {
    Object.assign(process.env, envOK)
    const { env } = await import('./env')
    const cfg = env()
    expect(cfg.OIDC_CLIENT_ID).toBe('web-dev')
    expect(cfg.SESSION_COOKIE_NAME).toBe('certready_session') // default
  })

  it('rechaza una URL inválida con un error legible', async () => {
    Object.assign(process.env, envOK, { OIDC_ISSUER: 'no-es-url' })
    const { env } = await import('./env')
    expect(() => env()).toThrow(/Variables de entorno inválidas/)
  })

  it('rechaza un SESSION_PASSWORD demasiado corto', async () => {
    Object.assign(process.env, envOK, { SESSION_PASSWORD: 'corto' })
    const { env } = await import('./env')
    expect(() => env()).toThrow(/SESSION_PASSWORD/)
  })
})
