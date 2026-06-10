/* eslint-disable -- Escenas 3D del landing (diseño hecho en claude.ai, vendido). Solo deps: three + RoundedBoxGeometry. */
import * as THREE from 'three'
import {
  C,
  gradientMat,
  solidMat,
  glowMat,
  slab,
  roundedBox,
  spark,
  checkMark,
  checkBadge,
  seg,
  easeOutBack,
  easeOutCubic,
  clamp01,
} from './three-helpers.js'

/* ---- pequeños constructores de forma ---------------------------------- */

function extrudeShape(shape, depth, mat) {
  const g = new THREE.ExtrudeGeometry(shape, { depth, bevelEnabled: true, bevelSize: 0.04, bevelThickness: 0.04, bevelSegments: 2 })
  g.center()
  return new THREE.Mesh(g, mat)
}

function shieldMesh(mat, s = 1) {
  const sh = new THREE.Shape()
  sh.moveTo(0, 0.55 * s)
  sh.lineTo(0.45 * s, 0.32 * s)
  sh.lineTo(0.45 * s, -0.12 * s)
  sh.quadraticCurveTo(0.45 * s, -0.5 * s, 0, -0.62 * s)
  sh.quadraticCurveTo(-0.45 * s, -0.5 * s, -0.45 * s, -0.12 * s)
  sh.lineTo(-0.45 * s, 0.32 * s)
  sh.closePath()
  return extrudeShape(sh, 0.16, mat)
}

/** Glifo </> con barras redondeadas. */
function codeGlyph(mat, s = 1) {
  const g = new THREE.Group()
  const mk = (x, sign) => {
    const grp = new THREE.Group()
    const a = slab(0.13 * s, 0.42 * s, 0.13 * s, 0.06 * s, mat)
    a.position.set(0, 0.16 * s, 0)
    a.rotation.z = sign * (Math.PI / 4)
    const b = slab(0.13 * s, 0.42 * s, 0.13 * s, 0.06 * s, mat)
    b.position.set(0, -0.16 * s, 0)
    b.rotation.z = sign * -(Math.PI / 4)
    grp.add(a, b)
    grp.position.x = x
    return grp
  }
  g.add(mk(-0.26 * s, 1), mk(0.26 * s, -1))
  return g
}

/** Birrete (gorro de graduación). */
function gradCap(s = 1) {
  const g = new THREE.Group()
  const grad = gradientMat({ clearcoat: 0.8 })
  const board = slab(1.5 * s, 0.12 * s, 1.5 * s, 0.06 * s, grad)
  board.rotation.y = Math.PI / 4
  g.add(board)
  const base = new THREE.Mesh(new THREE.CylinderGeometry(0.42 * s, 0.5 * s, 0.36 * s, 32), gradientMat({}, C.purple, C.blue))
  base.position.y = -0.26 * s
  g.add(base)
  const button = new THREE.Mesh(new THREE.SphereGeometry(0.08 * s, 16, 16), solidMat(C.white, { roughness: 0.3 }))
  button.position.y = 0.08 * s
  g.add(button)
  // borla
  const tassel = new THREE.Group()
  const cord = new THREE.Mesh(new THREE.CylinderGeometry(0.02 * s, 0.02 * s, 0.7 * s, 8), solidMat(C.white, { roughness: 0.4 }))
  cord.position.set(0.55 * s, -0.28 * s, 0.55 * s)
  const bead = new THREE.Mesh(new THREE.SphereGeometry(0.09 * s, 16, 16), glowMat(C.purple, 0.6))
  bead.position.set(0.55 * s, -0.62 * s, 0.55 * s)
  tassel.add(cord, bead)
  g.add(tassel)
  g.userData.tassel = tassel
  g.userData.bead = bead
  return g
}

/* Anima un arreglo de chispas: deriva vertical lenta, sin latido. */
function animateSparks(list, t, e) {
  for (const sp of list) {
    const d = sp.userData
    const ph = d.phase || 0
    sp.scale.setScalar(e)
    sp.position.y = (d.y0 || 0) + Math.sin(t * 0.5 + ph) * 0.07
  }
}

