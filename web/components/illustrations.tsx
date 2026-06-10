/**
 * Illustration — ilustraciones de marca del landing, dibujadas en SVG (sin vídeo
 * ni imágenes). Cada escena usa la paleta azul→morado de CertReady, formas
 * redondeadas amables y movimiento sutil (clases `il-*` de globals.css, que se
 * desactivan bajo `prefers-reduced-motion`). Son server components: nada de JS,
 * nítidas a cualquier tamaño y de peso mínimo.
 *
 * Identidad propia (regla de marcas): no se usan logos ni badges oficiales de
 * ningún proveedor; los íconos (nube, escudo, código, birrete) son genéricos.
 */
import type { CSSProperties, ReactElement } from 'react'

/** Paleta (espejo de los tokens de globals.css). */
const C = {
  brand: '#4B5BF0',
  brand2: '#9C8CFA',
  brandInk: '#3839B0',
  ink: '#1C1B29',
  muted: '#5B5C70',
  faint: '#9294A8',
  line: '#E4E6F3',
  lineStrong: '#CDD0E6',
  surface: '#F7F8FD',
  sunken: '#EEF0FA',
  good: '#22AF6E',
  warn: '#EAA834',
  bad: '#E84C4C',
  white: '#FFFFFF',
}

/** delay produce un style con el desfase de animación indicado (en segundos). */
function delay(s: number): CSSProperties {
  return { animationDelay: `${s}s` }
}

/** drawLen fija la longitud del trazo para la animación `il-draw`. */
function drawLen(len: number): CSSProperties {
  return { ['--len' as string]: String(len) } as CSSProperties
}

/** Defs comunes a una escena: gradiente de marca y sombra suave. */
function Defs({ id }: { id: string }) {
  return (
    <defs>
      <linearGradient id={`${id}-g`} x1="0" y1="0" x2="1" y2="1">
        <stop offset="0" stopColor={C.brand} />
        <stop offset="1" stopColor={C.brand2} />
      </linearGradient>
      <radialGradient id={`${id}-glow`} cx="0.5" cy="0.5" r="0.5">
        <stop offset="0" stopColor={C.brand2} stopOpacity="0.30" />
        <stop offset="1" stopColor={C.brand2} stopOpacity="0" />
      </radialGradient>
      <filter id={`${id}-sh`} x="-25%" y="-25%" width="150%" height="150%">
        <feDropShadow dx="0" dy="8" stdDeviation="11" floodColor={C.brandInk} floodOpacity="0.16" />
      </filter>
    </defs>
  )
}

/** Estrellita de brillo que late suavemente. */
function Spark({ x, y, r = 5, d = 0 }: { x: number; y: number; r?: number; d?: number }) {
  return (
    <path
      className="il-pulse"
      style={delay(d)}
      transform={`translate(${x} ${y})`}
      d={`M0 ${-r} L ${r * 0.32} ${-r * 0.32} L ${r} 0 L ${r * 0.32} ${r * 0.32} L 0 ${r} L ${-r * 0.32} ${r * 0.32} L ${-r} 0 L ${-r * 0.32} ${-r * 0.32} Z`}
      fill={C.brand2}
    />
  )
}

/** Marca de verificación (check) dentro de un círculo. */
function CheckBadge({
  x,
  y,
  r = 18,
  tone = C.good,
}: {
  x: number
  y: number
  r?: number
  tone?: string
}) {
  return (
    <g transform={`translate(${x} ${y})`}>
      <circle r={r} fill={tone} />
      <path
        d={`M ${-r * 0.42} 0 L ${-r * 0.1} ${r * 0.34} L ${r * 0.46} ${-r * 0.34}`}
        fill="none"
        stroke={C.white}
        strokeWidth={r * 0.22}
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </g>
  )
}

const baseSvg = (extra = '') => `block h-full w-full overflow-visible ${extra}`.trim()

/* --- Escenas ------------------------------------------------------------- */

