/* eslint-disable -- Escenas 3D del landing (diseño hecho en claude.ai, vendido). Solo deps: three + RoundedBoxGeometry. */
import * as THREE from 'three'
import { RoundedBoxGeometry } from 'three/addons/geometries/RoundedBoxGeometry.js'

/* Paleta de marca CertReady (espejo de los tokens de globals.css) */
export const C = {
  blue: '#4B5BF0',
  purple: '#9C8CFA',
  ink: '#3839B0',
  good: '#22AF6E',
  warn: '#EAA834',
  bad: '#E84C4C',
  white: '#ffffff',
  surface: '#F7F8FD',
  sunken: '#EEF0FA',
  line: '#CDD0E6',
  faint: '#9294A8',
}

/* ---- Texturas y materiales -------------------------------------------- */

/** Textura canvas con el degradado azul→morado de la marca. */
export function gradientTexture(a = C.blue, b = C.purple, angleDeg = 125) {
  const s = 256
  const cv = document.createElement('canvas')
  cv.width = cv.height = s
  const ctx = cv.getContext('2d')
  const ang = (angleDeg * Math.PI) / 180
  const x = Math.cos(ang) * s
  const y = Math.sin(ang) * s
  const g = ctx.createLinearGradient(0, 0, x, y)
  g.addColorStop(0, a)
  g.addColorStop(1, b)
  ctx.fillStyle = g
  ctx.fillRect(0, 0, s, s)
  const t = new THREE.CanvasTexture(cv)
  t.colorSpace = THREE.SRGBColorSpace
  t.anisotropy = 4
  return t
}

/* Rampa de sombreado cel (estilo vinilo/toon): pocos escalones suaves. */
let _toonRamp
function toonRamp() {
  if (!_toonRamp) {
    const data = new Uint8Array([168, 168, 168, 255, 216, 216, 216, 255, 255, 255, 255, 255, 255, 255, 255, 255])
    _toonRamp = new THREE.DataTexture(data, 4, 1, THREE.RGBAFormat)
    _toonRamp.minFilter = THREE.NearestFilter
    _toonRamp.magFilter = THREE.NearestFilter
    _toonRamp.needsUpdate = true
  }
  return _toonRamp
}

/** Material con el degradado de marca (toon, estilo vinilo). */
export function gradientMat(over = {}, a, b, angle) {
  return new THREE.MeshToonMaterial({
    map: gradientTexture(a, b, angle),
    gradientMap: toonRamp(),
  })
}

/** Material sólido (toon, estilo vinilo). */
export function solidMat(color, over = {}) {
  return new THREE.MeshToonMaterial({
    color: new THREE.Color(color),
    gradientMap: toonRamp(),
  })
}

/** Material emisivo (acentos). */
export function glowMat(color, intensity = 0.2) {
  return new THREE.MeshToonMaterial({
    color: new THREE.Color(color),
    gradientMap: toonRamp(),
    emissive: new THREE.Color(color),
    emissiveIntensity: Math.min(intensity, 0.25),
  })
}

/* ---- Geometrías reutilizables ----------------------------------------- */

const _slabCache = new Map()
/** Caja con esquinas redondeadas (cacheada por firma). */
export function roundedBox(w, h, d, r = 0.12, seg = 4) {
  const key = `${w}|${h}|${d}|${r}|${seg}`
  let g = _slabCache.get(key)
  if (!g) {
    g = new RoundedBoxGeometry(w, h, d, seg, r)
    _slabCache.set(key, g)
  }
  return g
}

export function slab(w, h, d, r, mat) {
  return new THREE.Mesh(roundedBox(w, h, d, r), mat)
}

/** Marca de verificación 3D (dos barras redondeadas). */
export function checkMark(mat, scale = 1) {
  const g = new THREE.Group()
  const a = slab(0.16, 0.5, 0.16, 0.07, mat)
  a.position.set(-0.16, -0.04, 0)
  a.rotation.z = Math.PI / 4
  const b = slab(0.16, 0.92, 0.16, 0.07, mat)
  b.position.set(0.13, 0.08, 0)
  b.rotation.z = -Math.PI / 4
  g.add(a, b)
  g.scale.setScalar(scale)
  return g
}

/** Insignia circular con check (moneda + verificación). */
export function checkBadge(faceMat, tone = C.good, r = 0.6) {
  const g = new THREE.Group()
  const coin = new THREE.Mesh(
    new THREE.CylinderGeometry(r, r, r * 0.34, 48),
    faceMat || solidMat(tone, { roughness: 0.3 })
  )
  coin.rotation.x = Math.PI / 2
  g.add(coin)
  const ck = checkMark(solidMat(C.white, { roughness: 0.4 }), r * 0.9)
  ck.position.z = r * 0.18
  g.add(ck)
  return g
}

/** Octaedro emisivo que late (chispa de marca). */
export function spark(size = 0.16, color = C.purple) {
  const m = new THREE.Mesh(new THREE.SphereGeometry(size * 0.7, 20, 20), solidMat(color))
  m.userData.spark = true
  return m
}

