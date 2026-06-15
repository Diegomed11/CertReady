import Image from 'next/image'
import Link from 'next/link'

import { EnrollMenu } from '@/components/enroll-menu'
import { GreetingStagger } from '@/components/greeting-stagger'
import { buttonStyles } from '@/components/ui/button'
import {
  getMe,
  getMyProgress,
  listCertifications,
  listMyEnrollments,
  listMyExams,
  listTopics,
} from '@/lib/api/services'
import type { EstadoInscripcion } from '@/lib/api/types'
import { requireSession } from '@/lib/auth/guard'

/** Meta de lecciones por semana (gamificación moderada). */
const META_SEMANAL = 5
/** Corte de aprobación del examen real (720/1000 ≈ 72%). */
const APROBADO_PCT = 72

/** Clase del badge (CSS .badge.*) según el estado de la inscripción. */
function estadoBadge(estado: EstadoInscripcion): string {
  if (estado === 'activa') return 'good'
  if (estado === 'completada') return 'brand'
  if (estado === 'pausada') return 'warn'
  return 'neutral'
}

function ymd(d: Date): string {
  return `${d.getFullYear()}-${d.getMonth()}-${d.getDate()}`
}

/** inicioSemana devuelve el lunes 00:00 local de la semana en curso. */
function inicioSemana(): Date {
  const d = new Date()
  d.setHours(0, 0, 0, 0)
  d.setDate(d.getDate() - ((d.getDay() + 6) % 7))
  return d
}

/** calcRacha cuenta los días consecutivos con actividad hasta hoy (o ayer). */
function calcRacha(fechas: string[]): number {
  const dias = new Set(fechas.map((iso) => ymd(new Date(iso))))
  if (dias.size === 0) return 0
  const cur = new Date()
  cur.setHours(0, 0, 0, 0)
  if (!dias.has(ymd(cur))) cur.setDate(cur.getDate() - 1)
  let n = 0
  while (dias.has(ymd(cur))) {
    n++
    cur.setDate(cur.getDate() - 1)
  }
  return n
}

/** calcSemana resume la actividad de esta semana: días con lección y total. */
function calcSemana(fechas: string[]): { dias: Set<number>; total: number } {
  const desde = inicioSemana()
  const dias = new Set<number>()
  let total = 0
  for (const iso of fechas) {
    const dt = new Date(iso)
    if (dt >= desde) {
      total++
      dias.add((dt.getDay() + 6) % 7)
    }
  }
  return { dias, total }
}

/**
 * Panel del estudiante: saludo, inscripciones con su avance y una columna de
 * gamificación moderada (racha, meta semanal y último simulacro). La racha y la
 * meta se calculan de las lecciones reales (servicio progress). El diseño visual
 * (shell colapsable, fondo glow, animaciones, border-beam) vive en `app/panel.css`.
 */
