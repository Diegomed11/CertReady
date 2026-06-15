'use client'

import { useEffect, useRef } from 'react'

import { ShaderField } from '@/components/ui/hero-shader'
import '@/app/landing.css'

/**
 * Landing — portada de CertReady. Recreación fiel del diseño entregado en Claude
 * Design ("CertReady Landing.html"): fondo CSS mesh-gradient, marca centrada,
 * titular gooey (Aprende → Practica → Certifícate), botones con glow que sigue al
 * cursor, 5 secciones con ilustraciones SVG animadas que se revelan al hacer
 * scroll, cierre con efecto "decode" y marquee de tecnologías.
 *
 * Es login-aware: recibe del server a dónde enrutar según la sesión.
 */
export function Landing({
  ctaHref,
  accesoHref,
  accesoText,
}: {
  ctaHref: string
  accesoHref: string
  accesoText: string
}) {
  const rootRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    const root = rootRef.current
    if (!root) return
    const reduce =
      typeof window.matchMedia === 'function' &&
      window.matchMedia('(prefers-reduced-motion: reduce)').matches
    const cleanups: Array<() => void> = []

    // 1) Titular gooey: morphing entre palabras con desenfoque pegajoso.
    ;(() => {
      const texts = ['Aprende', 'Practica', 'Certifícate']
      const t1 = document.getElementById('gooey1')
      const t2 = document.getElementById('gooey2')
      if (!t1 || !t2) return
      if (reduce) {
        t1.textContent = texts[0] ?? ''
        t1.style.opacity = '100%'
        return
      }
      const morphTime = 1
      const cooldownTime = 0.6
      let textIndex = texts.length - 1
      let time = new Date()
      let morph = 0
      let cooldown = cooldownTime
      let raf = 0
      t1.textContent = texts[textIndex % texts.length] ?? ''
      t2.textContent = texts[(textIndex + 1) % texts.length] ?? ''
      const setMorph = (fraction: number) => {
        t2.style.filter = 'blur(' + Math.min(8 / fraction - 8, 100) + 'px)'
        t2.style.opacity = Math.pow(fraction, 0.4) * 100 + '%'
        const inv = 1 - fraction
        t1.style.filter = 'blur(' + Math.min(8 / inv - 8, 100) + 'px)'
        t1.style.opacity = Math.pow(inv, 0.4) * 100 + '%'
      }
      const doCooldown = () => {
        morph = 0
        t2.style.filter = ''
        t2.style.opacity = '100%'
        t1.style.filter = ''
        t1.style.opacity = '0%'
      }
      const doMorph = () => {
        morph -= cooldown
        cooldown = 0
        let fraction = morph / morphTime
        if (fraction > 1) {
          cooldown = cooldownTime
          fraction = 1
        }
        setMorph(fraction)
      }
      const animate = () => {
        raf = requestAnimationFrame(animate)
        const newTime = new Date()
        const shouldIncrement = cooldown > 0
        const dt = (newTime.getTime() - time.getTime()) / 1000
        time = newTime
        cooldown -= dt
        if (cooldown <= 0) {
          if (shouldIncrement) {
            textIndex = (textIndex + 1) % texts.length
            t1.textContent = texts[textIndex % texts.length] ?? ''
            t2.textContent = texts[(textIndex + 1) % texts.length] ?? ''
          }
          doMorph()
        } else {
          doCooldown()
        }
      }
      animate()
      cleanups.push(() => cancelAnimationFrame(raf))
    })()

    // 2) Glow que sigue al cursor (variables en :root).
    ;(() => {
      const docEl = document.documentElement
      const move = (e: PointerEvent) => {
        docEl.style.setProperty('--x', e.clientX.toFixed(1))
        docEl.style.setProperty('--y', e.clientY.toFixed(1))
        docEl.style.setProperty('--xp', (e.clientX / window.innerWidth).toFixed(3))
      }
      window.addEventListener('pointermove', move, { passive: true })
      docEl.style.setProperty('--x', (window.innerWidth / 2).toFixed(1))
      docEl.style.setProperty('--y', (window.innerHeight / 2).toFixed(1))
      docEl.style.setProperty('--xp', '0.5')
      cleanups.push(() => window.removeEventListener('pointermove', move))
    })()

    // 3) Scroll reveal: revelar bloques de uno en uno.
    ;(() => {
      const els = Array.prototype.slice.call(
        root.querySelectorAll('.feature,.cta-inner'),
      ) as HTMLElement[]
      const check = () => {
        const vh = window.innerHeight || document.documentElement.clientHeight
        for (const el of els) {
          if (el.classList.contains('in')) continue
          const r = el.getBoundingClientRect()
          if (r.top < vh * 0.84 && r.bottom > 0) el.classList.add('in')
        }
      }
      window.addEventListener('scroll', check, { passive: true })
      window.addEventListener('resize', check)
      document.addEventListener('scroll', check, { passive: true })
      check()
      requestAnimationFrame(check)
      cleanups.push(() => {
        window.removeEventListener('scroll', check)
        window.removeEventListener('resize', check)
        document.removeEventListener('scroll', check)
      })
    })()

    // 4) Ensamblado por carácter de los títulos de sección al hacer scroll.
    ;(() => {
      const titles = Array.prototype.slice.call(
        root.querySelectorAll('.feature-title'),
      ) as HTMLElement[]
      if (!titles.length) return
      const groups = titles.map((t) => {
        const txt = t.dataset.orig ?? (t.dataset.orig = t.textContent || '')
        t.textContent = ''
        t.style.perspective = '600px'
        const totalChars = txt.replace(/ /g, '').length
        const words = txt.split(' ')
        const chs: HTMLElement[] = []
        let gi = 0
        words.forEach((word, wi) => {
          const w = document.createElement('span')
          w.style.display = 'inline-block'
          w.style.whiteSpace = 'nowrap'
          for (const chr of word) {
            const s = document.createElement('span')
            s.className = 'ch'
            s.textContent = chr
            s.style.display = 'inline-block'
            s.style.willChange = 'transform,opacity'
            const hue = 228 + (gi / Math.max(1, totalChars)) * 72
            s.style.color = 'hsl(' + hue + ',80%,72%)'
            w.appendChild(s)
            chs.push(s)
            gi++
          }
          t.appendChild(w)
          if (wi < words.length - 1) {
            const sp = document.createElement('span')
            sp.style.display = 'inline-block'
            sp.style.width = '0.28em'
            t.appendChild(sp)
          }
        })
        return { el: t, chs, center: (chs.length - 1) / 2 }
      })
      const update = () => {
        const vh = window.innerHeight || document.documentElement.clientHeight
        for (const grp of groups) {
          const rect = grp.el.getBoundingClientRect()
          const prog = Math.min(1, Math.max(0, (vh * 0.86 - rect.top) / (vh * 0.42)))
          const c = reduce ? 0 : 1 - prog
          grp.chs.forEach((ch, i) => {
            const dist = i - grp.center
            ch.style.transform =
              'translateX(' + dist * 26 * c + 'px) rotateX(' + dist * 16 * c + 'deg)'
            ch.style.opacity = (1 - 0.6 * c).toFixed(3)
          })
        }
      }
      window.addEventListener('scroll', update, { passive: true })
      window.addEventListener('resize', update)
      update()
      requestAnimationFrame(update)
      cleanups.push(() => {
        window.removeEventListener('scroll', update)
        window.removeEventListener('resize', update)
      })
    })()

    // 5) Efecto "decode" del título de cierre.
    ;(() => {
      const el = document.getElementById('cta-decode')
      if (!el) return
      const text = el.getAttribute('data-text') || el.textContent || ''
      if (reduce) {
        el.textContent = text
        return
      }
      const RAND = '_!X$0-+*#'
      const rnd = (prev?: string) => {
        let c = ''
        do {
          c = RAND[Math.floor(Math.random() * RAND.length)] ?? '#'
        } while (c === prev)
        return c
      }
      let started = false
      let timer: ReturnType<typeof setInterval> | null = null
      const run = () => {
        let phase = 1
        let step = 0
        const tick = () => {
          const chars: string[] = []
          let i
          if (phase === 1) {
            const maxSteps = text.length * 2
            const curLen = Math.min(step + 1, text.length)
            for (i = 0; i < curLen; i++) chars.push(rnd(i > 0 ? chars[i - 1] : undefined))
            for (i = curLen; i < text.length; i++) chars.push(' ')
            el.textContent = chars.join('')
            if (step < maxSteps - 1) step++
            else {
              phase = 2
              step = 0
            }
          } else {
            const revealed = Math.floor(step / 2)
            for (i = 0; i < revealed && i < text.length; i++)
              chars.push(text[i] ?? '')
            if (revealed < text.length) chars.push(step % 2 === 0 ? '_' : rnd())
            for (i = chars.length; i < text.length; i++) chars.push(rnd())
            el.textContent = chars.join('')
            if (step < text.length * 2 - 1) step++
            else {
              el.textContent = text
              if (timer) clearInterval(timer)
            }
          }
        }
        timer = setInterval(tick, 30)
      }
      const maybe = () => {
        if (started) return
        const r = el.getBoundingClientRect()
        const vh = window.innerHeight || document.documentElement.clientHeight
        if (r.top < vh * 0.86 && r.bottom > 0) {
          started = true
          run()
        }
      }
      window.addEventListener('scroll', maybe, { passive: true })
      window.addEventListener('resize', maybe)
      maybe()
      cleanups.push(() => {
        window.removeEventListener('scroll', maybe)
        window.removeEventListener('resize', maybe)
        if (timer) clearInterval(timer)
      })
    })()

    // 6) Marquee de tecnologías (logos vía simple-icons CDN).
    ;(() => {
      const track = document.getElementById('tech-track')
      if (!track) return
      const techs = [
        { name: 'Next.js', slug: 'nextdotjs' },
        { name: 'AWS', slug: 'amazonwebservices' },
        { name: 'TypeScript', slug: 'typescript' },
        { name: 'Tailwind CSS', slug: 'tailwindcss' },
        { name: 'Go', slug: 'go' },
        { name: 'Python', slug: 'python' },
        { name: 'Flutter', slug: 'flutter' },
        { name: 'PostgreSQL', slug: 'postgresql' },
        { name: 'MongoDB', slug: 'mongodb' },
        { name: 'Docker', slug: 'docker' },
        { name: 'Terraform', slug: 'terraform' },
      ]
      const item = (t: { name: string; slug: string }) =>
        '<div class="tech"><img src="https://cdn.jsdelivr.net/npm/simple-icons@v13/icons/' +
        t.slug +
        '.svg" alt="" loading="lazy"/><span>' +
        t.name +
        '</span></div>'
      const html = techs.map(item).join('')
      track.innerHTML = html + html
    })()

    return () => {
      cleanups.forEach((fn) => fn())
    }
  }, [])

  return (
    <div ref={rootRef} className="cr-landing reveal-on">
      <div className="bg" aria-hidden="true">
        <ShaderField />
        <div className="veil1"></div>
        <div className="veil2"></div>
      </div>

      <section className="hero">
        <header className="topbar">
          <span className="nav-spacer"></span>
          <a href="#" className="brand" aria-label="CertReady">
            {/* Logo propio de CertReady (escudo), fondo transparente */}
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src="/certready-logo.png" alt="" className="brand-logo" />
            <span className="brand-name">
              <span className="brand-cert">Cert</span>
              <span className="brand-ready">Ready</span>
            </span>
          </a>
          <div className="brand-right">
            <a href={accesoHref} className="access-pill glow-btn">
              {accesoText}
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" aria-hidden="true">
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth="2.2"
                  d="M7 17L17 7M17 7H7M17 7V17"
                />
              </svg>
            </a>
          </div>
        </header>

        <div className="hero-body">
          <div className="hero-inner">
            <h1
              className="hero-title gooey-head"
              aria-label="Aprende, practica, certifícate"
              dangerouslySetInnerHTML={{ __html: HERO_TITLE_INNER }}
            />
            <p className="hero-desc">
              {
                'CertReady es una plataforma academica que ayuda a certificarte e impulsar tu carrera profesional\nEstudia a tu ritmo, simula el examen real con simulacros cronometrados y practica entrevistas de código'
              }
            </p>
            <div className="hero-ctas">
              <a href={ctaHref} className="cta-solid glow-btn">
                Empieza ahora
              </a>
              <a href="#funciones" className="cta-outline glow-btn">
                Ver funciones
              </a>
            </div>
          </div>
        </div>

        <div className="scroll-ind">
          <svg
            className="animate-bob"
            width="20"
            height="20"
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth="2"
              d="M19 14l-7 7m0 0l-7-7m7 7V3"
            />
          </svg>
        </div>
      </section>

      <main>
        <section id="funciones" className="section-features">
          <div className="cr-container">
            <div className="features-wrap">
              {FEATURES.map((f) => (
                <div className="feature" key={f.label}>
                  <div className={'feature-text' + (f.mediaLeft ? ' order2' : '')}>
                    <span className="section-label">{f.label}</span>
                    <h2 className="feature-title text-gradient-brand">{f.title}</h2>
                    <p className="feature-desc">{f.desc}</p>
                    <ul className="bullets">
                      {f.bullets.map((b) => (
                        <li className="bullet" key={b}>
                          <span className="bullet-check">✓</span>
                          <span>{b}</span>
                        </li>
                      ))}
                    </ul>
                  </div>
                  <div className={'feature-media' + (f.mediaLeft ? ' order1' : '')}>
                    <div
                      className="media-frame"
                      dangerouslySetInnerHTML={{ __html: f.svg }}
                    />
                  </div>
                </div>
              ))}
            </div>
          </div>
        </section>

        <section className="section-cta">
          <div className="cr-container">
            <div className="cta-inner">
              <h2
                className="cta-h2 cta-decode"
                id="cta-decode"
                data-text="¿Listo para empezar?"
              >
                ¿Listo para empezar?
              </h2>
              <p className="cta-p">Crea tu cuenta y empieza a prepararte hoy mismo.</p>
              <div className="cta-btn-wrap">
                <a href={ctaHref} className="btn-chunky glow-btn">
                  Empieza ahora
                </a>
              </div>
            </div>
          </div>
        </section>
      </main>

      <section className="techstrip">
        <div className="marquee">
          <div className="marquee-track" id="tech-track"></div>
        </div>
      </section>

      <footer className="footer">
        <div className="cr-container">
          <div className="footer-inner">
            <span className="footer-mark">CertReady</span>
            <p className="footer-legal">
              {
                'CertReady no está afiliada, avalada ni patrocinada por AWS, Microsoft, Google u otros\nDesarrollada por GOdevs'
              }
            </p>
          </div>
        </div>
      </footer>
    </div>
  )
}

