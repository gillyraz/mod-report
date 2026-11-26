import { useEffect, useRef, type ReactNode } from 'react'
import { createPortal } from 'react-dom'
import type { Ctx } from '../App'
import { ChevronLeft, ChevronRight } from 'lucide-react'
import { Button, c } from '../ui'
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

export function MonthSwitcher({ month, setMonth }: { month: string; setMonth: (m: string) => void }) {
  return (
    <div style={{ display: 'inline-flex', alignItems: 'center', gap: 4, background: c.surface, border: `1px solid ${c.line}`, borderRadius: 8, height: 40 }}>
      <Button kind="ghost" title="החודש הקודם" icon={<ChevronRight size={18} />} onClick={() => setMonth(shiftMonth(month, -1))} style={{ height: 38 }} />
      <span style={{ minWidth: 112, textAlign: 'center', fontWeight: 600, fontSize: 15 }} aria-live="polite">
        {monthLabel(month)}
      </span>
      <Button kind="ghost" title="החודש הבא" icon={<ChevronLeft size={18} />} onClick={() => setMonth(shiftMonth(month, 1))} style={{ height: 38 }} />
    </div>
  )
}

/**
 * פס העמוד: כותרת, פרטים ופעולות של העמוד הנוכחי, באותו מבנה בכל העמודים.
 * בדסקטופ הוא יושב בפס העליון הקבוע, ובנייד בראש העמוד.
 */
export function PageBar({ ctx, title, lead, middle, actions }: { ctx: Ctx; title: string; lead?: ReactNode; middle?: ReactNode; actions?: ReactNode }) {
  const { wide, pageSlot } = ctx
  if (wide && pageSlot)
    return createPortal(
      <div style={{ borderTop: `1px solid ${c.line}` }}>
        <div style={{ maxWidth: 1184, margin: '0 auto', minHeight: 64, padding: '12px 32px', display: 'flex', alignItems: 'center', columnGap: 24, rowGap: 12, flexWrap: 'wrap' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 16, flex: '0 0 auto' }}>
            <h1 style={{ margin: 0, fontSize: 20, fontWeight: 600 }}>{title}</h1>
            {lead}
          </div>
          <div style={{ flex: '1 1 420px', display: 'flex', alignItems: 'center', gap: 16, fontSize: 14, color: c.ink2 }}>{middle}</div>
          {actions && <div style={{ display: 'flex', alignItems: 'center', gap: 8, flex: '0 0 auto' }}>{actions}</div>}
        </div>
      </div>,
      pageSlot,
    )
  if (wide) return null
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 16, flexWrap: 'wrap' }}>
        <h1 style={{ margin: 0, fontSize: 24, fontWeight: 600 }}>{title}</h1>
        {lead}
      </div>
      {middle && <div style={{ display: 'flex', flexDirection: 'column', gap: 8, fontSize: 14, color: c.ink2 }}>{middle}</div>}
      {actions && <div style={{ display: 'flex', gap: 8 }}>{actions}</div>}
    </div>
  )
}

/** ⌘P או Ctrl+P פותח חלון של מטופל חדש, כשאין חלון אחר פתוח */
export function useNewPatientShortcut(open: () => void) {
  const ref = useRef(open)
  ref.current = open
  useEffect(() => {
    const on = (e: KeyboardEvent) => {
      if (!(e.metaKey || e.ctrlKey) || e.key.toLowerCase() !== 'p' && e.code !== 'KeyP') return
      e.preventDefault()
      if (document.querySelector('[role="dialog"]')) return
      ref.current()
    }
    window.addEventListener('keydown', on)
    return () => window.removeEventListener('keydown', on)
  }, [])
}
