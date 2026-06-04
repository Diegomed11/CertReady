import type { Config } from 'tailwindcss'

/**
 * Configuración de Tailwind.
 *
 * `content` lista los archivos que Tailwind escanea para tree-shake de clases.
 * `darkMode: 'media'` respeta la preferencia del sistema sin estado adicional.
 */
const config: Config = {
  content: ['./app/**/*.{ts,tsx}', './components/**/*.{ts,tsx}'],
  darkMode: 'media',
  theme: { extend: {} },
  plugins: [],
}

export default config
