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
  // Endpoint de logout del IdP (Cognito: https://<dominio>/logout). Si está, el
  // logout es federado (cierra también la sesión de Cognito). Opcional (el mock no lo usa).
  OIDC_LOGOUT_URL: z.string().url().optional(),

  SESSION_PASSWORD: z.string().min(32, 'SESSION_PASSWORD debe medir al menos 32 caracteres'),
  SESSION_COOKIE_NAME: z.string().min(1).default('certready_session'),

  CATALOG_BASE_URL: z.string().url(),
  USERS_BASE_URL: z.string().url(),
  ENROLLMENTS_BASE_URL: z.string().url(),

  // Servicios añadidos por incrementos del front; opcionales para no romper el
  // resto de la app si su backend aún no está configurado. Las funciones que los
  // usan fallan con un error claro si faltan.
  CONTENT_BASE_URL: z.string().url().optional(),
  EXAMS_BASE_URL: z.string().url().optional(),
  PROBLEMS_BASE_URL: z.string().url().optional(),
  JUDGE_BASE_URL: z.string().url().optional(),
  DSS_BASE_URL: z.string().url().optional(),
  PROGRESS_BASE_URL: z.string().url().optional(),

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
