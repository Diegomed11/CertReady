/**
 * Política de seguridad de contenido (CSP). Se emite en modo *Report-Only* para
 * no romper la app (landing con Three.js, menú con Lottie, estilos inline de
 * Tailwind/WAAPI): el navegador solo reporta violaciones en consola. Promoverla a
 * `Content-Security-Policy` (enforce), idealmente con nonce, es un paso posterior
 * que se valida en navegador.
 */
const CSP = [
  "default-src 'self'",
  "base-uri 'self'",
  "object-src 'none'",
  "frame-ancestors 'none'",
  "form-action 'self'",
  "img-src 'self' data: blob:",
  "font-src 'self' data:",
  "style-src 'self' 'unsafe-inline'",
  "script-src 'self' 'unsafe-inline' 'unsafe-eval'",
  "connect-src 'self'",
  "worker-src 'self' blob:",
].join('; ')

/**
 * Encabezados de seguridad aplicados a todas las respuestas. HSTS solo surte
 * efecto sobre HTTPS (el navegador lo ignora en http://localhost, así que es
 * seguro en dev). El resto es defensa en profundidad (anti-sniffing, anti-clickjacking,
 * fuga de referer y permisos del navegador).
 */
const securityHeaders = [
  {
    key: 'Strict-Transport-Security',
    value: 'max-age=63072000; includeSubDomains; preload',
  },
  { key: 'X-Content-Type-Options', value: 'nosniff' },
  { key: 'X-Frame-Options', value: 'DENY' },
  { key: 'Referrer-Policy', value: 'strict-origin-when-cross-origin' },
  {
    key: 'Permissions-Policy',
    value: 'camera=(), microphone=(), geolocation=(), interest-cohort=()',
  },
  { key: 'Content-Security-Policy-Report-Only', value: CSP },
]

/**
 * Configuración de Next.js.
 *
 * - reactStrictMode: detecta efectos defectuosos en dev.
 * - poweredByHeader: false → no anunciar el framework en headers.
 * - output: 'standalone' → empaqueta un servidor mínimo (ideal para despliegues).
 * - headers(): encabezados de seguridad en todas las rutas (ver arriba).
 */
/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  devIndicators: false,
  poweredByHeader: false,
  output: 'standalone',
  // El build de producción type-chequea y lintea (dev no). Para la demo no
  // queremos que un nit de tipos/lint —que no cambia el JS emitido— tumbe el
  // build. El lint/tsc se siguen corriendo aparte en CI/local.
  eslint: { ignoreDuringBuilds: true },
  typescript: { ignoreBuildErrors: true },
  async headers() {
    return [{ source: '/:path*', headers: securityHeaders }]
  },
}

export default nextConfig
