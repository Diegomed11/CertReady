import Link from 'next/link'
import type { ButtonHTMLAttributes, ReactNode } from 'react'

/** Flecha diagonal de los CTA (misma que el botón "Continuar" del panel). */
function CtaArrow() {
  return (
    <svg
      className="cta-arrow"
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
  )
}

type CtaProps = ButtonHTMLAttributes<HTMLButtonElement> & {
  children: ReactNode
  arrow?: boolean
}

/**
 * Cta — botón con el estilo colorido del panel (degradado arcoíris + glow).
 * Reutiliza las clases globales `.cta` de `globals.css`.
 */
export function Cta({ children, arrow = false, className = '', type = 'button', ...props }: CtaProps) {
  return (
    <button type={type} className={`cta ${className}`} {...props}>
      <span className="cta-glow" />
      <span className="cta-content">
        {children}
        {arrow ? <CtaArrow /> : null}
      </span>
    </button>
  )
}

/** CtaLink — variante enlace (Next Link) del CTA colorido. */
export function CtaLink({
  href,
  children,
  arrow = false,
  className = '',
}: {
  href: string
  children: ReactNode
  arrow?: boolean
  className?: string
}) {
  return (
    <Link href={href} className={`cta ${className}`}>
      <span className="cta-glow" />
      <span className="cta-content">
        {children}
        {arrow ? <CtaArrow /> : null}
      </span>
    </Link>
  )
}
