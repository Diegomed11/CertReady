/**
 * POST /api/progress/quizzes — Registra el resultado del quiz de un tema.
 *
 * El BFF reenvía el resultado al servicio progress con el token de la sesión y
 * devuelve el estado resultante del tema (mejor puntaje y si quedó aprobado).
 */
import { NextResponse } from 'next/server'

import { ApiError } from '@/lib/api/client'
import { completeQuiz } from '@/lib/api/services'
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
  if (!esQuiz(body)) {
    return NextResponse.json(
      { error: { code: 'cuerpo_invalido', message: 'certificacion, tema y puntaje requeridos' } },
      { status: 400 },
    )
  }

  try {
    const tema = await completeQuiz(session.accessToken, body)
    return NextResponse.json(tema, { status: 200 })
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

function esQuiz(v: unknown): v is { certificacion: string; tema: string; puntaje: number } {
  if (typeof v !== 'object' || v === null) return false
  const o = v as Record<string, unknown>
  return (
    typeof o.certificacion === 'string' &&
    o.certificacion.length > 0 &&
    typeof o.tema === 'string' &&
    o.tema.length > 0 &&
    typeof o.puntaje === 'number'
  )
}
