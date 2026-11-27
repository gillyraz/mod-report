import ImportSheet from './ImportSheet'
import { useNewPatientShortcut } from './parts'
import { useEffect, useMemo, useRef, useState, type CSSProperties, type ReactNode } from 'react'
import { AlertCircle, AlertTriangle, ScanLine, Sparkles, Check, CheckCircle2, ChevronLeft, Search, FileOutput, FileSpreadsheet, FileStack, FileUp, Paperclip, Pencil, Percent, UserPlus, X } from 'lucide-react'
import type { Ctx } from '../App'
import { Badge, Button, c, EASE, lift, Stepper } from '../ui'
import { calc, ils, missingOf, monthLabel, rateOf, refOf, setVatFrom, uid, updatePatient, vatOf, type Entry, type Patient, type Scan } from '../model'
import { makeThumb } from '../pdf'
import { detectSignatures, SIG_VERSION } from '../detect'
import AssignSheet from './AssignSheet'
import ScanSheet from './ScanSheet'
import { Avatar, MonthSwitcher, PageBar } from './parts'
import PatientForm from './PatientForm'
import ReportSheet from './ReportSheet'
import Tour from './Tour'

type Sort = 'added' | 'first' | 'last'
const firstName = (n: string) => n.trim().split(/\s+/)[0] ?? ''
const lastName = (n: string) => n.trim().split(/\s+/).slice(1).join(' ') || n
const ACCEPT = 'application/pdf,image/jpeg,image/png'
const hasSessions = (e: Entry | undefined) => (e?.signed ?? 0) + (e?.cancelled ?? 0) > 0

