import { useEffect, useMemo, useRef, useState, type ReactNode } from 'react'
import { createPortal } from 'react-dom'
import { Check, CheckCircle2, FileOutput, FileStack, FileUp, Paperclip, Pencil, Percent, ShieldCheck, Upload, UserPlus } from 'lucide-react'
import type { Ctx } from '../App'
import { Badge, Button, c, Card, EASE, Stepper } from '../ui'
import { calc, ils, monthLabel, statusOf, uid, type Entry, type Patient, type Scan } from '../model'
import { makeThumb } from '../pdf'
import { readBackup } from '../backup'
import { MonthSwitcher } from './parts'
import PatientForm from './PatientForm'
import AssignSheet from './AssignSheet'
import ScanSheet from './ScanSheet'
import ReportSheet from './ReportSheet'

const ACCEPT = 'application/pdf,image/jpeg,image/png'

export default function MonthScreen({ ctx }: { ctx: Ctx }) {
  const { data, setData, scans, setScans, month, setMonth, toast, wide, layout, slots } = ctx
  const entries = data.months[month] ?? {}
  const [adding, setAdding] = useState(false)
  const [assigning, setAssigning] = useState(false)
  const [viewScan, setViewScan] = useState<{ scan: Scan; patient: Patient } | null>(null)
  const [reporting, setReporting] = useState(false)
  const [busy, setBusy] = useState(false)
  const bulkInput = useRef<HTMLInputElement>(null)
  const oneInput = useRef<HTMLInputElement>(null)
  const target = useRef<string | null>(null)

  const patients = useMemo(
    () => data.patients.filter((p) => !p.archived || entries[p.id]).sort((a, b) => a.name.localeCompare(b.name, 'he')),
    [data.patients, entries],
  )
  const assignedIds = new Set(Object.values(entries).map((e) => e.scanId).filter(Boolean))
  const unassigned = scans.filter((s) => s.month === month && !assignedIds.has(s.id))
  const ready = patients.filter((p) => statusOf(entries[p.id]) === 'ready')
  const total = patients.reduce((sum, p) => sum + calc(p, entries[p.id], data.settings).total, 0)

  const setEntry = (pid: string, fn: (e: Entry) => Entry) =>
    setData((d) => {
      const m = d.months[month] ?? {}
      const cur = m[pid] ?? { signed: 0, cancelled: 0 }
      return { ...d, months: { ...d.months, [month]: { ...m, [pid]: fn(cur) } } }
    })

  const attach = (pid: string, scanId: string | undefined) => {
    const old = entries[pid]?.scanId
    setEntry(pid, (e) => ({ ...e, scanId }))
    if (old && old !== scanId) setScans((s) => s.filter((x) => x.id !== old))
  }

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
    setScans((s) => [...s, ...made])
    setBusy(false)
    if (forPatient) {
      attach(forPatient, made[0].id)
      toast('הסריקה צורפה')
      return
    }
    let auto = 0
    for (const s of made) {
      const p = guess(s.name)
      if (p) {
        attach(p.id, s.id)
        auto++
      }
    }
    if (auto === made.length) toast(auto === 1 ? 'הסריקה שויכה אוטומטית לפי שם הקובץ' : `${auto} סריקות שויכו אוטומטית לפי שם הקובץ`)
    else setAssigning(true)
  }

  // כשהכרטיס הראשי יוצא מהמסך מופיע פס מצומצם
  const headRef = useRef<HTMLDivElement>(null)
  const [compact, setCompact] = useState(false)
  const hasPatients = data.patients.some((p) => !p.archived)
  useEffect(() => {
    const el = headRef.current
    if (!el) return
    const io = new IntersectionObserver(([e]) => setCompact(!e.isIntersecting), { rootMargin: `-${wide ? 0 : 64}px 0px 0px 0px` })
    io.observe(el)
    return () => io.disconnect()
  }, [wide, hasPatients, layout])

  // גרסת הניסיון: ייבוא סריקות לדוגמה
  const importRef = useRef(importFiles)
  importRef.current = importFiles
  useEffect(() => {
    const on = (e: Event) => void importRef.current((e as CustomEvent<File[]>).detail)
    window.addEventListener('proto-import', on)
    return () => window.removeEventListener('proto-import', on)
  }, [])

  if (data.patients.filter((p) => !p.archived).length === 0) {
    return (
      <>
        <Welcome ctx={ctx} onAdd={() => setAdding(true)} />
        {adding && (
          <PatientForm
            onClose={() => setAdding(false)}
            onSave={(p) => {
              setData((d) => ({ ...d, patients: [...d.patients, p] }))
              setAdding(false)
              toast(`${p.name} נוסף. אפשר להוסיף עוד מטופלים מלשונית ״מטופלים״.`)
            }}
          />
        )}
      </>
    )
  }

  const pct = patients.length ? ready.length / patients.length : 0
  const actions = (small: boolean) => (
    <div style={{ display: 'flex', gap: 8, flex: wide ? undefined : small ? undefined : 1 }}>
      <Button icon={<FileUp size={small ? 16 : 18} />} onClick={() => bulkInput.current?.click()} disabled={busy} style={{ flex: wide || small ? undefined : 1, ...(small ? { height: 36, padding: '0 12px', fontSize: 14 } : {}) }}>
        {busy ? 'קורא קבצים…' : 'ייבוא סריקות'}
      </Button>
      <Button kind="primary" icon={<FileOutput size={small ? 16 : 18} />} onClick={() => setReporting(true)} disabled={!ready.length} style={{ flex: wide || small ? undefined : 1, ...(small ? { height: 36, padding: '0 12px', fontSize: 14 } : {}) }}>
        הפקת דיווח
      </Button>
    </div>
  )

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 24 }}>
      {wide && layout === 'b' && slots.bar && createPortal(
        // פריסה ב: פס פעולות קבוע למעלה
        <div style={{ background: c.surface, borderBottom: `1px solid ${c.line}` }}>
          <div style={{ maxWidth: 1184, margin: '0 auto', padding: '16px 32px', display: 'flex', alignItems: 'center', gap: 24, flexWrap: 'wrap' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 16 }}>
              <h1 style={{ margin: 0, fontSize: 20, fontWeight: 600 }}>החודש</h1>
              <MonthSwitcher month={month} setMonth={setMonth} />
            </div>
            <div style={{ flex: 1, minWidth: 280, display: 'flex', flexDirection: 'column', gap: 4 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 16, fontSize: 14, color: c.ink2, flexWrap: 'wrap' }}>
                <span>
                  <b style={{ color: c.ink, fontVariantNumeric: 'tabular-nums' }}>
                    {ready.length} מתוך {patients.length}
                  </b>{' '}
                  מוכנים לשליחה
                </span>
                <span>
                  סה״כ <b style={{ color: c.ink, fontVariantNumeric: 'tabular-nums' }}>{ils(total)}</b>
                </span>
                <VatInline ctx={ctx} />
              </div>
              <Progress pct={pct} />
            </div>
            {actions(false)}
          </div>
        </div>,
        slots.bar,
      )}

      {wide && layout === 'c' && slots.head && createPortal(
        <>
          <MonthSwitcher month={month} setMonth={setMonth} />
          {actions(true)}
        </>,
        slots.head,
      )}
      {wide && layout === 'c' && slots.strip && createPortal(
        // פריסה ג: פס התקדמות דק מתחת לפס העליון
        <div style={{ borderTop: `1px solid ${c.line}`, background: c.surface }}>
          <div style={{ maxWidth: 1184, margin: '0 auto', padding: '8px 32px', display: 'flex', alignItems: 'center', gap: 24, fontSize: 14, color: c.ink2 }}>
            <span style={{ whiteSpace: 'nowrap' }}>
              <b style={{ color: c.ink, fontVariantNumeric: 'tabular-nums' }}>
                {ready.length} מתוך {patients.length}
              </b>{' '}
              מוכנים לשליחה
            </span>
            <div style={{ flex: 1 }}>
              <Progress pct={pct} />
            </div>
            <span style={{ whiteSpace: 'nowrap' }}>
              סה״כ <b style={{ color: c.ink, fontVariantNumeric: 'tabular-nums' }}>{ils(total)}</b>
            </span>
            <VatInline ctx={ctx} />
          </div>
        </div>,
        slots.strip,
      )}

      {(!wide || layout === 'a') && (
        <>
      {/* פס מצומצם שנצמד למעלה כשהכרטיס הראשי יוצא מהמסך */}
      <div style={{ position: 'sticky', top: wide ? 0 : 64, height: 0, zIndex: 15, marginBottom: -24 }}>
        <div
          aria-hidden={!compact}
          inert={!compact}
          style={{
            marginInline: wide ? -32 : -16,
            background: c.surface,
            borderBottom: `1px solid ${c.line}`,
            boxShadow: '0 4px 16px rgba(16,22,34,0.08)',
            padding: wide ? '12px 32px' : '8px 16px',
            display: 'flex',
            alignItems: 'center',
            gap: wide ? 24 : 8,
            transform: compact ? 'translateY(0)' : 'translateY(-110%)',
            opacity: compact ? 1 : 0,
            pointerEvents: compact ? 'auto' : 'none',
            transition: `transform 320ms ${EASE}, opacity 200ms ${EASE}`,
          }}
        >
          {wide && <span style={{ fontSize: 17, fontWeight: 600, whiteSpace: 'nowrap' }}>{monthLabel(month)}</span>}
          <div style={{ flex: 1, display: 'flex', alignItems: 'center', gap: wide ? 16 : 8, minWidth: 0 }}>
            <span style={{ fontSize: 14, color: c.ink2, whiteSpace: 'nowrap' }}>
              <b style={{ color: c.ink, fontVariantNumeric: 'tabular-nums' }}>
                {ready.length} מתוך {patients.length}
              </b>{' '}
              מוכנים
            </span>
            {wide && <Progress pct={pct} width={120} />}
            {wide && (
              <span style={{ fontSize: 14, color: c.ink2, whiteSpace: 'nowrap' }}>
                סה״כ <b style={{ color: c.ink, fontVariantNumeric: 'tabular-nums' }}>{ils(total)}</b>
              </span>
            )}
          </div>
          {actions(true)}
        </div>
      </div>

      {/* כותרת החודש, סטטוס ופעולות ראשיות */}
      <Card style={{ padding: wide ? 24 : 16, display: 'flex', flexDirection: 'column', gap: wide ? 24 : 16 }}>
        <div ref={wide ? headRef : undefined} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 16, flexWrap: 'wrap' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 16, flexWrap: 'wrap' }}>
            {wide && <h1 style={{ margin: 0, fontSize: 26, fontWeight: 600 }}>החודש</h1>}
            <MonthSwitcher month={month} setMonth={setMonth} />
          </div>
          {wide && actions(false)}
        </div>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
          <div style={{ display: 'flex', alignItems: 'baseline', gap: 8, flexWrap: 'wrap' }}>
            <span style={{ fontSize: 22, fontWeight: 600, fontVariantNumeric: 'tabular-nums' }}>
              {ready.length} מתוך {patients.length}
            </span>
            <span style={{ color: c.ink2, fontSize: 15 }}>מוכנים לשליחה</span>
          </div>
          <Progress pct={pct} />
          <div style={{ display: 'flex', alignItems: 'center', gap: 16, flexWrap: 'wrap', fontSize: 14, color: c.ink2, minHeight: 32 }}>
            <span>
              סה״כ לחודש: <b style={{ color: c.ink, fontVariantNumeric: 'tabular-nums' }}>{ils(total)}</b>
            </span>
            <VatInline ctx={ctx} />
          </div>
        </div>
        {!wide && <div ref={headRef}>{actions(false)}</div>}
      </Card>

        </>
      )}

      {unassigned.length > 0 && (
        <button
          onClick={() => setAssigning(true)}
          style={{ display: 'flex', alignItems: 'center', gap: 16, padding: 16, background: c.warnBg, color: c.warn, border: 'none', borderRadius: 12, fontSize: 15, cursor: 'pointer', textAlign: 'start' }}
        >
          <FileStack size={20} />
          <span style={{ flex: 1 }}>
            {unassigned.length === 1 ? (<><b>סריקה אחת</b> ממתינה לשיוך למטופל</>) : (<><b>{unassigned.length} סריקות</b> ממתינות לשיוך למטופל</>)}
          </span>
          <span style={{ fontWeight: 600, textDecoration: 'underline' }}>לשיוך</span>
        </button>
      )}

      {/* רשימת המטופלים */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 16, paddingInlineStart: wide ? 24 : 0, marginBottom: 8 }}>
          <h2 style={{ margin: 0, fontSize: 17, fontWeight: 600 }}>
            מטופלים <span style={{ color: c.ink2, fontWeight: 400 }}>· {patients.length}</span>
          </h2>
          <Button icon={<UserPlus size={18} />} onClick={() => setAdding(true)}>
            הוספת מטופל
          </Button>
        </div>
        {wide && (
          <div style={{ display: 'grid', gridTemplateColumns: COLS, gap: 16, padding: '0 24px', fontSize: 13, color: c.ink2, fontWeight: 500 }}>
            <span>מטופל</span>
            <span>מפגשים חתומים</span>
            <span>ביטולים ללא הודעה</span>
            <span>לכתוב בטופס</span>
            <span>סריקה</span>
          </div>
        )}
        {patients.map((p) => (
          <Row
            key={p.id}
            p={p}
            e={entries[p.id]}
            ctx={ctx}
            scan={scans.find((s) => s.id === entries[p.id]?.scanId)}
            onEntry={(fn) => setEntry(p.id, fn)}
            onAttach={() => {
              target.current = p.id
              oneInput.current?.click()
            }}
            onView={(scan) => setViewScan({ scan, patient: p })}
          />
        ))}
      </div>

      <input ref={bulkInput} type="file" accept={ACCEPT} multiple hidden onChange={(e) => (importFiles(e.target.files), (e.target.value = ''))} />
      <input ref={oneInput} type="file" accept={ACCEPT} hidden onChange={(e) => (importFiles(e.target.files, target.current ?? undefined), (e.target.value = ''))} />

      {adding && (
        <PatientForm
          onClose={() => setAdding(false)}
          onSave={(p) => {
            setData((d) => ({ ...d, patients: [...d.patients, p] }))
            setAdding(false)
            toast(`${p.name} נוסף לרשימה`)
          }}
        />
      )}
      {assigning && (
        <AssignSheet
          scans={unassigned}
          patients={patients}
          entries={entries}
          onSave={(choices) => {
            const del = Object.keys(choices).filter((sid) => choices[sid] === 'delete')
            const pairs = Object.entries(choices).filter(([, v]) => v !== 'delete')
            for (const [sid, pid] of pairs) attach(pid, sid)
            if (del.length) setScans((s) => s.filter((x) => !del.includes(x.id)))
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
            setScans((s) => s.filter((x) => x.id !== viewScan.scan.id))
            setViewScan(null)
            toast('הסריקה הוסרה')
          }}
          onClose={() => setViewScan(null)}
        />
      )}
      {reporting && <ReportSheet ctx={ctx} ready={ready} patients={patients} onClose={() => setReporting(false)} />}
    </div>
  )
}

