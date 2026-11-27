import { useEffect, useId, useState, type CSSProperties, type ReactNode } from 'react'
import { CircleAlert, Minus, Plus, X } from 'lucide-react'

export const EASE = 'cubic-bezier(0.16, 1, 0.3, 1)'

export const c = {
  bg: '#F6F8FD',
  surface: '#FFFFFF',
  sub: '#F2F5FB',
  group: '#EDF1F8',
  // שדות תמיד לבנים עם מסגרת ברורה, כדי שייראו לחיצים
  field: '#FFFFFF',
  fieldLine: '#D3DAE6',
  ink: '#101828',
  ink2: '#475467',
  ink3: '#667085',
  ink4: '#98A2B3',
  line: '#E6EBF3',
  primary: '#4566E8',
  primaryHover: '#3753CF',
  primarySoft: '#EEF2FF',
  primaryInk: '#2F48B8',
  navy: '#1B2559',
  focus: '#4566E8',
  okBg: '#E3F5EC',
  okSurf: '#EFF8F3',
  ok: '#16855A',
  warnBg: '#FFF1DA',
  warnSoft: '#FFF7EA',
  warn: '#A15C07',
  dangerBg: '#FDECEA',
  danger: '#C4321F',
}

/** צל רך לכרטיסים: מסגרת דקה ועומק קל */
export const lift = '0 0 0 1px rgba(16,24,40,0.05), 0 1px 3px rgba(16,24,40,0.04)'

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
    borderRadius: 12,
    fontSize: 15,
    fontWeight: 500,
    cursor: disabled ? 'not-allowed' : 'pointer',
    opacity: disabled ? 0.45 : 1,
    border: '1px solid transparent',
    transition: `background 200ms ${EASE}, border-color 200ms ${EASE}, transform 200ms ${EASE}`,
    whiteSpace: 'nowrap',
  }
  const kinds: Record<BtnKind, CSSProperties> = {
    primary: { background: hover && !disabled ? c.primaryHover : 'linear-gradient(180deg, #5577F0, #4566E8)', color: '#fff', boxShadow: disabled ? 'none' : '0 1px 2px rgba(69,102,232,0.3), 0 4px 12px -4px rgba(69,102,232,0.45), inset 0 1px 0 rgba(255,255,255,0.18)' },
    secondary: { background: hover && !disabled ? c.sub : c.surface, color: c.primary, borderColor: '#E1E7F2', boxShadow: '0 1px 2px rgba(16,24,40,0.04)' },
    ghost: { background: hover && !disabled ? c.sub : 'transparent', color: c.ink2 },
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
  disabled,
  error,
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
  disabled?: boolean
  error?: string
}) {
  const [focus, setFocus] = useState(false)
  const id = useId()
  const described = [error && id + 'e', hint && id + 'h'].filter(Boolean).join(' ') || undefined
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 8, minWidth: 0 }}>
      <label htmlFor={id} style={{ fontSize: 13, fontWeight: 600, color: c.ink2 }}>{label}</label>
      <span style={{ position: 'relative', display: 'flex' }}>
        <input
          id={id}
          aria-describedby={described}
          value={value}
          type={type}
          disabled={disabled}
          inputMode={inputMode}
          autoFocus={autoFocus}
          onChange={(e) => onChange(e.target.value)}
          onFocus={() => setFocus(true)}
          onBlur={() => setFocus(false)}
          dir={dirLtr ? 'ltr' : undefined}
          aria-invalid={error ? true : undefined}
          style={{
            flex: 1,
            minWidth: 0,
            height: 48,
            padding: suffix ? '0 16px 0 40px' : '0 16px',
            borderRadius: 12,
            border: 'none',
            outline: 'none',
            boxShadow: error
              ? `inset 0 0 0 1px ${c.danger}${focus ? ', 0 0 0 4px rgba(196,50,31,0.12)' : ''}`
              : focus ? `inset 0 0 0 1px ${c.primary}, 0 0 0 4px rgba(69,102,232,0.14)` : `inset 0 0 0 1px ${c.fieldLine}`,
            background: c.field,
            transition: `box-shadow 200ms ${EASE}, background 200ms ${EASE}`,
            fontSize: 16,
            color: disabled ? c.ink3 : c.ink,
            cursor: disabled ? 'not-allowed' : undefined,
            opacity: disabled ? 0.6 : 1,
            textAlign: dirLtr ? 'right' : undefined,
          }}
        />
        {suffix && (
          <span style={{ position: 'absolute', left: 16, top: 0, bottom: 0, display: 'flex', alignItems: 'center', color: c.ink3, fontSize: 15 }}>
            {suffix}
          </span>
        )}
      </span>
      {error && (
        <span id={id + 'e'} style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 13, fontWeight: 500, color: c.danger }}>
          <CircleAlert size={14} style={{ flex: '0 0 14px' }} />
          {error}
        </span>
      )}
      {hint && <span id={id + 'h'} style={{ fontSize: 12, color: c.ink3 }}>{hint}</span>}
    </div>
  )
}

