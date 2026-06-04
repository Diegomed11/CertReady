/**
 * POST /api/auth/logout — Destruye la sesión local.
 *
 * No invoca el endpoint de logout del IdP (Hosted UI) por defecto: cerrar la
 * sesión local es lo que el usuario espera. El logout federado se puede añadir
 * en una iteración posterior si hace falta.
 */
import { NextResponse } from 'next/server'

import { getSession } from '@/lib/auth/session'

export async function POST() {
  const session = await getSession()
  session.destroy()
  return NextResponse.json({ status: 'ok' })
}
