import Image from 'next/image'
import Link from 'next/link'

import { Badge, type BadgeTone } from '@/components/ui/badge'
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

function estadoTone(estado: EstadoInscripcion): BadgeTone {
  if (estado === 'activa') return 'good'
  if (estado === 'completada') return 'brand'
  if (estado === 'pausada') return 'warn'
  return 'neutral'
}

/** ymd devuelve la fecha local en formato YYYY-MM-DD (para comparar días). */
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

/** DiaDot es un punto de la racha semanal (completado / hoy / pendiente). */
function DiaDot({ done, today }: { done: boolean; today: boolean }) {
  const cls = done
    ? 'border-brand bg-brand'
    : today
      ? 'border-dashed border-brand bg-bg'
      : 'border-line-strong bg-bg'
  return (
    <span className={`grid h-[22px] w-[22px] place-items-center rounded-full border-2 ${cls}`}>
      {done && (
        <svg width="9" height="6" viewBox="0 0 9 6" aria-hidden>
          <path
            d="M1 3 L3.4 5 L8 1"
            fill="none"
            stroke="#fff"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
        </svg>
      )}
    </span>
  )
}

/** StatCard envuelve una tarjeta de la columna derecha (racha, meta, simulacro). */
function StatCard({
  icon,
  titulo,
  children,
}: {
  icon: string
  titulo: string
  children: React.ReactNode
}) {
  return (
    <div className="rounded-[18px] border-2 border-line bg-bg px-5 py-[18px]">
      <div className="flex items-center gap-2.5">
        <Image
          src={icon}
          alt=""
          width={30}
          height={30}
          className="h-[30px] w-[30px] object-contain"
        />
        <span className="font-display text-sm font-semibold text-ink">{titulo}</span>
      </div>
      {children}
    </div>
  )
}

