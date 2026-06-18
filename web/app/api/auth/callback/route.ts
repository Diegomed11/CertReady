/**
 * GET /api/auth/callback — Recibe el code del IdP, lo intercambia por tokens y
 * sella la identidad en la sesión.
 *
 * El IdP ya validó al usuario; aquí se valida que la respuesta corresponda al
 * PKCE/state que el navegador inició (defensa contra CSRF en OAuth y contra
 * token injection). Tras un canje exitoso, se borra el PKCE de la sesión.
 *
 * Nota de proxy: detrás de Caddy/ALB, `req.url` puede traer un host interno
 * (p. ej. 0.0.0.0:3000). Por eso la URL del callback y los redirects se
 * reconstruyen desde la configuración pública (OIDC_REDIRECT_URI / la home),
 * no desde `req.url`: así el intercambio valida el redirect_uri correcto y el
 * navegador siempre vuelve al dominio real.
 */
import { NextResponse } from 'next/server'

import { exchangeCallback } from '@/lib/auth/oidc'
import { env } from '@/lib/env'
import { getSession } from '@/lib/auth/session'

export async function GET(req: Request) {
  const cfg = env()
  const base = new URL(cfg.OIDC_POST_LOGOUT_REDIRECT_URI) // origen público de la app
  // URL del callback con los parámetros (?code=...&state=...) pero con el host público.
  const callbackURL = new URL(cfg.OIDC_REDIRECT_URI)
  callbackURL.search = new URL(req.url).search

  const session = await getSession()
  if (!session.pkce) {
    return NextResponse.redirect(new URL('/auth/error', base))
  }

  try {
    const result = await exchangeCallback(callbackURL, session.pkce)

    session.subject = result.subject
    session.email = result.email
    session.nombre = result.nombre
    session.roles = result.roles
    // A los servicios se les manda el id token (trae email/nombre y aud = client_id;
    // el access token de Cognito no). Con el emisor local el id token también sirve.
    session.accessToken = result.idToken ?? result.accessToken
    session.refreshToken = result.refreshToken
    session.expiresAt = result.expiresAt
    delete session.pkce

    await session.save()
    return NextResponse.redirect(new URL('/panel', base))
  } catch (e) {
    // Log para diagnosticar (firma, redirect_uri, nonce, secreto, etc.).
    console.error('[auth/callback] intercambio de tokens falló:', e)
    delete session.pkce
    await session.save()
    return NextResponse.redirect(new URL('/auth/error', base))
  }
}
