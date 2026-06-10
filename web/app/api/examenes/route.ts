/**
 * POST /api/examenes — Inicia un simulacro para el usuario autenticado.
 *
 * El BFF toma el token de la sesión cifrada y lo reenvía al servicio exams, que
 * muestrea las preguntas y crea la sesión. El `usuario_id` lo fija el backend a
 * partir del token, nunca el cliente.
 */
import { NextResponse } from 'next/server'

import { ApiError } from '@/lib/api/client'
import { createExamSession, createSimulacroPonderado } from '@/lib/api/services'
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
  if (!esNuevaSesion(body)) {
    return NextResponse.json(
      { error: { code: 'cuerpo_invalido', message: 'certificacion requerida' } },
      { status: 400 },
    )
  }

  try {
    // Examen completo (sin tema/temas) → muestreo ponderado por dominio y rotatorio.
    const esSimulacro =
      (body.modo === 'simulacro' || body.modo === undefined) &&
      !body.tema &&
      (!body.temas || body.temas.length === 0)
    const sesion = esSimulacro
      ? await createSimulacroPonderado(
          session.accessToken,
          body.certificacion,
          body.num_preguntas ?? 65,
        )
      : await createExamSession(session.accessToken, {
          certificacion: body.certificacion,
          tema: body.tema,
          temas: body.temas,
          num_preguntas: body.num_preguntas,
          modo: body.modo,
        })
    return NextResponse.json(sesion, { status: 201 })
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

/** esNuevaSesion valida la forma mínima del cuerpo recibido del cliente. */
function esNuevaSesion(v: unknown): v is {
  certificacion: string
  tema?: string
  temas?: string[]
  num_preguntas?: number
  modo?: 'simulacro' | 'practica'
} {
  if (typeof v !== 'object' || v === null) return false
  const o = v as Record<string, unknown>
  if (typeof o.certificacion !== 'string' || o.certificacion.length === 0) return false
  if (o.tema !== undefined && typeof o.tema !== 'string') return false
  if (
    o.temas !== undefined &&
    (!Array.isArray(o.temas) || !o.temas.every((t) => typeof t === 'string'))
  )
    return false
  if (o.num_preguntas !== undefined && typeof o.num_preguntas !== 'number') return false
  if (o.modo !== undefined && o.modo !== 'simulacro' && o.modo !== 'practica') return false
  return true
}
