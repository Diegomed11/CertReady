import type { Metadata } from 'next'
import './globals.css'

/**
 * Metadata estática del sitio. La descripción y el título se reemplazarán por
 * vistas concretas a medida que se construyan los paneles.
 */
export const metadata: Metadata = {
  title: 'CertReady',
  description: 'Plataforma de preparación de certificaciones y entrevistas técnicas.',
}

/**
 * RootLayout es el envoltorio común de todas las páginas. Mantiene el HTML
 * mínimo y delega el estilo a Tailwind (clases utilitarias).
 */
export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="es">
      <body className="min-h-screen bg-white text-slate-900 antialiased dark:bg-slate-950 dark:text-slate-100">
        {children}
      </body>
    </html>
  )
}
