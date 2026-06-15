import { Sidebar } from '@/components/sidebar'
import { requireSession } from '@/lib/auth/guard'

import '@/app/panel.css'

/**
 * Layout de las rutas autenticadas. Exige sesión válida (redirige a login si no
 * la hay) y monta el shell tipo app: menú lateral colapsable (liquid glass) +
 * área de contenido desplazable sobre el fondo glow. El pie lleva el aviso de
 * marcas como badge-pill. Estilos en `app/panel.css`.
 */
export default async function ProtectedLayout({ children }: { children: React.ReactNode }) {
  const session = await requireSession()
  return (
    <>
      <div className="cr-bg" aria-hidden="true" />
      <div className="cr-shell">
        <Sidebar
          nombre={session.nombre}
          email={session.email}
          esAdmin={session.roles.includes('admin')}
        />
        <main className="main">
          <div className="main-scroll">
            <div className="main-inner">{children}</div>
            <footer className="app-footer">
              <div className="footer-badge">
                <span className="chip">Aviso</span>
                <span className="txt">
                  CertReady no está afiliada ni patrocinada por AWS, HashiCorp u otros proveedores.
                  Marcas de sus respectivos dueños.
                </span>
              </div>
            </footer>
          </div>
        </main>
      </div>
    </>
  )
}
