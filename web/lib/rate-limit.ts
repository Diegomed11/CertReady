/**
 * Limitador de tasa en memoria (token-bucket por clave). Defensa básica anti
 * fuerza bruta para los endpoints sensibles del BFF (auth, subidas). Es **por
 * instancia** (suficiente en local / instancia única); en producción el límite
 * robusto y distribuido lo aplica el WAF.
 */
interface Bucket {
  tokens: number
  last: number // segundos (epoch)
}

const buckets = new Map<string, Bucket>()

/**
 * rateLimit descuenta un token del bucket de `key` y dice si la petición procede.
 *
 * @param key          identificador del cupo (p. ej. `login:<ip>`).
 * @param cap          ráfaga máxima (capacidad del bucket).
 * @param refillPerSec tokens repuestos por segundo (tasa sostenida).
 */
export function rateLimit(key: string, cap = 10, refillPerSec = 0.2): boolean {
  const now = Date.now() / 1000
  const b = buckets.get(key) ?? { tokens: cap, last: now }
  b.tokens = Math.min(cap, b.tokens + (now - b.last) * refillPerSec)
  b.last = now
  if (b.tokens < 1) {
    buckets.set(key, b)
    return false
  }
  b.tokens -= 1
  buckets.set(key, b)
  return true
}

/** clientKey deriva una clave por IP (primer salto de X-Forwarded-For tras el proxy). */
export function clientKey(req: Request): string {
  const xff = req.headers.get('x-forwarded-for')
  if (xff) return xff.split(',')[0].trim()
  return req.headers.get('x-real-ip') ?? 'local'
}