function addSparks(root, defs) {
  const list = []
  for (const def of defs) {
    const sp = spark(def.size || 0.16, def.color || C.purple)
    sp.userData.phase = def.phase || Math.random() * 6
    sp.userData.y0 = def.y
    sp.position.set(def.x, def.y, def.z)
    root.add(sp)
    list.push(sp)
  }
  return list
}

/* ====================================================================== */
/* HERO A — Medallón orbital de certificación                             */
/* ====================================================================== */
function heroMedallion(root) {
  root.position.y = 0.1
  const coin = new THREE.Group()
  const disc = new THREE.Mesh(new THREE.CylinderGeometry(1.55, 1.55, 0.42, 64), gradientMat({ clearcoat: 0.85, clearcoatRoughness: 0.15 }))
  disc.rotation.x = Math.PI / 2
  coin.add(disc)
  const ringFace = new THREE.Mesh(new THREE.TorusGeometry(1.3, 0.07, 16, 64), solidMat(C.white, { roughness: 0.3 }))
  ringFace.position.z = 0.22
  coin.add(ringFace)
  const ck = checkMark(solidMat(C.white, { roughness: 0.35 }), 1.35)
  ck.position.z = 0.24
  coin.add(ck)
  // cintas
  const ribbon = new THREE.Group()
  for (const sx of [-1, 1]) {
    const tail = slab(0.5, 1.5, 0.16, 0.08, gradientMat({}, C.purple, C.blue))
    tail.position.set(sx * 0.42, -2.0, 0)
    tail.rotation.z = sx * 0.18
    ribbon.add(tail)
  }
  ribbon.position.z = -0.1
  coin.add(ribbon)
  root.add(coin)

  // chips orbitando (nube, escudo, código)
  const chips = []
  const emblem = [
    () => new THREE.Mesh(new THREE.IcosahedronGeometry(0.34, 1), solidMat(C.blue, { roughness: 0.3 })), // nube/genérico
    () => shieldMesh(solidMat(C.purple, { roughness: 0.3 }), 0.6),
    () => codeGlyph(solidMat(C.blue, { roughness: 0.3 }), 0.8),
  ]
  for (let i = 0; i < 3; i++) {
    const chip = new THREE.Group()
    const card = slab(0.95, 0.95, 0.22, 0.18, solidMat(C.white, { roughness: 0.28 }))
    chip.add(card)
    const em = emblem[i]()
    em.position.z = 0.2
    chip.add(em)
    chip.userData = { a0: (i / 3) * Math.PI * 2, r: 2.7, ry: 0.35, speed: 0.16 }
    root.add(chip)
    chips.push(chip)
  }

  const sparks = addSparks(root, [
    { x: 2.1, y: 1.8, z: 0.5, size: 0.18, phase: 0 },
    { x: -2.4, y: 1.2, z: -0.3, size: 0.14, phase: 1.5 },
    { x: 2.0, y: -1.6, z: 0.2, size: 0.13, phase: 3 },
    { x: -1.9, y: -1.3, z: 0.6, size: 0.12, phase: 4.2 },
  ])

  return {
    update(t, e) {
      root.scale.setScalar(e)
      coin.rotation.y = Math.sin(t * 0.32) * 0.35 + 0.12
      coin.rotation.x = Math.sin(t * 0.45) * 0.06
      coin.position.y = Math.sin(t * 0.5) * 0.07
      chips.forEach((chip) => {
        const d = chip.userData
        const a = t * d.speed + d.a0
        // órbita inclinada: al cruzar por delante pasan por debajo del medallón
        chip.position.set(Math.cos(a) * d.r, -0.15 - Math.sin(a) * 0.95, Math.sin(a) * 1.5 - 0.2)
        chip.rotation.y = Math.sin(a) * 0.35
        const sc = 0.88 + 0.12 * Math.sin(a) // los del frente un pelín más grandes
        chip.scale.setScalar(sc * e)
      })
      animateSparks(sparks, t, e)
    },
  }
}

