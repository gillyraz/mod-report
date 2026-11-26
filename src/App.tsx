import logo from '../public/favicon.svg'
import { PROTO, ProtoBar } from './proto'
import { useCallback, useEffect, useRef, useState } from 'react'
import { CalendarDays, Settings as SettingsIcon, Users } from 'lucide-react'
import { c, EASE, Toast, useWide } from './ui'
import { loadData, loadScans, monthKey, saveData, saveScans, type Data, type Scan } from './model'
import MonthScreen from './screens/MonthScreen'
import PatientsScreen from './screens/PatientsScreen'
import SettingsScreen from './screens/SettingsScreen'

export type Tab = 'month' | 'patients' | 'settings'

export type Ctx = {
  data: Data
  setData: (fn: (d: Data) => Data) => void
  scans: Scan[]
  setScans: (fn: (s: Scan[]) => Scan[]) => void
  month: string
  setMonth: (m: string) => void
  toast: (t: string) => void
  go: (t: Tab) => void
  wide: boolean
  /** בדסקטופ: המקום בפס העליון שבו כל עמוד מציג את הכותרת והפעולות שלו */
  pageSlot: HTMLElement | null
  headerH: number
}

export default function App() {
  const [data, setDataRaw] = useState<Data | null>(null)
  const [scans, setScansRaw] = useState<Scan[]>([])
  const [tab, setTab] = useState<Tab>('month')
  const [month, setMonth] = useState(() => monthKey(new Date()))
  const [toastText, setToastText] = useState<string | null>(null)
  const timer = useRef<number | undefined>(undefined)
  const wide = useWide()
  const [pageEl, setPageEl] = useState<HTMLElement | null>(null)
  // גובה הפס העליון, כדי שכותרות הטבלה ייצמדו מתחתיו
  const [headerH, setHeaderH] = useState(64)
  const ro = useRef<ResizeObserver | null>(null)
  const headerRef = useCallback((el: HTMLElement | null) => {
    ro.current?.disconnect()
    if (!el) return
    ro.current = new ResizeObserver(() => setHeaderH(el.offsetHeight))
    ro.current.observe(el)
  }, [])

  useEffect(() => {
    Promise.all([loadData(), loadScans()]).then(([d, s]) => {
      setDataRaw(d)
      setScansRaw(s)
    })
  }, [])

  const setData = useCallback((fn: (d: Data) => Data) => {
    setDataRaw((d) => {
      const n = fn(d!)
      saveData(n)
      return n
    })
  }, [])
  const setScans = useCallback((fn: (s: Scan[]) => Scan[]) => {
    setScansRaw((s) => {
      const n = fn(s)
      saveScans(n)
      return n
    })
  }, [])
  const toast = useCallback((t: string) => {
    setToastText(t)
    window.clearTimeout(timer.current)
    timer.current = window.setTimeout(() => setToastText(null), 2800)
  }, [])

  if (!data) return null

  const ctx: Ctx = { data, setData, scans, setScans, month, setMonth, toast, go: setTab, wide, pageSlot: pageEl, headerH }
  const tabs: { id: Tab; label: string; icon: typeof Users }[] = [
    { id: 'month', label: 'החודש', icon: CalendarDays },
    { id: 'patients', label: 'מטופלים', icon: Users },
    { id: 'settings', label: 'הגדרות', icon: SettingsIcon },
  ]

  const screen = (
    <>
      {tab === 'month' && <MonthScreen ctx={ctx} />}
      {tab === 'patients' && <PatientsScreen ctx={ctx} />}
      {tab === 'settings' && <SettingsScreen ctx={ctx} />}
    </>
  )

  // דסקטופ: פס עליון קבוע עם הלשוניות, ומתחתיו פס העמוד (כותרת ופעולות של העמוד הנוכחי)
  if (wide)
    return (
      <div style={{ minHeight: '100vh', display: 'flex', flexDirection: 'column' }}>
        {PROTO && <ProtoBar />}
        <header ref={headerRef} style={{ position: 'sticky', top: 0, zIndex: 20, background: c.surface, borderBottom: `1px solid ${c.line}` }}>
          <div style={{ maxWidth: 1184, margin: '0 auto', height: 64, padding: '0 32px', display: 'flex', alignItems: 'center', gap: 32 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <img src={logo} alt="" width={32} height={32} style={{ borderRadius: 8 }} />
              <span style={{ fontSize: 17, fontWeight: 600, whiteSpace: 'nowrap' }}>דיווח חודשי</span>
            </div>
            <nav aria-label="ניווט ראשי" style={{ display: 'flex', gap: 4, height: '100%' }}>
              {tabs.map((t) => {
                const on = tab === t.id
                return (
                  <button
                    key={t.id}
                    onClick={() => setTab(t.id)}
                    aria-current={on ? 'page' : undefined}
                    style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '0 12px', background: 'transparent', border: 'none', borderTop: '3px solid transparent', borderBottom: `3px solid ${on ? c.primary : 'transparent'}`, color: on ? c.primary : c.ink2, fontSize: 15, fontWeight: on ? 600 : 400, cursor: 'pointer', transition: `color 200ms ${EASE}, border-color 200ms ${EASE}` }}
                  >
                    <t.icon size={18} />
                    {t.label}
                  </button>
                )
              })}
            </nav>
          </div>
          <div ref={setPageEl} />
        </header>
        <main style={{ flex: 1, width: '100%', maxWidth: 1184, margin: '0 auto', padding: '0 32px 48px' }}>{screen}</main>
        <Toast text={toastText} />
      </div>
    )

  // נייד: כותרת למעלה ותפריט בתחתית
  return (
    <div style={{ minHeight: '100vh', display: 'flex', flexDirection: 'column' }}>
      <header style={{ position: 'sticky', top: 0, zIndex: 20, background: c.primary, color: '#fff' }}>
        <div style={{ height: 64, padding: '0 16px', display: 'flex', alignItems: 'center', gap: 8 }}>
          <img src={logo} alt="" width={32} height={32} style={{ borderRadius: 8, boxShadow: '0 0 0 1px rgba(255,255,255,0.25)' }} />
          <span style={{ fontSize: 17, fontWeight: 600 }}>דיווח חודשי</span>
        </div>
      </header>
      {PROTO && <ProtoBar />}
      <main style={{ flex: 1, width: '100%', padding: '16px 16px 104px' }}>{screen}</main>
      <nav
        aria-label="ניווט ראשי"
        style={{ position: 'fixed', bottom: 0, insetInline: 0, zIndex: 20, background: c.surface, borderTop: `1px solid ${c.line}`, display: 'flex', paddingBottom: 'env(safe-area-inset-bottom)' }}
      >
        {tabs.map((t) => {
          const on = tab === t.id
          return (
            <button
              key={t.id}
              onClick={() => setTab(t.id)}
              aria-current={on ? 'page' : undefined}
              style={{ flex: 1, height: 64, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 4, border: 'none', background: 'transparent', color: on ? c.primary : c.ink3, fontSize: 12, fontWeight: on ? 600 : 400, cursor: 'pointer' }}
            >
              <t.icon size={22} strokeWidth={on ? 2.25 : 1.75} />
              {t.label}
            </button>
          )
        })}
      </nav>
      <Toast text={toastText} lift />
    </div>
  )
}
