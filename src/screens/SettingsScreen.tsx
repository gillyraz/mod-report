import { useEffect, useRef, useState } from 'react'
import { DatabaseBackup, Trash2, Upload } from 'lucide-react'
import type { Ctx } from '../App'
import { Button, c, Card, EASE, Field } from '../ui'
import { defaultSettings, monthLabel, setVatFrom, vatOf, wipeAll, type Data, type Settings } from '../model'
import { backupFile, readBackup } from '../backup'
import { downloadFiles } from '../files'
import { PageBar } from './parts'
import { PROTO } from '../proto'

export default function SettingsScreen({ ctx }: { ctx: Ctx }) {
  const { data, setData, setScans, toast, month } = ctx
  const s = data.settings
  const mv = vatOf(data, month)
  const [pending, setPending] = useState<Data | null>(null)
  const fileIn = useRef<HTMLInputElement>(null)
  const [confirmWipe, setConfirmWipe] = useState(false)
  const [vatText, setVatText] = useState(String(mv.rate))
  useEffect(() => {
    if (parseFloat(vatText) !== mv.rate) setVatText(String(mv.rate))
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [mv.rate])
  const vatNum = parseFloat(vatText)
  const vatBad = vatText.trim() === '' || !Number.isFinite(vatNum) || vatNum > 100
  // שיעור המע״מ חל מהחודש שנבחר והלאה, כמו בעריכה בעמוד החודש
  const onVat = (v: string) => {
    const t = v.replace(/[^\d.]/g, '').replace(/(\..*)\./g, '$1')
    setVatText(t)
    const n = parseFloat(t)
    if (t.trim() !== '' && Number.isFinite(n) && n <= 100) setData((d) => setVatFrom(d, month, { rate: n, exempt: vatOf(d, month).exempt }))
  }
  const set = (patch: Partial<Settings>) => setData((d) => ({ ...d, settings: { ...d.settings, ...patch } }))

  const backup = () => {
    downloadFiles([backupFile(data)])
    toast(PROTO ? 'בפרוטוטייפ אין הורדת קבצים' : 'קובץ הגיבוי הורד')
  }
  const restore = async (f: File | undefined) => {
    if (!f) return
    const d = await readBackup(f)
    if (!d) return toast('הקובץ הזה אינו קובץ גיבוי של הכלי')
    if (!data.patients.length) return apply(d)
    setPending(d) // יש מידע קיים: מבקשים אישור לפני שמחליפים אותו
  }
  const apply = (d: Data) => {
    setScans(() => [])
    setData(() => d)
    setPending(null)
    toast(`שוחזרו ${d.patients.length} מטופלים`)
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
      <PageBar ctx={ctx} title="הגדרות" sub="שינויים נשמרים אוטומטית." />
      <span aria-hidden style={{ marginTop: -8 }} />

      <Section wide={ctx.wide} title="חישוב" desc="מע״מ והסכום שמופיע בטבלה שנשלחת למשרד.">
        <Field label="שיעור מע״מ" value={vatText} onChange={onVat} inputMode="decimal" suffix="%" dirLtr hint={`חל מ${monthLabel(month)} והלאה. החודשים הקודמים נשארים כמו שדווחו.`} />
        {vatBad && (
          <p role="alert" style={{ margin: '-8px 0 0', fontSize: 14, color: c.danger }}>
            שיעור מע״מ צריך להיות מספר בין 0 ל-100. נשמר השיעור הקודם, {mv.rate}%.
          </p>
        )}
        <Toggle label="עוסק פטור (בלי מע״מ)" checked={mv.exempt} onChange={(v) => setData((d) => setVatFrom(d, month, { rate: vatOf(d, month).rate, exempt: v }))} />
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
          <span style={{ fontSize: 14, fontWeight: 500 }}>הסכום שמופיע בטבלה החודשית</span>
          <div role="radiogroup" aria-label="הסכום שמופיע בטבלה החודשית" style={{ display: 'inline-flex', alignSelf: 'flex-start', background: c.group, borderRadius: 10, padding: 4, gap: 4 }}>
            {(
              [
                ['total', 'סה״כ כולל מע״מ'],
                ['beforeVat', 'לפני מע״מ'],
              ] as const
            ).map(([v, l]) => (
              <button
                key={v}
                role="radio"
                aria-checked={s.tableAmount === v}
                onClick={() => set({ tableAmount: v })}
                style={{ height: 36, padding: '0 16px', borderRadius: 8, border: 'none', background: s.tableAmount === v ? c.surface : 'transparent', boxShadow: s.tableAmount === v ? '0 1px 2px rgba(16,24,40,0.10)' : 'none', color: s.tableAmount === v ? c.ink : c.ink2, fontWeight: s.tableAmount === v ? 600 : 500, fontSize: 14, cursor: 'pointer', transition: `background 200ms ${EASE}` }}
              >
                {l}
              </button>
            ))}
          </div>
        </div>
      </Section>

      <Section wide={ctx.wide} title="פרטים בראש הטבלה" desc="מה שמופיע מעל הטבלה החודשית.">
        <Field label="שם המטפל/ת" value={s.therapistName} onChange={(v) => set({ therapistName: v })} hint="מופיע מעל הטבלה החודשית. לא חובה." />
      </Section>

      <Section wide={ctx.wide} title="גיבוי" desc="קובץ עם המטופלים והסכומים, למעבר מחשב או לשחזור.">
        <p style={{ margin: 0, color: c.ink2, fontSize: 15, lineHeight: 1.6 }}>
          המידע נשמר רק במחשב הזה. גיבוי שומר את המטופלים והסכומים לקובץ, כדי לעבור למחשב אחר או לשחזר. הסריקות לא נכללות בגיבוי.
        </p>
        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
          <Button icon={<DatabaseBackup size={18} />} onClick={backup}>
            הורדת קובץ גיבוי
          </Button>
          <Button icon={<Upload size={18} />} onClick={() => fileIn.current?.click()}>
            שחזור מקובץ
          </Button>
        </div>
        {pending && (
          <div role="alert" style={{ display: 'flex', flexDirection: 'column', gap: 16, padding: 16, background: c.warnSoft, borderRadius: 12 }}>
            <span style={{ color: c.warn, fontSize: 15, lineHeight: 1.6 }}>
              השחזור יחליף את {data.patients.length} המטופלים והסכומים שיש עכשיו במכשיר ב-{pending.patients.length} המטופלים מהקובץ. הסריקות שצורפו יוסרו, כי הן לא נשמרות בגיבוי.
            </span>
            <div style={{ display: 'flex', gap: 8 }}>
              <Button kind="primary" onClick={() => apply(pending)}>
                החלפת המידע במידע מהקובץ
              </Button>
              <Button kind="ghost" onClick={() => setPending(null)}>
                ביטול
              </Button>
            </div>
          </div>
        )}
        <input ref={fileIn} type="file" accept="application/json,.json" hidden onChange={(e) => (restore(e.target.files?.[0]), (e.target.value = ''))} />
      </Section>

      <Section wide={ctx.wide} title="מחיקה" desc="מחיקה של כל המידע מהמחשב הזה.">
        {!confirmWipe ? (
          <Button kind="danger" icon={<Trash2 size={18} />} onClick={() => setConfirmWipe(true)} style={{ alignSelf: 'flex-start' }}>
            מחיקת כל המידע מהמכשיר
          </Button>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 16, padding: 16, background: c.dangerBg, borderRadius: 12 }}>
            <span style={{ color: c.danger, fontSize: 15 }}>כל המטופלים, הסכומים והסריקות יימחקו מהמכשיר הזה, ואי אפשר לשחזר אותם בלי קובץ גיבוי.</span>
            <div style={{ display: 'flex', gap: 8 }}>
              <Button
                kind="primary"
                style={{ background: c.danger }}
                onClick={async () => {
                  await wipeAll()
                  setScans(() => [])
                  setData(() => ({ patients: [], months: {}, settings: defaultSettings }))
                  setConfirmWipe(false)
                  toast('כל המידע נמחק')
                }}
              >
                כן, למחוק הכול
              </Button>
              <Button kind="ghost" onClick={() => setConfirmWipe(false)}>
                ביטול
              </Button>
            </div>
          </div>
        )}
      </Section>
    </div>
  )
}

