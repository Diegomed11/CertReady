import { Sidebar } from '@/components/sidebar'
import { requireSession } from '@/lib/auth/guard'

/**
 * Layout de las rutas autenticadas. Exige sesión válida (redirige a login si no
 * la hay) y monta el shell tipo app: sidebar lateral fija + área de contenido
 * desplazable. El pie lleva el aviso de marcas.
 */
export default async function ProtectedLayout({ children }: { children: React.ReactNode }) {
  const session = await requireSession()
  return (
    <div className="grid h-screen grid-cols-[72px_1fr] md:grid-cols-[240px_1fr]">
      <Sidebar
        nombre={session.nombre}
        email={session.email}
        esAdmin={session.roles.includes('admin')}
      />
      <div className="flex min-h-0 flex-col overflow-y-auto bg-surface">
        <main className="flex-1">
          <div className="mx-auto w-full max-w-[1100px] px-5 py-10 sm:px-10">{children}</div>
        </main>
        <footer className="border-t border-line">
          <div className="mx-auto max-w-[1100px] px-5 py-6 font-mono text-[11px] leading-relaxed text-faint sm:px-10">
            CertReady no está afiliada, avalada ni patrocinada por AWS, HashiCorp u otros
            proveedores. Las marcas y certificaciones pertenecen a sus respectivos dueños.
          </div>
        </footer>
      </div>
    </div>
  )
}
