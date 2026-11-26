import { useEffect, useState, type CSSProperties, type ReactNode } from 'react'
import { Minus, Plus, X } from 'lucide-react'

export const EASE = 'cubic-bezier(0.16, 1, 0.3, 1)'

export const c = {
  bg: '#F4F5F7',
  surface: '#FFFFFF',
  sub: '#F0F2F5',
  ink: '#1A1D23',
  ink2: '#5B6270',
  ink3: '#6E7584',
  line: '#E3E6EB',
  primary: '#1F3A5F',
  primaryHover: '#16304F',
  focus: '#2F6FEB',
  okBg: '#E5F4EC',
  ok: '#17794A',
  warnBg: '#FFF3DC',
  warn: '#9A5B00',
  dangerBg: '#FDECEA',
  danger: '#B3261E',
}

export function useWide(min = 900) {
  const q = `(min-width: ${min}px)`
  const [wide, setWide] = useState(() => window.matchMedia(q).matches)
  useEffect(() => {
    const m = window.matchMedia(q)
    const on = () => setWide(m.matches)
    m.addEventListener('change', on)
    return () => m.removeEventListener('change', on)
  }, [q])
  return wide
}

type BtnKind = 'primary' | 'secondary' | 'ghost' | 'danger'
export function Button({
  kind = 'secondary',
  icon,
  children,
  onClick,
  disabled,
  full,
  type = 'button',
  style,
  title,
}: {
  kind?: BtnKind
  icon?: ReactNode
  children?: ReactNode
  onClick?: () => void
  disabled?: boolean
  full?: boolean
  type?: 'button' | 'submit'
  style?: CSSProperties
  title?: string
}) {
  const [hover, setHover] = useState(false)
  const base: CSSProperties = {
    display: 'inline-flex',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    height: 40,
    padding: children ? '0 16px' : 0,
    width: full ? '100%' : children ? undefined : 40,
    borderRadius: 8,
    fontSize: 15,
    fontWeight: 500,
    cursor: disabled ? 'not-allowed' : 'pointer',
    opacity: disabled ? 0.45 : 1,
    border: '1px solid transparent',
    transition: `background 200ms ${EASE}, border-color 200ms ${EASE}, transform 200ms ${EASE}`,
    whiteSpace: 'nowrap',
  }
  const kinds: Record<BtnKind, CSSProperties> = {
    primary: { background: hover && !disabled ? c.primaryHover : c.primary, color: '#fff' },
    secondary: { background: hover && !disabled ? c.sub : c.surface, color: c.ink, borderColor: c.line },
    ghost: { background: hover && !disabled ? c.sub : 'transparent', color: c.ink },
    danger: { background: hover && !disabled ? c.dangerBg : 'transparent', color: c.danger },
  }
  return (
    <button
      type={type}
      title={title}
      aria-label={title}
      disabled={disabled}
      onClick={onClick}
      onMouseEnter={() => setHover(true)}
      onMouseLeave={() => setHover(false)}
      style={{ ...base, ...kinds[kind], ...style }}
    >
      {icon}
      {children}
    </button>
  )
}

export function Field({
  label,
  hint,
  value,
  onChange,
  type = 'text',
  inputMode,
  autoFocus,
  suffix,
  dirLtr,
}: {
  label: string
  hint?: string
  value: string
  onChange: (v: string) => void
  type?: string
  inputMode?: 'numeric' | 'decimal' | 'text'
  autoFocus?: boolean
  suffix?: string
  dirLtr?: boolean
}) {
  return (
    <label style={{ display: 'flex', flexDirection: 'column', gap: 8, minWidth: 0 }}>
      <span style={{ fontSize: 14, fontWeight: 500, color: c.ink }}>{label}</span>
      <span style={{ position: 'relative', display: 'flex' }}>
        <input
          value={value}
          type={type}
          inputMode={inputMode}
          autoFocus={autoFocus}
          onChange={(e) => onChange(e.target.value)}
          dir={dirLtr ? 'ltr' : undefined}
          style={{
            flex: 1,
            minWidth: 0,
            height: 48,
            padding: suffix ? '0 16px 0 40px' : '0 16px',
            borderRadius: 8,
            border: `1px solid ${c.line}`,
            background: c.surface,
            fontSize: 16,
            color: c.ink,
            textAlign: dirLtr ? 'right' : undefined,
          }}
        />
        {suffix && (
          <span style={{ position: 'absolute', left: 16, top: 0, bottom: 0, display: 'flex', alignItems: 'center', color: c.ink3, fontSize: 15 }}>
            {suffix}
          </span>
        )}
      </span>
      {hint && <span style={{ fontSize: 13, color: c.ink2 }}>{hint}</span>}
    </label>
  )
}

