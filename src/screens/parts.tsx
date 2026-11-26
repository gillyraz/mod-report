import type { ReactNode } from 'react'
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
