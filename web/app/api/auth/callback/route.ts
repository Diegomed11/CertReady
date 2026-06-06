/**
 * GET /api/auth/callback — Recibe el code del IdP, lo intercambia por tokens y
 * sella la identidad en la sesión.
 *
 * El IdP ya validó al usuario; aquí se valida que la respuesta corresponda al
 * PKCE/state que el navegador inició (defensa contra CSRF en OAuth y contra
 * token injection). Tras un canje exitoso, se borra el PKCE de la sesión.
 */
import { NextResponse } from 'next/server'

import { exchangeCallback } from '@/lib/auth/oidc'
import { getSession } from '@/lib/auth/session'

export async function GET(req: Request) {
  const session = await getSession()
  if (!session.pkce) {
    return NextResponse.redirect(new URL('/auth/error', req.url))
  }

  try {
    const result = await exchangeCallback(new URL(req.url), session.pkce)

    session.subject = result.subject
    session.email = result.email
    session.nombre = result.nombre
    session.roles = result.roles
    session.accessToken = result.accessToken
    session.refreshToken = result.refreshToken
    session.expiresAt = result.expiresAt
    delete session.pkce

    await session.save()
    return NextResponse.redirect(new URL('/panel', req.url))
  } catch {
    // Limpiamos el PKCE pendiente para evitar reusos de un flow inválido y
    // enviamos al usuario a la página de error de autenticación.
    delete session.pkce
    await session.save()
    return NextResponse.redirect(new URL('/auth/error', req.url))
  }
}
