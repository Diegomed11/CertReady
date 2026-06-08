import type { ButtonHTMLAttributes } from 'react'

export type ButtonVariant = 'primary' | 'secondary' | 'ghost' | 'quiet'
export type ButtonSize = 'sm' | 'md' | 'lg'

/**
 * buttonStyles devuelve las clases del botón. Estilo "chunky" con sombra inferior
 * que se hunde al presionar (active), para una sensación táctil y con energía.
 * Se exporta aparte para reutilizarlo en `<Link>` y en botones de cliente.
 */
export function buttonStyles(variant: ButtonVariant = 'primary', size: ButtonSize = 'md'): string {
  const base =
    'inline-flex select-none items-center justify-center gap-2 rounded-2xl font-display font-semibold uppercase tracking-wide transition-all duration-100 active:translate-y-[2px] disabled:pointer-events-none disabled:opacity-50'
  const sizes: Record<ButtonSize, string> = {
    sm: 'px-4 py-2 text-xs',
    md: 'px-6 py-2.5 text-sm',
    lg: 'px-8 py-3.5 text-base',
  }
  const variants: Record<ButtonVariant, string> = {
    primary:
      'bg-brand text-white shadow-[0_4px_0_0_rgb(var(--brand-ink))] hover:brightness-105 active:shadow-[0_2px_0_0_rgb(var(--brand-ink))]',
    secondary:
      'bg-brand-2 text-white shadow-[0_4px_0_0_rgb(var(--brand))] hover:brightness-105 active:shadow-[0_2px_0_0_rgb(var(--brand))]',
    ghost:
      'border-2 border-line-strong bg-white text-brand shadow-[0_4px_0_0_rgb(var(--line-strong))] hover:border-brand active:shadow-[0_2px_0_0_rgb(var(--line-strong))]',
    quiet: 'normal-case text-muted hover:text-brand',
  }
  return `${base} ${sizes[size]} ${variants[variant]}`
}

type Props = ButtonHTMLAttributes<HTMLButtonElement> & {
  variant?: ButtonVariant
  size?: ButtonSize
}

/** Botón base del sistema. */
export function Button({ variant = 'primary', size = 'md', className = '', ...props }: Props) {
  return <button className={`${buttonStyles(variant, size)} ${className}`} {...props} />
}