/* ====================================================================== */
/* HERO B — Ruta ascendente hacia el birrete                              */
/* ====================================================================== */
function heroPath(root) {
  root.position.y = -0.3
  root.rotation.x = 0.12
  const steps = []
  const pts = [
    { x: -2.2, y: -1.5, z: 0.4 },
    { x: -0.5, y: -0.55, z: -0.2 },
    { x: 1.2, y: 0.5, z: 0.3 },
  ]
  pts.forEach((p, i) => {
    const g = new THREE.Group()
    const plat = new THREE.Mesh(new THREE.CylinderGeometry(0.78, 0.92, 0.28, 6), gradientMat({}, C.blue, C.purple))
    g.add(plat)
    const top = new THREE.Mesh(new THREE.CylinderGeometry(0.62, 0.62, 0.06, 6), solidMat(C.white, { roughness: 0.3 }))
    top.position.y = 0.17
    g.add(top)
    if (i === 0) {
      const cb = checkBadge(null, C.good, 0.34)
      cb.position.y = 0.5
      g.add(cb)
      g.userData.node = cb
    } else {
      const node = new THREE.Mesh(new THREE.SphereGeometry(0.26, 24, 24), i === 1 ? glowMat(C.purple, 0.7) : solidMat(C.white, { roughness: 0.3 }))
      node.position.y = 0.5
      g.add(node)
      g.userData.node = node
    }
    g.position.set(p.x, p.y, p.z)
    g.userData.base = p.y
    g.userData.delay = i * 0.18
    root.add(g)
    steps.push(g)
  })

  // birrete sobre el último escalón
  const cap = gradCap(0.95)
  cap.position.set(pts[2].x, pts[2].y + 1.35, pts[2].z)
  root.add(cap)

  // camino punteado entre escalones
  const dots = []
  for (let i = 0; i < pts.length - 1; i++) {
    const a = pts[i]
    const b = pts[i + 1]
    for (let k = 1; k <= 4; k++) {
      const f = k / 5
      const dot = new THREE.Mesh(new THREE.SphereGeometry(0.08, 12, 12), glowMat(C.purple, 0.5))
      dot.position.set(a.x + (b.x - a.x) * f, a.y + (b.y - a.y) * f + 0.45, a.z + (b.z - a.z) * f)
      dot.userData.order = i * 4 + k
      root.add(dot)
      dots.push(dot)
    }
  }

  const sparks = addSparks(root, [
    { x: 2.3, y: 2.1, z: 0.4, size: 0.16, phase: 0 },
    { x: -2.6, y: 0.6, z: 0.2, size: 0.13, phase: 2 },
    { x: 1.9, y: -1.9, z: 0.5, size: 0.12, phase: 3.6 },
  ])

  return {
    update(t, e) {
      root.scale.setScalar(e)
      root.rotation.y = Math.sin(t * 0.45) * 0.32
      steps.forEach((g, i) => {
        const en = clamp01((e - g.userData.delay) / (1 - g.userData.delay))
        g.position.y = g.userData.base * (0.4 + 0.6 * easeOutCubic(en)) + Math.sin(t * 1.2 + i) * 0.08
        g.scale.setScalar(easeOutBack(en))
        if (g.userData.node && g.userData.node.material && g.userData.node.material.emissive) {
          g.userData.node.material.emissiveIntensity = 0.5 + 0.5 * (0.5 + 0.5 * Math.sin(t * 3 + i))
        }
      })
      cap.position.y = pts[2].y + 1.35 + Math.sin(t * 1.3) * 0.12
      cap.rotation.y = t * 0.6
      if (cap.userData.tassel) cap.userData.tassel.rotation.z = Math.sin(t * 1.6) * 0.25
      dots.forEach((dot) => {
        const pulse = 0.5 + 0.5 * Math.sin(t * 3 - dot.userData.order * 0.5)
        dot.material.emissiveIntensity = 0.3 + 0.7 * pulse
        dot.scale.setScalar((0.7 + 0.5 * pulse) * e)
      })
      animateSparks(sparks, t, e)
    },
  }
}

