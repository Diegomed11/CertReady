/**
 * POST /api/auth/register — registro NATIVO.
 *
 * Recibe {email, password, name}, crea la cuenta en el IdP y sella la identidad
 * en la sesión (auto-login). Devuelve JSON; el cliente redirige al panel.
 */
import { NextResponse } from 'next/server'

import { nativeRegister, AuthError } from '@/lib/auth/native'
import { getSession } from '@/lib/auth/session'
import { clientKey, rateLimit } from '@/lib/rate-limit'

export async function POST(req: Request) {
  if (!rateLimit(`register:${clientKey(req)}`)) {
    return NextResponse.json(
      { error: 'Demasiados intentos. Espera un momento e inténtalo de nuevo.' },
      { status: 429 },
    )
  }
  let body: { email?: unknown; password?: unknown; name?: unknown }
  try {
    body = await req.json()
  } catch {
    return NextResponse.json({ error: 'Solicitud inválida' }, { status: 400 })
  }
  const email = typeof body.email === 'string' ? body.email.trim() : ''
  const password = typeof body.password === 'string' ? body.password : ''
  const name = typeof body.name === 'string' ? body.name.trim() : ''
  if (!email || !password) {
    return NextResponse.json({ error: 'Escribe tu email y contraseña' }, { status: 400 })
  }
  if (password.length < 8) {
    return NextResponse.json(
      { error: 'La contraseña debe tener al menos 8 caracteres' },
      { status: 400 },
    )
  }

  try {
    const r = await nativeRegister(email, password, name)
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
    const error = e instanceof AuthError ? e.message : 'No se pudo crear la cuenta'
    return NextResponse.json({ error }, { status })
  }
}
