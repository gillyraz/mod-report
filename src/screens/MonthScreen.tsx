import { useEffect, useMemo, useRef, useState, type ReactNode } from 'react'
import { Check, CheckCircle2, FileOutput, FileStack, FileUp, Paperclip, Pencil, Percent, ShieldCheck, Upload, UserPlus, X } from 'lucide-react'
import type { Ctx } from '../App'
import { Badge, Button, c, Card, EASE, Stepper } from '../ui'
import { calc, ils, uid, type Entry, type Patient, type Scan } from '../model'
import { makeThumb } from '../pdf'
import AssignSheet from './AssignSheet'
import ScanSheet from './ScanSheet'
import { readBackup } from '../backup'
import { MonthSwitcher, PageBar } from './parts'
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
  const [sort, setSort] = useState<Sort>('added')
  // מצב בחירה להפקת דיווח: מי ייכלל בטבלה
  const [selecting, setSelecting] = useState(false)
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
  const eligible = patients.filter((p) => hasSessions(entries[p.id]))
  const total = patients.reduce((sum, p) => sum + calc(p, entries[p.id], data.settings).total, 0)
  const pct = patients.length ? eligible.length / patients.length : 0

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
    return patients.find((p) => !entries[p.id]?.scanId && ((p.referralNo && n.includes(p.referralNo)) || (p.fileNo && n.includes(p.fileNo)) || n.includes(p.name)))
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
    setPicked((s) => new Set([...s].filter((id) => hasSessions(entries[id]))))
  }, [entries, selecting])

  const startSelect = () => {
    setPicked(new Set(eligible.map((p) => p.id)))
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
      onClose={() => setAdding(false)}
      onSave={(p) => {
        setData((d) => ({ ...d, patients: [...d.patients, p] }))
        setAdding(false)
        setFlash(p.id)
        toast(`${p.name} נוסף לרשימה`)
      }}
    />
  )

  if (data.patients.filter((p) => !p.archived).length === 0) {
    return (
      <div style={{ display: 'flex', flexDirection: 'column', gap: 24, paddingTop: wide ? 32 : 0 }}>
        {wide && <PageBar ctx={ctx} title="החודש" />}
        <Welcome ctx={ctx} onAdd={() => setAdding(true)} />
        {addForm}
      </div>
    )
  }

  const status = (
    <>
      <span style={{ whiteSpace: 'nowrap' }}>
        <b style={{ color: c.ink, fontVariantNumeric: 'tabular-nums' }}>
          {eligible.length} מתוך {patients.length}
        </b>{' '}
        עם מפגשים
      </span>
      <div style={{ flex: 1, minWidth: 80 }}>
        <Progress pct={pct} />
      </div>
      <span style={{ whiteSpace: 'nowrap' }}>
        סה״כ <b style={{ color: c.ink, fontVariantNumeric: 'tabular-nums' }}>{ils(total)}</b>
      </span>
      <VatInline ctx={ctx} />
    </>
  )

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

  const COLS = `${selecting ? '40px ' : ''}minmax(180px, 1.6fr) 136px 136px minmax(200px, 1.4fr) 168px`

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: wide ? 0 : 24 }}>
      <PageBar
        ctx={ctx}
        title="החודש"
        lead={<MonthSwitcher month={month} setMonth={setMonth} />}
        middle={wide ? status : <div style={{ display: 'flex', alignItems: 'center', gap: 16, flexWrap: 'wrap' }}>{status}</div>}
        actions={
          selecting ? (
            wide ? selectActions : undefined
          ) : (
            <>
              <Button icon={<FileUp size={18} />} onClick={() => bulkInput.current?.click()} disabled={busy} style={{ flex: wide ? undefined : 1 }}>
                {busy ? 'קורא קבצים…' : 'ייבוא סריקות'}
              </Button>
              <Button kind="primary" icon={<FileOutput size={18} />} onClick={startSelect} disabled={!eligible.length} style={{ flex: wide ? undefined : 1 }}>
                הפקת דיווח
              </Button>
            </>
          )
        }
      />

      {/* כותרת הרשימה וכותרות העמודות: נשארות במקום, רק השורות נגללות */}
      <div style={{ position: wide ? 'sticky' : 'static', top: headerH, zIndex: 10, background: c.bg, paddingTop: wide ? 24 : 0, paddingBottom: 8, marginInline: wide ? -8 : 0, paddingInline: wide ? 8 : 0, display: 'flex', flexDirection: 'column', gap: 16 }}>
        {unassigned.length > 0 && !selecting && (
          <button
            onClick={() => setAssigning(true)}
            style={{ display: 'flex', alignItems: 'center', gap: 16, padding: '12px 16px', background: c.warnBg, color: c.warn, border: 'none', borderRadius: 12, fontSize: 15, cursor: 'pointer', textAlign: 'start' }}
          >
            <FileStack size={20} />
            <span style={{ flex: 1 }}>
              {unassigned.length === 1 ? (<><b>סריקה אחת</b> ממתינה לשיוך למטופל</>) : (<><b>{unassigned.length} סריקות</b> ממתינות לשיוך למטופל</>)}
            </span>
            <span style={{ fontWeight: 600, textDecoration: 'underline' }}>לשיוך</span>
          </button>
        )}
        {selecting && (
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '12px 16px', background: '#E8EEF6', color: c.primary, borderRadius: 12, fontSize: 15 }}>
            <CheckCircle2 size={20} style={{ flex: '0 0 20px' }} />
            <span>
              מסמנים את המטופלים שייכנסו לטבלה. מטופל בלי מפגשים החודש לא ניתן לסימון.
            </span>
          </div>
        )}
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 16, flexWrap: 'wrap' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 16 }}>
            <h2 style={{ margin: 0, fontSize: 17, fontWeight: 600 }}>
              מטופלים <span style={{ color: c.ink2, fontWeight: 400 }}>· {patients.length}</span>
            </h2>
            <label style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 14, color: c.ink2 }}>
              מיון
              <select
                value={sort}
                onChange={(e) => setSort(e.target.value as Sort)}
                style={{ height: 32, borderRadius: 8, border: `1px solid ${c.line}`, background: c.surface, color: c.ink, padding: '0 8px', fontSize: 14 }}
              >
                <option value="added">לפי סדר ההוספה</option>
                <option value="first">לפי שם פרטי</option>
                <option value="last">לפי שם משפחה</option>
              </select>
            </label>
          </div>
          {!selecting && (
            <Button icon={<UserPlus size={18} />} onClick={() => setAdding(true)}>
              הוספת מטופל
            </Button>
          )}
        </div>
        {wide && (
          <div style={{ display: 'grid', gridTemplateColumns: COLS, gap: 16, alignItems: 'center', padding: '0 24px', fontSize: 13, color: c.ink2, fontWeight: 500 }}>
            {selecting && (
              <Check4
                checked={allOn}
                mixed={!allOn && picked.size > 0}
                disabled={!eligible.length}
                label={allOn ? 'ביטול הסימון של כולם' : 'סימון כל המטופלים עם מפגשים'}
                onChange={() => setPicked(allOn ? new Set() : new Set(eligible.map((p) => p.id)))}
              />
            )}
            <span>מטופל</span>
            <span>מפגשים חתומים</span>
            <span>ביטולים ללא הודעה</span>
            <span>לכתוב בטופס</span>
            <span />
          </div>
        )}
      </div>

      <div style={{ display: 'flex', flexDirection: 'column', gap: 8, paddingBottom: !wide && selecting ? 88 : 0 }}>
        {patients.map((p) => (
          <Row
            key={p.id}
            p={p}
            e={entries[p.id]}
            ctx={ctx}
            cols={COLS}
            flash={flash === p.id}
            select={selecting ? { on: picked.has(p.id), can: hasSessions(entries[p.id]), toggle: () => toggle(p.id) } : undefined}
            scan={scans.find((x) => x.id === entries[p.id]?.scanId)}
            onAttach={() => {
              target.current = p.id
              oneInput.current?.click()
            }}
            onView={(scan) => setViewScan({ scan, patient: p })}
            onEntry={(fn) => setEntry(p.id, fn)}
          />
        ))}
      </div>

      {/* נייד: פעולות הבחירה בפס תחתון */}
      {!wide && selecting && (
        <div style={{ position: 'fixed', insetInline: 0, bottom: 'calc(64px + env(safe-area-inset-bottom))', zIndex: 18, background: c.surface, borderTop: `1px solid ${c.line}`, padding: '12px 16px', display: 'flex', gap: 8 }}>
          {selectActions}
        </div>
      )}

      <input ref={bulkInput} type="file" accept={ACCEPT} multiple hidden onChange={(e) => (importFiles(e.target.files), (e.target.value = ''))} />
      <input ref={oneInput} type="file" accept={ACCEPT} hidden onChange={(e) => (importFiles(e.target.files, target.current ?? undefined), (e.target.value = ''))} />

      {addForm}
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
            attach(viewScan.patient.id, undefined)
            setScans((s0) => s0.filter((x) => x.id !== viewScan.scan.id))
            setViewScan(null)
            toast('הסריקה הוסרה')
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
  select?: { on: boolean; can: boolean; toggle: () => void }
  scan: Scan | undefined
  onAttach: () => void
  onView: (s: Scan) => void
  onEntry: (fn: (e: Entry) => Entry) => void
}) {
  const { wide, data } = ctx
  const r = calc(p, e, data.settings)
  const has = r.sessions > 0
  const dim = select && !select.can

  const who = (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 4, minWidth: 0 }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
        <span style={{ fontWeight: 600, fontSize: 16 }}>{p.name}</span>
        {has && scan && (
          <Badge tone="ok">
            <CheckCircle2 size={14} /> מוכן
          </Badge>
        )}
        {has && !scan && <Badge tone="warn">חסרה סריקה</Badge>}
        {dim && <span style={{ fontSize: 13, color: c.ink2 }}>אין מפגשים החודש</span>}
      </div>
      <span style={{ fontSize: 13, color: c.ink2, fontVariantNumeric: 'tabular-nums' }}>
        תיק {p.fileNo} · הפנייה {p.referralNo} · {ils(p.rate)} למפגש
      </span>
    </div>
  )

  const sums = (
    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8, background: has ? c.sub : 'transparent', border: has ? 'none' : `1px dashed ${c.line}`, borderRadius: 8, padding: '8px 16px', transition: `background 240ms ${EASE}` }}>
      <Num label="מע״מ" value={has ? ils(r.vat) : '—'} />
      <Num label="סה״כ" value={has ? ils(r.total) : '—'} strong />
    </div>
  )

  const scanCell = scan ? (
    <button
      onClick={() => onView(scan)}
      title="הצגת הסריקה"
      style={{ display: 'flex', alignItems: 'center', gap: 8, height: 56, padding: 4, paddingInlineEnd: 12, background: c.surface, border: `1px solid ${c.line}`, borderRadius: 8, cursor: 'pointer', color: c.ink, fontSize: 14, minWidth: 0 }}
    >
      {scan.thumb ? <img src={scan.thumb} alt="" style={{ width: 36, height: 46, objectFit: 'cover', objectPosition: 'top', borderRadius: 4, border: `1px solid ${c.line}` }} /> : <Paperclip size={18} />}
      <span>סריקה מצורפת</span>
    </button>
  ) : (
    <Button icon={<Paperclip size={18} />} onClick={onAttach} style={{ height: 56 }}>
      צירוף סריקה
    </Button>
  )

  const box = select && <Check4 checked={select.on} disabled={!select.can} label={select.can ? `הכללת ${p.name} בטבלה` : `${p.name}: אין מפגשים החודש`} onChange={select.toggle} />

  const cardStyle = {
    opacity: dim ? 0.45 : 1,
    boxShadow: flash ? `0 0 0 2px ${c.ok}` : select?.on ? `0 0 0 2px ${c.primary}` : undefined,
    background: flash ? c.okBg : c.surface,
    transition: `opacity 240ms ${EASE}, box-shadow 240ms ${EASE}, background 600ms ${EASE}`,
  }

  if (wide)
    return (
      <Card id={`row-${p.id}`} style={{ display: 'grid', gridTemplateColumns: cols, gap: 16, alignItems: 'center', padding: '16px 24px', ...cardStyle }}>
        {box}
        {who}
        <Stepper hideLabel label="מפגשים חתומים" value={e?.signed ?? 0} onChange={(n) => onEntry((x) => ({ ...x, signed: n }))} />
        <Stepper hideLabel label="ביטולים ללא הודעה" value={e?.cancelled ?? 0} onChange={(n) => onEntry((x) => ({ ...x, cancelled: n }))} />
        {sums}
        {scanCell}
      </Card>
    )

  return (
    <Card style={{ padding: 16, display: 'flex', flexDirection: 'column', gap: 16, ...cardStyle }}>
      <div id={`row-${p.id}`} style={{ display: 'flex', gap: 8, alignItems: 'flex-start' }}>
        {box}
        <div style={{ flex: 1, minWidth: 0 }}>{who}</div>
      </div>
      <div style={{ display: 'flex', gap: 16, flexWrap: 'wrap' }}>
        <Stepper label="מפגשים חתומים" value={e?.signed ?? 0} onChange={(n) => onEntry((x) => ({ ...x, signed: n }))} />
        <Stepper label="ביטולים ללא הודעה" value={e?.cancelled ?? 0} onChange={(n) => onEntry((x) => ({ ...x, cancelled: n }))} />
      </div>
      {sums}
      {scanCell}
    </Card>
  )
}

