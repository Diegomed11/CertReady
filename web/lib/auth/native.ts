/**
 * Auth nativo (first-party) del BFF.
 *
 * En vez del redirect OIDC, el BFF llama directamente a los endpoints
 * `/login` y `/register` del emisor (en prod = API de Cognito), recibe los
 * tokens y extrae la identidad del id_token. La contraseña viaja servidor↔IdP,
 * nunca al navegador (que solo recibe la cookie de sesión cifrada).
 */
import { env } from '@/lib/env'

import type { CallbackResult } from './oidc'

/** Error de autenticación con el código HTTP del IdP (401 credenciales, 409 email, …). */
export class AuthError extends Error {
  constructor(
    readonly status: number,
    message: string,
  ) {
    super(message)
    this.name = 'AuthError'
  }
}

interface TokenResponse {
  access_token: string
  id_token: string
  refresh_token?: string
  expires_in?: number
}

/** decodeClaims lee el payload del JWT (sin verificar firma: el token viene del
 * IdP por una llamada servidor↔servidor de confianza; el backend lo valida luego). */
function decodeClaims(idToken: string): Record<string, unknown> {
  const part = idToken.split('.')[1]
  if (!part) throw new Error('id_token inválido')
  const json = Buffer.from(part.replace(/-/g, '+').replace(/_/g, '/'), 'base64').toString('utf8')
  return JSON.parse(json) as Record<string, unknown>
}

function toResult(tok: TokenResponse): CallbackResult {
  const claims = decodeClaims(tok.id_token)
  const subject = typeof claims.sub === 'string' ? claims.sub : ''
  if (!subject) throw new Error('token sin sub')

  const roles: string[] = []
  const groups = claims['cognito:groups']
  if (Array.isArray(groups)) {
    for (const g of groups) if (typeof g === 'string') roles.push(g)
  }
  if (typeof claims.role === 'string') roles.push(claims.role)

  const expiresIn = typeof tok.expires_in === 'number' ? tok.expires_in : 3600
  return {
    subject,
    email: typeof claims.email === 'string' ? claims.email : undefined,
    nombre: typeof claims.name === 'string' ? claims.name : undefined,
    roles,
    accessToken: tok.access_token,
    // A los servicios Go se les reenvía el id token (trae aud=client_id, email,
    // cognito:groups); el access token de Cognito no. Igual que en el flujo OIDC.
    idToken: tok.id_token,
    refreshToken: tok.refresh_token,
    expiresAt: Math.floor(Date.now() / 1000) + expiresIn,
  }
}

async function call(path: string, body: Record<string, string>): Promise<CallbackResult> {
  const cfg = env()
  let res: Response
  try {
    res = await fetch(new URL(path, cfg.OIDC_ISSUER), {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ ...body, client_id: cfg.OIDC_CLIENT_ID }),
      cache: 'no-store',
    })
  } catch {
    throw new AuthError(503, 'No se pudo contactar al servidor de identidad')
  }
  if (!res.ok) {
    let msg = 'No se pudo autenticar'
    try {
      const j = (await res.json()) as { error?: string }
      if (j?.error) msg = j.error
    } catch {
      /* respuesta sin JSON */
    }
    throw new AuthError(res.status, msg)
  }
  return toResult((await res.json()) as TokenResponse)
}

/** nativeLogin verifica credenciales contra el IdP y devuelve la identidad. */
export function nativeLogin(email: string, password: string): Promise<CallbackResult> {
  return call('/login', { email, password })
}

/** nativeRegister crea la cuenta en el IdP y devuelve la identidad (auto-login). */
export function nativeRegister(
  email: string,
  password: string,
  name: string,
): Promise<CallbackResult> {
  return call('/register', { email, password, name })
}
