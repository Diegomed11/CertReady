/**
 * GET /api/auth/login — Inicia el flow OIDC.
 *
 * Genera PKCE + state + nonce, los guarda en la sesión cifrada y redirige al
 * Authorization Endpoint del IdP. La sesión todavía no contiene una identidad:
 * solo los datos PKCE en curso.
 */
import { NextResponse } from 'next/server'

import { authorizationURL } from '@/lib/auth/oidc'
import { getSession } from '@/lib/auth/session'

export async function GET() {
  const session = await getSession()
  const { url, state, nonce, codeVerifier } = await authorizationURL()

  session.pkce = { state, nonce, codeVerifier }
  await session.save()

  return NextResponse.redirect(url.toString())
}