const HERO_TITLE_INNER = `
<svg class="gooey-defs" aria-hidden="true" focusable="false"><defs><filter id="threshold"><feColorMatrix in="SourceGraphic" type="matrix" values="1 0 0 0 0  0 1 0 0 0  0 0 1 0 0  0 0 0 255 -140"/></filter></defs></svg>
<span class="gooey-inner"><span id="gooey1" class="text-gradient-brand"></span><span id="gooey2" class="text-gradient-brand"></span></span>`

const SVG_CERT = `<svg viewBox="0 0 480 360" class="il-svg" role="img" aria-label="Certificaciones"><defs>
<linearGradient id="cert-g" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#4B5BF0"/><stop offset="1" stop-color="#9C8CFA"/></linearGradient>
<radialGradient id="cert-glow" cx="0.5" cy="0.5" r="0.5"><stop offset="0" stop-color="#9C8CFA" stop-opacity="0.30"/><stop offset="1" stop-color="#9C8CFA" stop-opacity="0"/></radialGradient>
<filter id="cert-sh" x="-25%" y="-25%" width="150%" height="150%"><feDropShadow dx="0" dy="8" stdDeviation="11" flood-color="#3839B0" flood-opacity="0.16"/></filter>
</defs>
<ellipse cx="240" cy="180" rx="220" ry="150" fill="url(#cert-glow)"/>
<g class="il-float" filter="url(#cert-sh)">
<rect x="118" y="58" width="244" height="206" rx="20" fill="#FFFFFF" stroke="#CDD0E6" stroke-width="2"/>
<rect x="146" y="86" width="120" height="14" rx="7" fill="url(#cert-g)"/>
<rect x="146" y="116" width="188" height="9" rx="4.5" fill="#EEF0FA"/>
<rect x="146" y="134" width="188" height="9" rx="4.5" fill="#EEF0FA"/>
<rect x="146" y="152" width="140" height="9" rx="4.5" fill="#EEF0FA"/>
<rect x="146" y="186" width="92" height="9" rx="4.5" fill="#E4E6F3"/>
<rect x="146" y="204" width="70" height="9" rx="4.5" fill="#E4E6F3"/></g>
<g class="il-float" style="animation-delay:0.4s">
<path d="M300 250 L312 232 L326 248 L326 296 L312 282 L298 296 Z" fill="#9C8CFA"/>
<g filter="url(#cert-sh)"><circle cx="312" cy="232" r="34" fill="url(#cert-g)"/><circle cx="312" cy="232" r="34" fill="none" stroke="#FFFFFF" stroke-width="2.5" opacity="0.5"/></g>
<path d="M300 232 l8 8 l16 -18" fill="none" stroke="#FFFFFF" stroke-width="4" stroke-linecap="round" stroke-linejoin="round"/></g>
<g class="il-float" style="animation-delay:0.2s" filter="url(#cert-sh)">
<rect x="44" y="120" width="58" height="58" rx="16" fill="#FFFFFF" stroke="#CDD0E6" stroke-width="2"/>
<path d="M62 152 a10 10 0 0 1 10 -10 a12 12 0 0 1 22 4 a8 8 0 0 1 -2 16 h-22 a9 9 0 0 1 -8 -10 Z" fill="url(#cert-g)"/></g>
<g class="il-float" style="animation-delay:0.55s" filter="url(#cert-sh)">
<rect x="386" y="92" width="56" height="56" rx="16" fill="#FFFFFF" stroke="#CDD0E6" stroke-width="2"/>
<path d="M414 104 l16 6 v12 c0 11 -8 18 -16 22 c-8 -4 -16 -11 -16 -22 v-12 Z" fill="#4B5BF0" opacity="0.92"/></g>
<g class="il-float" style="animation-delay:0.75s" filter="url(#cert-sh)">
<rect x="392" y="210" width="56" height="56" rx="16" fill="#FFFFFF" stroke="#CDD0E6" stroke-width="2"/>
<path d="M412 226 l-8 12 l8 12 M428 226 l8 12 l-8 12" fill="none" stroke="#9C8CFA" stroke-width="4" stroke-linecap="round" stroke-linejoin="round"/></g>
<path class="il-pulse" style="animation-delay:0.2s" transform="translate(92 70)" d="M0 -7 L 2.24 -2.24 L 7 0 L 2.24 2.24 L 0 7 L -2.24 2.24 L -7 0 L -2.24 -2.24 Z" fill="#9C8CFA"/><path class="il-pulse" style="animation-delay:0.9s" transform="translate(430 300)" d="M0 -6 L 1.92 -1.92 L 6 0 L 1.92 1.92 L 0 6 L -1.92 1.92 L -6 0 L -1.92 -1.92 Z" fill="#9C8CFA"/><path class="il-pulse" style="animation-delay:1.2s" transform="translate(56 250)" d="M0 -6 L 1.92 -1.92 L 6 0 L 1.92 1.92 L 0 6 L -1.92 1.92 L -6 0 L -1.92 -1.92 Z" fill="#9C8CFA"/></svg>`