function Hero({ className }: { className?: string }) {
  const id = 'hero'
  return (
    <svg viewBox="0 0 640 360" className={baseSvg(className)} role="img" aria-label="CertReady">
      <Defs id={id} />
      <ellipse cx="330" cy="185" rx="290" ry="180" fill={`url(#${id}-glow)`} />

      {/* App: ruta de aprendizaje */}
      <g className="il-float" filter={`url(#${id}-sh)`}>
        <rect
          x="78"
          y="44"
          width="244"
          height="276"
          rx="30"
          fill={C.white}
          stroke={C.lineStrong}
          strokeWidth="2"
        />
        <rect x="78" y="44" width="244" height="54" rx="30" fill={`url(#${id}-g)`} />
        <rect x="78" y="74" width="244" height="24" fill={`url(#${id}-g)`} />
        <circle cx="108" cy="71" r="9" fill={C.white} opacity="0.9" />
        <rect x="126" y="66" width="92" height="10" rx="5" fill={C.white} opacity="0.85" />

        {/* camino serpenteante */}
        <path
          className="il-draw"
          style={drawLen(360)}
          d="M150 150 C 150 124 250 130 250 160 C 250 192 150 196 150 226 C 150 256 250 258 250 286"
          fill="none"
          stroke={C.sunken}
          strokeWidth="14"
          strokeLinecap="round"
        />
        <path
          className="il-draw"
          style={{ ...drawLen(360), animationDelay: '0.35s' }}
          d="M150 150 C 150 124 250 130 250 160 C 250 192 150 196 150 226 C 150 256 250 258 250 286"
          fill="none"
          stroke={`url(#${id}-g)`}
          strokeWidth="6"
          strokeLinecap="round"
          strokeDasharray="2 14"
        />
        <g>
          <circle cx="150" cy="150" r="17" fill={C.good} />
          <path
            d="M143 150 l5 5 l9 -11"
            fill="none"
            stroke={C.white}
            strokeWidth="3.4"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
          <circle cx="250" cy="160" r="17" fill={C.white} stroke={C.brand} strokeWidth="4" />
          <circle cx="250" cy="160" r="6" fill={C.brand} />
          <circle cx="150" cy="226" r="15" fill={C.sunken} stroke={C.lineStrong} strokeWidth="2" />
          <circle cx="250" cy="286" r="15" fill={C.sunken} stroke={C.lineStrong} strokeWidth="2" />
        </g>
      </g>

      {/* Medallón con birrete */}
      <g className="il-float" style={delay(0.6)}>
        <g filter={`url(#${id}-sh)`}>
          <circle cx="452" cy="138" r="66" fill={`url(#${id}-g)`} />
          <circle
            cx="452"
            cy="138"
            r="66"
            fill="none"
            stroke={C.white}
            strokeWidth="3"
            opacity="0.5"
          />
        </g>
        <path d="M452 108 L498 126 L452 144 L406 126 Z" fill={C.white} />
        <path d="M430 134 L430 152 Q452 166 474 152 L474 134" fill={C.white} opacity="0.82" />
        <path d="M498 126 L498 150" stroke={C.white} strokeWidth="3" strokeLinecap="round" />
        <circle cx="498" cy="153" r="5" fill={C.white} />
        {/* cintas */}
        <path d="M436 196 L452 182 L468 196 L468 230 L452 218 L436 230 Z" fill={C.brand2} />
      </g>

      {/* Chips flotantes */}
      <g className="il-float" style={delay(0.25)} filter={`url(#${id}-sh)`}>
        <rect
          x="392"
          y="246"
          width="132"
          height="46"
          rx="23"
          fill={C.white}
          stroke={C.lineStrong}
          strokeWidth="2"
        />
        <CheckBadge x={416} y={269} r={14} />
        <rect x="438" y="262" width="68" height="9" rx="4.5" fill={C.ink} opacity="0.8" />
        <rect x="438" y="276" width="46" height="8" rx="4" fill={C.faint} />
      </g>

      <Spark x={372} y={92} r={9} d={0} />
      <Spark x={548} y={210} r={7} d={0.5} />
      <Spark x={356} y={300} r={6} d={1} />
      <Spark x={540} y={92} r={5} d={0.8} />
    </svg>
  )
}