export function Stepper({ value, onChange, label, hideLabel }: { value: number; onChange: (n: number) => void; label: string; hideLabel?: boolean }) {
  const btn: CSSProperties = {
    width: 36,
    height: 40,
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    border: 'none',
    background: 'transparent',
    color: c.ink2,
    cursor: 'pointer',
    borderRadius: 10,
  }
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
      {!hideLabel && <span style={{ fontSize: 13, color: c.ink2 }}>{label}</span>}
      <div role="group" aria-label={label} style={{ display: 'inline-flex', alignItems: 'center', background: c.field, boxShadow: `inset 0 0 0 1px ${c.fieldLine}`, borderRadius: 12, height: 40, alignSelf: 'flex-start' }}>
        <button style={btn} aria-label={`הוספה: ${label}`} onClick={() => onChange(value + 1)}>
          <Plus size={16} />
        </button>
        <input
          aria-label={label}
          inputMode="numeric"
          value={value}
          onChange={(e) => onChange(Math.max(0, parseInt(e.target.value.replace(/\D/g, '') || '0', 10)))}
          style={{ width: 36, height: 38, border: 'none', textAlign: 'center', fontSize: 16, fontWeight: 600, color: value === 0 ? c.ink4 : c.ink, background: 'transparent', fontVariantNumeric: 'tabular-nums' }}
        />
        <button style={{ ...btn, color: value === 0 ? c.ink4 : c.ink2, cursor: value === 0 ? 'default' : 'pointer' }} aria-label={`הפחתה: ${label}`} disabled={value === 0} onClick={() => onChange(Math.max(0, value - 1))}>
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

/** חלון: בדסקטופ במרכז, בנייד כגיליון מלמטה. נסגר רק מהכפתורים שלו */
export function Sheet({ title, sub, icon, onClose, children, footer, wide, tone }: { title: string; sub?: ReactNode; icon?: ReactNode; onClose: () => void; children: ReactNode; footer?: ReactNode; wide?: boolean; tone?: 'danger' }) {
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
  const px = desk ? 28 : 20
  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label={title}
      style={{ position: 'fixed', inset: 0, background: 'rgba(15,23,42,0.28)', backdropFilter: 'blur(6px)', WebkitBackdropFilter: 'blur(6px)', display: 'flex', alignItems: desk ? 'center' : 'flex-end', justifyContent: 'center', zIndex: 50, animation: `fade 240ms ${EASE}` }}
    >
      <div
        style={{
          background: c.surface,
          width: desk ? (wide ? 760 : 520) : '100%',
          maxHeight: desk ? '88vh' : '92vh',
          borderRadius: desk ? 24 : '24px 24px 0 0',
          display: 'flex',
          flexDirection: 'column',
          overflow: 'hidden',
          animation: `rise 360ms ${EASE}`,
          boxShadow: '0 24px 64px -12px rgba(15,23,42,0.35)',
        }}
      >
        <div style={{ display: 'flex', alignItems: 'flex-start', gap: 16, padding: `${px}px ${px}px 8px` }}>
          {icon && (
            <span aria-hidden style={{ flex: '0 0 44px', height: 44, borderRadius: 14, background: tone === 'danger' ? c.dangerBg : c.primarySoft, color: tone === 'danger' ? c.danger : c.primary, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              {icon}
            </span>
          )}
          <div style={{ flex: 1, minWidth: 0, display: 'flex', flexDirection: 'column', gap: 4, paddingTop: icon ? 0 : 4 }}>
            <h2 style={{ margin: 0, fontSize: 20, fontWeight: 600, letterSpacing: -0.2 }}>{title}</h2>
            {sub && <p style={{ margin: 0, fontSize: 14, color: c.ink3, lineHeight: 1.5 }}>{sub}</p>}
          </div>
          <Button kind="ghost" title="סגירה" icon={<X size={18} />} onClick={onClose} style={{ width: 36, height: 36, borderRadius: 10, background: c.sub, color: c.ink3 }} />
        </div>
        <div style={{ padding: `16px ${px}px ${footer ? 16 : px}px`, flex: '1 1 auto', minHeight: 0, overflowY: 'auto', overscrollBehavior: 'contain', display: 'flex', flexDirection: 'column', gap: 16 }}>{children}</div>
        {footer && <div style={{ padding: `8px ${px}px ${px}px`, paddingBottom: `max(${px}px, env(safe-area-inset-bottom))`, display: 'flex', gap: 8, justifyContent: 'flex-start', flexWrap: 'wrap' }}>{footer}</div>}
      </div>
    </div>
  )
}

export function Card({ children, style, ref, id }: { children: ReactNode; style?: CSSProperties; ref?: React.Ref<HTMLDivElement>; id?: string }) {
  return <div ref={ref} id={id} style={{ background: c.surface, borderRadius: 20, boxShadow: lift, ...style }}>{children}</div>
}

export function Toast({ t, onDone, lift }: { t: { text: string; action?: { label: string; run: () => void } } | null; onDone: () => void; lift?: boolean }) {
  if (!t) return null
  return (
    <div role="status" style={{ position: 'fixed', bottom: lift ? 'calc(80px + env(safe-area-inset-bottom))' : 24, insetInline: 0, display: 'flex', justifyContent: 'center', zIndex: 60, pointerEvents: 'none' }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 16, background: c.ink, color: '#fff', padding: t.action ? '8px 8px 8px 16px' : '12px 16px', paddingInlineStart: 16, borderRadius: 12, boxShadow: '0 12px 32px rgba(16,24,40,0.24)', fontSize: 15, animation: `rise 320ms ${EASE}`, maxWidth: 'calc(100% - 32px)', pointerEvents: 'auto' }}>
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