/* ====================================================================== */
/* CERTIFICACIONES — diploma + sello + fichas                             */
/* ====================================================================== */
function sceneCert(root) {
  const doc = new THREE.Group()
  const sheet = slab(3.0, 3.8, 0.16, 0.12, solidMat(C.white, { roughness: 0.32 }))
  doc.add(sheet)
  const title = slab(1.7, 0.32, 0.08, 0.08, gradientMat())
  title.position.set(-0.3, 1.25, 0.1)
  doc.add(title)
  const lineDefs = [
    [2.2, 0.7, C.sunken],
    [2.2, 0.4, C.sunken],
    [1.6, 0.1, C.sunken],
    [1.1, -0.55, C.line],
    [0.8, -0.85, C.line],
  ]
  lineDefs.forEach(([w, y, col]) => {
    const ln = slab(w, 0.13, 0.06, 0.05, solidMat(col, { roughness: 0.6, clearcoat: 0.1 }))
    ln.position.set(-1.5 + w / 2, y, 0.1)
    doc.add(ln)
  })
  doc.rotation.set(-0.12, 0.32, 0.04)
  root.add(doc)

  // sello con cinta
  const seal = new THREE.Group()
  const sdisc = new THREE.Mesh(new THREE.CylinderGeometry(0.62, 0.62, 0.22, 48), gradientMat({ clearcoat: 0.85 }))
  sdisc.rotation.x = Math.PI / 2
  seal.add(sdisc)
  const sck = checkMark(solidMat(C.white, { roughness: 0.35 }), 0.62)
  sck.position.z = 0.13
  seal.add(sck)
  for (const sx of [-1, 1]) {
    const tail = slab(0.26, 0.8, 0.1, 0.05, gradientMat({}, C.purple, C.blue))
    tail.position.set(sx * 0.22, -0.85, -0.05)
    tail.rotation.z = sx * 0.2
    seal.add(tail)
  }
  seal.position.set(1.0, -1.2, 0.5)
  root.add(seal)

  // fichas genéricas flotantes
  const tiles = []
  const mk = (emFn) => {
    const g = new THREE.Group()
    g.add(slab(0.8, 0.8, 0.2, 0.16, solidMat(C.white, { roughness: 0.28 })))
    const em = emFn()
    em.position.z = 0.18
    g.add(em)
    return g
  }
  const t1 = mk(() => new THREE.Mesh(new THREE.IcosahedronGeometry(0.27, 1), solidMat(C.blue, { roughness: 0.3 })))
  t1.position.set(-2.1, 1.4, 0.8)
  const t2 = mk(() => shieldMesh(solidMat(C.purple, { roughness: 0.3 }), 0.5))
  t2.position.set(2.0, 1.5, 0.6)
  const t3 = mk(() => codeGlyph(solidMat(C.blue, { roughness: 0.3 }), 0.65))
  t3.position.set(-2.2, -1.4, 0.6)
  ;[t1, t2, t3].forEach((tl, i) => {
    tl.userData.phase = i * 1.7
    tl.userData.y0 = tl.position.y
    root.add(tl)
    tiles.push(tl)
  })

  const sparks = addSparks(root, [
    { x: 2.4, y: -1.6, z: 0.6, size: 0.13, phase: 0.4 },
    { x: -2.5, y: 0.2, z: 0.3, size: 0.12, phase: 2.1 },
  ])

  return {
    update(t, e) {
      root.scale.setScalar(e)
      doc.rotation.y = 0.32 + Math.sin(t * 0.28) * 0.09
      doc.position.y = Math.sin(t * 0.5) * 0.05
      seal.rotation.y = Math.sin(t * 0.55) * 0.4
      seal.position.y = -1.2 + Math.sin(t * 0.5 + 1) * 0.05
      tiles.forEach((tl) => {
        tl.position.y = tl.userData.y0 + Math.sin(t * 0.6 + tl.userData.phase) * 0.06
        tl.rotation.y = Math.sin(t * 0.35 + tl.userData.phase) * 0.22
      })
      animateSparks(sparks, t, e)
    },
  }
}