function Section({ title, desc, wide, children }: { title: string; desc: string; wide: boolean; children: React.ReactNode }) {
  return (
    <Card style={{ padding: wide ? 32 : 24, display: 'grid', gridTemplateColumns: wide ? '280px minmax(0, 560px)' : '1fr', gap: wide ? 48 : 16 }}>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
        <h2 style={{ margin: 0, fontSize: 17, fontWeight: 600 }}>{title}</h2>
        <p style={{ margin: 0, fontSize: 14, color: c.ink3, lineHeight: 1.5 }}>{desc}</p>
      </div>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 20, minWidth: 0 }}>{children}</div>
    </Card>
  )
}

function Toggle({ label, checked, onChange }: { label: string; checked: boolean; onChange: (v: boolean) => void }) {
  return (
    <label style={{ display: 'flex', alignItems: 'center', gap: 12, cursor: 'pointer', alignSelf: 'flex-start' }}>
      <button
        role="switch"
        aria-checked={checked}
        onClick={() => onChange(!checked)}
        style={{ width: 48, height: 28, borderRadius: 999, border: 'none', background: checked ? c.primary : '#CBD3DF', position: 'relative', cursor: 'pointer', transition: 'background 200ms cubic-bezier(0.16, 1, 0.3, 1)' }}
      >
        <span style={{ position: 'absolute', top: 4, insetInlineStart: checked ? 24 : 4, width: 20, height: 20, borderRadius: 999, background: '#fff', boxShadow: '0 1px 2px rgba(16,24,40,0.2)', transition: 'inset-inline-start 200ms cubic-bezier(0.16, 1, 0.3, 1)' }} />
      </button>
      <span style={{ fontSize: 15 }}>{label}</span>
    </label>
  )
}