export default function MonthScreen({ ctx }: { ctx: Ctx }) {
  const { data, setData, scans, setScans, month, setMonth, toast, wide, headerH } = ctx
  const entries = data.months[month] ?? {}
  const [adding, setAdding] = useState(false)
  const [fixing, setFixing] = useState<Patient | null>(null)
  const [importing, setImporting] = useState(false)
  const [sort, setSort] = useState<Sort>('added')
  const [query, setQuery] = useState('')
  // מצב בחירה להפקת דיווח: מי ייכלל בטבלה
  const [selecting, setSelecting] = useState(false)
  useNewPatientShortcut(() => setAdding(true), !selecting)
  const [picked, setPicked] = useState<Set<string>>(new Set())
  const [reporting, setReporting] = useState<Patient[] | null>(null)
  const [flash, setFlash] = useState<string | null>(null)
  const [assigning, setAssigning] = useState(false)
  const [viewScan, setViewScan] = useState<{ scan: Scan; patient: Patient } | null>(null)
  const [busy, setBusy] = useState(false)
  const bulkInput = useRef<HTMLInputElement>(null)
  const oneInput = useRef<HTMLInputElement>(null)
  const target = useRef<string | null>(null)

  const patients = useMemo(() => {
    const list = data.patients.filter((p) => !p.archived || entries[p.id])
    if (sort === 'first') return [...list].sort((a, b) => firstName(a.name).localeCompare(firstName(b.name), 'he'))
    if (sort === 'last') return [...list].sort((a, b) => lastName(a.name).localeCompare(lastName(b.name), 'he'))
    return list // סדר ההוספה: מטופל חדש תמיד בסוף
  }, [data.patients, entries, sort])
  const q = query.trim()
  const shown = q ? patients.filter((p) => p.name.includes(q) || p.fileNo.includes(q) || refOf(p, entries[p.id]).includes(q)) : patients
  // אפשר להכניס לטבלה רק מטופל שיש לו מפגשים וגם סריקה של הטופס
  const hasScan = (id: string) => scans.some((x) => x.id === entries[id]?.scanId)
  const incomplete = (id: string) => {
    const p = data.patients.find((x) => x.id === id)
    return !p || missingOf(p, entries[id]).length > 0
  }
  // וגם כל הפרטים שלו מלאים (מספר תיק, הפנייה וסכום)
  const canReport = (id: string) => hasSessions(entries[id]) && hasScan(id) && !incomplete(id)
  const eligible = patients.filter((p) => canReport(p.id))
  // הטבלה של החודש: מתי נשמרה, ואם הנתונים השתנו מאז
  const sumOf = (ids: string[]) => ids.reduce((a, id) => {
    const p = data.patients.find((x) => x.id === id)
    return p ? a + calc(p, entries[id], vatOf(data, month)).total : a
  }, 0)
  const rep = data.reports?.[month]
  const repChanged = !!rep && (Math.abs(sumOf(rep.ids) - rep.total) > 0.005 || rep.ids.some((id) => !canReport(id)))
  const notIn = rep ? eligible.filter((p) => !rep.ids.includes(p.id)).length : 0

  const setEntry = (pid: string, fn: (e: Entry) => Entry) =>
    setData((d) => {
      const m = d.months[month] ?? {}
      const cur = m[pid] ?? { signed: 0, cancelled: 0 }
      return { ...d, months: { ...d.months, [month]: { ...m, [pid]: fn(cur) } } }
    })

  const assignedIds = new Set(Object.values(entries).map((e) => e.scanId).filter(Boolean))
  const unassigned = scans.filter((x) => x.month === month && !assignedIds.has(x.id))

  const attach = (pid: string, scanId: string | undefined) => {
    const old = entries[pid]?.scanId
    setEntry(pid, (e) => ({ ...e, scanId }))
    if (old && old !== scanId) setScans((s0) => s0.filter((x) => x.id !== old))
  }

  // שיוך אוטומטי לפי מספר הפנייה, מספר תיק או שם בשם הקובץ
  const guess = (name: string): Patient | undefined => {
    const n = name.replace(/\.[^.]+$/, '')
    // מספר נחשב רק כשהוא עומד בפני עצמו בשם הקובץ, לא כחלק ממספר ארוך יותר
    const num = (x: string) => !!x && new RegExp(`(^|\\D)${x}(\\D|$)`).test(n)
    return patients.find((p) => !entries[p.id]?.scanId && (num(refOf(p, entries[p.id])) || num(p.fileNo) || n.includes(p.name)))
  }

  const importFiles = async (files: FileList | File[] | null, forPatient?: string) => {
    if (!files?.length) return
    setBusy(true)
    const made: Scan[] = []
    for (const f of Array.from(files)) {
      made.push({ id: uid(), name: f.name, type: f.type || 'application/pdf', blob: f, thumb: await makeThumb(f), month, addedAt: Date.now() })
    }
    setScans((s0) => [...s0, ...made])
    setBusy(false)
    if (forPatient) {
      attach(forPatient, made[0].id)
      toast('הסריקה צורפה')
      return
    }
    let auto = 0
    for (const x of made) {
      const p = guess(x.name)
      if (p) {
        attach(p.id, x.id)
        auto++
      }
    }
    if (auto === made.length) toast(auto === 1 ? 'הסריקה שויכה אוטומטית לפי שם הקובץ' : `${auto} סריקות שויכו אוטומטית לפי שם הקובץ`)
    else setAssigning(true)
  }

  // ספירת החתימות בכל סריקה, ברקע ועל המחשב עצמו
  const counting = useRef(new Set<string>())
  useEffect(() => {
    const todo = scans.filter((x) => x.sigV !== SIG_VERSION && !counting.current.has(x.id))
    if (!todo.length) return
    todo.forEach((x) => counting.current.add(x.id))
    void (async () => {
      for (const x of todo) {
        const sig = await detectSignatures(x.blob)
        setScans((s0) => s0.map((y) => (y.id === x.id ? { ...y, sig, sigV: SIG_VERSION } : y)))
        counting.current.delete(x.id)
      }
    })()
  }, [scans, setScans])

  // גרסת הניסיון: ייבוא סריקות לדוגמה
  const importRef = useRef(importFiles)
  importRef.current = importFiles
  useEffect(() => {
    const on = (e: Event) => void importRef.current((e as CustomEvent<File[]>).detail)
    window.addEventListener('proto-import', on)
    return () => window.removeEventListener('proto-import', on)
  }, [])

  // מטופל חדש: גלילה אל השורה שלו והדגשה קצרה
  useEffect(() => {
    if (!flash) return
    const el = document.getElementById(`row-${flash}`)
    el?.scrollIntoView({ behavior: 'smooth', block: 'center' })
    const t = window.setTimeout(() => setFlash(null), 2400)
    return () => window.clearTimeout(t)
  }, [flash])

  // מטופל שאין לו מפגשים יוצא מהבחירה
  useEffect(() => {
    if (!selecting) return
    setPicked((s) => new Set([...s].filter((id) => canReport(id))))
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [entries, scans, selecting])

  const startSelect = (only?: string[]) => {
    setPicked(new Set(eligible.map((p) => p.id).filter((id) => !only || only.includes(id))))
    setSelecting(true)
  }
  const toggle = (id: string) =>
    setPicked((s) => {
      const n = new Set(s)
      if (n.has(id)) n.delete(id)
      else n.add(id)
      return n
    })
  const allOn = eligible.length > 0 && eligible.every((p) => picked.has(p.id))

  const addForm = adding && (
    <PatientForm
      others={data.patients}
      month={month}
      onClose={() => setAdding(false)}
      onSave={(p) => {
        setData((d) => ({ ...d, patients: [...d.patients, p] }))
        setAdding(false)
        setFlash(p.id)
        toast(`${p.name} נוסף לרשימה`)
      }}
    />
  )

  // השלמת פרטים חסרים של מטופל, בלי לעזוב את עמוד החודש
  const fixForm = fixing && (
    <PatientForm
      others={data.patients}
      month={month}
      patient={fixing}
      onClose={() => setFixing(null)}
      onSave={(p) => {
        setData((d) => updatePatient(d, p, month))
        setFixing(null)
        toast('הפרטים נשמרו')
      }}
    />
  )

  const importForm = importing && <ImportSheet ctx={ctx} onClose={() => setImporting(false)} />

  // מטופל שעבר מקבוצה לקבוצה (הפך למוכן או הפסיק להיות מוכן) מודגש לרגע, כדי שהעין תעקוב אחריו
  const readyKey = eligible.map((p) => p.id).join(',')
  const prevReady = useRef<{ month: string; ids: Set<string> } | null>(null)
  useEffect(() => {
    const now = new Set(readyKey ? readyKey.split(',') : [])
    const prev = prevReady.current
    prevReady.current = { month, ids: now }
    if (!prev || prev.month !== month) return
    const moved = [...now].find((id) => !prev.ids.has(id)) ?? [...prev.ids].find((id) => !now.has(id))
    if (moved && document.getElementById(`row-${moved}`)) setFlash(moved)
  }, [readyKey, month])

  // הפס המצומצם מופיע כשכרטיס הסיכום מתחיל להיגלל מתחת לסרגל העליון (הכפתורים שמעליו כבר יצאו מהמסך)
  const heroRef = useRef<HTMLElement>(null)
  const [compact, setCompact] = useState(false)
  useEffect(() => {
    const el = heroRef.current
    if (!el || !wide) return setCompact(false)
    // נמדד ישירות בכל גלילה ושינוי גודל, כדי שהפס לא ייתקע פתוח אחרי גלילה אוטומטית או מעבר ממסך הפתיחה
    let raf = 0
    const check = () => {
      cancelAnimationFrame(raf)
      raf = requestAnimationFrame(() => setCompact(el.isConnected && el.getBoundingClientRect().top < headerH - 8))
    }
    check()
    addEventListener('scroll', check, { passive: true })
    addEventListener('resize', check)
    const ro = new ResizeObserver(check)
    ro.observe(document.body)
    return () => (cancelAnimationFrame(raf), removeEventListener('scroll', check), removeEventListener('resize', check), ro.disconnect())
  }, [wide, headerH, patients.length > 0])

  // אין מטופלים להציג בחודש הזה (גם לא מטופל בארכיון שיש לו נתונים בחודש)
  if (patients.length === 0) {
    return (
      <div style={{ display: 'flex', flexDirection: 'column', gap: wide ? 40 : 24 }}>
        {wide && <PageBar ctx={ctx} title="החודש" sub="מתחילים ברשימת המטופלים, ואחר כך מסכמים את החודש." />}
        <Welcome ctx={ctx} archived={data.patients.filter((p) => p.archived).length} onAdd={() => setAdding(true)} onImport={() => setImporting(true)} />
        {addForm}
        {importForm}
      </div>
    )
  }

  const vat = vatOf(data, month)
  const readyTotal = eligible.reduce((a, p) => a + calc(p, entries[p.id], vat).total, 0)
  const rest = patients.length - eligible.length
  const readyList = shown.filter((p) => canReport(p.id))
  const needList = shown.filter((p) => !canReport(p.id))

  const hint = 'אפשר לסמן רק מטופלים עם מפגשים וסריקה מצורפת'
  const selectActions = (
    <>
      <Button kind="primary" icon={<FileOutput size={18} />} disabled={!picked.size} onClick={() => setReporting(patients.filter((p) => picked.has(p.id)))}>
        {picked.size === 1 ? 'הפקת טבלה למטופל אחד' : `הפקת טבלה ל-${picked.size} מטופלים`}
      </Button>
      <Button kind="ghost" icon={<X size={18} />} onClick={() => setSelecting(false)}>
        ביטול
      </Button>
    </>
  )

  const COLS = `${selecting ? '40px ' : ''}minmax(200px, 1fr) 120px 120px minmax(104px, 152px) 176px`

  const glass: CSSProperties = { padding: '16px 20px', borderRadius: 16, background: 'rgba(255,255,255,0.75)', backdropFilter: 'blur(8px)', boxShadow: '0 1px 2px rgba(16,24,40,0.04)', minWidth: wide ? 184 : 0, flex: wide ? '0 0 auto' : '1 1 140px' }
  const inner: CSSProperties = { position: 'relative', display: 'flex', alignItems: 'center', gap: 12, padding: '0 16px', minHeight: 52, borderRadius: 14, background: 'rgba(255,255,255,0.82)', fontSize: 14 }
  const chip = (bg: string, fg: string, icon: ReactNode) => (
    <span style={{ flex: '0 0 28px', height: 28, borderRadius: 9, background: bg, color: fg, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>{icon}</span>
  )

  const hero = (
    <section ref={heroRef} aria-label="סיכום החודש" style={{ position: 'relative', overflow: 'hidden', marginTop: wide ? 24 : 0, marginBottom: wide ? 8 : 0, borderRadius: 24, background: 'linear-gradient(120deg, #EEF3FF 0%, #E6EDFF 45%, #EFEAFF 100%)', boxShadow: '0 0 0 1px rgba(69,102,232,0.10), 0 10px 30px -14px rgba(69,102,232,0.35)' }}>
      <span aria-hidden style={{ position: 'absolute', width: 320, height: 320, borderRadius: '50%', left: -60, top: -140, background: 'radial-gradient(circle, rgba(255,255,255,0.9), transparent 65%)' }} />
      <span aria-hidden style={{ position: 'absolute', width: 260, height: 260, borderRadius: '50%', left: 280, bottom: -170, background: 'radial-gradient(circle, rgba(168,140,255,0.28), transparent 65%)' }} />
      <div style={{ position: 'relative', padding: wide ? 32 : 20, display: 'flex', flexWrap: 'wrap', alignItems: 'center', columnGap: 32, rowGap: 20 }}>
        <div style={{ flex: '1 1 320px', minWidth: 0 }}>
          <span style={{ display: 'inline-flex', alignItems: 'center', gap: 6, height: 26, padding: '0 10px', borderRadius: 999, background: 'rgba(255,255,255,0.7)', color: c.primaryInk, fontSize: 12, fontWeight: 600 }}>
            <CheckCircle2 size={14} />
            מוכן לדיווח החודש
          </span>
          <div style={{ display: 'flex', alignItems: 'baseline', columnGap: 12, flexWrap: 'wrap', marginTop: 12 }}>
            <span style={{ fontSize: wide ? 48 : 36, fontWeight: 600, letterSpacing: -1.2, lineHeight: 1.05, color: c.navy, fontVariantNumeric: 'tabular-nums' }}>{ils(readyTotal)}</span>
            <span style={{ color: c.ink2, fontSize: 16 }}>{eligible.length === 1 ? 'מטופל אחד' : `${eligible.length} מטופלים`}</span>
          </div>
          <Segments n={eligible.length} t={patients.length} />
          <div style={{ marginTop: 8, fontSize: 13, color: c.ink2 }}>
            <b style={{ color: c.ink, fontWeight: 600, fontVariantNumeric: 'tabular-nums' }}>
              {eligible.length} מתוך {patients.length}
            </b>{' '}
            מטופלים מוכנים.{rest > 0 ? ` ${rest === 1 ? 'מטופל אחד צריך' : `${rest} צריכים`} השלמה.` : ' כולם מוכנים.'}
          </div>
        </div>
        <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap', flex: wide ? '0 0 auto' : '1 1 100%' }}>
          <div style={glass}>
            <div style={{ fontSize: 12, color: c.ink3, fontWeight: 500 }}>מע״מ</div>
            <div style={{ marginTop: 6 }}>
              <VatInline ctx={ctx} />
            </div>
          </div>
        </div>
      </div>
      {((rep && !selecting) || (unassigned.length > 0 && !selecting)) && (
        <div style={{ position: 'relative', display: 'flex', flexDirection: 'column', gap: 8, padding: wide ? '0 12px 12px' : '0 8px 8px' }}>
          {rep && !selecting && (
            <div role="status" style={inner}>
              {repChanged ? chip(c.warnBg, c.warn, <AlertTriangle size={15} />) : chip(c.okBg, c.ok, <CheckCircle2 size={15} />)}
              <span style={{ flex: 1, lineHeight: 1.5, padding: '8px 0' }}>
                <b style={{ fontWeight: 600 }}>הטבלה של {monthLabel(month)} נשמרה ב-{new Date(rep.at).toLocaleDateString('he-IL')}</b>{' '}
                <span style={{ color: c.ink3 }}>
                  · {rep.ids.length === 1 ? 'מטופל אחד' : `${rep.ids.length} מטופלים`}, {ils(rep.total)}
                </span>
                {repChanged ? <span style={{ color: c.warn }}>. הנתונים השתנו מאז, וכדאי להפיק אותה מחדש.</span> : notIn > 0 ? <span style={{ color: c.warn }}>{`. ${notIn === 1 ? 'מטופל מוכן אחד לא נכלל' : `${notIn} מטופלים מוכנים לא נכללו`} בה.`}</span> : ''}
              </span>
              {eligible.length > 0 && (
                <Button kind="ghost" icon={<FileOutput size={18} />} onClick={() => startSelect(rep.ids)} style={{ color: c.primary, fontWeight: 600, height: 36 }}>
                  הפקה מחדש של הטבלה
                </Button>
              )}
            </div>
          )}
          {unassigned.length > 0 && !selecting && (
            <button onClick={() => setAssigning(true)} style={{ ...inner, border: 'none', width: '100%', cursor: 'pointer', textAlign: 'start', font: 'inherit', color: c.ink }}>
              {chip(c.warnBg, c.warn, <FileStack size={15} />)}
              <span style={{ flex: 1 }}>
                <b style={{ fontWeight: 600 }}>{unassigned.length === 1 ? 'סריקה אחת ממתינה' : `${unassigned.length} סריקות ממתינות`}</b>{' '}
                <span style={{ color: c.ink3 }}>{unassigned.length === 1 ? 'ועדיין לא שויכה לאף מטופל' : 'ועדיין לא שויכו למטופלים'}</span>
              </span>
              <span style={{ display: 'inline-flex', alignItems: 'center', gap: 4, fontWeight: 600, color: c.primary }}>
                {unassigned.length === 1 ? 'שיוך הסריקה למטופל' : 'שיוך הסריקות למטופלים'}
                <ChevronLeft size={16} />
              </span>
            </button>
          )}
        </div>
      )}
    </section>
  )

  const pageActions = (h = 40) => (
    <>
      <Button icon={<FileUp size={18} />} onClick={() => bulkInput.current?.click()} disabled={busy || selecting} style={{ flex: wide ? undefined : 1, height: h }}>
        {busy ? 'קורא קבצים…' : 'ייבוא סריקות'}
      </Button>
      <span data-tour="report" style={{ display: 'flex', flex: wide ? undefined : 1 }}>
      <Button kind="primary" icon={<FileOutput size={18} />} onClick={() => startSelect()} disabled={!eligible.length || selecting} title={!eligible.length ? 'אין עדיין מטופל עם מפגשים וסריקה' : undefined} style={{ flex: wide ? undefined : 1, height: h }}>
        הפקת דיווח
      </Button>
      </span>
    </>
  )

  // פס מצומצם: כשהכותרת וכרטיס הסיכום נגללים החוצה, החודש, הסכומים והפעולות נשארים למעלה
  const compactBar = wide && compact && (
    <div style={{ position: 'fixed', top: headerH, insetInline: 0, zIndex: 15, padding: '12px 0', background: c.bg, backdropFilter: 'blur(10px)', WebkitBackdropFilter: 'blur(10px)', animation: `drop 320ms ${EASE}` }}>
      <div style={{ maxWidth: 1184, margin: '0 auto', padding: '0 32px' }}>
        <div role="region" aria-label="סיכום החודש מצומצם" style={{ pointerEvents: 'auto', display: 'flex', alignItems: 'center', gap: 20, height: 64, padding: '0 12px', paddingInlineStart: 20, borderRadius: 18, background: c.surface, backdropFilter: 'blur(16px)', WebkitBackdropFilter: 'blur(16px)', boxShadow: '0 0 0 1px rgba(69,102,232,0.10), 0 12px 28px -12px rgba(16,24,40,0.18)' }}>
          <span style={{ fontWeight: 600, fontSize: 16 }}>החודש</span>
          <MonthSwitcher month={month} setMonth={setMonth} disabled={selecting} compact />
          <span style={{ width: 1, height: 28, background: c.line }} />
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <Ring n={eligible.length} t={patients.length} />
            <div>
              <div style={{ fontSize: 11, color: c.ink3, fontWeight: 500 }}>
                מוכן לדיווח · {eligible.length} מתוך {patients.length}
              </div>
              <div style={{ fontWeight: 600, fontSize: 16, color: c.navy, fontVariantNumeric: 'tabular-nums' }}>{ils(readyTotal)}</div>
            </div>
          </div>
          <span style={{ flex: 1 }} />
          <div style={{ display: 'flex', gap: 8 }}>{pageActions(40)}</div>
        </div>
      </div>
    </div>
  )

  const sortSelect = (
    <select
      aria-label="מיון המטופלים"
      value={sort}
      onChange={(e) => setSort(e.target.value as Sort)}
      style={{ height: 28, borderRadius: 8, border: 'none', background: 'transparent', color: c.ink, padding: '0 4px', fontSize: 12, fontWeight: 600, cursor: 'pointer' }}
    >
      <option value="added">לפי סדר ההוספה</option>
      <option value="first">לפי שם פרטי</option>
      <option value="last">לפי שם משפחה</option>
    </select>
  )

  const colHead = (first: boolean, ready: boolean) =>
    wide && (
      <div style={{ display: 'grid', gridTemplateColumns: COLS, gap: 'clamp(12px, 1.6vw, 24px)', alignItems: 'center', padding: '0 24px 8px', fontSize: 12, color: c.ink3, fontWeight: 500 }}>
        {selecting &&
          (ready ? (
            <Check4
              checked={allOn}
              mixed={!allOn && picked.size > 0}
              disabled={!eligible.length}
              label={allOn ? 'ביטול הסימון של כולם' : 'סימון כל המטופלים שאפשר לדווח'}
              onChange={() => setPicked(allOn ? new Set() : new Set(eligible.map((p) => p.id)))}
            />
          ) : (
            <span />
          ))}
        <span style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
          מטופל
          {first && (
            <>
              <span aria-hidden>·</span>
              {sortSelect}
            </>
          )}
        </span>
        <span>מפגשים חתומים</span>
        <span>ביטולים ללא הודעה</span>
        <span>סה״כ לטופס</span>
        <span />
      </div>
    )

  const rowOf = (p: Patient) => (
    <Row
      key={p.id}
      p={p}
      e={entries[p.id]}
      ctx={ctx}
      cols={COLS}
      flash={flash === p.id}
      report={rep ? { at: rep.at, has: rep.ids.includes(p.id) } : undefined}
      select={selecting ? { on: picked.has(p.id), can: canReport(p.id), toggle: () => toggle(p.id) } : undefined}
      scan={scans.find((x) => x.id === entries[p.id]?.scanId)}
      onAttach={() => {
        target.current = p.id
        oneInput.current?.click()
      }}
      onView={(scan) => setViewScan({ scan, patient: p })}
      onEntry={(fn) => setEntry(p.id, fn)}
      onFix={() => setFixing(p)}
    />
  )

  const showReady = readyList.length > 0 || !q
  const showNeed = needList.length > 0

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: wide ? 0 : 24 }}>
      <PageBar
        ctx={ctx}
        title="החודש"
        sub="מזינים מפגשים, מצרפים סריקות ומפיקים את הטבלה החודשית."
        lead={<span data-tour="month" style={{ display: 'inline-flex' }}><MonthSwitcher month={month} setMonth={setMonth} disabled={selecting} /></span>}
        actions={pageActions()}
      />

      {hero}
      {compactBar}

      {/* כותרת הרשימה: נשארת במקום בגלילה */}
      <div style={{ position: wide ? 'sticky' : 'static', top: headerH + (compact ? 88 : 0), zIndex: 10, background: wide ? c.bg : 'transparent', backdropFilter: wide ? 'blur(10px)' : undefined, paddingTop: wide ? 16 : 0, paddingBottom: wide ? 16 : 0, transition: `top 320ms ${EASE}`, display: 'flex', alignItems: 'center', gap: 16, flexWrap: 'wrap' }}>
        <h2 style={{ margin: 0, fontSize: 18, fontWeight: 600, whiteSpace: 'nowrap' }}>
          מטופלים <span style={{ color: c.ink4, fontWeight: 400, fontVariantNumeric: 'tabular-nums' }}>{q ? `${shown.length} מתוך ${patients.length}` : patients.length}</span>
        </h2>
        <label style={{ position: 'relative', display: 'flex', alignItems: 'center', flex: wide ? '0 0 296px' : '1 1 200px' }}>
          <Search size={18} style={{ position: 'absolute', insetInlineStart: 12, color: c.ink4, pointerEvents: 'none' }} />
          <input
            type="search"
            aria-label="חיפוש מטופל לפי שם, מספר תיק או מספר הפנייה"
            placeholder="חיפוש לפי שם, תיק או הפנייה"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            style={{ width: '100%', height: 40, borderRadius: 12, border: 'none', boxShadow: `0 0 0 1px ${c.fieldLine}`, background: c.field, color: c.ink, padding: '0 12px', paddingInlineStart: 40, fontSize: 14 }}
          />
        </label>
        {!wide && (
          <select aria-label="מיון המטופלים" value={sort} onChange={(e) => setSort(e.target.value as Sort)} style={{ height: 40, borderRadius: 10, border: 'none', boxShadow: `0 0 0 1px ${c.fieldLine}`, background: c.field, color: c.ink, padding: '0 8px', fontSize: 14 }}>
            <option value="added">לפי סדר ההוספה</option>
            <option value="first">לפי שם פרטי</option>
            <option value="last">לפי שם משפחה</option>
          </select>
        )}
        <span style={{ flex: 1 }} />
        <Button icon={<UserPlus size={18} />} onClick={() => setAdding(true)} disabled={selecting} title="קיצור מקלדת: N" aria-keyshortcuts="N">
          הוספת מטופל
        </Button>
      </div>

      <div style={{ display: 'flex', flexDirection: 'column', gap: 16, paddingBottom: selecting || wide ? 120 : 0 }}>
        {q && !shown.length && (
          <div style={{ padding: 24, background: c.surface, boxShadow: lift, borderRadius: 16, fontSize: 15, color: c.ink2, display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 16 }}>
            <span>אין מטופל שמתאים ל״{q}״.</span>
            <Button kind="ghost" onClick={() => setQuery('')}>ניקוי החיפוש</Button>
          </div>
        )}
        {showReady && (
          <Group tone="ok" title="מוכנים לדיווח" count={readyList.length} head={colHead(true, true)}>
            {readyList.length ? (
              readyList.map(rowOf)
            ) : (
              <div style={{ padding: '20px 24px', background: c.surface, borderRadius: 12, fontSize: 14, color: c.ink2, lineHeight: 1.5 }}>
                עדיין אין מטופל מוכן לדיווח. מטופל נכנס לכאן כשיש לו מפגשים החודש וסריקה מצורפת של הטופס החתום.
              </div>
            )}
          </Group>
        )}
        {showNeed && (
          <Group tone="warn" title="צריכים השלמה" count={needList.length} head={colHead(!showReady, false)}>
            {needList.map(rowOf)}
          </Group>
        )}
      </div>

      {/* נייד: פעולות הבחירה בפס תחתון */}
      {!wide && selecting && (
        <div style={{ position: 'fixed', insetInline: 0, bottom: 'calc(64px + env(safe-area-inset-bottom))', zIndex: 18, background: c.surface, borderTop: `1px solid ${c.line}`, padding: '12px 16px', display: 'flex', flexDirection: 'column', gap: 8 }}>
          <span style={{ fontSize: 13, color: c.ink2 }}>{hint}</span>
          <div style={{ display: 'flex', gap: 8 }}>{selectActions}</div>
        </div>
      )}

      {/* פס פעולות צף בתחתית המסך בזמן הבחירה */}
      {wide && selecting && (
        <div style={{ position: 'fixed', insetInline: 0, bottom: 24, zIndex: 18, display: 'flex', justifyContent: 'center', pointerEvents: 'none' }}>
          <div style={{ pointerEvents: 'auto', background: c.surface, border: `1px solid ${c.line}`, borderRadius: 16, boxShadow: '0 12px 32px rgba(16,22,34,0.18)', padding: '12px 12px 12px 16px', paddingInlineStart: 24, display: 'flex', alignItems: 'center', gap: 24, animation: `rise 320ms ${EASE}` }}>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
              <span style={{ fontSize: 16, fontWeight: 600 }}>{picked.size === 1 ? 'נבחר מטופל אחד' : `נבחרו ${picked.size} מטופלים`}</span>
              <span style={{ fontSize: 13, color: c.ink2 }}>{hint}</span>
            </div>
            <div style={{ display: 'flex', gap: 8 }}>{selectActions}</div>
          </div>
        </div>
      )}

      <input ref={bulkInput} type="file" accept={ACCEPT} multiple hidden onChange={(e) => (importFiles(e.target.files), (e.target.value = ''))} />
      <input ref={oneInput} type="file" accept={ACCEPT} hidden onChange={(e) => (importFiles(e.target.files, target.current ?? undefined), (e.target.value = ''))} />

      {addForm}
      {importForm}
      {fixForm}
      {assigning && (
        <AssignSheet
          scans={unassigned}
          patients={patients}
          entries={entries}
          onSave={(choices) => {
            const del = Object.keys(choices).filter((sid) => choices[sid] === 'delete')
            const pairs = Object.entries(choices).filter(([, v]) => v !== 'delete')
            for (const [sid, pid] of pairs) attach(pid, sid)
            if (del.length) setScans((s0) => s0.filter((x) => !del.includes(x.id)))
            setAssigning(false)
            const left = unassigned.length - pairs.length - del.length
            toast(left > 0 ? `${left === 1 ? 'סריקה אחת עדיין ממתינה' : `${left} סריקות עדיין ממתינות`} לשיוך` : 'כל הסריקות שויכו')
          }}
          onClose={() => setAssigning(false)}
        />
      )}
      {viewScan && (
        <ScanSheet
          scan={scans.find((x) => x.id === viewScan.scan.id) ?? viewScan.scan}
          patient={viewScan.patient}
          signed={entries[viewScan.patient.id]?.signed ?? 0}
          onApply={(n) => {
            setEntry(viewScan.patient.id, (e) => ({ ...e, signed: n }))
            toast(`הוזנו ${n} מפגשים חתומים ל${viewScan.patient.name}`)
          }}
          onReplace={() => {
            target.current = viewScan.patient.id
            setViewScan(null)
            oneInput.current?.click()
          }}
          onRemove={() => {
            const { scan, patient } = viewScan
            attach(patient.id, undefined)
            setScans((s0) => s0.filter((x) => x.id !== scan.id))
            setViewScan(null)
            toast(`הסריקה של ${patient.name} הוסרה`, {
              label: 'ביטול ההסרה',
              run: () => {
                setScans((s0) => [...s0, scan])
                setEntry(patient.id, (e) => ({ ...e, scanId: scan.id }))
              },
            })
          }}
          onClose={() => setViewScan(null)}
        />
      )}
      {reporting && (
        <ReportSheet
          ctx={ctx}
          list={reporting}
          onClose={() => setReporting(null)}
          onDone={() => {
            const ids = reporting.map((p) => p.id)
            setData((d) => ({ ...d, reports: { ...(d.reports ?? {}), [month]: { at: Date.now(), ids, total: Math.round(sumOf(ids) * 100) / 100 } } }))
            setReporting(null)
            setSelecting(false)
          }}
        />
      )}
      <Tour ready={wide && patients.length > 0 && !selecting && !adding && !fixing && !importing && !reporting && !assigning && !viewScan} headerH={headerH} />
    </div>
  )
}