const SVG_STUDY = `<svg viewBox="0 0 480 360" class="il-svg" role="img" aria-label="Estudio"><defs>
<linearGradient id="study-g" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#4B5BF0"/><stop offset="1" stop-color="#9C8CFA"/></linearGradient>
<radialGradient id="study-glow" cx="0.5" cy="0.5" r="0.5"><stop offset="0" stop-color="#9C8CFA" stop-opacity="0.30"/><stop offset="1" stop-color="#9C8CFA" stop-opacity="0"/></radialGradient>
<filter id="study-sh" x="-25%" y="-25%" width="150%" height="150%"><feDropShadow dx="0" dy="8" stdDeviation="11" flood-color="#3839B0" flood-opacity="0.16"/></filter>
</defs>
<ellipse cx="240" cy="180" rx="220" ry="150" fill="url(#study-glow)"/>
<g class="il-float" filter="url(#study-sh)">
<path d="M240 96 C 200 78 150 76 110 88 L110 256 C 150 244 200 246 240 264 Z" fill="#FFFFFF" stroke="#CDD0E6" stroke-width="2"/>
<path d="M240 96 C 280 78 330 76 370 88 L370 256 C 330 244 280 246 240 264 Z" fill="#FFFFFF" stroke="#CDD0E6" stroke-width="2"/>
<path d="M240 96 L240 264" stroke="#E4E6F3" stroke-width="3"/>
<rect x="132" y="116" width="86" height="8" rx="4" fill="url(#study-g)"/>
<rect x="132" y="136" width="92" height="7" rx="3.5" fill="#EEF0FA"/>
<rect x="132" y="152" width="92" height="7" rx="3.5" fill="#EEF0FA"/>
<rect x="132" y="168" width="70" height="7" rx="3.5" fill="#EEF0FA"/>
<rect x="262" y="116" width="86" height="8" rx="4" fill="#9C8CFA" opacity="0.85"/>
<rect x="262" y="136" width="92" height="7" rx="3.5" fill="#EEF0FA"/>
<rect x="262" y="152" width="92" height="7" rx="3.5" fill="#EEF0FA"/>
<rect x="262" y="168" width="62" height="7" rx="3.5" fill="#EEF0FA"/></g>
<g class="il-float" style="animation-delay:0.5s"><path d="M318 76 L350 76 L350 134 L334 120 L318 134 Z" fill="url(#study-g)"/></g>
<g class="il-float" style="animation-delay:0.3s" filter="url(#study-sh)"><g transform="rotate(40 150 280)">
<rect x="120" y="270" width="86" height="20" rx="6" fill="#EAA834"/>
<path d="M206 270 l22 10 l-22 10 Z" fill="#1C1B29"/>
<rect x="120" y="270" width="14" height="20" rx="6" fill="#4B5BF0"/></g></g>
<path class="il-pulse" style="animation-delay:0.1s" transform="translate(392 120)" d="M0 -8 L 2.56 -2.56 L 8 0 L 2.56 2.56 L 0 8 L -2.56 2.56 L -8 0 L -2.56 -2.56 Z" fill="#9C8CFA"/><path class="il-pulse" style="animation-delay:0.7s" transform="translate(96 96)" d="M0 -6 L 1.92 -1.92 L 6 0 L 1.92 1.92 L 0 6 L -1.92 1.92 L -6 0 L -1.92 -1.92 Z" fill="#9C8CFA"/><path class="il-pulse" style="animation-delay:1.1s" transform="translate(408 250)" d="M0 -6 L 1.92 -1.92 L 6 0 L 1.92 1.92 L 0 6 L -1.92 1.92 L -6 0 L -1.92 -1.92 Z" fill="#9C8CFA"/></svg>`

