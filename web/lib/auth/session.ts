/**
 * Sesión del BFF: una cookie HttpOnly + Secure cifrada con `iron-session`.
 *
 * El navegador NUNCA ve los tokens OIDC: solo recibe una cookie opaca cifrada
 * cuyo contenido lo descifra el servidor en cada petición. Las rutas /api leen
 * esta sesión y añaden `Authorization: Bearer <access_token>` al llamar a los
 * servicios Go.
 */
import { getIronSession, type SessionOptions } from 'iron-session'
import { cookies } from 'next/headers'

import { env } from '@/lib/env'

/** Datos persistidos en la sesión cifrada. */
export interface SessionData {
  /** sub del JWT (identificador estable del usuario). */
  subject?: string
  email?: string
  nombre?: string
  roles?: string[]
  /** Token a inyectar como Authorization: Bearer hacia los servicios Go. */
  accessToken?: string
  /** Refresh token para renovar; null si el IdP no lo emite. */
  refreshToken?: string
  /** Instante (Unix segundos) en que `accessToken` expira. */
  expiresAt?: number
  /** PKCE en curso (entre /api/auth/login y /api/auth/callback). */
  pkce?: {
    state: string
    nonce: string
    codeVerifier: string
  }
}

/** sessionOptions devuelve la configuración de iron-session. */
export function sessionOptions(): SessionOptions {
  const cfg = env()
  return {
    cookieName: cfg.SESSION_COOKIE_NAME,
    password: cfg.SESSION_PASSWORD,
    cookieOptions: {
      httpOnly: true,
      sameSite: 'lax',
      // En dev sobre http, secure debe ser false para que el navegador acepte la cookie.
      secure: cfg.NODE_ENV === 'production',
      path: '/',
    },
  }
}

/**
 * getSession lee y descifra la sesión de la cookie de la petición actual. Las
 * mutaciones requieren `await session.save()` para volver a sellar la cookie.
 *
 * Solo válido dentro de Route Handlers o Server Components (usa cookies()).
 */
export async function getSession() {
  const store = await cookies()
  return getIronSession<SessionData>(store, sessionOptions())
}

/** isAuthenticated indica si la sesión contiene una identidad válida. */
export function isAuthenticated(s: SessionData): boolean {
  return Boolean(s.subject && s.accessToken)
}