function Certificaciones({ className }: { className?: string }) {
  const id = 'cert'
  return (
    <svg
      viewBox="0 0 480 360"
      className={baseSvg(className)}
      role="img"
      aria-label="Certificaciones"
    >
      <Defs id={id} />
      <ellipse cx="240" cy="180" rx="220" ry="150" fill={`url(#${id}-glow)`} />

      {/* Documento / diploma */}
      <g className="il-float" filter={`url(#${id}-sh)`}>
        <rect
          x="118"
          y="58"
          width="244"
          height="206"
          rx="20"
          fill={C.white}
          stroke={C.lineStrong}
          strokeWidth="2"
        />
        <rect x="146" y="86" width="120" height="14" rx="7" fill={`url(#${id}-g)`} />
        <rect x="146" y="116" width="188" height="9" rx="4.5" fill={C.sunken} />
        <rect x="146" y="134" width="188" height="9" rx="4.5" fill={C.sunken} />
        <rect x="146" y="152" width="140" height="9" rx="4.5" fill={C.sunken} />
        <rect x="146" y="186" width="92" height="9" rx="4.5" fill={C.line} />
        <rect x="146" y="204" width="70" height="9" rx="4.5" fill={C.line} />
      </g>

      {/* Sello con cintas */}
      <g className="il-float" style={delay(0.4)}>
        <path d="M300 250 L312 232 L326 248 L326 296 L312 282 L298 296 Z" fill={C.brand2} />
        <g filter={`url(#${id}-sh)`}>
          <circle cx="312" cy="232" r="34" fill={`url(#${id}-g)`} />
          <circle
            cx="312"
            cy="232"
            r="34"
            fill="none"
            stroke={C.white}
            strokeWidth="2.5"
            opacity="0.5"
          />
        </g>
        <path
          d="M300 232 l8 8 l16 -18"
          fill="none"
          stroke={C.white}
          strokeWidth="4"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
      </g>

      {/* Tiles genéricos del catálogo (nube · escudo · código) */}
      <g className="il-float" style={delay(0.2)} filter={`url(#${id}-sh)`}>
        <rect
          x="44"
          y="120"
          width="58"
          height="58"
          rx="16"
          fill={C.white}
          stroke={C.lineStrong}
          strokeWidth="2"
        />
        <path
          d="M62 152 a10 10 0 0 1 10 -10 a12 12 0 0 1 22 4 a8 8 0 0 1 -2 16 h-22 a9 9 0 0 1 -8 -10 Z"
          fill={`url(#${id}-g)`}
        />
      </g>
      <g className="il-float" style={delay(0.55)} filter={`url(#${id}-sh)`}>
        <rect
          x="386"
          y="92"
          width="56"
          height="56"
          rx="16"
          fill={C.white}
          stroke={C.lineStrong}
          strokeWidth="2"
        />
        <path
          d="M414 104 l16 6 v12 c0 11 -8 18 -16 22 c-8 -4 -16 -11 -16 -22 v-12 Z"
          fill={C.brand}
          opacity="0.92"
        />
      </g>
      <g className="il-float" style={delay(0.75)} filter={`url(#${id}-sh)`}>
        <rect
          x="392"
          y="210"
          width="56"
          height="56"
          rx="16"
          fill={C.white}
          stroke={C.lineStrong}
          strokeWidth="2"
        />
        <path
          d="M412 226 l-8 12 l8 12 M428 226 l8 12 l-8 12"
          fill="none"
          stroke={C.brand2}
          strokeWidth="4"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
      </g>

      <Spark x={92} y={70} r={7} d={0.2} />
      <Spark x={430} y={300} r={6} d={0.9} />
      <Spark x={56} y={250} r={6} d={1.2} />
    </svg>
  )
}

