/**
 * POST /api/auth/logout — Cierra la sesión local y, si hay logout federado
 * (OIDC_LOGOUT_URL, p. ej. Cognito), devuelve la URL del IdP para que el cliente
 * navegue ahí y se cierre también la sesión del proveedor. Sin logout federado
 * (emisor local), basta con destruir la sesión local y volver a la home.
 */
import { NextResponse } from 'next/server'

import { env } from '@/lib/env'
import { getSession } from '@/lib/auth/session'

export async function POST() {
  const cfg = env()
  const session = await getSession()
  session.destroy()

  let redirect = cfg.OIDC_POST_LOGOUT_REDIRECT_URI
  if (cfg.OIDC_LOGOUT_URL) {
    const u = new URL(cfg.OIDC_LOGOUT_URL)
    u.searchParams.set('client_id', cfg.OIDC_CLIENT_ID)
    u.searchParams.set('logout_uri', cfg.OIDC_POST_LOGOUT_REDIRECT_URI)
    redirect = u.toString()
  }
  return NextResponse.json({ status: 'ok', redirect })
}
