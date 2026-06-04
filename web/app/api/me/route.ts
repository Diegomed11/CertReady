/**
 * GET /api/me — Proxy ejemplar al servicio users.
 *
 * Patrón canónico de toda ruta /api del BFF:
 *   1. lee la sesión cifrada
 *   2. si no hay autenticación, responde 401
 *   3. añade Authorization: Bearer al llamar al servicio Go
 *   4. propaga el cuerpo y el código del servicio
 *
 * Las próximas rutas de catalog / enrollments seguirán este mismo esquema.
 */
import { NextResponse } from 'next/server'

import { env } from '@/lib/env'
import { getSession, isAuthenticated } from '@/lib/auth/session'
import { ApiError, fetchJSON } from '@/lib/api/client'
import type { Cuenta } from '@/lib/api/types'

export async function GET() {
  const session = await getSession()
  if (!isAuthenticated(session)) {
    return NextResponse.json(
      { error: { code: 'no_autenticado', message: 'inicia sesión' } },
      { status: 401 },
    )
  }

  try {
    const cuenta = await fetchJSON<Cuenta>({
      baseURL: env().USERS_BASE_URL,
      path: '/v1/me',
      accessToken: session.accessToken,
    })
    return NextResponse.json(cuenta)
  } catch (err) {
    if (err instanceof ApiError) {
      return NextResponse.json(err.body ?? null, { status: err.status })
    }
    return NextResponse.json(
      { error: { code: 'error_interno', message: 'fallo del BFF' } },
      { status: 502 },
    )
  }
}
