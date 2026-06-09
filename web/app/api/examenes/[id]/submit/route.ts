/**
 * POST /api/examenes/[id]/submit — Entrega y califica una sesión propia.
 *
 * El BFF reenvía las respuestas al servicio exams con el token de la sesión. El
 * backend solo considera respuestas de preguntas que pertenecen a la sesión y
 * verifica que la sesión sea del usuario autenticado (autorización por objeto).
 */
import { NextResponse } from 'next/server'

import { ApiError } from '@/lib/api/client'
import { submitExam } from '@/lib/api/services'
import { getSession } from '@/lib/auth/session'

export async function POST(req: Request, ctx: { params: Promise<{ id: string }> }) {
  const session = await getSession()
  if (!session.subject || !session.accessToken) {
    return NextResponse.json(
      { error: { code: 'no_autenticado', message: 'inicia sesión' } },
      { status: 401 },
    )
  }

  const { id } = await ctx.params
  const body: unknown = await req.json().catch(() => null)
  if (!esEnvio(body)) {
    return NextResponse.json(
      { error: { code: 'cuerpo_invalido', message: 'respuestas inválidas' } },
      { status: 400 },
    )
  }

  try {
    const resultado = await submitExam(session.accessToken, id, body.respuestas)
    return NextResponse.json(resultado, { status: 200 })
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

/** esEnvio valida la forma del cuerpo: { respuestas: [{ ref, seleccion[] }] }. */
function esEnvio(v: unknown): v is { respuestas: { ref: string; seleccion: string[] }[] } {
  if (typeof v !== 'object' || v === null) return false
  const o = v as Record<string, unknown>
  if (!Array.isArray(o.respuestas)) return false
  return o.respuestas.every((r) => {
    if (typeof r !== 'object' || r === null) return false
    const rr = r as Record<string, unknown>
    return (
      typeof rr.ref === 'string' &&
      Array.isArray(rr.seleccion) &&
      rr.seleccion.every((s) => typeof s === 'string')
    )
  })
}