/* ---- Easings ----------------------------------------------------------- */

export function easeOutBack(x) {
  const c1 = 1.70158
  const c3 = c1 + 1
  return 1 + c3 * Math.pow(x - 1, 3) + c1 * Math.pow(x - 1, 2)
}
export function easeOutCubic(x) {
  return 1 - Math.pow(1 - x, 3)
}
export function clamp01(x) {
  return Math.max(0, Math.min(1, x))
}
/** Progreso parcial dentro de una ventana [a,b]. */
export function seg(p, a, b) {
  return clamp01((p - a) / (b - a))
}

/* ---- Escena 3D montable ------------------------------------------------ */
/**
 * Scene3D monta un canvas WebGL transparente dentro de `container`, construye la
 * escena con `builder(root, ctx)` (que devuelve { update(t, e, p) }), reproduce
 * una entrada al entrar en viewport y deja un bucle de animación con energía.
 * Pausa el render cuando sale de pantalla. Respeta prefers-reduced-motion.
 */
export class Scene3D {
  constructor(container, builder, opts = {}) {
    this.container = container
    this.opts = opts
    this.reduced = matchMedia('(prefers-reduced-motion: reduce)').matches

    const renderer = new THREE.WebGLRenderer({ alpha: true, antialias: true, powerPreference: 'high-performance', preserveDrawingBuffer: true })
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2))
    renderer.toneMapping = THREE.NoToneMapping
    renderer.outputColorSpace = THREE.SRGBColorSpace
    const el = renderer.domElement
    el.style.width = '100%'
    el.style.height = '100%'
    el.style.display = 'block'
    container.appendChild(el)
    this.renderer = renderer

    this.scene = new THREE.Scene()
    this.camera = new THREE.PerspectiveCamera(opts.fov || 34, 1, 0.1, 100)
    this.camera.position.set(0, 0, opts.dist || 9)
    if (opts.lookY) this.camera.lookAt(0, opts.lookY, 0)

    // luz para sombreado cel: una clave clara + relleno alto y parejo
    const key = new THREE.DirectionalLight(0xffffff, 1.45)
    key.position.set(3.5, 5, 6)
    const fill = new THREE.DirectionalLight(0xffffff, 0.35)
    fill.position.set(-5, -1.5, 3)
    this.scene.add(key, fill, new THREE.AmbientLight(0xffffff, 1.5))

    this.t0 = performance.now()
    this.last = this.t0
    this.progress = 0
    this.entered = false
    if (opts.noEntrance || this.reduced) {
      this.progress = 1
      this.entered = true
    }
    this.visible = false
    this.running = false

    this.root = new THREE.Group()
    this.scene.add(this.root)
    this.api = builder(this.root, { scene: this.scene, camera: this.camera, renderer })
    // primer frame coherente: aplica el estado inicial antes de renderizar
    this.api && this.api.update && this.api.update(0, this.progress, this.progress)

    this._resize()
    this._ro = new ResizeObserver(() => this._resize())
    this._ro.observe(container)
    this.start()
  }

  /** Visibilidad real del contenedor en el viewport (sin IntersectionObserver,
      que no dispara en algunos contextos embebidos). */
  _isVisible() {
    const r = this.container.getBoundingClientRect()
    const vh = window.innerHeight || document.documentElement.clientHeight || 1
    return r.width > 0 && r.bottom > vh * 0.06 && r.top < vh * 0.94
  }

  _resize() {
    const w = this.container.clientWidth || 1
    const h = this.container.clientHeight || 1
    this.renderer.setSize(w, h, false)
    this.camera.aspect = w / h
    this.camera.updateProjectionMatrix()
    this.render()
  }

  start() {
    if (this.running) return
    this.running = true
    this.last = performance.now()
    requestAnimationFrame((n) => this._loop(n))
  }

  render() {
    this.renderer.render(this.scene, this.camera)
  }

  destroy() {
    this.running = false
    this._ro && this._ro.disconnect()
    this.renderer.dispose()
    const el = this.renderer.domElement
    if (el.parentNode) el.parentNode.removeChild(el)
  }

  _loop(now) {
    if (!this.running) return
    const dt = Math.min(0.05, (now - this.last) / 1000)
    this.last = now
    this.visible = this._isVisible()

    if (this.reduced) {
      this.progress = 1
      this.entered = true
      this.api && this.api.update && this.api.update(0, 1, 1)
      this.render()
      this.running = false
      return
    }

    if (this.visible) {
      if (!this.entered) {
        this.progress = Math.min(1, this.progress + dt / 0.95)
        if (this.progress >= 1) this.entered = true
      }
      const t = (now - this.t0) / 1000
      const e = easeOutCubic(this.progress)
      this.api && this.api.update && this.api.update(t, e, this.progress)
      this.render()
    }
    requestAnimationFrame((n) => this._loop(n))
  }
}