const SVG_EXAM = `<svg viewBox="0 0 480 360" class="il-svg" role="img" aria-label="Exámenes"><defs>
<linearGradient id="exam-g" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#4B5BF0"/><stop offset="1" stop-color="#9C8CFA"/></linearGradient>
<radialGradient id="exam-glow" cx="0.5" cy="0.5" r="0.5"><stop offset="0" stop-color="#9C8CFA" stop-opacity="0.30"/><stop offset="1" stop-color="#9C8CFA" stop-opacity="0"/></radialGradient>
<filter id="exam-sh" x="-25%" y="-25%" width="150%" height="150%"><feDropShadow dx="0" dy="8" stdDeviation="11" flood-color="#3839B0" flood-opacity="0.16"/></filter>
</defs>
<ellipse cx="240" cy="180" rx="220" ry="150" fill="url(#exam-glow)"/>
<g class="il-float" filter="url(#exam-sh)">
<rect x="96" y="64" width="232" height="232" rx="22" fill="#FFFFFF" stroke="#CDD0E6" stroke-width="2"/>
<rect x="120" y="90" width="150" height="12" rx="6" fill="url(#exam-g)"/>
<rect x="120" y="110" width="184" height="9" rx="4.5" fill="#EEF0FA"/>
<rect x="120" y="142" width="184" height="38" rx="12" fill="#EAF7F0" stroke="#22AF6E" stroke-width="2"/>
<circle cx="142" cy="161" r="11" fill="#22AF6E"/>
<path d="M137 161 l4 4 l7 -8" fill="none" stroke="#FFFFFF" stroke-width="3" stroke-linecap="round" stroke-linejoin="round"/>
<rect x="162" y="156" width="110" height="10" rx="5" fill="#22AF6E" opacity="0.7"/>
<rect x="120" y="190" width="184" height="38" rx="12" fill="#F7F8FD" stroke="#E4E6F3" stroke-width="2"/>
<circle cx="142" cy="209" r="11" fill="#FFFFFF" stroke="#CDD0E6" stroke-width="2"/>
<rect x="162" y="204" width="120" height="10" rx="5" fill="#EEF0FA"/>
<rect x="120" y="238" width="184" height="38" rx="12" fill="#F7F8FD" stroke="#E4E6F3" stroke-width="2"/>
<circle cx="142" cy="257" r="11" fill="#FFFFFF" stroke="#CDD0E6" stroke-width="2"/>
<rect x="162" y="252" width="96" height="10" rx="5" fill="#EEF0FA"/></g>
<g class="il-float" style="animation-delay:0.45s">
<g filter="url(#exam-sh)"><circle cx="350" cy="118" r="46" fill="#FFFFFF" stroke="#CDD0E6" stroke-width="2"/></g>
<circle cx="350" cy="118" r="46" fill="none" stroke="url(#exam-g)" stroke-width="8" stroke-linecap="round" stroke-dasharray="289" stroke-dashoffset="96" transform="rotate(-90 350 118)"/>
<rect x="338" y="62" width="24" height="9" rx="4.5" fill="#4B5BF0"/>
<path d="M350 118 L350 96 M350 118 L368 126" stroke="#1C1B29" stroke-width="4" stroke-linecap="round"/>
<circle cx="350" cy="118" r="5" fill="#4B5BF0"/></g>
<path class="il-pulse" style="animation-delay:0.3s" transform="translate(392 210)" d="M0 -8 L 2.56 -2.56 L 8 0 L 2.56 2.56 L 0 8 L -2.56 2.56 L -8 0 L -2.56 -2.56 Z" fill="#9C8CFA"/><path class="il-pulse" style="animation-delay:0.9s" transform="translate(92 104)" d="M0 -6 L 1.92 -1.92 L 6 0 L 1.92 1.92 L 0 6 L -1.92 1.92 L -6 0 L -1.92 -1.92 Z" fill="#9C8CFA"/><path class="il-pulse" style="animation-delay:1.2s" transform="translate(310 300)" d="M0 -6 L 1.92 -1.92 L 6 0 L 1.92 1.92 L 0 6 L -1.92 1.92 L -6 0 L -1.92 -1.92 Z" fill="#9C8CFA"/></svg>`