const COLS = 'minmax(180px, 1.6fr) 136px 136px minmax(200px, 1.4fr) 168px'

function Row({
  p,
  e,
  ctx,
  scan,
  onEntry,
  onAttach,
  onView,
}: {
  p: Patient
  e: Entry | undefined
  ctx: Ctx
  scan: Scan | undefined
  onEntry: (fn: (e: Entry) => Entry) => void
  onAttach: () => void
  onView: (s: Scan) => void
}) {
  const { wide, data } = ctx
  const st = statusOf(e)
  const r = calc(p, e, data.settings)
  const has = r.sessions > 0

  const who = (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 4, minWidth: 0 }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
        <span style={{ fontWeight: 600, fontSize: 16 }}>{p.name}</span>
        {st === 'ready' && (
          <Badge tone="ok">
            <CheckCircle2 size={14} /> מוכן
          </Badge>
        )}
        {st === 'amounts' && <Badge tone="warn">{has ? 'חסרה סריקה' : 'חסרים מפגשים'}</Badge>}
      </div>
      <span style={{ fontSize: 13, color: c.ink2, fontVariantNumeric: 'tabular-nums' }}>
        תיק {p.fileNo} · הפנייה {p.referralNo} · {ils(p.rate)} למפגש
      </span>
    </div>
  )

  const steppers = (
    <>
      <Stepper label="מפגשים חתומים" value={e?.signed ?? 0} onChange={(n) => onEntry((x) => ({ ...x, signed: n }))} />
      <Stepper label="ביטולים ללא הודעה" value={e?.cancelled ?? 0} onChange={(n) => onEntry((x) => ({ ...x, cancelled: n }))} />
    </>
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

  if (wide)
    return (
      <Card style={{ display: 'grid', gridTemplateColumns: COLS, gap: 16, alignItems: 'center', padding: '16px 24px' }}>
        {who}
        <Stepper hideLabel label="מפגשים חתומים" value={e?.signed ?? 0} onChange={(n) => onEntry((x) => ({ ...x, signed: n }))} />
        <Stepper hideLabel label="ביטולים ללא הודעה" value={e?.cancelled ?? 0} onChange={(n) => onEntry((x) => ({ ...x, cancelled: n }))} />
        {sums}
        {scanCell}
      </Card>
    )

  return (
    <Card style={{ padding: 16, display: 'flex', flexDirection: 'column', gap: 16 }}>
      {who}
      <div style={{ display: 'flex', gap: 16, flexWrap: 'wrap' }}>{steppers}</div>
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