function Estudio({ className }: { className?: string }) {
  const id = 'study'
  return (
    <svg viewBox="0 0 480 360" className={baseSvg(className)} role="img" aria-label="Estudio">
      <Defs id={id} />
      <ellipse cx="240" cy="180" rx="220" ry="150" fill={`url(#${id}-glow)`} />

      {/* Libro abierto */}
      <g className="il-float" filter={`url(#${id}-sh)`}>
        {/* página izquierda */}
        <path
          d="M240 96 C 200 78 150 76 110 88 L110 256 C 150 244 200 246 240 264 Z"
          fill={C.white}
          stroke={C.lineStrong}
          strokeWidth="2"
        />
        {/* página derecha */}
        <path
          d="M240 96 C 280 78 330 76 370 88 L370 256 C 330 244 280 246 240 264 Z"
          fill={C.white}
          stroke={C.lineStrong}
          strokeWidth="2"
        />
        {/* lomo */}
        <path d="M240 96 L240 264" stroke={C.line} strokeWidth="3" />
        {/* líneas izquierda */}
        <rect x="132" y="116" width="86" height="8" rx="4" fill={`url(#${id}-g)`} />
        <rect x="132" y="136" width="92" height="7" rx="3.5" fill={C.sunken} />
        <rect x="132" y="152" width="92" height="7" rx="3.5" fill={C.sunken} />
        <rect x="132" y="168" width="70" height="7" rx="3.5" fill={C.sunken} />
        {/* líneas derecha */}
        <rect x="262" y="116" width="86" height="8" rx="4" fill={C.brand2} opacity="0.85" />
        <rect x="262" y="136" width="92" height="7" rx="3.5" fill={C.sunken} />
        <rect x="262" y="152" width="92" height="7" rx="3.5" fill={C.sunken} />
        <rect x="262" y="168" width="62" height="7" rx="3.5" fill={C.sunken} />
      </g>

      {/* Marcador / bookmark */}
      <g className="il-float" style={delay(0.5)}>
        <path d="M318 76 L350 76 L350 134 L334 120 L318 134 Z" fill={`url(#${id}-g)`} />
      </g>

      {/* Lápiz que apunta a la página */}
      <g className="il-float" style={delay(0.3)} filter={`url(#${id}-sh)`}>
        <g transform="rotate(40 150 280)">
          <rect x="120" y="270" width="86" height="20" rx="6" fill={C.warn} />
          <path d="M206 270 l22 10 l-22 10 Z" fill={C.ink} />
          <rect x="120" y="270" width="14" height="20" rx="6" fill={C.brand} />
        </g>
      </g>

      <Spark x={392} y={120} r={8} d={0.1} />
      <Spark x={96} y={96} r={6} d={0.7} />
      <Spark x={408} y={250} r={6} d={1.1} />
    </svg>
  )
}

function Examenes({ className }: { className?: string }) {
  const id = 'exam'
  return (
    <svg viewBox="0 0 480 360" className={baseSvg(className)} role="img" aria-label="Exámenes">
      <Defs id={id} />
      <ellipse cx="240" cy="180" rx="220" ry="150" fill={`url(#${id}-glow)`} />

      {/* Tarjeta de pregunta con opciones */}
      <g className="il-float" filter={`url(#${id}-sh)`}>
        <rect
          x="96"
          y="64"
          width="232"
          height="232"
          rx="22"
          fill={C.white}
          stroke={C.lineStrong}
          strokeWidth="2"
        />
        <rect x="120" y="90" width="150" height="12" rx="6" fill={`url(#${id}-g)`} />
        <rect x="120" y="110" width="184" height="9" rx="4.5" fill={C.sunken} />

        {/* opción correcta */}
        <rect
          x="120"
          y="142"
          width="184"
          height="38"
          rx="12"
          fill="#EAF7F0"
          stroke={C.good}
          strokeWidth="2"
        />
        <circle cx="142" cy="161" r="11" fill={C.good} />
        <path
          d="M137 161 l4 4 l7 -8"
          fill="none"
          stroke={C.white}
          strokeWidth="3"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
        <rect x="162" y="156" width="110" height="10" rx="5" fill={C.good} opacity="0.7" />

        <rect
          x="120"
          y="190"
          width="184"
          height="38"
          rx="12"
          fill={C.surface}
          stroke={C.line}
          strokeWidth="2"
        />
        <circle cx="142" cy="209" r="11" fill={C.white} stroke={C.lineStrong} strokeWidth="2" />
        <rect x="162" y="204" width="120" height="10" rx="5" fill={C.sunken} />

        <rect
          x="120"
          y="238"
          width="184"
          height="38"
          rx="12"
          fill={C.surface}
          stroke={C.line}
          strokeWidth="2"
        />
        <circle cx="142" cy="257" r="11" fill={C.white} stroke={C.lineStrong} strokeWidth="2" />
        <rect x="162" y="252" width="96" height="10" rx="5" fill={C.sunken} />
      </g>

      {/* Cronómetro */}
      <g className="il-float" style={delay(0.45)}>
        <g filter={`url(#${id}-sh)`}>
          <circle cx="350" cy="118" r="46" fill={C.white} stroke={C.lineStrong} strokeWidth="2" />
        </g>
        <circle
          cx="350"
          cy="118"
          r="46"
          fill="none"
          stroke={`url(#${id}-g)`}
          strokeWidth="8"
          strokeLinecap="round"
          strokeDasharray="289"
          strokeDashoffset="96"
          transform="rotate(-90 350 118)"
        />
        <rect x="338" y="62" width="24" height="9" rx="4.5" fill={C.brand} />
        <path
          d="M350 118 L350 96 M350 118 L368 126"
          stroke={C.ink}
          strokeWidth="4"
          strokeLinecap="round"
        />
        <circle cx="350" cy="118" r="5" fill={C.brand} />
      </g>

      <Spark x={392} y={210} r={8} d={0.3} />
      <Spark x={92} y={104} r={6} d={0.9} />
      <Spark x={310} y={300} r={6} d={1.2} />
    </svg>
  )
}

