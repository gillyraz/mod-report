import { useEffect, useRef, type ReactNode } from 'react'
import type { Ctx } from '../App'
import { ChevronLeft, ChevronRight } from 'lucide-react'
import { Button, c, lift } from '../ui'
import { monthLabel, shiftMonth } from '../model'

export function PageHead({ title, sub, actions }: { title: ReactNode; sub?: ReactNode; actions?: ReactNode }) {
  return (
    <div style={{ display: 'flex', alignItems: 'flex-end', justifyContent: 'space-between', gap: 16, flexWrap: 'wrap' }}>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
        <h1 style={{ margin: 0, fontSize: 26, fontWeight: 600, letterSpacing: -0.2 }}>{title}</h1>
        {sub && <p style={{ margin: 0, fontSize: 15, color: c.ink2 }}>{sub}</p>}
      </div>
      {actions && <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>{actions}</div>}
    </div>
  )
}

export function MonthSwitcher({ month, setMonth, disabled }: { month: string; setMonth: (m: string) => void; disabled?: boolean }) {
  const why = disabled ? 'אי אפשר להחליף חודש באמצע הבחירה. מסיימים או מבטלים קודם.' : undefined
  return (
    <div style={{ display: 'inline-flex', alignItems: 'center', gap: 4, background: c.surface, boxShadow: lift, borderRadius: 10, height: 40 }}>
      <Button kind="ghost" title={why ?? 'החודש הקודם'} disabled={disabled} icon={<ChevronRight size={18} />} onClick={() => setMonth(shiftMonth(month, -1))} style={{ height: 38 }} />
      <span style={{ minWidth: 112, textAlign: 'center', fontWeight: 600, fontSize: 15 }} aria-live="polite">
        {monthLabel(month)}
      </span>
      <Button kind="ghost" title={why ?? 'החודש הבא'} disabled={disabled} icon={<ChevronLeft size={18} />} onClick={() => setMonth(shiftMonth(month, 1))} style={{ height: 38 }} />
    </div>
  )
}

/**
 * ראש העמוד: כותרת גדולה, שורת הסבר ופעולות. אותו מבנה ואותו מקום בכל העמודים.
 */
export function PageBar({ ctx, title, sub, lead, actions }: { ctx: Ctx; title: string; sub?: ReactNode; lead?: ReactNode; actions?: ReactNode }) {
  const { wide } = ctx
  if (wide)
    return (
      <div style={{ paddingTop: 40, display: 'flex', alignItems: 'flex-end', gap: 24 }}>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8, minWidth: 0 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 16, minHeight: 40 }}>
            <h1 style={{ margin: 0, fontSize: 32, fontWeight: 600, letterSpacing: -0.6, lineHeight: 1.15 }}>{title}</h1>
            {lead}
          </div>
          {sub && <p style={{ margin: 0, fontSize: 15, color: c.ink3, minHeight: 21 }}>{sub}</p>}
        </div>
        <span style={{ flex: 1 }} />
        {actions && <div style={{ display: 'flex', alignItems: 'center', gap: 8, flex: '0 0 auto' }}>{actions}</div>}
      </div>
    )
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 16, flexWrap: 'wrap' }}>
        <h1 style={{ margin: 0, fontSize: 26, fontWeight: 600, letterSpacing: -0.4 }}>{title}</h1>
        {lead}
      </div>
      {sub && <p style={{ margin: 0, fontSize: 14, color: c.ink3 }}>{sub}</p>}
      {actions && <div style={{ display: 'flex', gap: 8 }}>{actions}</div>}
    </div>
  )
}

/** המקש N (בכל שפת מקלדת) פותח חלון של מטופל חדש, כשלא מקלידים בשדה ואין חלון פתוח */
export function useNewPatientShortcut(open: () => void, enabled = true) {
  const ref = useRef(open)
  ref.current = open
  const allowed = useRef(enabled)
  allowed.current = enabled
  useEffect(() => {
    const on = (e: KeyboardEvent) => {
      if (e.metaKey || e.ctrlKey || e.altKey || e.shiftKey || e.repeat || e.code !== 'KeyN') return
      const t = e.target as HTMLElement | null
      if (t && (t.isContentEditable || /^(INPUT|TEXTAREA|SELECT)$/.test(t.tagName))) return
      if (!allowed.current || document.querySelector('[role="dialog"]')) return
      e.preventDefault()
      ref.current()
    }
    window.addEventListener('keydown', on)
    return () => window.removeEventListener('keydown', on)
  }, [])
}

const TONES = ['#E3E9F3', '#E9E4F3', '#E1EEE8', '#F3E8E1', '#E8EEE0', '#F1E3E8']
/** עיגול עם ראשי התיבות של המטופל, בגוון קבוע לכל שם */
export function Avatar({ name }: { name: string }) {
  const parts = name.trim().split(/\s+/)
  const ini = (parts[0]?.[0] ?? '') + (parts.length > 1 ? parts[parts.length - 1][0] : '')
  const tone = TONES[[...name].reduce((a, ch) => a + ch.charCodeAt(0), 0) % TONES.length]
  return (
    <span aria-hidden style={{ flex: '0 0 40px', height: 40, borderRadius: 999, background: tone, color: '#2A3446', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 14, fontWeight: 600 }}>
      {ini}
    </span>
  )
}