/* ====================================================================== */
/* ESTUDIO — temario de lecciones que avanzan a tu ritmo                  */
/* ====================================================================== */
function sceneStudy(root) {
  root.rotation.x = 0.05
  root.position.x = 0.25
  const lerp = (a, b, k) => a + (b - a) * k
  const n = 3
  const baseY = [-1.3, 0.0, 1.3]
  const baseZ = [0.45, 0.0, -0.45]
  const cards = []

  for (let i = 0; i < n; i++) {
    const g = new THREE.Group()
    g.add(slab(2.7, 1.5, 0.16, 0.16, solidMat(C.white, { roughness: 0.3 })))
    // cabecera de tema (resalta cuando la lección está activa)
    const head = slab(1.35, 0.26, 0.08, 0.08, gradientMat())
    head.material.emissive = new THREE.Color(C.purple)
    head.material.emissiveIntensity = 0
    head.position.set(-0.5, 0.46, 0.1)
    g.add(head)
    // renglones de contenido
    ;[2.0, 2.0, 1.35].forEach((w, k) => {
      const ln = slab(w, 0.11, 0.05, 0.04, solidMat(C.sunken, { roughness: 0.7, clearcoat: 0 }))
      ln.position.set(-1.1 + w / 2, 0.04 - k * 0.34, 0.1)
      g.add(ln)
    })
    // check de completado
    const ck = checkBadge(null, C.good, 0.19)
    ck.position.set(1.02, 0.46, 0.16)
    ck.scale.setScalar(0.001)
    g.add(ck)
    g.position.set(0, baseY[i], baseZ[i])
    g.rotation.z = (i % 2 ? -1 : 1) * 0.025
    g.userData = { i, head, ck, baseZ: baseZ[i] }
    root.add(g)
    cards.push(g)
  }

  // riel de progreso lateral
  const rail = new THREE.Group()
  rail.add(slab(0.14, 3.2, 0.14, 0.07, solidMat(C.sunken, { roughness: 0.7, clearcoat: 0 })))
  const fill = new THREE.Mesh(roundedBox(0.14, 3.2, 0.14, 0.07).clone(), gradientMat({}, C.blue, C.purple, 90))
  fill.geometry.translate(0, 1.6, 0)
  fill.position.y = -1.6
  rail.add(fill)
  const dot = new THREE.Mesh(new THREE.SphereGeometry(0.17, 24, 24), glowMat(C.purple, 0.6))
  rail.add(dot)
  rail.position.set(-2.55, 0, 0.25)
  root.add(rail)

  const sparks = addSparks(root, [
    { x: 2.5, y: 1.7, z: 0.6, size: 0.14, phase: 0.4 },
    { x: 2.3, y: -1.5, z: 0.4, size: 0.12, phase: 2.6 },
  ])

  let prog = 0

  return {
    update(t, e) {
      root.scale.setScalar(e)
      root.rotation.y = Math.sin(t * 0.3) * 0.1
      root.position.y = Math.sin(t * 0.6) * 0.03
      const cycle = 2.8
      const active = Math.floor(t / cycle) % n
      cards.forEach((g) => {
        const isActive = g.userData.i === active
        const done = g.userData.i < active
        const s = lerp(g.scale.x, isActive ? 1.07 : 0.93, 0.12)
        g.scale.set(s, s, s)
        g.position.z = lerp(g.position.z, g.userData.baseZ + (isActive ? 0.45 : 0), 0.12)
        const hm = g.userData.head.material
        hm.emissiveIntensity = lerp(hm.emissiveIntensity, isActive ? 0.55 : 0, 0.12)
        const cs = lerp(g.userData.ck.scale.x, done ? 1 : 0.001, 0.18)
        g.userData.ck.scale.set(cs, cs, cs)
      })
      prog = lerp(prog, (active + 1) / n, 0.1)
      fill.scale.y = Math.max(0.001, prog)
      dot.position.y = -1.6 + prog * 3.2
      animateSparks(sparks, t, e)
    },
  }
}