/**
 * Panel del estudiante: saludo, inscripciones con su avance, y una columna de
 * gamificación moderada (racha, meta semanal y último simulacro). La racha y la
 * meta se calculan de las lecciones reales completadas (servicio progress);
 * `getMe` provisiona la cuenta en el primer acceso.
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

  // Avance por inscripción + lecciones para la racha/meta (servicios que sí corren).
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
    <div className="grid items-start gap-10 lg:grid-cols-[minmax(0,1fr)_300px]">
      {/* Columna izquierda */}
      <div className="flex min-w-0 flex-col gap-9">
        <header>
          <span className="text-[11px] font-extrabold uppercase tracking-[0.14em] text-brand">
            Panel
          </span>
          <h1 className="mt-1 flex items-center gap-2.5 font-display text-[34px] font-semibold leading-tight text-ink">
            Hola{nombre ? `, ${nombre}` : ''}
            <Image src="/icons/wave.png" alt="" width={36} height={36} className="h-9 w-9" />
          </h1>
          <p className="mt-1.5 max-w-[48ch] text-muted">{lead}</p>
        </header>

        <section>
          <div className="mb-3.5 flex items-baseline justify-between gap-3">
            <h2 className="font-display text-xl font-semibold">Mis inscripciones</h2>
            <Link
              href="/certifications"
              className="text-[13.5px] font-bold text-muted transition-colors hover:text-brand"
            >
              Explorar catálogo →
            </Link>
          </div>

          {detalles.length === 0 ? (
            <div className="flex flex-col items-center gap-2 rounded-[18px] border-2 border-dashed border-line-strong bg-bg px-6 py-11 text-center">
              <Image src="/icons/rocket.png" alt="" width={56} height={56} className="h-14 w-14" />
              <p className="font-display text-[19px] font-semibold">Aún no tienes inscripciones</p>
              <p className="mx-auto max-w-[38ch] text-muted">
                Elige una certificación del catálogo y arma tu ruta de estudio.
              </p>
              <Link href="/certifications" className={`mt-2.5 ${buttonStyles('primary', 'md')}`}>
                Explorar catálogo
              </Link>
            </div>
          ) : (
            <ul className="flex flex-col gap-3">
              {detalles.map(({ ins, cert, total, hechos, pct, siguiente }) => (
                <li key={ins.id}>
                  <div className="flex items-center gap-[18px] rounded-[18px] border-2 border-line bg-bg px-5 py-[18px]">
                    <div className="min-w-0 flex-1">
                      <div className="flex flex-wrap items-center gap-2.5">
                        <Badge tone="brand">{cert.proveedor}</Badge>
                        <Link
                          href={`/estudiar/${cert.slug}`}
                          className="font-display text-base font-semibold text-ink hover:text-brand"
                        >
                          {cert.nombre}
                        </Link>
                        <Badge tone={estadoTone(ins.estado)}>{ins.estado}</Badge>
                      </div>
                      <p className="mt-1 text-[12.5px] font-semibold text-faint">
                        {hechos} de {total} temas
                        {siguiente ? ` · Siguiente: ${siguiente.nombre}` : ' · ¡Completado!'}
                      </p>
                      <div className="mt-2.5 h-2.5 overflow-hidden rounded-full bg-sunken">
                        <div
                          className="h-full rounded-full bg-gradient-to-r from-brand to-brand-2 transition-[width] duration-500"
                          style={{ width: `${Math.max(3, pct)}%` }}
                        />
                      </div>
                    </div>
                    <Link href={`/estudiar/${cert.slug}`} className={buttonStyles('ghost', 'sm')}>
                      Continuar
                    </Link>
                  </div>
                </li>
              ))}
            </ul>
          )}
        </section>
      </div>

      {/* Columna derecha — gamificación moderada */}
      <div className="flex flex-col gap-4 lg:sticky lg:top-0">
        <StatCard icon="/icons/fire.png" titulo="Racha">
          <p className="mt-2 font-display text-[30px] font-semibold text-ink">
            {racha}{' '}
            <span className="text-[15px] font-semibold text-faint">
              día{racha === 1 ? '' : 's'}
            </span>
          </p>
          <p className="mt-1 text-[12.5px] text-muted">
            {racha > 0
              ? 'Una lección al día la mantiene viva.'
              : 'Completa una lección hoy para encenderla.'}
          </p>
          <div className="mt-3.5 flex gap-1.5">
            {dias.map((l, i) => (
              <div
                key={l}
                className="flex flex-1 flex-col items-center gap-1.5 text-[10px] font-extrabold text-faint"
              >
                <DiaDot done={semana.dias.has(i)} today={i === hoyIdx} />
                {l}
              </div>
            ))}
          </div>
        </StatCard>

        <StatCard icon="/icons/target.png" titulo="Meta semanal">
          <p className="mt-2 font-display text-[30px] font-semibold text-ink">
            {semana.total}{' '}
            <span className="text-[15px] font-semibold text-faint">
              de {META_SEMANAL} lecciones
            </span>
          </p>
          <div className="mt-3 h-3 overflow-hidden rounded-full bg-sunken">
            <div
              className="h-full rounded-full bg-good transition-[width] duration-500"
              style={{ width: `${Math.min(100, (semana.total / META_SEMANAL) * 100)}%` }}
            />
          </div>
          <p className="mt-2 text-[12.5px] text-muted">
            {semana.total >= META_SEMANAL
              ? '¡Meta cumplida esta semana!'
              : `Te faltan ${META_SEMANAL - semana.total} para cumplirla.`}
          </p>
        </StatCard>

        {ultimoSim && ultimoSim.puntaje !== null && (
          <StatCard icon="/icons/trophy.png" titulo="Último simulacro">
            <p className="mt-2 font-display text-[30px] font-semibold text-ink">
              {Math.round(ultimoSim.puntaje)}%{' '}
              <span className="text-[15px] font-semibold text-faint">
                · {nombrePorSlug.get(ultimoSim.certificacion) ?? ultimoSim.certificacion}
              </span>
            </p>
            <p className="mt-1 text-[12.5px] text-muted">
              Corte de aprobación: {APROBADO_PCT}%.{' '}
              {ultimoSim.puntaje >= APROBADO_PCT ? 'Vas por buen camino.' : 'Sigue practicando.'}
            </p>
          </StatCard>
        )}
      </div>
    </div>
  )
}
