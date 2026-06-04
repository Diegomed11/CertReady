/**
 * DTOs compartidos con los servicios Go (catalog / users / enrollments).
 *
 * Espejo manual de los modelos Go (sin codegen por ahora). Si el contrato
 * cambia en Go, este archivo debe actualizarse en el mismo PR.
 */

// --- catalog ---------------------------------------------------------------

export interface Certificacion {
  id: string
  slug: string
  nombre: string
  proveedor: string
  nivel: string
  descripcion: string | null
  activo: boolean
  creado_en: string
  actualizado_en: string
}

export interface Tema {
  id: string
  certificacion_id: string
  slug: string
  nombre: string
  dominio: string | null
  orden: number
  creado_en: string
  actualizado_en: string
}

export interface Pista {
  id: string
  slug: string
  puesto: string
  area: string
  nombre: string
  descripcion: string | null
  activo: boolean
  creado_en: string
  actualizado_en: string
}

/** Envoltura de listas con paginación: catalog, users.listar, enrollments. */
export interface PaginatedList<T> {
  data: T[]
  count: number
  next_offset: number | null
}

// --- users -----------------------------------------------------------------

export interface Usuario {
  id: string
  email: string
  nombre: string | null
  rol: 'estudiante' | 'admin'
  creado_en: string
  actualizado_en: string
}

export interface Perfil {
  bio: string | null
  pais: string | null
  avatar_url: string | null
  actualizado_en: string
}

export interface Cuenta extends Usuario {
  perfil: Perfil
}

// --- enrollments -----------------------------------------------------------

export type TipoObjetivo = 'certificacion' | 'pista'
export type EstadoInscripcion = 'activa' | 'pausada' | 'completada' | 'archivada'

export interface Inscripcion {
  id: string
  usuario_id: string
  tipo_objetivo: TipoObjetivo
  objetivo_id: string
  estado: EstadoInscripcion
  creado_en: string
}
