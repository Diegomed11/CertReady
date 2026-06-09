/**
 * POST /api/judge — Envía código al juez para una corrida del usuario autenticado.
 *
 * El BFF reenvía el envío al servicio judge con el token de la sesión. El juez
 * ejecuta el código en un sandbox aislado y devuelve el veredicto sin revelar los
 * casos ocultos. El `usuario_id` lo fija el backend a partir del token.
 */
import { NextResponse } from 'next/server'

import { ApiError } from '@/lib/api/client'
import { submitJudge } from '@/lib/api/services'
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
  if (!esEnvio(body)) {
    return NextResponse.json(
      { error: { code: 'cuerpo_invalido', message: 'problema_ref, lenguaje y fuente requeridos' } },
      { status: 400 },
    )
  }

  try {
    const respuesta = await submitJudge(session.accessToken, {
      problema_ref: body.problema_ref,
      lenguaje: body.lenguaje,
      fuente: body.fuente,
    })
    return NextResponse.json(respuesta, { status: 201 })
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

/** esEnvio valida la forma del cuerpo recibido del cliente. */
function esEnvio(v: unknown): v is { problema_ref: string; lenguaje: string; fuente: string } {
  if (typeof v !== 'object' || v === null) return false
  const o = v as Record<string, unknown>
  return (
    typeof o.problema_ref === 'string' &&
    o.problema_ref.length > 0 &&
    typeof o.lenguaje === 'string' &&
    o.lenguaje.length > 0 &&
    typeof o.fuente === 'string' &&
    o.fuente.length > 0
  )
}