function Num({ label, value, strong }: { label: string; value: string; strong?: boolean }) {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 0 }}>
      <span style={{ fontSize: 12, color: c.ink2 }}>{label}</span>
      <span style={{ fontSize: strong ? 20 : 17, fontWeight: strong ? 700 : 500, fontVariantNumeric: 'tabular-nums', color: c.ink }}>{value}</span>
    </div>
  )
}

function Welcome({ ctx, onAdd }: { ctx: Ctx; onAdd: () => void }) {
  const { setData, toast, go } = ctx
  const fileIn = useRef<HTMLInputElement>(null)
  const steps = [
    ['מוסיפים את המטופלים', 'שם, מספר תיק, מספר הפנייה וסכום למפגש. פעם אחת.'],
    ['מסכמים כל טופס', 'מזינים כמה מפגשים נחתמו, ומעתיקים לטופס את המע״מ והסה״כ.'],
    ['מצרפים סריקות ומפיקים', 'הטבלה החודשית נבנית לבד, והקבצים מקבלים שמות אחידים.'],
  ]
  const restore = async (f: File | undefined) => {
    if (!f) return
    const d = await readBackup(f)
    if (!d) return toast('הקובץ הזה אינו קובץ גיבוי של הכלי')
    setData(() => d)
    toast(`שוחזרו ${d.patients.length} מטופלים`)
  }
  const more: { icon: ReactNode; title: string; sub: string; onClick: () => void }[] = [
    { icon: <Upload size={20} />, title: 'שחזור מקובץ גיבוי', sub: 'מעבירים לכאן מטופלים וסכומים ממחשב או מדפדפן אחר.', onClick: () => fileIn.current?.click() },
    { icon: <Percent size={20} />, title: 'הגדרת מע״מ ושם המטפל', sub: 'שיעור המע״מ, עוסק פטור, והשם שמופיע מעל הטבלה.', onClick: () => go('settings') },
  ]
  return (
    <div style={{ maxWidth: 640, margin: '0 auto', display: 'flex', flexDirection: 'column', gap: 24, animation: `rise 480ms ${EASE}` }}>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
        <h1 style={{ margin: 0, fontSize: 28, fontWeight: 600 }}>דיווח חודשי למשרד הביטחון, בלי טבלאות ביד</h1>
        <p style={{ margin: 0, fontSize: 16, color: c.ink2, lineHeight: 1.6 }}>חישוב מע״מ וסה״כ לכל טופס, טבלה חודשית מוכנה, וקבצים מסודרים להעלאה.</p>
      </div>
      <Card style={{ padding: 8, background: c.sub, border: 'none' }}>
        {steps.map(([t, d], i) => (
          <div key={t} style={{ display: 'flex', gap: 16, padding: 16, background: c.surface, borderRadius: 8, marginTop: i ? 8 : 0 }}>
            <span style={{ flex: '0 0 32px', height: 32, borderRadius: 999, background: c.primary, color: '#fff', display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 600 }}>{i + 1}</span>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
              <span style={{ fontWeight: 600 }}>{t}</span>
              <span style={{ fontSize: 15, color: c.ink2, lineHeight: 1.5 }}>{d}</span>
            </div>
          </div>
        ))}
      </Card>
      <Button kind="primary" icon={<UserPlus size={18} />} onClick={onAdd} style={{ alignSelf: 'flex-start', height: 48, padding: '0 24px' }}>
        הוספת מטופל ראשון
      </Button>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
        <span style={{ fontSize: 14, fontWeight: 600, color: c.ink2 }}>אפשר גם להתחיל מכאן</span>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))', gap: 8 }}>
          {more.map((m) => (
            <button
              key={m.title}
              onClick={m.onClick}
              style={{ display: 'flex', gap: 16, alignItems: 'flex-start', padding: 16, background: c.surface, border: `1px solid ${c.line}`, borderRadius: 12, textAlign: 'start', cursor: 'pointer', color: c.ink, font: 'inherit' }}
            >
              <span style={{ flex: '0 0 40px', height: 40, borderRadius: 8, background: c.sub, color: c.primary, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>{m.icon}</span>
              <span style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
                <span style={{ fontWeight: 600, fontSize: 15 }}>{m.title}</span>
                <span style={{ fontSize: 14, color: c.ink2, lineHeight: 1.5 }}>{m.sub}</span>
              </span>
            </button>
          ))}
        </div>
      </div>
      <input ref={fileIn} type="file" accept="application/json,.json" hidden onChange={(e) => (restore(e.target.files?.[0]), (e.target.value = ''))} />
      <div style={{ display: 'flex', gap: 8, alignItems: 'flex-start', color: c.ink2, fontSize: 14, lineHeight: 1.5 }}>
        <ShieldCheck size={18} style={{ flex: '0 0 18px', marginTop: 2, color: c.ok }} />
        <span>כל המידע נשמר רק בדפדפן הזה, במכשיר הזה. שום דבר לא נשלח לשרת.</span>
      </div>
    </div>
  )
}