const SVG_INTV = `<svg viewBox="0 0 480 360" class="il-svg" role="img" aria-label="Entrevistas"><defs>
<linearGradient id="intv-g" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#4B5BF0"/><stop offset="1" stop-color="#9C8CFA"/></linearGradient>
<radialGradient id="intv-glow" cx="0.5" cy="0.5" r="0.5"><stop offset="0" stop-color="#9C8CFA" stop-opacity="0.30"/><stop offset="1" stop-color="#9C8CFA" stop-opacity="0"/></radialGradient>
<filter id="intv-sh" x="-25%" y="-25%" width="150%" height="150%"><feDropShadow dx="0" dy="8" stdDeviation="11" flood-color="#3839B0" flood-opacity="0.16"/></filter>
</defs>
<ellipse cx="240" cy="180" rx="220" ry="150" fill="url(#intv-glow)"/>
<g class="il-float" filter="url(#intv-sh)">
<rect x="86" y="70" width="280" height="206" rx="20" fill="#FFFFFF" stroke="#CDD0E6" stroke-width="2"/>
<rect x="86" y="70" width="280" height="38" rx="20" fill="#F7F8FD"/>
<rect x="86" y="92" width="280" height="16" fill="#F7F8FD"/>
<circle cx="112" cy="89" r="6" fill="#E84C4C"/><circle cx="132" cy="89" r="6" fill="#EAA834"/><circle cx="152" cy="89" r="6" fill="#22AF6E"/>
<rect x="110" y="128" width="40" height="9" rx="4.5" fill="#4B5BF0"/>
<rect x="158" y="128" width="64" height="9" rx="4.5" fill="#9294A8"/>
<rect x="128" y="148" width="58" height="9" rx="4.5" fill="#9C8CFA"/>
<rect x="194" y="148" width="92" height="9" rx="4.5" fill="#EEF0FA"/>
<rect x="128" y="168" width="84" height="9" rx="4.5" fill="#EEF0FA"/>
<rect x="110" y="188" width="48" height="9" rx="4.5" fill="#22AF6E"/>
<rect x="166" y="188" width="70" height="9" rx="4.5" fill="#EEF0FA"/>
<rect x="110" y="226" width="150" height="9" rx="4.5" fill="#EEF0FA"/>
<path d="M300 150 l-14 16 l14 16 M330 150 l14 16 l-14 16" fill="none" stroke="#CDD0E6" stroke-width="5" stroke-linecap="round" stroke-linejoin="round"/></g>
<g class="il-float" style="animation-delay:0.45s" filter="url(#intv-sh)">
<rect x="262" y="234" width="150" height="56" rx="28" fill="#FFFFFF" stroke="#CDD0E6" stroke-width="2"/>
<g transform="translate(292 262)"><circle r="17" fill="#22AF6E"/><path d="M -7.14 0 L -1.7000000000000002 5.78 L 7.82 -5.78" fill="none" stroke="#FFFFFF" stroke-width="3.74" stroke-linecap="round" stroke-linejoin="round"/></g>
<rect x="318" y="252" width="78" height="10" rx="5" fill="#1C1B29" opacity="0.78"/>
<rect x="318" y="270" width="54" height="8" rx="4" fill="#22AF6E"/></g>
<path class="il-pulse" style="animation-delay:0.2s" transform="translate(392 120)" d="M0 -8 L 2.56 -2.56 L 8 0 L 2.56 2.56 L 0 8 L -2.56 2.56 L -8 0 L -2.56 -2.56 Z" fill="#9C8CFA"/><path class="il-pulse" style="animation-delay:0.8s" transform="translate(86 250)" d="M0 -6 L 1.92 -1.92 L 6 0 L 1.92 1.92 L 0 6 L -1.92 1.92 L -6 0 L -1.92 -1.92 Z" fill="#9C8CFA"/><path class="il-pulse" style="animation-delay:1.15s" transform="translate(410 210)" d="M0 -6 L 1.92 -1.92 L 6 0 L 1.92 1.92 L 0 6 L -1.92 1.92 L -6 0 L -1.92 -1.92 Z" fill="#9C8CFA"/></svg>`

