/**
 * Cliente OIDC del BFF.
 *
 * Encapsula `openid-client` v6 para que las rutas de /api/auth solo trabajen
 * con tipos del dominio. La configuración del emisor se cachea entre
 * peticiones (el discovery es estable y no se recupera por request).
 */
import * as oidc from 'openid-client'

import { env } from '@/lib/env'

let cached: oidc.Configuration | undefined

/** configuration descubre el emisor OIDC y memoriza la configuración. */
export async function configuration(): Promise<oidc.Configuration> {
  if (cached) return cached
  const cfg = env()
  const issuer = new URL(cfg.OIDC_ISSUER)

  // openid-client exige HTTPS por defecto. En desarrollo el emisor es un mock en
  // http://localhost, así que se permite HTTP solo cuando el issuer es http
  // (nunca en producción, donde el emisor es Cognito sobre https).
  const insecure = issuer.protocol === 'http:'

  cached = await oidc.discovery(
    issuer,
    cfg.OIDC_CLIENT_ID,
    cfg.OIDC_CLIENT_SECRET ? { client_secret: cfg.OIDC_CLIENT_SECRET } : undefined,
    cfg.OIDC_CLIENT_SECRET ? undefined : oidc.None(),
    insecure ? { execute: [oidc.allowInsecureRequests] } : undefined,
  )

  // Habilita HTTP también para las llamadas posteriores (token endpoint) sobre
  // la configuración ya descubierta.
  if (insecure) {
    oidc.allowInsecureRequests(cached)
  }
  return cached
}

/**
 * authorizationURL construye la URL del Authorization Endpoint con PKCE.
 *
 * Returns la URL a la que redirigir el navegador, junto con los datos PKCE que
 * deben guardarse en la sesión para validarlos en el callback.
 */
export async function authorizationURL(): Promise<{
  url: URL
  state: string
  nonce: string
  codeVerifier: string
}> {
  const cfg = env()
  const config = await configuration()
  const codeVerifier = oidc.randomPKCECodeVerifier()
  const codeChallenge = await oidc.calculatePKCECodeChallenge(codeVerifier)
  const state = oidc.randomState()
  const nonce = oidc.randomNonce()

  const url = oidc.buildAuthorizationUrl(config, {
    redirect_uri: cfg.OIDC_REDIRECT_URI,
    // Solo openid + email: son los scopes garantizados en el app client de Cognito
    // (email da el correo; los roles vienen en `cognito:groups`, sin scope aparte).
    // Pedir `profile` rompería el login si ese scope no está habilitado; el "nombre"
    // es opcional y no se usa para autorizar.
    scope: 'openid email',
    code_challenge: codeChallenge,
    code_challenge_method: 'S256',
    state,
    nonce,
  })
  return { url, state, nonce, codeVerifier }
}

/** Identidad obtenida del token tras el callback. */
export interface CallbackResult {
  subject: string
  email: string | undefined
  nombre: string | undefined
  roles: string[]
  accessToken: string
  /**
   * id_token: JWT con email/nombre/aud (= client_id) y cognito:groups. Es el que
   * se reenvía como Bearer a los servicios Go (el access token de Cognito no trae
   * `aud` ni email/nombre, así que el id token es el correcto para validar y
   * aprovisionar). Con el emisor local también es válido.
   */
  idToken: string | undefined
  refreshToken: string | undefined
  expiresAt: number
}

/**
 * exchangeCallback completa el flow: valida la URL del callback (state, PKCE,
 * nonce, audiencia, firma) y devuelve la identidad junto con los tokens.
 *
 * Lanza si la respuesta es inválida (state ausente/cambiado, nonce no coincide,
 * code inválido, firma incorrecta).
 */
export async function exchangeCallback(
  currentURL: URL,
  expected: { state: string; nonce: string; codeVerifier: string },
): Promise<CallbackResult> {
  const config = await configuration()
  const tokens = await oidc.authorizationCodeGrant(config, currentURL, {
    pkceCodeVerifier: expected.codeVerifier,
    expectedState: expected.state,
    expectedNonce: expected.nonce,
  })

  const claims = tokens.claims()
  if (!claims) throw new Error('id_token sin claims')

  const subject = String(claims.sub)
  const email = typeof claims.email === 'string' ? claims.email : undefined
  const nombre = typeof claims.name === 'string' ? claims.name : undefined

  // cognito:groups (array) + claim `role` opcional → union de roles.
  const roles: string[] = []
  const groups = claims['cognito:groups']
  if (Array.isArray(groups)) {
    for (const g of groups) if (typeof g === 'string') roles.push(g)
  }
  if (typeof claims.role === 'string') roles.push(claims.role)

  const expiresIn = typeof tokens.expires_in === 'number' ? tokens.expires_in : 3600

  return {
    subject,
    email,
    nombre,
    roles,
    accessToken: tokens.access_token,
    idToken: tokens.id_token,
    refreshToken: tokens.refresh_token,
    expiresAt: Math.floor(Date.now() / 1000) + expiresIn,
  }
}