/* ====================================================================== */
/* EXAMENES — tarjeta de pregunta + cronómetro                            */
/* ====================================================================== */
function sceneExam(root) {
  const card = new THREE.Group()
  card.add(slab(3.0, 3.4, 0.18, 0.16, solidMat(C.white, { roughness: 0.3 })))
  const head = slab(1.8, 0.26, 0.08, 0.06, gradientMat())
  head.position.set(-0.4, 1.32, 0.1)
  card.add(head)
  const sub = slab(2.3, 0.12, 0.06, 0.04, solidMat(C.sunken, { roughness: 0.6, clearcoat: 0 }))
  sub.position.set(-0.1, 0.95, 0.1)
  card.add(sub)

  const pills = []
  const yOff = [0.35, -0.35, -1.05]
  yOff.forEach((y, i) => {
    const correct = i === 0
    const pill = new THREE.Group()
    const body = slab(2.5, 0.6, 0.12, 0.18, solidMat(correct ? '#E7F7EE' : C.surface, { roughness: 0.45, clearcoat: 0.2 }))
    pill.add(body)
    const dot = correct
      ? checkBadge(null, C.good, 0.2)
      : new THREE.Mesh(new THREE.TorusGeometry(0.16, 0.05, 12, 24), solidMat(C.line, { roughness: 0.5 }))
    dot.position.set(-0.95, 0, 0.12)
    pill.add(dot)
    const txt = slab(correct ? 1.3 : 1.5, 0.1, 0.05, 0.03, solidMat(correct ? C.good : C.sunken, { roughness: 0.6, clearcoat: 0 }))
    txt.position.set(0.1, 0, 0.12)
    pill.add(txt)
    pill.position.set(0, y, 0.12)
    pill.userData = { correct, i }
    card.add(pill)
    pills.push(pill)
  })
  card.rotation.set(-0.08, 0.3, 0.02)
  root.add(card)

  // cronómetro
  const watch = new THREE.Group()
  const ring = new THREE.Mesh(new THREE.TorusGeometry(0.78, 0.12, 20, 48), solidMat(C.white, { roughness: 0.3 }))
  watch.add(ring)
  const arc = new THREE.Mesh(new THREE.TorusGeometry(0.78, 0.14, 20, 48, Math.PI * 1.4), gradientMat())
  arc.rotation.z = Math.PI / 2
  watch.add(arc)
  const crown = new THREE.Mesh(new THREE.CylinderGeometry(0.1, 0.1, 0.18, 12), solidMat(C.blue, { roughness: 0.35 }))
  crown.position.y = 0.92
  watch.add(crown)
  const hand = slab(0.07, 0.62, 0.07, 0.03, solidMat(C.ink, { roughness: 0.4 }))
  hand.geometry.translate(0, 0.31, 0)
  const handPivot = new THREE.Group()
  handPivot.add(hand)
  watch.add(handPivot)
  const hub = new THREE.Mesh(new THREE.SphereGeometry(0.1, 16, 16), gradientMat())
  watch.add(hub)
  watch.position.set(2.0, 1.5, 0.7)
  root.add(watch)

  const sparks = addSparks(root, [
    { x: -2.5, y: 1.2, z: 0.5, size: 0.13, phase: 0.3 },
    { x: 2.3, y: -1.6, z: 0.4, size: 0.12, phase: 2.6 },
  ])

  return {
    update(t, e) {
      root.scale.setScalar(e)
      card.rotation.y = 0.3 + Math.sin(t * 0.28) * 0.07
      card.position.y = Math.sin(t * 0.5) * 0.04
      // el cronómetro avanza a tics, como uno real
      const tickN = Math.floor(t)
      const frac = easeOutCubic(Math.min(1, (t - tickN) * 6))
      handPivot.rotation.z = -(tickN + frac) * (Math.PI / 6)
      watch.rotation.y = Math.sin(t * 0.35) * 0.12
      watch.position.y = 1.5 + Math.sin(t * 0.55 + 1) * 0.06
      animateSparks(sparks, t, e)
    },
  }
}