export function Stepper({ value, onChange, label, hideLabel }: { value: number; onChange: (n: number) => void; label: string; hideLabel?: boolean }) {
  const btn: CSSProperties = {
    width: 40,
    height: 40,
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    border: 'none',
    background: 'transparent',
    color: c.ink,
    cursor: 'pointer',
    borderRadius: 8,
  }
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
      {!hideLabel && <span style={{ fontSize: 13, color: c.ink2 }}>{label}</span>}
      <div role="group" aria-label={label} style={{ display: 'inline-flex', alignItems: 'center', background: c.surface, border: `1px solid ${c.line}`, borderRadius: 8, height: 40 }}>
        <button style={btn} aria-label={`הוספה: ${label}`} onClick={() => onChange(value + 1)}>
          <Plus size={16} />
        </button>
        <input
          aria-label={label}
          inputMode="numeric"
          value={value}
          onChange={(e) => onChange(Math.max(0, parseInt(e.target.value.replace(/\D/g, '') || '0', 10)))}
          style={{ width: 40, height: 38, border: 'none', textAlign: 'center', fontSize: 16, fontWeight: 600, color: c.ink, background: 'transparent', fontVariantNumeric: 'tabular-nums' }}
        />
        <button style={{ ...btn, color: value === 0 ? c.ink3 : c.ink }} aria-label={`הפחתה: ${label}`} disabled={value === 0} onClick={() => onChange(Math.max(0, value - 1))}>
          <Minus size={16} />
        </button>
      </div>
    </div>
  )
}

export function Badge({ tone, children }: { tone: 'ok' | 'warn' | 'muted'; children: ReactNode }) {
  const t = { ok: [c.okBg, c.ok], warn: [c.warnBg, c.warn], muted: [c.sub, c.ink2] }[tone]
  return (
    <span style={{ display: 'inline-flex', alignItems: 'center', gap: 4, height: 24, padding: '0 8px', borderRadius: 999, background: t[0], color: t[1], fontSize: 13, fontWeight: 500, whiteSpace: 'nowrap' }}>
      {children}
    </span>
  )
}

/** חלון: בדסקטופ במרכז, בנייד כגיליון מלמטה */
export function Sheet({ title, onClose, children, footer, wide }: { title: string; onClose: () => void; children: ReactNode; footer?: ReactNode; wide?: boolean }) {
  const desk = useWide(700)
  // המסך שמאחורי החלון לא נגלל כל עוד החלון פתוח
  useEffect(() => {
    const html = document.documentElement
    const prev = html.style.overflow
    const gap = window.innerWidth - html.clientWidth
    html.style.overflow = 'hidden'
    if (gap) document.body.style.paddingInlineEnd = `${gap}px`
    return () => {
      html.style.overflow = prev
      document.body.style.paddingInlineEnd = ''
    }
  }, [])
  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label={title}
      style={{ position: 'fixed', inset: 0, background: 'rgba(16,22,34,0.42)', display: 'flex', alignItems: desk ? 'center' : 'flex-end', justifyContent: 'center', zIndex: 50, animation: `fade 240ms ${EASE}` }}
    >
      <div
        style={{
          background: c.bg,
          width: desk ? (wide ? 760 : 520) : '100%',
          maxHeight: desk ? '88vh' : '92vh',
          borderRadius: desk ? 16 : '16px 16px 0 0',
          display: 'flex',
          flexDirection: 'column',
          overflow: 'hidden',
          animation: `rise 360ms ${EASE}`,
          boxShadow: '0 24px 64px rgba(16,22,34,0.24)',
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '16px 24px', background: c.surface, borderBottom: `1px solid ${c.line}` }}>
          <h2 style={{ margin: 0, fontSize: 18, fontWeight: 600 }}>{title}</h2>
          <Button kind="ghost" title="סגירה" icon={<X size={20} />} onClick={onClose} />
        </div>
        <div style={{ padding: 24, flex: '1 1 auto', minHeight: 0, overflowY: 'auto', overscrollBehavior: 'contain', display: 'flex', flexDirection: 'column', gap: 16 }}>{children}</div>
        {footer && <div style={{ padding: '16px 24px', paddingBottom: 'max(16px, env(safe-area-inset-bottom))', background: c.surface, borderTop: `1px solid ${c.line}`, display: 'flex', gap: 8, justifyContent: 'flex-start', flexWrap: 'wrap' }}>{footer}</div>}
      </div>
    </div>
  )
}

export function Card({ children, style, ref, id }: { children: ReactNode; style?: CSSProperties; ref?: React.Ref<HTMLDivElement>; id?: string }) {
  return <div ref={ref} id={id} style={{ background: c.surface, borderRadius: 12, border: `1px solid ${c.line}`, ...style }}>{children}</div>
}

export function Toast({ t, onDone, lift }: { t: { text: string; action?: { label: string; run: () => void } } | null; onDone: () => void; lift?: boolean }) {
  if (!t) return null
  return (
    <div role="status" style={{ position: 'fixed', bottom: lift ? 'calc(80px + env(safe-area-inset-bottom))' : 24, insetInline: 0, display: 'flex', justifyContent: 'center', zIndex: 60, pointerEvents: 'none' }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 16, background: c.ink, color: '#fff', padding: t.action ? '8px 8px 8px 16px' : '12px 16px', paddingInlineStart: 16, borderRadius: 8, fontSize: 15, animation: `rise 320ms ${EASE}`, maxWidth: 'calc(100% - 32px)', pointerEvents: 'auto' }}>
        <span>{t.text}</span>
        {t.action && (
          <button
            onClick={() => (t.action!.run(), onDone())}
            style={{ height: 32, padding: '0 12px', border: 'none', borderRadius: 6, background: 'rgba(255,255,255,0.14)', color: '#fff', fontSize: 14, fontWeight: 600, cursor: 'pointer' }}
          >
            {t.action.label}
          </button>
        )}
      </div>
    </div>
  )
}
