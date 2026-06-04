/**
 * Configuración de Next.js.
 *
 * - reactStrictMode: detecta efectos defectuosos en dev.
 * - poweredByHeader: false → no anunciar el framework en headers.
 * - output: 'standalone' → empaqueta un servidor mínimo (ideal para despliegues).
 */
/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  poweredByHeader: false,
  output: 'standalone',
}

export default nextConfig