/* ====================================================================== */
/* ENTREVISTAS — editor de código + glifo + badge de tests                */
/* ====================================================================== */
function sceneInterview(root) {
  const editor = new THREE.Group()
  editor.add(slab(3.6, 2.6, 0.18, 0.14, solidMat(C.white, { roughness: 0.3 })))
  const bar = slab(3.6, 0.5, 0.04, 0.14, solidMat(C.surface, { roughness: 0.5 }))
  bar.position.set(0, 1.05, 0.1)
  editor.add(bar)
  const dotsCols = [C.bad, C.warn, C.good]
  dotsCols.forEach((col, i) => {
    const d = new THREE.Mesh(new THREE.SphereGeometry(0.09, 16, 16), solidMat(col, { roughness: 0.35 }))
    d.position.set(-1.5 + i * 0.28, 1.05, 0.14)
    editor.add(d)
  })
  // líneas de código
  const code = [
    [-1.3, 0.55, 0.8, C.blue],
    [-0.2, 0.55, 1.0, C.faint],
    [-1.0, 0.2, 1.0, C.purple],
    [0.4, 0.2, 1.2, C.sunken],
    [-1.0, -0.15, 1.4, C.sunken],
    [-1.3, -0.5, 0.7, C.good],
    [-0.4, -0.5, 1.1, C.sunken],
  ]
  const codeLines = []
  code.forEach(([x, y, w, col], i) => {
    const geo = roundedBox(w, 0.12, 0.05, 0.04).clone()
    geo.translate(w / 2, 0, 0)
    const ln = new THREE.Mesh(geo, solidMat(col, { roughness: 0.6 }))
    ln.position.set(x - w / 2, y, 0.12)
    ln.userData.order = i
    editor.add(ln)
    codeLines.push(ln)
  })
  editor.rotation.set(-0.07, 0.28, 0.02)
  root.add(editor)

  // glifo </>
  const glyph = codeGlyph(gradientMat(), 1.4)
  glyph.position.set(2.1, 1.3, 0.7)
  root.add(glyph)

  // badge de tests aprobados
  const badge = new THREE.Group()
  badge.add(slab(1.7, 0.7, 0.14, 0.18, solidMat(C.white, { roughness: 0.28 })))
  const bb = checkBadge(null, C.good, 0.24)
  bb.position.set(-0.5, 0, 0.12)
  badge.add(bb)
  const bt = slab(0.8, 0.1, 0.05, 0.03, solidMat(C.good, { roughness: 0.6, clearcoat: 0 }))
  bt.position.set(0.25, 0, 0.12)
  badge.add(bt)
  badge.position.set(1.4, -1.45, 0.9)
  root.add(badge)

  const sparks = addSparks(root, [
    { x: -2.6, y: 0.4, z: 0.5, size: 0.13, phase: 1.1 },
    { x: 2.5, y: -1.7, z: 0.4, size: 0.12, phase: 3.2 },
  ])

  return {
    update(t, e) {
      root.scale.setScalar(e)
      editor.rotation.y = 0.28 + Math.sin(t * 0.28) * 0.06
      editor.position.y = Math.sin(t * 0.5) * 0.04
      // las líneas de código se escriben al entrar, en orden
      codeLines.forEach((ln) => {
        const k = seg(e, 0.12 + ln.userData.order * 0.1, 0.42 + ln.userData.order * 0.1)
        ln.scale.x = Math.max(0.001, easeOutCubic(k))
      })
      glyph.rotation.y = Math.sin(t * 0.45) * 0.4
      glyph.position.y = 1.3 + Math.sin(t * 0.55) * 0.07
      badge.rotation.z = Math.sin(t * 0.5) * 0.04
      badge.position.y = -1.45 + Math.sin(t * 0.5 + 0.5) * 0.05
      animateSparks(sparks, t, e)
    },
  }
}