function Entrevistas({ className }: { className?: string }) {
  const id = 'intv'
  return (
    <svg viewBox="0 0 480 360" className={baseSvg(className)} role="img" aria-label="Entrevistas">
      <Defs id={id} />
      <ellipse cx="240" cy="180" rx="220" ry="150" fill={`url(#${id}-glow)`} />

      {/* Ventana de editor */}
      <g className="il-float" filter={`url(#${id}-sh)`}>
        <rect
          x="86"
          y="70"
          width="280"
          height="206"
          rx="20"
          fill={C.white}
          stroke={C.lineStrong}
          strokeWidth="2"
        />
        <rect x="86" y="70" width="280" height="38" rx="20" fill={C.surface} />
        <rect x="86" y="92" width="280" height="16" fill={C.surface} />
        <circle cx="112" cy="89" r="6" fill={C.bad} />
        <circle cx="132" cy="89" r="6" fill={C.warn} />
        <circle cx="152" cy="89" r="6" fill={C.good} />

        {/* líneas de código (con sangría) */}
        <rect x="110" y="128" width="40" height="9" rx="4.5" fill={C.brand} />
        <rect x="158" y="128" width="64" height="9" rx="4.5" fill={C.faint} />
        <rect x="128" y="148" width="58" height="9" rx="4.5" fill={C.brand2} />
        <rect x="194" y="148" width="92" height="9" rx="4.5" fill={C.sunken} />
        <rect x="128" y="168" width="84" height="9" rx="4.5" fill={C.sunken} />
        <rect x="110" y="188" width="48" height="9" rx="4.5" fill={C.good} />
        <rect x="166" y="188" width="70" height="9" rx="4.5" fill={C.sunken} />
        <rect x="110" y="226" width="150" height="9" rx="4.5" fill={C.sunken} />
        {/* glifo </> */}
        <path
          d="M300 150 l-14 16 l14 16 M330 150 l14 16 l-14 16"
          fill="none"
          stroke={C.lineStrong}
          strokeWidth="5"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
      </g>

      {/* Badge de tests en verde */}
      <g className="il-float" style={delay(0.45)} filter={`url(#${id}-sh)`}>
        <rect
          x="262"
          y="234"
          width="150"
          height="56"
          rx="28"
          fill={C.white}
          stroke={C.lineStrong}
          strokeWidth="2"
        />
        <CheckBadge x={292} y={262} r={17} />
        <rect x="318" y="252" width="78" height="10" rx="5" fill={C.ink} opacity="0.78" />
        <rect x="318" y="270" width="54" height="8" rx="4" fill={C.good} />
      </g>

      <Spark x={392} y={120} r={8} d={0.2} />
      <Spark x={86} y={250} r={6} d={0.8} />
      <Spark x={410} y={210} r={6} d={1.15} />
    </svg>
  )
}