/** שיעור המע״מ משתנה מעת לעת, ולכן אפשר לעדכן אותו ישירות מכאן */
function VatInline({ ctx }: { ctx: Ctx }) {
  const { data, setData, toast } = ctx
  const s = data.settings
  const [editing, setEditing] = useState(false)
  const [val, setVal] = useState(String(s.vatRate))
  if (s.vatExempt) return <span>עוסק פטור, בלי מע״מ</span>
  const save = () => {
    const n = parseFloat(val)
    if (!Number.isFinite(n) || n < 0 || n > 100) return toast('שיעור מע״מ צריך להיות מספר בין 0 ל-100')
    setData((d) => ({ ...d, settings: { ...d.settings, vatRate: n } }))
    setEditing(false)
    toast(`שיעור המע״מ עודכן ל-${n}%. כל הסכומים חושבו מחדש.`)
  }
  if (!editing)
    return (
      <span style={{ display: 'inline-flex', alignItems: 'center', gap: 4 }}>
        מע״מ <b style={{ color: c.ink, fontVariantNumeric: 'tabular-nums' }}>{s.vatRate}%</b>
        <button
          onClick={() => (setVal(String(s.vatRate)), setEditing(true))}
          aria-label="עריכת שיעור המע״מ"
          style={{ display: 'inline-flex', alignItems: 'center', gap: 4, height: 32, padding: '0 8px', border: 'none', borderRadius: 8, background: 'transparent', color: c.primary, fontSize: 14, fontWeight: 500, cursor: 'pointer' }}
        >
          <Pencil size={14} />
          עריכה
        </button>
      </span>
    )
  return (
    <div style={{ display: 'inline-flex', alignItems: 'center', gap: 8 }}>
      <label htmlFor="vat-inline">מע״מ</label>
      <span style={{ position: 'relative', display: 'inline-flex' }}>
        <input
          id="vat-inline"
          autoFocus
          value={val}
          onChange={(e) => setVal(e.target.value)}
          onKeyDown={(e) => (e.key === 'Escape' ? setEditing(false) : e.key === 'Enter' && save())}
          inputMode="decimal"
          dir="ltr"
          style={{ width: 72, height: 32, borderRadius: 8, border: `1px solid ${c.primary}`, background: c.surface, padding: '0 24px 0 8px', fontSize: 15, color: c.ink, textAlign: 'right' }}
        />
        <span style={{ position: 'absolute', right: 8, top: 0, bottom: 0, display: 'flex', alignItems: 'center', color: c.ink2, fontSize: 14 }}>%</span>
      </span>
      <Button kind="primary" icon={<Check size={16} />} onClick={save} style={{ height: 32, padding: '0 12px', fontSize: 14 }}>
        שמירה
      </Button>
      <Button kind="ghost" onClick={() => setEditing(false)} style={{ height: 32, padding: '0 8px', fontSize: 14 }}>
        ביטול
      </Button>
    </div>
  )
}

function Progress({ pct, width }: { pct: number; width?: number }) {
  return (
    <div style={{ height: 8, width: width ?? '100%', flex: width ? `0 0 ${width}px` : undefined, background: c.sub, borderRadius: 999, overflow: 'hidden' }} role="progressbar" aria-valuenow={Math.round(pct * 100)} aria-valuemin={0} aria-valuemax={100}>
      <div style={{ width: `${pct * 100}%`, height: '100%', background: c.ok, borderRadius: 999, transition: `width 480ms ${EASE}` }} />
    </div>
  )
}
