import ImportSheet from './ImportSheet'
import { useNewPatientShortcut } from './parts'
import { useEffect, useMemo, useRef, useState, type CSSProperties, type ReactNode } from 'react'
import { AlertCircle, AlertTriangle, Check, CheckCircle2, ChevronLeft, Search, FileOutput, FileSpreadsheet, FileStack, FileUp, Paperclip, Pencil, Percent, UserPlus, X } from 'lucide-react'
import type { Ctx } from '../App'
import { Badge, Button, c, Card, EASE, lift, Stepper } from '../ui'
import { calc, ils, monthLabel, rateOf, refOf, setVatFrom, uid, vatOf, type Entry, type Patient, type Scan } from '../model'
import { makeThumb } from '../pdf'
import AssignSheet from './AssignSheet'
import ScanSheet from './ScanSheet'
import { Avatar, MonthSwitcher, PageBar } from './parts'
import PatientForm from './PatientForm'
import ReportSheet from './ReportSheet'

type Sort = 'added' | 'first' | 'last'
const firstName = (n: string) => n.trim().split(/\s+/)[0] ?? ''
const lastName = (n: string) => n.trim().split(/\s+/).slice(1).join(' ') || n
const ACCEPT = 'application/pdf,image/jpeg,image/png'
const hasSessions = (e: Entry | undefined) => (e?.signed ?? 0) + (e?.cancelled ?? 0) > 0