const SVG_PROG = `<svg viewBox="0 0 480 360" class="il-svg" role="img" aria-label="Progreso"><defs>
<linearGradient id="prog-g" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#4B5BF0"/><stop offset="1" stop-color="#9C8CFA"/></linearGradient>
<radialGradient id="prog-glow" cx="0.5" cy="0.5" r="0.5"><stop offset="0" stop-color="#9C8CFA" stop-opacity="0.30"/><stop offset="1" stop-color="#9C8CFA" stop-opacity="0"/></radialGradient>
<filter id="prog-sh" x="-25%" y="-25%" width="150%" height="150%"><feDropShadow dx="0" dy="8" stdDeviation="11" flood-color="#3839B0" flood-opacity="0.16"/></filter>
</defs>
<ellipse cx="240" cy="180" rx="220" ry="150" fill="url(#prog-glow)"/>
<g class="il-float" filter="url(#prog-sh)">
<rect x="92" y="64" width="296" height="232" rx="22" fill="#FFFFFF" stroke="#CDD0E6" stroke-width="2"/>
<g transform="translate(170 178)">
<circle r="52" fill="none" stroke="#EEF0FA" stroke-width="16"/>
<circle class="il-draw" style="--len:326.7256359733385" r="52" fill="none" stroke="url(#prog-g)" stroke-width="16" stroke-linecap="round" stroke-dasharray="235.2424579008037 326.7256359733385" transform="rotate(-90)"/>
<text x="0" y="-2" text-anchor="middle" font-family="system-ui, sans-serif" font-weight="700" font-size="30" fill="#1C1B29">72%</text>
<text x="0" y="22" text-anchor="middle" font-family="system-ui, sans-serif" font-weight="600" font-size="13" fill="#9294A8">listo</text></g>
<g>
<rect x="262" y="118" width="96" height="11" rx="5.5" fill="#EEF0FA"/><rect class="il-rise" style="animation-delay:0.1s" x="262" y="118" width="78" height="11" rx="5.5" fill="url(#prog-g)"/>
<rect x="262" y="148" width="96" height="11" rx="5.5" fill="#EEF0FA"/><rect class="il-rise" style="animation-delay:0.25s" x="262" y="148" width="62" height="11" rx="5.5" fill="url(#prog-g)"/>
<rect x="262" y="178" width="96" height="11" rx="5.5" fill="#EEF0FA"/><rect class="il-rise" style="animation-delay:0.4s" x="262" y="178" width="50" height="11" rx="5.5" fill="url(#prog-g)"/>
<rect x="262" y="208" width="96" height="11" rx="5.5" fill="#EEF0FA"/><rect class="il-rise" style="animation-delay:0.55s" x="262" y="208" width="40" height="11" rx="5.5" fill="url(#prog-g)"/></g>
<g>
<rect class="il-rise" style="animation-delay:0.2s" x="120" y="248" width="20" height="30" rx="6" fill="#9C8CFA" opacity="0.5"/>
<rect class="il-rise" style="animation-delay:0.35s" x="150" y="240" width="20" height="38" rx="6" fill="#9C8CFA" opacity="0.65"/>
<rect class="il-rise" style="animation-delay:0.5s" x="180" y="228" width="20" height="50" rx="6" fill="#4B5BF0" opacity="0.8"/>
<rect class="il-rise" style="animation-delay:0.65s" x="210" y="216" width="20" height="62" rx="6" fill="url(#prog-g)"/></g></g>
<g class="il-float" style="animation-delay:0.5s" filter="url(#prog-sh)">
<circle cx="372" cy="100" r="26" fill="#FFFFFF" stroke="#CDD0E6" stroke-width="2"/><g transform="translate(372 100)"><circle r="16" fill="#22AF6E"/><path d="M -6.72 0 L -1.6 5.44 L 7.36 -5.44" fill="none" stroke="#FFFFFF" stroke-width="3.52" stroke-linecap="round" stroke-linejoin="round"/></g></g>
<path class="il-pulse" style="animation-delay:0.3s" transform="translate(108 96)" d="M0 -7 L 2.24 -2.24 L 7 0 L 2.24 2.24 L 0 7 L -2.24 2.24 L -7 0 L -2.24 -2.24 Z" fill="#9C8CFA"/><path class="il-pulse" style="animation-delay:0.9s" transform="translate(404 250)" d="M0 -6 L 1.92 -1.92 L 6 0 L 1.92 1.92 L 0 6 L -1.92 1.92 L -6 0 L -1.92 -1.92 Z" fill="#9C8CFA"/><path class="il-pulse" style="animation-delay:1.2s" transform="translate(250 312)" d="M0 -6 L 1.92 -1.92 L 6 0 L 1.92 1.92 L 0 6 L -1.92 1.92 L -6 0 L -1.92 -1.92 Z" fill="#9C8CFA"/></svg>`

