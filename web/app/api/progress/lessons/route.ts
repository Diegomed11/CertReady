/**
 * POST /api/progress/lessons — Marca una lección como leída por el usuario.
 *
 * El BFF toma el token de la sesión cifrada y lo reenvía al servicio progress; el
 * usuario_id lo fija el backend a partir del token, nunca el cliente.
 */
import { NextResponse } from 'next/server'

import { ApiError } from '@/lib/api/client'
import { completeLesson } from '@/lib/api/services'
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
  if (!esLeccion(body)) {
    return NextResponse.json(
      {
        error: { code: 'cuerpo_invalido', message: 'certificacion, tema y material_id requeridos' },
      },
      { status: 400 },
    )
  }

  try {
    await completeLesson(session.accessToken, body)
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

function esLeccion(v: unknown): v is { certificacion: string; tema: string; material_id: string } {
  if (typeof v !== 'object' || v === null) return false
  const o = v as Record<string, unknown>
  return (
    typeof o.certificacion === 'string' &&
    o.certificacion.length > 0 &&
    typeof o.tema === 'string' &&
    o.tema.length > 0 &&
    typeof o.material_id === 'string' &&
    o.material_id.length > 0
  )
}