export default async function PanelPage() {
  const { accessToken, nombre: nombreSesion } = await requireSession()
  const [cuenta, inscripciones, certs, historial] = await Promise.all([
    getMe(accessToken),
    listMyEnrollments(accessToken),
    listCertifications({ accessToken, limit: 100 }),
    listMyExams(accessToken, { limit: 100 }),
  ])

  const certsById = new Map(certs.data.map((c) => [c.id, c]))
  const nombrePorSlug = new Map(certs.data.map((c) => [c.slug, c.nombre]))
  const nombre = cuenta.nombre ?? nombreSesion ?? ''

  const certEnrolls = inscripciones.data
    .filter((i) => i.tipo_objetivo === 'certificacion')
    .flatMap((i) => {
      const cert = certsById.get(i.objetivo_id)
      return cert ? [{ ins: i, cert }] : []
    })

  const detalles = await Promise.all(
    certEnrolls.map(async ({ ins, cert }) => {
      const [prog, temas] = await Promise.all([
        getMyProgress(accessToken, cert.slug),
        listTopics(cert.id, accessToken),
      ])
      const aprob = new Set(prog.temas.filter((t) => t.quiz_aprobado).map((t) => t.tema))
      const total = temas.length
      const hechos = temas.filter((t) => aprob.has(t.slug)).length
      const pct = total > 0 ? Math.round((hechos / total) * 100) : 0
      const siguiente = temas.find((t) => !aprob.has(t.slug)) ?? null
      return { ins, cert, lecciones: prog.lecciones, total, hechos, pct, siguiente }
    }),
  )

  const fechasLecciones = detalles.flatMap((d) => d.lecciones.map((l) => l.creado_en))
  const racha = calcRacha(fechasLecciones)
  const semana = calcSemana(fechasLecciones)
  const hoyIdx = (new Date().getDay() + 6) % 7

  const ultimoSim =
    historial.data.find(
      (s) => s.modo === 'simulacro' && s.estado === 'finalizada' && s.puntaje !== null,
    ) ?? null

  const lead =
    certEnrolls.length === 0
      ? 'Tu cuenta está lista. Elige una certificación para armar tu ruta de estudio.'
      : racha > 0
        ? `Llevas ${racha} día${racha === 1 ? '' : 's'} de racha. ¡Sigue así!`
        : 'Retoma tu ruta de estudio y enciende tu racha hoy.'

  const dias = ['L', 'M', 'X', 'J', 'V', 'S', 'D']

  return (
    <div className="panel-grid">
      {/* Columna izquierda */}
      <div className="col-left">
        <header className="page-head">
          <span className="section-label">Panel</span>
          <h1>
            <GreetingStagger text={`Hola${nombre ? `, ${nombre}` : ''}`} />
            <Image src="/icons/wave.png" alt="" width={36} height={36} className="wave-emoji" />
          </h1>
          <p className="lead">{lead}</p>
        </header>

        <section>
          <div className="row-head">
            <h2>Mis inscripciones</h2>
            <Link href="/certifications" className="link-quiet">
              Explorar catálogo →
            </Link>
          </div>

          {detalles.length === 0 ? (
            <div className="empty">
              <Image src="/icons/rocket.png" alt="" width={56} height={56} />
              <p className="t">Aún no tienes inscripciones</p>
              <p className="s">Elige una certificación del catálogo y arma tu ruta de estudio.</p>
              <Link href="/certifications" className={`mt-2.5 ${buttonStyles('primary', 'md')}`}>
                Explorar catálogo
              </Link>
            </div>
          ) : (
            <ul className="enroll-list">
              {detalles.map(({ ins, cert, total, hechos, pct, siguiente }) => (
                <li key={ins.id}>
                  <div className="card beam enroll-card">
                    <div className="info">
                      <div className="top-line">
                        <span className="badge brand">{cert.proveedor}</span>
                        <Link href={`/estudiar/${cert.slug}`} className="name">
                          {cert.nombre}
                        </Link>
                        <span className={`badge ${estadoBadge(ins.estado)}`}>{ins.estado}</span>
                      </div>
                      <p className="meta">
                        {hechos} de {total} temas
                        {siguiente ? ` · Siguiente: ${siguiente.nombre}` : ' · ¡Completado!'}
                      </p>
                      <div className="progress-track">
                        <div className="progress-fill" style={{ width: `${Math.max(3, pct)}%` }} />
                      </div>
                    </div>
                    <Link href={`/estudiar/${cert.slug}`} className="btn-colorful">
                      <span className="bc-glow" />
                      <span className="bc-content">
                        Continuar
                        <svg
                          className="bc-arrow"
                          viewBox="0 0 24 24"
                          fill="none"
                          stroke="currentColor"
                          strokeWidth="2.2"
                          strokeLinecap="round"
                          strokeLinejoin="round"
                          aria-hidden="true"
                        >
                          <line x1="7" y1="17" x2="17" y2="7" />
                          <polyline points="7 7 17 7 17 17" />
                        </svg>
                      </span>
                    </Link>
                    <EnrollMenu id={ins.id} nombre={cert.nombre} />
                  </div>
                </li>
              ))}
            </ul>
          )}
        </section>
      </div>

      {/* Columna derecha — gamificación moderada */}
      <div className="col-right">
        <div className="card beam stat-card">
          <div className="head">
            <Image src="/icons/fire.png" alt="" width={30} height={30} />
            <span className="k">Racha</span>
          </div>
          <p className="big">
            {racha} <span>día{racha === 1 ? '' : 's'}</span>
          </p>
          <p className="note">
            {racha > 0
              ? 'Una lección al día la mantiene viva.'
              : 'Completa una lección hoy para encenderla.'}
          </p>
          <div className="week">
            {dias.map((l, i) => (
              <div
                key={l}
                className={
                  'd' + (semana.dias.has(i) ? ' done' : '') + (i === hoyIdx ? ' today' : '')
                }
              >
                <span className="dot" />
                {l}
              </div>
            ))}
          </div>
        </div>

        <div className="card beam stat-card">
          <div className="head">
            <Image src="/icons/target.png" alt="" width={30} height={30} />
            <span className="k">Meta semanal</span>
          </div>
          <p className="big">
            {semana.total} <span>de {META_SEMANAL} lecciones</span>
          </p>
          <div className="goal-bar">
            <div
              className="goal-fill"
              style={{ width: `${Math.min(100, (semana.total / META_SEMANAL) * 100)}%` }}
            />
          </div>
          <p className="note">
            {semana.total >= META_SEMANAL
              ? '¡Meta cumplida esta semana!'
              : `Te faltan ${META_SEMANAL - semana.total} para cumplirla.`}
          </p>
        </div>

        {ultimoSim && ultimoSim.puntaje !== null && (
          <div className="card beam stat-card">
            <div className="head">
              <Image src="/icons/trophy.png" alt="" width={30} height={30} />
              <span className="k">Último simulacro</span>
            </div>
            <p className="big">
              {Math.round(ultimoSim.puntaje)}%{' '}
              <span>· {nombrePorSlug.get(ultimoSim.certificacion) ?? ultimoSim.certificacion}</span>
            </p>
            <p className="note">
              Corte de aprobación: {APROBADO_PCT}%.{' '}
              {ultimoSim.puntaje >= APROBADO_PCT ? 'Vas por buen camino.' : 'Sigue practicando.'}
            </p>
          </div>
        )}
      </div>
    </div>
  )
}
