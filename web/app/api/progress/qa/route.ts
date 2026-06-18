/**
 * POST /api/progress/qa — Registra la autoevaluación de una pregunta de Q&A.
 *
 * El BFF reenvía la autoevaluación al servicio progress con el token de la sesión.
 * Alimenta la señal de Q&A del DSS de preparación por puesto. Responde 204.
 */
import { NextResponse } from 'next/server'

import { ApiError } from '@/lib/api/client'
import { submitQARevision } from '@/lib/api/services'
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
  if (!esRevision(body)) {
    return NextResponse.json(
      { error: { code: 'cuerpo_invalido', message: 'qa_ref y nivel (1-3) requeridos' } },
      { status: 400 },
    )
  }

  try {
    await submitQARevision(session.accessToken, body)
    return new NextResponse(null, { status: 204 })
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

function esRevision(v: unknown): v is { qa_ref: string; nivel: number; area?: string } {
  if (typeof v !== 'object' || v === null) return false
  const o = v as Record<string, unknown>
  return (
    typeof o.qa_ref === 'string' &&
    o.qa_ref.length > 0 &&
    typeof o.nivel === 'number' &&
    Number.isInteger(o.nivel) &&
    o.nivel >= 1 &&
    o.nivel <= 3 &&
    (o.area === undefined || typeof o.area === 'string')
  )
}