type Feature = {
  label: string
  title: string
  desc: string
  bullets: string[]
  svg: string
  mediaLeft: boolean
}

const FEATURES: Feature[] = [
  {
    label: 'Certificaciones',
    title: 'Tu certificación, tu ruta',
    desc: 'Explora las certificaciones más demandadas del mercado y elige tu objetivo. Te inscribes y CertReady arma una ruta de estudio paso a paso, con todo lo que necesitas en un solo lugar.',
    bullets: [
      'Catálogo por proveedor y nivel',
      'Inscripción en un clic',
      'Tu ruta siempre a la vista',
    ],
    svg: SVG_CERT,
    mediaLeft: false,
  },
  {
    label: 'Estudio',
    title: 'Aprende a tu ritmo',
    desc: 'Material claro y organizado por tema, pensado para que entiendas de verdad. Lee, repasa y avanza cuando quieras, desde donde quieras, sin presión.',
    bullets: [
      'Lecturas por tema y dificultad',
      'Repaso a tu propio ritmo',
      'Desde cualquier dispositivo',
    ],
    svg: SVG_STUDY,
    mediaLeft: true,
  },
  {
    label: 'Exámenes',
    title: 'Simula el examen real',
    desc: 'Practica con simulacros cronometrados que se sienten como el examen de verdad. Recibe tu puntaje al instante y repasa cada pregunta con explicaciones que sí se entienden.',
    bullets: ['Simulacros cronometrados', 'Puntaje inmediato', 'Repaso con explicaciones'],
    svg: SVG_EXAM,
    mediaLeft: false,
  },
  {
    label: 'Entrevistas',
    title: 'Llega listo a la entrevista',
    desc: 'Resuelve problemas de código que se evalúan automáticamente contra casos de prueba, y repasa las preguntas más frecuentes por puesto y área para llegar con confianza.',
    bullets: [
      'Editor con corrección automática',
      'Casos de prueba al instante',
      'Banco de preguntas por puesto',
    ],
    svg: SVG_INTV,
    mediaLeft: true,
  },
  {
    label: 'Progreso',
    title: 'Sabe cuándo estás listo',
    desc: 'CertReady estima tu probabilidad de aprobar a partir de tu desempeño real y te dice exactamente qué estudiar después para mejorar más rápido.',
    bullets: ['Probabilidad de aprobar', 'Dominio por tema', 'Tu siguiente mejor paso'],
    svg: SVG_PROG,
    mediaLeft: false,
  },
]