/** תיבת סימון בגודל נוח ללחיצה */
function Check4({ checked, mixed, disabled, label, onChange }: { checked: boolean; mixed?: boolean; disabled?: boolean; label: string; onChange: () => void }) {
  return (
    <button
      role="checkbox"
      aria-checked={mixed ? 'mixed' : checked}
      aria-label={label}
      title={label}
      disabled={disabled}
      onClick={onChange}
      style={{ width: 40, height: 40, display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'transparent', border: 'none', padding: 0, cursor: disabled ? 'not-allowed' : 'pointer' }}
    >
      <span
        style={{
          width: 22,
          height: 22,
          borderRadius: 6,
          border: `2px solid ${disabled ? c.line : checked || mixed ? c.primary : c.ink3}`,
          background: checked || mixed ? c.primary : c.surface,
          color: '#fff',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          transition: `background 160ms ${EASE}, border-color 160ms ${EASE}`,
        }}
      >
        {checked ? <Check size={16} strokeWidth={3} /> : mixed ? <span style={{ width: 10, height: 2, background: '#fff', borderRadius: 1 }} /> : null}
      </span>
    </button>
  )
}

function Row({
  p,
  e,
  ctx,
  cols,
  flash,
  report,
  select,
  scan,
  onAttach,
  onView,
  onEntry,
  onFix,
}: {
  p: Patient
  e: Entry | undefined
  ctx: Ctx
  cols: string
  flash: boolean
  report?: { at: number; has: boolean }
  select?: { on: boolean; can: boolean; toggle: () => void }
  scan: Scan | undefined
  onAttach: () => void
  onView: (s: Scan) => void
  onEntry: (fn: (e: Entry) => Entry) => void
  onFix: () => void
}) {
  const { wide, data } = ctx
  const r = calc(p, e, vatOf(data, ctx.month))
  const has = r.sessions > 0
  const missing = missingOf(p, e)
  const ready = has && !!scan && !missing.length
  const dim = select && !select.can
  const need = missing.length ? `חסר: ${missing.join(', ')}` : ready ? null : has ? 'חסרה סריקה של הטופס החתום' : scan ? 'לא הוזנו מפגשים החודש' : 'לא הוזנו מפגשים ואין סריקה'
  const meta = `תיק ${p.fileNo} · הפנייה ${refOf(p, e)} · ${ils(rateOf(p, e))} למפגש`

  const who = (
    <div style={{ display: 'flex', alignItems: 'center', gap: 16, minWidth: 0 }}>
      <Avatar name={p.name} />
      <div style={{ display: 'flex', flexDirection: 'column', gap: 4, minWidth: 0 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
          <span style={{ fontWeight: 600, fontSize: 16 }}>{p.name}</span>
          {ready && report && (report.has ? (
            <Badge tone="ok">
              <CheckCircle2 size={14} /> בטבלה מ-{new Date(report.at).toLocaleDateString('he-IL', { day: 'numeric', month: 'numeric' })}
            </Badge>
          ) : (
            <Badge tone="warn">מוכן, לא בטבלה</Badge>
          ))}
          {report?.has && !ready && <Badge tone="muted">היה בטבלה</Badge>}
        </div>
        {need ? (
          <span title={meta} style={{ display: 'flex', alignItems: 'center', gap: 4, fontSize: 13, color: c.warn, fontWeight: 500 }}>
            <AlertCircle size={14} style={{ flex: '0 0 14px' }} />
            {need}
            {missing.length > 0 && !select && (
              <button onClick={onFix} style={{ border: 'none', background: 'transparent', padding: '0 4px', font: 'inherit', fontSize: 13, fontWeight: 600, color: c.primary, cursor: 'pointer', textDecoration: 'underline', textUnderlineOffset: 3 }}>
                השלמת הפרטים
              </button>
            )}
          </span>
        ) : (
          <span style={{ fontSize: 13, color: c.ink3, fontVariantNumeric: 'tabular-nums', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }} title={meta}>{meta}</span>
        )}
      </div>
    </div>
  )

  const sums = has ? (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
      <span style={{ fontSize: 18, fontWeight: 600, fontVariantNumeric: 'tabular-nums', letterSpacing: -0.2 }}>{ils(r.total)}</span>
      <span style={{ fontSize: 12, color: c.ink3, fontVariantNumeric: 'tabular-nums' }}>{r.vat > 0 ? `מתוכם מע״מ ${ils(r.vat)}` : 'ללא מע״מ'}</span>
    </div>
  ) : (
    <span style={{ fontSize: 14, color: c.ink4 }}>אין סכום</span>
  )

  const scanCell = scan ? (
    <button
      onClick={() => onView(scan)}
      title="הצגת הסריקה"
      className="row-btn"
      style={{ display: 'flex', alignItems: 'center', gap: 12, height: 52, padding: '0 8px', background: 'transparent', border: 'none', borderRadius: 10, cursor: 'pointer', color: c.ink, minWidth: 0, font: 'inherit', textAlign: 'start' }}
    >
      {scan.thumb ? (
        <img src={scan.thumb} alt="" style={{ width: 28, height: 36, objectFit: 'cover', objectPosition: 'top', borderRadius: 4, boxShadow: `0 0 0 1px ${c.line}` }} />
      ) : (
        <Paperclip size={18} />
      )}
      <span style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
        <span style={{ fontSize: 14, fontWeight: 500 }}>סריקה מצורפת</span>
        <span style={{ fontSize: 12, color: c.ink3 }}>הצגה או החלפה</span>
      </span>
    </button>
  ) : (
    <Button icon={<Paperclip size={16} />} onClick={onAttach} style={{ height: 36, padding: '0 12px', fontSize: 14 }}>
      צירוף סריקה
    </Button>
  )

  // מה שזוהה בסריקה: הצעה בלבד, נכנס רק בלחיצה
  const found = scan?.sig?.count
  const signed = e?.signed ?? 0
  const sigHint =
    found === undefined || found === 0 || select ? null : found === signed ? (
      <span title="מספר השורות החתומות בסריקה זהה למספר שהוזן" style={{ display: 'inline-flex', alignItems: 'center', gap: 4, height: 20, fontSize: 12, color: c.ok, fontWeight: 500, whiteSpace: 'nowrap' }}>
        <Check size={14} /> תואם לסריקה
      </span>
    ) : (
      <button
        onClick={() => onEntry((x) => ({ ...x, signed: found }))}
        title={`בסריקה זוהו ${found} שורות חתומות. לחיצה מזינה ${found} מפגשים חתומים`}
        className="link-btn"
        style={{ display: 'inline-flex', alignItems: 'center', gap: 4, height: 20, padding: 0, border: 'none', background: 'transparent', font: 'inherit', fontSize: 12, fontWeight: 600, color: c.primary, cursor: 'pointer', whiteSpace: 'nowrap' }}
      >
        <ScanLine size={14} /> הזנת {found} מהסריקה
      </button>
    )

  const box = select && <Check4 checked={select.on} disabled={!select.can} label={select.can ? `הכללת ${p.name} בטבלה` : `${p.name}: ${need}`} onChange={select.toggle} />

  const look: CSSProperties = {
    opacity: dim ? 0.45 : 1,
    background: flash ? c.okBg : c.surface,
    borderRadius: 16,
    boxShadow: select?.on ? `0 0 0 2px ${c.primary}` : flash ? `0 0 0 2px ${c.ok}` : '0 0 0 1px rgba(16,24,40,0.05), 0 1px 2px rgba(16,24,40,0.04)',
    transition: `opacity 240ms ${EASE}, box-shadow 240ms ${EASE}, background 600ms ${EASE}`,
    animation: `rise 320ms ${EASE}`,
  }

  if (wide)
    return (
      <div id={`row-${p.id}`} style={{ display: 'grid', gridTemplateColumns: cols, gap: 'clamp(12px, 1.6vw, 24px)', alignItems: 'center', padding: sigHint ? '12px 24px 28px' : '12px 24px', minHeight: 80, ...look }}>
        {box}
        {who}
        <div data-tour="sessions" style={{ justifySelf: 'start', position: 'relative' }}>
          <Stepper hideLabel label="מפגשים חתומים" value={e?.signed ?? 0} onChange={(n) => onEntry((x) => ({ ...x, signed: n }))} />
          {sigHint && <div style={{ position: 'absolute', top: 'calc(100% + 4px)', insetInlineStart: 0 }}>{sigHint}</div>}
        </div>
        <Stepper hideLabel label="ביטולים ללא הודעה" value={e?.cancelled ?? 0} onChange={(n) => onEntry((x) => ({ ...x, cancelled: n }))} />
        {sums}
        <div style={{ display: 'flex', justifyContent: 'flex-end' }}><span data-tour="scan" style={{ display: 'flex' }}>{scanCell}</span></div>
      </div>
    )

  return (
    <div id={`row-${p.id}`} style={{ padding: 16, display: 'flex', flexDirection: 'column', gap: 16, ...look }}>
      <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
        {box}
        <div style={{ flex: 1, minWidth: 0 }}>{who}</div>
      </div>
      <div style={{ display: 'flex', gap: 16, flexWrap: 'wrap' }}>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
          <Stepper label="מפגשים חתומים" value={e?.signed ?? 0} onChange={(n) => onEntry((x) => ({ ...x, signed: n }))} />
          {sigHint}
        </div>
        <Stepper label="ביטולים ללא הודעה" value={e?.cancelled ?? 0} onChange={(n) => onEntry((x) => ({ ...x, cancelled: n }))} />
      </div>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 16 }}>
        {sums}
        {scanCell}
      </div>
    </div>
  )
}