/* ====================================================================== */
/* PROGRESO — medidor radial + barras que suben + insignia                */
/* ====================================================================== */
function sceneProgress(root) {
  const pct = 0.72
  const panel = new THREE.Group()

  // medidor
  const gauge = new THREE.Group()
  const track = new THREE.Mesh(new THREE.TorusGeometry(1.15, 0.16, 24, 64), solidMat(C.sunken, { roughness: 0.6, clearcoat: 0.1 }))
  gauge.add(track)
  const arc = new THREE.Mesh(new THREE.TorusGeometry(1.15, 0.2, 24, 80, Math.PI * 2 * pct), gradientMat({ clearcoat: 0.8 }))
  gauge.add(arc)
  const knob = new THREE.Mesh(new THREE.SphereGeometry(0.22, 24, 24), glowMat(C.purple, 0.5))
  gauge.add(knob)
  gauge.rotation.z = Math.PI / 2 + Math.PI * 2 * pct * 0 // arranque
  gauge.position.set(-1.4, 0, 0)
  panel.add(gauge)

  // barras que suben
  const bars = []
  const heights = [1.0, 1.6, 2.2, 2.9]
  heights.forEach((h, i) => {
    const bar = new THREE.Mesh(roundedBox(0.55, h, 0.55, 0.12), gradientMat({}, C.blue, C.purple, 90))
    bar.geometry.translate(0, h / 2, 0)
    bar.position.set(0.9 + i * 0.75, -1.3, 0)
    bar.userData = { h, delay: i * 0.12 }
    panel.add(bar)
    bars.push(bar)
  })
  root.add(panel)

  // insignia "listo"
  const badge = checkBadge(null, C.good, 0.4)
  badge.position.set(2.6, 1.7, 0.6)
  root.add(badge)

  const sparks = addSparks(root, [
    { x: -2.7, y: 1.6, z: 0.4, size: 0.13, phase: 0.5 },
    { x: 2.4, y: -1.7, z: 0.5, size: 0.12, phase: 2.3 },
  ])

  return {
    update(t, e) {
      root.scale.setScalar(e)
      panel.rotation.y = Math.sin(t * 0.28) * 0.08
      panel.position.y = Math.sin(t * 0.5) * 0.04
      // entrada del arco: gira hacia su posición
      const ge = easeOutCubic(clamp01(e))
      gauge.rotation.z = Math.PI / 2 + (1 - ge) * Math.PI * 2 * pct * 0.5
      gauge.rotation.y = Math.sin(t * 0.4) * 0.06
      // perilla al final del arco
      const ang = Math.PI / 2 + Math.PI * 2 * pct
      knob.position.set(Math.cos(ang) * 1.15, Math.sin(ang) * 1.15, 0)
      bars.forEach((bar) => {
        const en = clamp01((e - bar.userData.delay) / (1 - bar.userData.delay))
        bar.scale.y = Math.max(0.001, easeOutCubic(en))
      })
      badge.rotation.y = Math.sin(t * 0.45) * 0.3
      badge.position.y = 1.7 + Math.sin(t * 0.55) * 0.06
      animateSparks(sparks, t, e)
    },
  }
}

/* ---- registro --------------------------------------------------------- */
export const SCENES = {
  heroMedallion,
  heroPath,
  certificaciones: sceneCert,
  estudio: sceneStudy,
  examenes: sceneExam,
  entrevistas: sceneInterview,
  progreso: sceneProgress,
}
