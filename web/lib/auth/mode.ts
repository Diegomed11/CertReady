/**
 * Modo de autenticación. En desarrollo el emisor es el mock local (formularios
 * nativos); en producción es Amazon Cognito (flujo de redirección gestionado).
 * La distinción se deriva del issuer configurado, no de una bandera aparte.
 */
import { env } from '@/lib/env'

/** usaCognito indica si el emisor OIDC es Amazon Cognito (vs el mock local). */
export function usaCognito(): boolean {
  return env().OIDC_ISSUER.includes('amazoncognito.com')
}