function Progreso({ className }: { className?: string }) {
  const id = 'prog'
  // Arco del medidor (~72%): r=52 → circunferencia ≈ 327.
  const r = 52
  const circ = 2 * Math.PI * r
  const pct = 0.72
  return (
    <svg viewBox="0 0 480 360" className={baseSvg(className)} role="img" aria-label="Progreso">
      <Defs id={id} />
      <ellipse cx="240" cy="180" rx="220" ry="150" fill={`url(#${id}-glow)`} />

      {/* Panel */}
      <g className="il-float" filter={`url(#${id}-sh)`}>
        <rect
          x="92"
          y="64"
          width="296"
          height="232"
          rx="22"
          fill={C.white}
          stroke={C.lineStrong}
          strokeWidth="2"
        />

        {/* Medidor circular */}
        <g transform="translate(170 178)">
          <circle r={r} fill="none" stroke={C.sunken} strokeWidth="16" />
          <circle
            className="il-draw"
            style={drawLen(circ)}
            r={r}
            fill="none"
            stroke={`url(#${id}-g)`}
            strokeWidth="16"
            strokeLinecap="round"
            strokeDasharray={`${circ * pct} ${circ}`}
            transform="rotate(-90)"
          />
          <text
            x="0"
            y="-2"
            textAnchor="middle"
            fontFamily="system-ui, sans-serif"
            fontWeight="700"
            fontSize="30"
            fill={C.ink}
          >
            72%
          </text>
          <text
            x="0"
            y="22"
            textAnchor="middle"
            fontFamily="system-ui, sans-serif"
            fontWeight="600"
            fontSize="13"
            fill={C.faint}
          >
            listo
          </text>
        </g>

        {/* Barras por dominio (suben) */}
        <g>
          <rect x="262" y="118" width="96" height="11" rx="5.5" fill={C.sunken} />
          <rect
            className="il-rise"
            style={delay(0.1)}
            x="262"
            y="118"
            width="78"
            height="11"
            rx="5.5"
            fill={`url(#${id}-g)`}
          />
          <rect x="262" y="148" width="96" height="11" rx="5.5" fill={C.sunken} />
          <rect
            className="il-rise"
            style={delay(0.25)}
            x="262"
            y="148"
            width="62"
            height="11"
            rx="5.5"
            fill={`url(#${id}-g)`}
          />
          <rect x="262" y="178" width="96" height="11" rx="5.5" fill={C.sunken} />
          <rect
            className="il-rise"
            style={delay(0.4)}
            x="262"
            y="178"
            width="50"
            height="11"
            rx="5.5"
            fill={`url(#${id}-g)`}
          />
          <rect x="262" y="208" width="96" height="11" rx="5.5" fill={C.sunken} />
          <rect
            className="il-rise"
            style={delay(0.55)}
            x="262"
            y="208"
            width="40"
            height="11"
            rx="5.5"
            fill={`url(#${id}-g)`}
          />
        </g>

        {/* Barras de tendencia */}
        <g>
          <rect
            className="il-rise"
            style={delay(0.2)}
            x="120"
            y="248"
            width="20"
            height="30"
            rx="6"
            fill={C.brand2}
            opacity="0.5"
          />
          <rect
            className="il-rise"
            style={delay(0.35)}
            x="150"
            y="240"
            width="20"
            height="38"
            rx="6"
            fill={C.brand2}
            opacity="0.65"
          />
          <rect
            className="il-rise"
            style={delay(0.5)}
            x="180"
            y="228"
            width="20"
            height="50"
            rx="6"
            fill={C.brand}
            opacity="0.8"
          />
          <rect
            className="il-rise"
            style={delay(0.65)}
            x="210"
            y="216"
            width="20"
            height="62"
            rx="6"
            fill={`url(#${id}-g)`}
          />
        </g>
      </g>

      {/* Insignia "listo" */}
      <g className="il-float" style={delay(0.5)} filter={`url(#${id}-sh)`}>
        <circle cx="372" cy="100" r="26" fill={C.white} stroke={C.lineStrong} strokeWidth="2" />
        <CheckBadge x={372} y={100} r={16} />
      </g>

      <Spark x={108} y={96} r={7} d={0.3} />
      <Spark x={404} y={250} r={6} d={0.9} />
      <Spark x={250} y={312} r={6} d={1.2} />
    </svg>
  )
}

const ESCENAS: Record<string, (props: { className?: string }) => ReactElement> = {
  hero: Hero,
  certificaciones: Certificaciones,
  estudio: Estudio,
  examenes: Examenes,
  entrevistas: Entrevistas,
  progreso: Progreso,
}

/**
 * Illustration dibuja la escena de marca indicada por `name`. Si el nombre no
 * existe, cae a la del hero. `className` controla el tamaño del SVG (el contenedor
 * fija la relación de aspecto en el landing).
 */
export function Illustration({ name, className }: { name: string; className?: string }) {
  const Escena = ESCENAS[name] ?? Hero
  return <Escena className={className} />
}
