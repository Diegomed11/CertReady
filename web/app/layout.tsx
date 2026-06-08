import type { Metadata } from 'next'
import { Fredoka, IBM_Plex_Mono, Nunito } from 'next/font/google'

import './globals.css'

const display = Fredoka({
  subsets: ['latin'],
  variable: '--font-display',
  display: 'swap',
})

const body = Nunito({
  subsets: ['latin'],
  variable: '--font-body',
  display: 'swap',
})

const mono = IBM_Plex_Mono({
  subsets: ['latin'],
  variable: '--font-mono',
  weight: ['400', '500', '600'],
  display: 'swap',
})

export const metadata: Metadata = {
  title: 'CertReady — Aprende, practica y certifícate',
  description:
    'Estudia, simula exámenes de certificación y practica entrevistas de programación con evaluación automática.',
}

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="es" className={`${display.variable} ${body.variable} ${mono.variable}`}>
      <body className="min-h-screen bg-bg font-body text-ink antialiased">{children}</body>
    </html>
  )
}
