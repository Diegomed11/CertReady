/**
 * DELETE /api/enrollments/{id} — Elimina una inscripción propia.
 *
 * El servicio enrollments solo borra la inscripción si pertenece al usuario del
 * token (devuelve 404 indistinto si no existe o es de otro), de modo que el BFF
 * solo necesita reenviar el id y el token.
 */
import { NextResponse } from 'next/server'

import { ApiError } from '@/lib/api/client'
import { deleteEnrollment } from '@/lib/api/services'
import { getSession } from '@/lib/auth/session'

export async function DELETE(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const session = await getSession()
  if (!session.subject || !session.accessToken) {
    return NextResponse.json(
      { error: { code: 'no_autenticado', message: 'inicia sesión' } },
      { status: 401 },
    )
  }

  const { id } = await params

  try {
    await deleteEnrollment(session.accessToken, id)
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
