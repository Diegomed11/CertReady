import { ProfileForm } from '@/components/profile-form'
import { getMe } from '@/lib/api/services'
import { requireSession } from '@/lib/auth/guard'

/** Página de perfil: ver y editar la información propia (auth). */
export default async function PerfilPage() {
  const session = await requireSession()
  const cuenta = await getMe(session.accessToken)

  return (
    <ProfileForm
      init={{
        email: cuenta.email,
        nombre: cuenta.nombre ?? '',
        rol: cuenta.rol,
        creadoEn: cuenta.creado_en,
      }}
    />
  )
}