/** קבוצת מטופלים על משטח משותף */
function Group({ tone, title, count, head, children }: { tone: 'ok' | 'warn'; title: string; count: number; head: ReactNode; children: ReactNode }) {
  const col = tone === 'ok' ? c.ok : c.warn
  return (
    <section aria-label={title} style={{ background: tone === 'ok' ? c.okSurf : c.group, borderRadius: 24, padding: '16px 8px 8px' }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '0 16px 12px', flexWrap: 'wrap' }}>
        <span style={{ color: col, display: 'flex' }}>{tone === 'ok' ? <CheckCircle2 size={18} /> : <AlertCircle size={18} />}</span>
        <h3 style={{ margin: 0, fontSize: 15, fontWeight: 600, color: col }}>{title}</h3>
        <span style={{ minWidth: 22, height: 22, padding: '0 6px', borderRadius: 11, background: c.surface, color: col, fontSize: 12, fontWeight: 600, display: 'flex', alignItems: 'center', justifyContent: 'center', fontVariantNumeric: 'tabular-nums' }}>{count}</span>
      </div>
      {head}
      <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>{children}</div>
    </section>
  )
}

/** פס התקדמות: מקטע לכל מטופל, או פס רציף כשיש הרבה מטופלים */
function Segments({ n, t }: { n: number; t: number }) {
  const bar = (on: boolean, flex = 1) => ({ flex, height: 6, borderRadius: 3, background: on ? c.primary : 'rgba(69,102,232,0.16)', transition: `background 320ms ${EASE}` })
  return (
    <div role="progressbar" aria-valuenow={n} aria-valuemin={0} aria-valuemax={t} aria-label="מטופלים מוכנים לדיווח" style={{ display: 'flex', gap: 4, marginTop: 20, maxWidth: 360 }}>
      {t <= 12 ? Array.from({ length: t }, (_, i) => <span key={i} style={bar(i < n)} />) : (
        <span style={{ ...bar(false), position: 'relative', overflow: 'hidden' }}>
          <span style={{ position: 'absolute', insetBlock: 0, insetInlineStart: 0, width: `${(n / t) * 100}%`, background: c.primary, borderRadius: 3, transition: `width 480ms ${EASE}` }} />
        </span>
      )}
    </div>
  )
}

