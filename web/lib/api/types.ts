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
  /** Conteo de temas de la ruta; solo lo trae el listado (ausente en el detalle). */
  num_temas?: number
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

// --- content ---------------------------------------------------------------

export type FormatoMaterial = 'markdown' | 'html' | 'texto'

export interface Material {
  id: string
  certificacion: string
  tema: string
  titulo: string
  formato: FormatoMaterial
  contenido: string
  recursos: string[]
  creado_en: string
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

// --- exams -----------------------------------------------------------------

export type ModoExamen = 'simulacro' | 'practica'
export type EstadoSesion = 'en_curso' | 'finalizada'

export interface OpcionPregunta {
  id: string
  texto: string
}

/** Pregunta tal como la ve el estudiante: sin la respuesta correcta. */
export interface PreguntaPublica {
  ref: string
  tema: string
  dificultad: string
  tipo: string
  enunciado: string
  opciones: OpcionPregunta[]
}

/** Sesión de examen (cabecera). */
export interface SesionExamen {
  id: string
  usuario_id: string
  certificacion: string
  modo: ModoExamen
  estado: EstadoSesion
  puntaje: number | null
  iniciado_en: string
  finalizado_en: string | null
}

/** Respuesta al iniciar un simulacro: la sesión más las preguntas públicas. */
export interface SesionConPreguntas extends SesionExamen {
  preguntas: PreguntaPublica[]
}

/** Detalle por pregunta tras calificar (con la respuesta correcta para repaso). */
export interface ResultadoPregunta {
  ref: string
  correcto: boolean
  seleccion: string[]
  respuesta_correcta: string[]
  explicacion: string
}

/** Resultado completo de calificar una sesión. */
export interface ResultadoExamen {
  sesion_id: string
  puntaje: number
  correctas: number
  total: number
  resultados: ResultadoPregunta[]
}

/** Consulta de una sesión: preguntas si está en curso, resultado si finalizada. */
export interface RevisionSesion extends SesionExamen {
  preguntas?: PreguntaPublica[]
  resultado?: ResultadoExamen
}

// --- problems / qa ---------------------------------------------------------

export type Dificultad = 'facil' | 'media' | 'dificil'

export interface CasoProblema {
  entrada: string
  salida_esperada: string
  oculto: boolean
  peso: number
}

/** Problema de código (vista pública: sin casos ocultos). */
export interface Problema {
  id: string
  titulo: string
  enunciado: string
  dificultad: Dificultad
  area: string
  etiquetas: string[]
  lenguajes_permitidos: string[]
  plantillas: Record<string, string>
  limite_tiempo_ms: number
  limite_memoria_mb: number
  casos: CasoProblema[]
  creado_en: string
}

export type TipoQA = 'abierta' | 'conceptual'

/** Pregunta de Q&A de entrevista (autoestudio: trae respuesta modelo). */
export interface PreguntaQA {
  id: string
  puesto: string
  area: string
  categoria: string
  enunciado: string
  tipo: TipoQA
  respuesta_modelo: string
  puntos_clave: string[]
  etiquetas: string[]
  creado_en: string
}

// --- judge -----------------------------------------------------------------

export type VeredictoJuez =
  | 'accepted'
  | 'wrong_answer'
  | 'time_limit_exceeded'
  | 'memory_limit_exceeded'
  | 'runtime_error'
  | 'compile_error'

export type EstadoCaso = 'passed' | 'wrong' | 'tle' | 'mle' | 're' | 'ce'

/** Resultado de un caso. Para casos ocultos solo viene el estado. */
export interface ResultadoCaso {
  indice: number
  oculto: boolean
  estado: EstadoCaso
  entrada?: string
  salida_esperada?: string
  salida_obtenida?: string
}

/** Resultado completo de una calificación del juez. */
export interface ResultadoJuez {
  veredicto: VeredictoJuez
  casos_total: number
  casos_pasados: number
  duracion_ms: number
  casos: ResultadoCaso[]
}

/** Registro persistido de una ejecucion (historial). */
export interface Ejecucion {
  id: string
  usuario_id: string
  problema_ref: string
  lenguaje: string
  veredicto: VeredictoJuez
  casos_pasados: number
  casos_total: number
  duracion_ms: number
  creado_en: string
}

/** Respuesta de POST /v1/judge/runs. */
export interface RespuestaEjecucion {
  ejecucion: Ejecucion
  resultado: ResultadoJuez
}

// --- dss / readiness -------------------------------------------------------

export interface CeldaDominio {
  tema: string
  dificultad: string
  dominio_pct: number
  intentos: number
}

export interface SiguienteAccion {
  tema: string
  dificultad: string
  motivo: string
}

/** Preparación estimada (IRT Rasch) de un usuario para una certificación. */
export interface Readiness {
  usuario_id: string
  certificacion: string
  readiness_pct: number
  probabilidad_aprobar: number
  habilidad_theta: number
  por_celda: CeldaDominio[]
  siguiente_accion: SiguienteAccion | null
}

// --- dss / preparación por puesto ------------------------------------------

/** Un puesto/especialidad del catálogo para el que se puede estimar preparación. */
export interface PuestoResumen {
  slug: string
  nombre: string
  descripcion: string
  /** Áreas conceptuales de Q&A de la especialidad (para filtrar el banco). */
  qa_areas: string[]
  /** Áreas de código de la especialidad (para filtrar los problemas). */
  code_areas: string[]
}

/** Una de las señales que componen la preparación por puesto. */
export interface SenalPreparacion {
  clave: 'examenes' | 'codigo' | 'qa'
  etiqueta: string
  /** Score de la señal en [0,100], o null si no tiene datos. */
  score_pct: number | null
  peso: number
  /** Nº de ítems con datos (certs / problemas / preguntas). */
  cobertura: number
  detalle: string
}

/** Preparación combinada (exámenes + código + Q&A) de un usuario para un puesto. */
export interface JobReadiness {
  usuario_id: string
  puesto: string
  nombre: string
  /** Readiness combinada en [0,100], o null si ninguna señal tiene datos. */
  readiness_pct: number | null
  nivel: string
  senales: SenalPreparacion[]
  /** Señal (con datos) de menor score: dónde conviene enfocarse. */
  enfoque: string | null
}

// --- progress --------------------------------------------------------------

export interface LeccionCompletada {
  tema: string
  material_id: string
  creado_en: string
}

export interface TemaProgreso {
  tema: string
  quiz_puntaje: number
  quiz_aprobado: boolean
}

/** Progreso de estudio del usuario en una certificación (lecciones + quiz por tema). */
export interface Progreso {
  lecciones: LeccionCompletada[]
  temas: TemaProgreso[]
}

// --- dss: recomendador por CV + analítica ----------------------------------

/** Un paso (certificación recomendada) dentro de un camino. */
export interface PasoCamino {
  slug: string
  nombre: string
  proveedor: string
  area: string
  nivel: string
  match_pct: number
  por_que: string
  tiene_contenido: boolean
  slug_estudio: string | null
}

/** Un camino de certificación sugerido (secuencia de pasos). */
export interface Camino {
  nombre: string
  motivo: string
  pasos: PasoCamino[]
}

/** Perfil detectado a partir del CV. */
export interface PerfilCV {
  skills: string[]
  areas: string[]
  nivel: string
  resumen: string
}

/** Respuesta del recomendador: perfil + caminos + recomendaciones planas. */
export interface Recomendaciones {
  perfil: PerfilCV
  caminos: Camino[]
  recomendaciones: PasoCamino[]
}

/** Acierto del usuario en un tema (para los dashboards). */
export interface TemaAcierto {
  tema: string
  aciertos: number
  total: number
  pct: number
}

/** Punto de la tendencia diaria de acierto. */
export interface PuntoTendencia {
  fecha: string
  pct: number
  intentos: number
}

/** Analítica de desempeño del usuario en una certificación. */
export interface Analitica {
  certificacion: string
  total: number
  aciertos: number
  pct: number
  por_tema: TemaAcierto[]
  tendencia: PuntoTendencia[]
}
