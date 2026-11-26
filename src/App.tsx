import logo from '../public/favicon.svg'
import { PROTO, ProtoBar } from './proto'
import { useCallback, useEffect, useRef, useState } from 'react'
import { CalendarDays, Settings as SettingsIcon, ShieldCheck, Users } from 'lucide-react'
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
  layout: Layout
  slots: { bar: HTMLElement | null; head: HTMLElement | null; strip: HTMLElement | null }
}

/** א: תפריט בצד ימין וכרטיס עליון · ב: תפריט צר ופס פעולות קבוע · ג: פס עליון אחד בלי תפריט צד */
export type Layout = 'a' | 'b' | 'c'

export default function App() {
  const [data, setDataRaw] = useState<Data | null>(null)
  const [scans, setScansRaw] = useState<Scan[]>([])
  const [tab, setTab] = useState<Tab>('month')
  const [month, setMonth] = useState(() => monthKey(new Date()))
  const [toastText, setToastText] = useState<string | null>(null)
  const timer = useRef<number | undefined>(undefined)
  const wide = useWide()
  const [layout, setLayout] = useState<Layout>('a')
  const [barEl, setBarEl] = useState<HTMLElement | null>(null)
  const [headEl, setHeadEl] = useState<HTMLElement | null>(null)
  const [stripEl, setStripEl] = useState<HTMLElement | null>(null)

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

  const ctx: Ctx = { data, setData, scans, setScans, month, setMonth, toast, go: setTab, wide, layout, slots: { bar: barEl, head: headEl, strip: stripEl } }
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

  // דסקטופ, פריסה ג: פס עליון אחד עם הלשוניות, בורר החודש והפעולות
  if (wide && layout === 'c')
    return (
      <div style={{ minHeight: '100vh', display: 'flex', flexDirection: 'column' }}>
        {PROTO && <ProtoBar patients={data.patients} layout={layout} setLayout={setLayout} />}
        <header style={{ position: 'sticky', top: 0, zIndex: 20, background: c.surface, borderBottom: `1px solid ${c.line}` }}>
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
            <div ref={setHeadEl} style={{ marginInlineStart: 'auto', display: 'flex', alignItems: 'center', gap: 16 }} />
          </div>
          <div ref={setStripEl} />
        </header>
        <main style={{ flex: 1, width: '100%', maxWidth: 1184, margin: '0 auto', padding: '32px 32px 48px' }}>{screen}</main>
        <Toast text={toastText} />
      </div>
    )

  // דסקטופ, פריסות א ו-ב: תפריט בצד ימין (ב: צר, אייקונים בלבד)
  if (wide) {
    const narrow = layout === 'b'
    return (
      <div style={{ minHeight: '100vh', display: 'flex' }}>
        <aside style={{ position: 'sticky', top: 0, height: '100vh', flex: `0 0 ${narrow ? 80 : 232}px`, background: c.primary, color: '#fff', display: 'flex', flexDirection: 'column', alignItems: narrow ? 'center' : 'stretch', padding: narrow ? '16px 8px' : '24px 16px', gap: narrow ? 24 : 32 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, padding: narrow ? 0 : '0 8px' }}>
            <img src={logo} alt="דיווח חודשי" width={32} height={32} style={{ borderRadius: 8, boxShadow: '0 0 0 1px rgba(255,255,255,0.25)' }} />
            {!narrow && <span style={{ fontSize: 17, fontWeight: 600 }}>דיווח חודשי</span>}
          </div>
          <nav aria-label="ניווט ראשי" style={{ display: 'flex', flexDirection: 'column', gap: narrow ? 8 : 4, alignSelf: 'stretch' }}>
            {tabs.map((t) => {
              const on = tab === t.id
              return (
                <button
                  key={t.id}
                  onClick={() => setTab(t.id)}
                  aria-current={on ? 'page' : undefined}
                  style={{
                    display: 'flex',
                    flexDirection: narrow ? 'column' : 'row',
                    alignItems: 'center',
                    justifyContent: narrow ? 'center' : 'flex-start',
                    gap: narrow ? 4 : 12,
                    height: narrow ? 64 : 44,
                    padding: narrow ? 0 : '0 12px',
                    borderRadius: 8,
                    border: 'none',
                    background: on ? 'rgba(255,255,255,0.14)' : 'transparent',
                    color: on ? '#fff' : 'rgba(255,255,255,0.76)',
                    fontSize: narrow ? 12 : 15,
                    fontWeight: on ? 600 : 400,
                    cursor: 'pointer',
                    textAlign: 'start',
                    transition: `background 200ms ${EASE}, color 200ms ${EASE}`,
                  }}
                >
                  <t.icon size={narrow ? 22 : 20} strokeWidth={on ? 2.25 : 1.75} />
                  {t.label}
                </button>
              )
            })}
          </nav>
          <div title="המידע נשמר רק במכשיר הזה" style={{ marginTop: 'auto', display: 'flex', gap: 8, alignItems: 'flex-start', padding: narrow ? 0 : '0 8px', fontSize: 13, lineHeight: 1.5, color: 'rgba(255,255,255,0.76)' }}>
            <ShieldCheck size={narrow ? 20 : 16} style={{ flex: '0 0 auto', marginTop: 2, color: '#7FD1AE' }} />
            {!narrow && <span>המידע נשמר רק במכשיר הזה</span>}
          </div>
        </aside>
        <div style={{ flex: 1, minWidth: 0, display: 'flex', flexDirection: 'column' }}>
          {PROTO && <ProtoBar patients={data.patients} layout={layout} setLayout={setLayout} />}
          {narrow && <div ref={setBarEl} style={{ position: 'sticky', top: 0, zIndex: 15 }} />}
          <main style={{ flex: 1, width: '100%', maxWidth: 1184, margin: '0 auto', padding: '32px 32px 48px' }}>{screen}</main>
        </div>
        <Toast text={toastText} />
      </div>
    )
  }

  // נייד: כותרת למעלה ותפריט בתחתית
  return (
    <div style={{ minHeight: '100vh', display: 'flex', flexDirection: 'column' }}>
      <header style={{ position: 'sticky', top: 0, zIndex: 20, background: c.primary, color: '#fff' }}>
        <div style={{ height: 64, padding: '0 16px', display: 'flex', alignItems: 'center', gap: 8 }}>
          <img src={logo} alt="" width={32} height={32} style={{ borderRadius: 8, boxShadow: '0 0 0 1px rgba(255,255,255,0.25)' }} />
          <span style={{ fontSize: 17, fontWeight: 600 }}>דיווח חודשי</span>
        </div>
      </header>
      {PROTO && <ProtoBar patients={data.patients} />}
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