function Welcome({ ctx, archived, onAdd, onImport }: { ctx: Ctx; archived: number; onAdd: () => void; onImport: () => void }) {
  const { go } = ctx
  const steps = [
    ['מוסיפים את המטופלים', 'שם, מספר תיק, מספר הפנייה וסכום למפגש. פעם אחת.'],
    ['מסכמים כל טופס', 'מזינים כמה מפגשים נחתמו, ומעתיקים לטופס את המע״מ והסה״כ.'],
    ['מצרפים סריקות ומפיקים', 'הטבלה החודשית נבנית לבד, והקבצים מקבלים שמות אחידים.'],
  ]
  const more: { icon: ReactNode; title: string; sub: string; onClick: () => void }[] = [
    { icon: <FileSpreadsheet size={18} />, title: 'ייבוא רשימת מטופלים מאקסל', sub: 'כל המטופלים נכנסים בבת אחת, עם תצוגה מקדימה לפני השמירה.', onClick: onImport },
    { icon: <Percent size={18} />, title: 'הגדרת מע״מ ושם המטפל', sub: 'שיעור המע״מ, עוסק פטור, והשם שמופיע מעל הטבלה.', onClick: () => go('settings') },
  ]
  const { wide } = ctx
  const pill: CSSProperties = { display: 'inline-flex', alignItems: 'center', gap: 8, height: 36, padding: '0 14px 0 6px', paddingInlineStart: 6, borderRadius: 999, background: 'rgba(255,255,255,0.75)', fontSize: 13, fontWeight: 500, color: c.ink }
  const mini = (n: string, amt: string, ok: boolean, w: number, tilt: string) => (
    <div style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '12px 14px', background: c.surface, borderRadius: 14, boxShadow: '0 6px 18px -10px rgba(16,24,40,0.25)', transform: tilt }}>
      <Avatar name={n} size={32} />
      <div style={{ flex: 1 }}>
        <div style={{ fontWeight: 600, fontSize: 13 }}>{n}</div>
        <div style={{ height: 6, width: w, borderRadius: 3, background: c.sub, marginTop: 6 }} />
      </div>
      <span style={{ fontWeight: 600, fontSize: 13, fontVariantNumeric: 'tabular-nums' }}>{amt}</span>
      <span style={{ color: ok ? c.ok : c.warn, display: 'flex' }}>{ok ? <CheckCircle2 size={16} /> : <AlertCircle size={16} />}</span>
    </div>
  )
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 16, animation: `rise 480ms ${EASE}` }}>
      {archived > 0 && (
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 16, padding: '12px 16px', paddingInlineStart: 24, background: c.warnSoft, color: c.warn, borderRadius: 16, fontSize: 15, flexWrap: 'wrap' }}>
          <span>{archived === 1 ? 'המטופל היחיד נמצא בארכיון.' : `כל ${archived} המטופלים נמצאים בארכיון.`} אפשר להחזיר אותם לרשימה בעמוד המטופלים.</span>
          <Button kind="ghost" onClick={() => go('patients')} style={{ color: c.warn, fontWeight: 600 }}>
            מעבר לעמוד המטופלים
          </Button>
        </div>
      )}
      <section style={{ position: 'relative', overflow: 'hidden', borderRadius: 28, background: 'linear-gradient(120deg, #F1F5FF 0%, #E8EEFF 50%, #F2EDFF 100%)', boxShadow: '0 0 0 1px rgba(69,102,232,0.10)', display: 'grid', gridTemplateColumns: wide ? '1fr 440px' : '1fr', minHeight: wide ? 440 : undefined }}>
        <span aria-hidden style={{ position: 'absolute', width: 420, height: 420, borderRadius: '50%', left: 40, top: -180, background: 'radial-gradient(circle, rgba(255,255,255,0.95), transparent 65%)' }} />
        <div style={{ position: 'relative', padding: wide ? 48 : 24, display: 'flex', flexDirection: 'column', justifyContent: 'center' }}>
          <span style={{ ...pill, alignSelf: 'flex-start', height: 28, padding: '0 12px', color: c.primaryInk, fontWeight: 600 }}>
            <Sparkles size={14} />
            ברוכים הבאים
          </span>
          <h2 style={{ margin: '16px 0 0', fontSize: wide ? 34 : 26, fontWeight: 600, letterSpacing: -0.6, lineHeight: 1.2, color: c.navy }}>
            הדיווח החודשי למשרד הביטחון,
            <br />
            בלי טבלאות ביד
          </h2>
          <p style={{ margin: '12px 0 0', fontSize: 16, color: c.ink2, lineHeight: 1.6, maxWidth: 480 }}>מע״מ וסה״כ לכל טופס מחושבים לבד, והטבלה החודשית מוכנה להעלאה.</p>
          <ol style={{ listStyle: 'none', margin: '28px 0 0', padding: 0, display: 'flex', gap: 8, flexWrap: 'wrap' }}>
            {steps.map(([t, d], i) => (
              <li key={t} title={d} style={pill}>
                <span style={{ width: 24, height: 24, borderRadius: '50%', background: c.primary, color: '#fff', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 12, fontWeight: 600 }}>{i + 1}</span>
                {t}
              </li>
            ))}
          </ol>
          <div style={{ display: 'flex', gap: 8, marginTop: 32, flexWrap: 'wrap' }}>
            <Button kind="primary" icon={<UserPlus size={18} />} onClick={onAdd} style={{ height: 48, padding: '0 22px' }} title="קיצור מקלדת: N">
              הוספת מטופל ראשון
            </Button>
            <Button icon={more[0].icon} onClick={more[0].onClick} style={{ height: 48 }} title={more[0].sub}>
              {more[0].title}
            </Button>
          </div>
          <Button kind="ghost" icon={more[1].icon} onClick={more[1].onClick} style={{ alignSelf: 'flex-start', marginTop: 8, padding: '0 8px', color: c.primary }} title={more[1].sub}>
            {more[1].title}
          </Button>
        </div>
        {wide && (
          <div aria-hidden style={{ position: 'relative', padding: '48px 8px 48px 56px', display: 'flex', flexDirection: 'column', justifyContent: 'center', gap: 10 }}>
            {mini('דנה לוי', '₪1,097.40', true, 60, 'rotate(-2deg) translateX(-8px)')}
            {mini('יוסי כהן', '₪1,646.10', true, 74, 'rotate(1deg) translateX(16px)')}
            {mini('מיכל אברהם', '₪814.20', false, 88, 'rotate(-1deg)')}
            <div style={{ marginTop: 6, alignSelf: 'flex-start', transform: 'translateX(-24px)', display: 'flex', alignItems: 'center', gap: 10, padding: '12px 16px', borderRadius: 14, background: c.navy, color: '#fff', boxShadow: '0 10px 24px -10px rgba(27,37,89,0.6)', fontSize: 13 }}>
              <FileOutput size={16} />
              <span>טבלה_2026-11.pdf</span>
              <b style={{ fontWeight: 600, fontVariantNumeric: 'tabular-nums' }}>₪3,557.70</b>
            </div>
          </div>
        )}
      </section>
    </div>
  )
}