export default function MonthScreen({ ctx }: { ctx: Ctx }) {
  const { data, setData, scans, setScans, month, setMonth, toast, wide, headerH } = ctx
  const entries = data.months[month] ?? {}
  const [adding, setAdding] = useState(false)
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
  const canReport = (id: string) => hasSessions(entries[id]) && hasScan(id)
  const eligible = patients.filter((p) => canReport(p.id))
  const total = patients.reduce((sum, p) => sum + calc(p, entries[p.id], vatOf(data, month)).total, 0)
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
  const soft = 'rgba(255,255,255,0.72)'

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

  const COLS = `${selecting ? '40px ' : ''}minmax(240px, 1fr) 120px 120px 152px 176px`
  const stripPad = wide ? '12px 32px' : '12px 16px'

  const hero = (
    <section aria-label="סיכום החודש" style={{ marginTop: wide ? 24 : 0, marginBottom: wide ? 16 : 0, borderRadius: 20, overflow: 'hidden', boxShadow: '0 8px 20px -10px rgba(27,54,93,0.45)' }}>
      <div style={{ background: `linear-gradient(135deg, ${c.primary} 0%, ${c.primary2} 100%)`, color: '#fff', padding: wide ? 32 : 24, display: 'flex', flexWrap: 'wrap', alignItems: 'center', columnGap: 32, rowGap: 24 }}>
        <div style={{ flex: '1 1 320px', minWidth: 0 }}>
          <div style={{ fontSize: 14, color: soft, fontWeight: 500 }}>מוכן לדיווח החודש</div>
          <div style={{ display: 'flex', alignItems: 'baseline', columnGap: 12, flexWrap: 'wrap', marginTop: 8 }}>
            <span style={{ fontSize: wide ? 48 : 36, fontWeight: 600, letterSpacing: -1.2, lineHeight: 1.05, fontVariantNumeric: 'tabular-nums' }}>{ils(readyTotal)}</span>
            <span style={{ color: soft, fontSize: 16 }}>{eligible.length === 1 ? 'מטופל אחד' : `${eligible.length} מטופלים`}</span>
          </div>
          <Segments n={eligible.length} t={patients.length} />
          <div style={{ marginTop: 8, fontSize: 13, color: soft }}>
            <b style={{ color: '#fff', fontWeight: 600, fontVariantNumeric: 'tabular-nums' }}>
              {eligible.length} מתוך {patients.length}
            </b>{' '}
            מטופלים מוכנים.{rest > 0 ? ` ${rest === 1 ? 'מטופל אחד צריך' : `${rest} צריכים`} השלמה.` : ' כולם מוכנים.'}
          </div>
        </div>
        {wide && <span style={{ width: 1, alignSelf: 'stretch', background: 'rgba(255,255,255,0.16)' }} />}
        <div style={{ display: 'flex', gap: 40, flex: '0 0 auto', flexWrap: 'wrap' }}>
          <div>
            <div style={{ fontSize: 13, color: soft }}>סה״כ כל הטפסים</div>
            <div style={{ fontSize: 22, fontWeight: 600, marginTop: 4, fontVariantNumeric: 'tabular-nums' }}>{ils(total)}</div>
          </div>
          <div>
            <div style={{ fontSize: 13, color: soft }}>מע״מ</div>
            <div style={{ marginTop: 4 }}>
              <VatInline ctx={ctx} />
            </div>
          </div>
        </div>
      </div>
      {rep && !selecting && (
        <div role="status" style={{ display: 'flex', alignItems: 'center', gap: 12, padding: stripPad, minHeight: 56, background: repChanged ? c.warnSoft : c.okSurf, color: repChanged ? c.warn : c.ok, fontSize: 14 }}>
          <span style={{ flex: '0 0 28px', height: 28, borderRadius: 8, background: repChanged ? c.warnBg : c.okBg, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            {repChanged ? <AlertTriangle size={16} /> : <CheckCircle2 size={16} />}
          </span>
          <span style={{ flex: 1, lineHeight: 1.5 }}>
            <b style={{ fontWeight: 600 }}>הטבלה של {monthLabel(month)} נשמרה ב-{new Date(rep.at).toLocaleDateString('he-IL')}</b>
            {' · '}
            {rep.ids.length === 1 ? 'מטופל אחד' : `${rep.ids.length} מטופלים`}, {ils(rep.total)}
            {repChanged ? '. הנתונים השתנו מאז, וכדאי להפיק אותה מחדש.' : notIn > 0 ? `. ${notIn === 1 ? 'מטופל מוכן אחד לא נכלל' : `${notIn} מטופלים מוכנים לא נכללו`} בה.` : ''}
          </span>
          {eligible.length > 0 && (
            <Button kind="ghost" icon={<FileOutput size={18} />} onClick={() => startSelect(rep.ids)} style={{ color: 'inherit', fontWeight: 600, height: 36 }}>
              הפקה מחדש של הטבלה
            </Button>
          )}
        </div>
      )}
      {unassigned.length > 0 && !selecting && (
        <button
          onClick={() => setAssigning(true)}
          style={{ display: 'flex', alignItems: 'center', gap: 12, padding: stripPad, minHeight: 56, width: '100%', background: c.warnSoft, color: '#5C3800', border: 'none', borderTop: rep ? '1px solid rgba(143,86,0,0.12)' : 'none', fontSize: 14, cursor: 'pointer', textAlign: 'start', font: 'inherit' }}
        >
          <span style={{ flex: '0 0 28px', height: 28, borderRadius: 8, background: c.warnBg, color: c.warn, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <FileStack size={16} />
          </span>
          <span style={{ flex: 1, fontSize: 14 }}>
            <b style={{ fontWeight: 600 }}>{unassigned.length === 1 ? 'סריקה אחת ממתינה' : `${unassigned.length} סריקות ממתינות`}</b>{' '}
            <span style={{ color: c.warn }}>{unassigned.length === 1 ? 'ועדיין לא שויכה לאף מטופל' : 'ועדיין לא שויכו למטופלים'}</span>
          </span>
          <span style={{ display: 'inline-flex', alignItems: 'center', gap: 4, fontWeight: 600, fontSize: 14 }}>
            {unassigned.length === 1 ? 'שיוך הסריקה למטופל' : 'שיוך הסריקות למטופלים'}
            <ChevronLeft size={16} />
          </span>
        </button>
      )}
    </section>
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
      <div style={{ display: 'grid', gridTemplateColumns: COLS, gap: 24, alignItems: 'center', padding: '0 24px 8px', fontSize: 12, color: c.ink3, fontWeight: 500 }}>
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
        <span style={{ textAlign: 'end' }}>טופס סרוק</span>
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
        lead={<MonthSwitcher month={month} setMonth={setMonth} disabled={selecting} />}
        actions={
          <>
            <Button icon={<FileUp size={18} />} onClick={() => bulkInput.current?.click()} disabled={busy || selecting} style={{ flex: wide ? undefined : 1 }}>
              {busy ? 'קורא קבצים…' : 'ייבוא סריקות'}
            </Button>
            <Button kind="primary" icon={<FileOutput size={18} />} onClick={() => startSelect()} disabled={!eligible.length || selecting} title={!eligible.length ? 'אין עדיין מטופל עם מפגשים וסריקה' : undefined} style={{ flex: wide ? undefined : 1 }}>
              הפקת דיווח
            </Button>
          </>
        }
      />

      {hero}

      {/* כותרת הרשימה: נשארת במקום בגלילה */}
      <div style={{ position: wide ? 'sticky' : 'static', top: headerH, zIndex: 10, background: c.bg, paddingTop: wide ? 16 : 0, paddingBottom: wide ? 16 : 0, display: 'flex', alignItems: 'center', gap: 16, flexWrap: 'wrap' }}>
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
            style={{ width: '100%', height: 40, borderRadius: 10, border: 'none', boxShadow: '0 0 0 1px #DCE3EE', background: c.surface, color: c.ink, padding: '0 12px', paddingInlineStart: 40, fontSize: 14 }}
          />
        </label>
        {!wide && (
          <select aria-label="מיון המטופלים" value={sort} onChange={(e) => setSort(e.target.value as Sort)} style={{ height: 40, borderRadius: 10, border: 'none', boxShadow: '0 0 0 1px #DCE3EE', background: c.surface, color: c.ink, padding: '0 8px', fontSize: 14 }}>
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

      <div style={{ display: 'flex', flexDirection: 'column', gap: 16, paddingBottom: selecting ? 120 : 0 }}>
        {q && !shown.length && (
          <div style={{ padding: 24, background: c.surface, boxShadow: lift, borderRadius: 16, fontSize: 15, color: c.ink2, display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 16 }}>
            <span>אין מטופל שמתאים ל״{q}״.</span>
            <Button kind="ghost" onClick={() => setQuery('')}>ניקוי החיפוש</Button>
          </div>
        )}
        {showReady && (
          <Group tone="ok" title="מוכנים לדיווח" count={readyList.length} sub="יש מפגשים וסריקה מצורפת" head={colHead(true, true)}>
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
          <Group tone="warn" title="צריכים השלמה" count={needList.length} sub="לא ייכנסו לדיווח עד שיושלמו" head={colHead(!showReady, false)}>
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
          scan={viewScan.scan}
          patient={viewScan.patient}
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
}) {
  const { wide, data } = ctx
  const r = calc(p, e, vatOf(data, ctx.month))
  const has = r.sessions > 0
  const ready = has && !!scan
  const dim = select && !select.can
  const need = ready ? null : has ? 'חסרה סריקה של הטופס החתום' : scan ? 'לא הוזנו מפגשים החודש' : 'לא הוזנו מפגשים ואין סריקה'
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

  const box = select && <Check4 checked={select.on} disabled={!select.can} label={select.can ? `הכללת ${p.name} בטבלה` : `${p.name}: ${need}`} onChange={select.toggle} />

  const look: CSSProperties = {
    opacity: dim ? 0.45 : 1,
    background: flash ? c.okBg : c.surface,
    borderRadius: 12,
    boxShadow: select?.on ? `0 0 0 2px ${c.primary}` : flash ? `0 0 0 2px ${c.ok}` : '0 0 0 1px rgba(16,24,40,0.05), 0 1px 2px rgba(16,24,40,0.04)',
    transition: `opacity 240ms ${EASE}, box-shadow 240ms ${EASE}, background 600ms ${EASE}`,
    animation: `rise 320ms ${EASE}`,
  }

  if (wide)
    return (
      <div id={`row-${p.id}`} style={{ display: 'grid', gridTemplateColumns: cols, gap: 24, alignItems: 'center', padding: '12px 24px', minHeight: 80, ...look }}>
        {box}
        {who}
        <Stepper hideLabel label="מפגשים חתומים" value={e?.signed ?? 0} onChange={(n) => onEntry((x) => ({ ...x, signed: n }))} />
        <Stepper hideLabel label="ביטולים ללא הודעה" value={e?.cancelled ?? 0} onChange={(n) => onEntry((x) => ({ ...x, cancelled: n }))} />
        {sums}
        <div style={{ display: 'flex', justifyContent: 'flex-end' }}>{scanCell}</div>
      </div>
    )

  return (
    <div id={`row-${p.id}`} style={{ padding: 16, display: 'flex', flexDirection: 'column', gap: 16, ...look }}>
      <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
        {box}
        <div style={{ flex: 1, minWidth: 0 }}>{who}</div>
      </div>
      <div style={{ display: 'flex', gap: 16, flexWrap: 'wrap' }}>
        <Stepper label="מפגשים חתומים" value={e?.signed ?? 0} onChange={(n) => onEntry((x) => ({ ...x, signed: n }))} />
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
function Group({ tone, title, count, sub, head, children }: { tone: 'ok' | 'warn'; title: string; count: number; sub: string; head: ReactNode; children: ReactNode }) {
  const col = tone === 'ok' ? c.ok : c.warn
  return (
    <section aria-label={title} style={{ background: tone === 'ok' ? c.okSurf : c.group, borderRadius: 20, padding: '16px 8px 8px' }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '0 16px 12px', flexWrap: 'wrap' }}>
        <span style={{ color: col, display: 'flex' }}>{tone === 'ok' ? <CheckCircle2 size={18} /> : <AlertCircle size={18} />}</span>
        <h3 style={{ margin: 0, fontSize: 15, fontWeight: 600, color: col }}>{title}</h3>
        <span style={{ minWidth: 22, height: 22, padding: '0 6px', borderRadius: 11, background: c.surface, color: col, fontSize: 12, fontWeight: 600, display: 'flex', alignItems: 'center', justifyContent: 'center', fontVariantNumeric: 'tabular-nums' }}>{count}</span>
        <span style={{ fontSize: 13, color: c.ink3, marginInlineStart: 8 }}>{sub}</span>
      </div>
      {head}
      <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>{children}</div>
    </section>
  )
}

/** פס התקדמות: מקטע לכל מטופל, או פס רציף כשיש הרבה מטופלים */
function Segments({ n, t }: { n: number; t: number }) {
  const bar = (on: boolean, flex = 1) => ({ flex, height: 6, borderRadius: 3, background: on ? '#fff' : 'rgba(255,255,255,0.22)', transition: `background 320ms ${EASE}` })
  return (
    <div role="progressbar" aria-valuenow={n} aria-valuemin={0} aria-valuemax={t} aria-label="מטופלים מוכנים לדיווח" style={{ display: 'flex', gap: 4, marginTop: 24, maxWidth: 360 }}>
      {t <= 12 ? Array.from({ length: t }, (_, i) => <span key={i} style={bar(i < n)} />) : (
        <span style={{ ...bar(false), position: 'relative', overflow: 'hidden' }}>
          <span style={{ position: 'absolute', insetBlock: 0, insetInlineStart: 0, width: `${(n / t) * 100}%`, background: '#fff', borderRadius: 3, transition: `width 480ms ${EASE}` }} />
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
      <Card style={{ padding: ctx.wide ? 40 : 24, borderRadius: 20, display: 'flex', flexDirection: 'column', gap: 32 }}>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
          <h2 style={{ margin: 0, fontSize: ctx.wide ? 28 : 22, fontWeight: 600, letterSpacing: -0.5 }}>דיווח חודשי למשרד הביטחון, בלי טבלאות ביד</h2>
          <p style={{ margin: 0, fontSize: 16, color: c.ink2, lineHeight: 1.6 }}>חישוב מע״מ וסה״כ לכל טופס, טבלה חודשית מוכנה, וקבצים מסודרים להעלאה.</p>
        </div>
        <ol style={{ listStyle: 'none', margin: 0, padding: 8, background: c.sub, borderRadius: 16, display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))', gap: 8 }}>
          {steps.map(([t, d], i) => (
            <li key={t} style={{ display: 'flex', flexDirection: 'column', gap: 12, padding: 20, background: c.surface, borderRadius: 12 }}>
              <span style={{ width: 28, height: 28, borderRadius: 999, background: c.primary, color: '#fff', display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 600, fontSize: 14 }}>{i + 1}</span>
              <span style={{ fontWeight: 600, fontSize: 16 }}>{t}</span>
              <span style={{ fontSize: 14, color: c.ink2, lineHeight: 1.6 }}>{d}</span>
            </li>
          ))}
        </ol>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
          <Button kind="primary" icon={<UserPlus size={18} />} onClick={onAdd} style={{ height: 48, padding: '0 24px' }} title="קיצור מקלדת: N">
            הוספת מטופל ראשון
          </Button>
          {more.map((m) => (
            <Button key={m.title} icon={m.icon} onClick={m.onClick} style={{ height: 48 }} title={m.sub}>
              {m.title}
            </Button>
          ))}
        </div>
      </Card>
    </div>
  )
}

/** שיעור המע״מ משתנה מעת לעת, ולכן אפשר לעדכן אותו ישירות מכאן (בתוך כרטיס הסיכום הכהה) */
function VatInline({ ctx }: { ctx: Ctx }) {
  const { data, setData, toast, month } = ctx
  const v = vatOf(data, month)
  const [editing, setEditing] = useState(false)
  const [val, setVal] = useState(String(v.rate))
  const big: CSSProperties = { fontSize: 22, fontWeight: 600, fontVariantNumeric: 'tabular-nums' }
  if (v.exempt) return <span style={{ ...big, fontSize: 18 }}>עוסק פטור</span>
  const save = () => {
    const n = parseFloat(val)
    if (!Number.isFinite(n) || n < 0 || n > 100) return toast('שיעור מע״מ צריך להיות מספר בין 0 ל-100')
    setData((d) => setVatFrom(d, month, { rate: n, exempt: false }))
    setEditing(false)
    toast(`המע״מ עודכן ל-${n}% מ${monthLabel(month)} והלאה. החודשים הקודמים לא השתנו.`)
  }
  const chip: CSSProperties = { display: 'inline-flex', alignItems: 'center', gap: 4, height: 32, padding: '0 10px', border: 'none', borderRadius: 8, background: 'rgba(255,255,255,0.12)', color: '#fff', fontSize: 13, fontWeight: 500, cursor: 'pointer', font: 'inherit' }
  if (!editing)
    return (
      <span style={{ display: 'inline-flex', alignItems: 'center', gap: 12 }}>
        <span style={big}>{v.rate}%</span>
        <button onClick={() => (setVal(String(v.rate)), setEditing(true))} aria-label="שינוי שיעור המע״מ" style={chip}>
          <Pencil size={14} />
          שינוי המע״מ
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
          style={{ width: 72, height: 32, borderRadius: 8, border: 'none', background: '#fff', padding: '0 24px 0 8px', fontSize: 15, color: c.ink, textAlign: 'right' }}
        />
        <span style={{ position: 'absolute', right: 8, top: 0, bottom: 0, display: 'flex', alignItems: 'center', color: c.ink3, fontSize: 14 }}>%</span>
      </span>
      <button onClick={save} style={{ ...chip, background: '#fff', color: c.primary, fontWeight: 600 }}>
        <Check size={14} />
        שמירה
      </button>
      <button onClick={() => setEditing(false)} style={{ ...chip, background: 'transparent' }}>
        ביטול
      </button>
    </div>
  )
}
