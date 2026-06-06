/**
 * POST /api/enrollments — Inscribe al usuario autenticado en un objetivo.
 *
 * El navegador llama a esta ruta; el BFF toma el token de la sesión cifrada y lo
 * reenvía al servicio enrollments. El `usuario_id` lo determina el backend a
 * partir del token, nunca el cliente.
 */
import { NextResponse } from 'next/server'

import { ApiError } from '@/lib/api/client'
import { createEnrollment } from '@/lib/api/services'
import { getSession } from '@/lib/auth/session'

export async function POST(req: Request) {
  const session = await getSession()
  if (!session.subject || !session.accessToken) {
    return NextResponse.json(
      { error: { code: 'no_autenticado', message: 'inicia sesión' } },
      { status: 401 },
    )
  }

  const body: unknown = await req.json().catch(() => null)
  if (!esNuevaInscripcion(body)) {
    return NextResponse.json(
      { error: { code: 'cuerpo_invalido', message: 'tipo_objetivo y objetivo_id requeridos' } },
      { status: 400 },
    )
  }

  try {
    const inscripcion = await createEnrollment(session.accessToken, body)
    return NextResponse.json(inscripcion, { status: 201 })
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

/** esNuevaInscripcion valida la forma del cuerpo recibido del cliente. */
function esNuevaInscripcion(
  v: unknown,
): v is { tipo_objetivo: 'certificacion' | 'pista'; objetivo_id: string } {
  if (typeof v !== 'object' || v === null) return false
  const o = v as Record<string, unknown>
  return (
    (o.tipo_objetivo === 'certificacion' || o.tipo_objetivo === 'pista') &&
    typeof o.objetivo_id === 'string' &&
    o.objetivo_id.length > 0
  )
}