/** שיעור המע״מ משתנה מעת לעת, ולכן אפשר לעדכן אותו ישירות מכאן (בתוך כרטיס הסיכום הכהה) */
function VatInline({ ctx }: { ctx: Ctx }) {
  const { data, setData, toast, month } = ctx
  const v = vatOf(data, month)
  const [editing, setEditing] = useState(false)
  const [val, setVal] = useState(String(v.rate))
  const big: CSSProperties = { fontSize: 22, fontWeight: 600, fontVariantNumeric: 'tabular-nums', color: c.ink }
  if (v.exempt) return <span style={{ ...big, fontSize: 18 }}>עוסק פטור</span>
  const save = () => {
    const n = parseFloat(val)
    if (!Number.isFinite(n) || n < 0 || n > 100) return toast('שיעור מע״מ צריך להיות מספר בין 0 ל-100')
    setData((d) => setVatFrom(d, month, { rate: n, exempt: false }))
    setEditing(false)
    toast(`המע״מ עודכן ל-${n}% מ${monthLabel(month)} והלאה. החודשים הקודמים לא השתנו.`)
  }
  const chip: CSSProperties = { display: 'inline-flex', alignItems: 'center', gap: 4, height: 30, padding: '0 8px', border: 'none', borderRadius: 8, background: 'transparent', color: c.primary, fontSize: 13, fontWeight: 600, cursor: 'pointer', font: 'inherit' }
  if (!editing)
    return (
      <span style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12 }}>
        <span style={big}>{v.rate}%</span>
        <button onClick={() => (setVal(String(v.rate)), setEditing(true))} aria-label="שינוי שיעור המע״מ" style={chip}>
          <Pencil size={14} />
          שינוי
        </button>
      </span>
    )
  return (
    <div style={{ display: 'inline-flex', alignItems: 'center', gap: 8 }}>
      <span style={{ position: 'relative', display: 'inline-flex' }}>
        <input
          aria-label="שיעור המע״מ באחוזים"
          autoFocus
          value={val}
          onChange={(e) => setVal(e.target.value.replace(/[^\d.]/g, ''))}
          onKeyDown={(e) => (e.key === 'Escape' ? setEditing(false) : e.key === 'Enter' && save())}
          inputMode="decimal"
          dir="ltr"
          style={{ width: 64, height: 32, borderRadius: 8, border: 'none', outline: 'none', boxShadow: `inset 0 0 0 1px ${c.primary}, 0 0 0 3px rgba(69,102,232,0.14)`, background: '#fff', padding: '0 22px 0 8px', fontSize: 15, color: c.ink, textAlign: 'right' }}
        />
        <span style={{ position: 'absolute', right: 8, top: 0, bottom: 0, display: 'flex', alignItems: 'center', color: c.ink3, fontSize: 14 }}>%</span>
      </span>
      <button onClick={save} style={{ ...chip, background: c.primary, color: '#fff' }}>
        <Check size={14} />
        שמירה
      </button>
      <button onClick={() => setEditing(false)} style={{ ...chip, color: c.ink3 }}>
        ביטול
      </button>
    </div>
  )
}

/** טבעת התקדמות קטנה לפס המצומצם */
function Ring({ n, t }: { n: number; t: number }) {
  const R = 13, L = 2 * Math.PI * R
  return (
    <svg width={32} height={32} viewBox="0 0 32 32" aria-hidden style={{ flex: '0 0 32px', transform: 'rotate(-90deg)' }}>
      <circle cx={16} cy={16} r={R} fill="none" stroke="rgba(69,102,232,0.15)" strokeWidth={4} />
      <circle cx={16} cy={16} r={R} fill="none" stroke={c.primary} strokeWidth={4} strokeLinecap="round" strokeDasharray={L} strokeDashoffset={t ? L * (1 - n / t) : L} style={{ transition: `stroke-dashoffset 480ms ${EASE}` }} />
    </svg>
  )
}
