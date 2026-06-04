/**
 * Validación de variables de entorno del servidor.
 *
 * Se valida una sola vez al importar el módulo: si falta una variable o tiene
 * formato inválido, el proceso falla al arrancar (mejor que un fallo silencioso
 * en runtime). Este módulo NO debe importarse desde código de cliente: contiene
 * el secreto de la sesión y otras URLs que no salen del servidor.
 */
import { z } from 'zod'

const Schema = z.object({
  OIDC_ISSUER: z.string().url(),
  OIDC_CLIENT_ID: z.string().min(1),
  OIDC_CLIENT_SECRET: z.string().optional(),
  OIDC_REDIRECT_URI: z.string().url(),
  OIDC_POST_LOGOUT_REDIRECT_URI: z.string().url(),

  SESSION_PASSWORD: z.string().min(32, 'SESSION_PASSWORD debe medir al menos 32 caracteres'),
  SESSION_COOKIE_NAME: z.string().min(1).default('certready_session'),

  CATALOG_BASE_URL: z.string().url(),
  USERS_BASE_URL: z.string().url(),
  ENROLLMENTS_BASE_URL: z.string().url(),

  NODE_ENV: z.enum(['development', 'test', 'production']).default('development'),
})

export type Env = z.infer<typeof Schema>

/**
 * env devuelve la configuración validada. Se memoriza para no parsear en cada
 * petición; el primer fallo aborta el proceso.
 */
let cached: Env | undefined
export function env(): Env {
  if (!cached) {
    const parsed = Schema.safeParse(process.env)
    if (!parsed.success) {
      const formatted = parsed.error.flatten().fieldErrors
      throw new Error(`Variables de entorno inválidas: ${JSON.stringify(formatted)}`)
    }
    cached = parsed.data
  }
  return cached
}
