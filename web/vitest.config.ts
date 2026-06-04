import { defineConfig } from 'vitest/config'
import { resolve } from 'node:path'

/**
 * Configuración de Vitest para el BFF.
 *
 * Entorno node (no jsdom): los tests cubren server-side (lib/, app/api/), no UI.
 * El alias `@` replica el `paths` de tsconfig.
 */
export default defineConfig({
  test: {
    environment: 'node',
    include: ['lib/**/*.test.ts', 'app/api/**/*.test.ts'],
  },
  resolve: {
    alias: { '@': resolve(__dirname, '.') },
  },
})
