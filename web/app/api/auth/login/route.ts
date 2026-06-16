/**
 * /api/auth/login
 *
 * - POST: login NATIVO. Recibe {email, password}, valida contra el IdP y sella
 *   la identidad en la sesión cifrada. El navegador solo recibe la cookie.
 * - GET: inicia el flow OIDC por redirección (compat / futuro Cognito Hosted UI).
 */
import { NextResponse } from 'next/server'

import { nativeLogin, AuthError } from '@/lib/auth/native'
import { authorizationURL } from '@/lib/auth/oidc'
import { getSession } from '@/lib/auth/session'
import { clientKey, rateLimit } from '@/lib/rate-limit'

export async function POST(req: Request) {
  if (!rateLimit(`login:${clientKey(req)}`)) {
    return NextResponse.json(
      { error: 'Demasiados intentos. Espera un momento e inténtalo de nuevo.' },
      { status: 429 },
    )
  }
  let body: { email?: unknown; password?: unknown }
  try {
    body = await req.json()
  } catch {
    return NextResponse.json({ error: 'Solicitud inválida' }, { status: 400 })
  }
  const email = typeof body.email === 'string' ? body.email.trim() : ''
  const password = typeof body.password === 'string' ? body.password : ''
  if (!email || !password) {
    return NextResponse.json({ error: 'Escribe tu email y contraseña' }, { status: 400 })
  }

  try {
    const r = await nativeLogin(email, password)
    const session = await getSession()
    session.subject = r.subject
    session.email = r.email
    session.nombre = r.nombre
    session.roles = r.roles
    session.accessToken = r.accessToken
    session.refreshToken = r.refreshToken
    session.expiresAt = r.expiresAt
    delete session.pkce
    await session.save()
    return NextResponse.json({ ok: true })
  } catch (e) {
    const status = e instanceof AuthError ? e.status : 500
    const error = e instanceof AuthError ? e.message : 'No se pudo iniciar sesión'
    return NextResponse.json({ error }, { status })
  }
}

export async function GET() {
  const session = await getSession()
  const { url, state, nonce, codeVerifier } = await authorizationURL()
  session.pkce = { state, nonce, codeVerifier }
  await session.save()
  return NextResponse.redirect(url.toString())
}
