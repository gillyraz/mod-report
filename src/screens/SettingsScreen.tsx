import { useEffect, useRef, useState } from 'react'
import { DatabaseBackup, KeyRound, Trash2, Upload } from 'lucide-react'
import type { Ctx } from '../App'
import { Button, c, EASE, Field, lift, Sheet } from '../ui'
import { WipeAnimation, WIPE_MS } from './WipeAnimation'
import * as vault from '../vault'
import { monthLabel, setVatFrom, vatOf, type Data, type Scan, type Settings } from '../model'
import { downloadFiles } from '../files'
import { PageBar } from './parts'
import { PROTO } from '../proto'

const count = (n: number, one: string, many: string) => (n === 1 ? `${one} אחד` : `${n} ${many}`)
const countF = (n: number, one: string, many: string) => (n === 1 ? `${one} אחת` : n === 0 ? `בלי ${many}` : `${n} ${many}`)

export default function SettingsScreen({ ctx }: { ctx: Ctx }) {
  const { data, setData, scans, setScans, toast, month } = ctx
  const s = data.settings
  const mv = vatOf(data, month)
  const [pending, setPending] = useState<{ data: Data; scans: Scan[] } | null>(null)
  const fileIn = useRef<HTMLInputElement>(null)
  const [confirmWipe, setConfirmWipe] = useState(false)
  const [wiping, setWiping] = useState<'run' | 'done' | null>(null)
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

  const [folder, setFolder] = useState(vault.folderLabel())
  const [askPw, setAskPw] = useState<Uint8Array | null>(null) // גיבוי שהוצפן בסיסמה אחרת
  const [backupPw, setBackupPw] = useState('')
  const [backupErr, setBackupErr] = useState<string>()

  const backup = async () => {
    const bytes = await vault.backupBytes(data, scans)
    if (!bytes) return
    const name = `גיבוי_דיווח_חודשי_${new Date().toISOString().slice(0, 10)}.mrv`
    if (PROTO) return toast('בפרוטוטייפ אין שמירת קבצים. בגרסה האמיתית נפתח חלון לבחירת מקום הגיבוי.')
    const picker = (window as unknown as { showSaveFilePicker?: (o: object) => Promise<{ name: string; createWritable: () => Promise<{ write: (b: BlobPart) => Promise<void>; close: () => Promise<void> }> }> }).showSaveFilePicker
    try {
      if (picker) {
        const h = await picker({ suggestedName: name, id: 'mod-report-backup' })
        const w = await h.createWritable()
        await w.write(bytes as BlobPart)
        await w.close()
        toast(`הגיבוי נשמר בקובץ ${h.name}`)
      } else {
        await downloadFiles([new File([bytes as BlobPart], name, { type: 'application/octet-stream' })])
        toast('קובץ הגיבוי נשמר בתיקיית ההורדות')
      }
    } catch {
      /* המשתמש סגר את החלון */
    }
  }
  const restore = async (f: File | undefined, password?: string) => {
    if (!f) return
    await restoreBytes(new Uint8Array(await f.arrayBuffer()), password)
  }
  const restoreBytes = async (bytes: Uint8Array, password?: string) => {
    const r = await vault.readBackup(bytes, password)
    if (!r.ok) {
      if (r.reason === 'invalid') return toast('הקובץ הזה אינו קובץ גיבוי של הכלי')
      if (password) return setBackupErr('הסיסמה לא נכונה. זו הסיסמה שהייתה בזמן יצירת הגיבוי.')
      setBackupErr(undefined)
      return setAskPw(bytes) // הגיבוי נוצר עם סיסמה אחרת
    }
    setAskPw(null)
    setBackupPw('')
    setBackupErr(undefined)
    if (!data.patients.length && !scans.length) return apply(r)
    setPending(r) // יש מידע קיים: מבקשים אישור לפני שמחליפים אותו
  }
  const apply = (b: { data: Data; scans: Scan[] }) => {
    setScans(() => b.scans)
    setData(() => b.data)
    setPending(null)
    toast(b.scans.length ? `שוחזרו ${b.data.patients.length} מטופלים ו-${b.scans.length} סריקות` : `שוחזרו ${b.data.patients.length} מטופלים`)
  }
  const move = async () => {
    const r = await vault.moveFolder()
    if (r.ok) return setFolder(r.label), toast(`המידע הועבר לתיקייה ״${r.label}״. העותק בתיקייה הקודמת נשאר מוצפן, ואפשר למחוק אותו.`)
    if (r.reason === 'existing') toast('בתיקייה הזו כבר שמור מידע של הכלי. בוחרים תיקייה ריקה.')
    if (r.reason === 'same') toast('זו התיקייה שבה המידע כבר נשמר.')
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column' }}>
      <PageBar ctx={ctx} title="הגדרות" sub="שינויים נשמרים אוטומטית." />
      <span aria-hidden style={{ height: 24 }} />

      <Section wide={ctx.wide} flush title="שמירה ואבטחה" desc="איפה המידע נשמר ומי יכול לפתוח אותו.">
        <Row title={vault.isFolder() ? `תיקייה ״${folder}״` : folder} desc={vault.isFolder() ? 'כאן נשמרים המטופלים, הסריקות והטבלאות.' : 'המידע נשמר מוצפן בדפדפן, במכשיר הזה בלבד.'}>
          {vault.isFolder() && vault.canPickFolder() && <Button onClick={move}>העברה לתיקייה אחרת</Button>}
        </Row>
        <Divider />
        <ChangePassword toast={toast} />
        <Divider />
        <Row title="נעילה אוטומטית" desc="כשאין שימוש הכלי ננעל, והמידע נשאר מוצפן.">
          <Segmented label="נעילה אוטומטית אחרי" value={s.lockMinutes} onChange={(v) => set({ lockMinutes: v })} options={[5, 15, 30, 60].map((m) => [m, `${m} דק׳`] as const)} />
        </Row>
      </Section>

      <Section wide={ctx.wide} title="חישוב" desc="מע״מ והסכום שמופיע בטבלה שנשלחת למשרד.">
        <div style={{ maxWidth: 480 }}>
          <Field label="שיעור מע״מ" disabled={mv.exempt} value={vatText} onChange={onVat} inputMode="decimal" suffix="%" dirLtr hint={mv.exempt ? 'עוסק פטור לא גובה מע״מ, ולכן השיעור לא נכנס לחישוב.' : `חל מ${monthLabel(month)} והלאה. החודשים הקודמים נשארים כמו שדווחו.`} />
        </div>
        {vatBad && (
          <p role="alert" style={{ margin: '-8px 0 0', fontSize: 14, color: c.danger }}>
            שיעור מע״מ צריך להיות מספר בין 0 ל-100. נשמר השיעור הקודם, {mv.rate}%.
          </p>
        )}
        <Toggle label="עוסק פטור (בלי מע״מ)" checked={mv.exempt} onChange={(v) => setData((d) => setVatFrom(d, month, { rate: vatOf(d, month).rate, exempt: v }))} />
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
          <span style={{ fontSize: 13, fontWeight: 600, color: c.ink2 }}>הסכום שמופיע בטבלה החודשית</span>
          <Segmented label="הסכום שמופיע בטבלה החודשית" disabled={mv.exempt} value={s.tableAmount} onChange={(v) => set({ tableAmount: v })} options={[['total', 'סה״כ כולל מע״מ'], ['beforeVat', 'לפני מע״מ']] as const} />
        </div>
      </Section>

      <Section wide={ctx.wide} title="פרטים בראש הטבלה" desc="מה שמופיע מעל הטבלה החודשית.">
        <div style={{ maxWidth: 480 }}>
          <Field label="שם המטפל/ת" value={s.therapistName} onChange={(v) => set({ therapistName: v })} hint="מופיע מעל הטבלה החודשית. לא חובה." />
        </div>
      </Section>

      <Section wide={ctx.wide} title="גיבוי" desc="קובץ נוסף עם המטופלים והסכומים, למעבר מחשב או לשחזור.">
        <p style={{ margin: 0, color: c.ink2, fontSize: 15, lineHeight: 1.6, maxWidth: 640 }}>
          קובץ הגיבוי שומר את כל המידע: המטופלים, הסכומים והסריקות. הוא מוצפן באותה סיסמה.
        </p>
        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
          <Button icon={<DatabaseBackup size={18} />} onClick={backup}>
            שמירת קובץ גיבוי
          </Button>
          <Button icon={<Upload size={18} />} onClick={() => fileIn.current?.click()}>
            שחזור מקובץ
          </Button>
        </div>
        {pending && (
          <Sheet
            title="שחזור מקובץ גיבוי"
            icon={<Upload size={20} />}
            onClose={() => setPending(null)}
            footer={
              <>
                <Button kind="primary" onClick={() => apply(pending)}>
                  החלפת המידע במידע מהקובץ
                </Button>
                <Button kind="ghost" onClick={() => setPending(null)}>
                  ביטול
                </Button>
              </>
            }
          >
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
              {[
                ['עכשיו במחשב', data.patients.length, scans.length],
                ['בקובץ הגיבוי', pending.data.patients.length, pending.scans.length],
              ].map(([label, pts, scs]) => (
                <div key={label} style={{ display: 'flex', flexDirection: 'column', gap: 8, padding: 16, background: c.sub, borderRadius: 12 }}>
                  <span style={{ fontSize: 13, fontWeight: 600, color: c.ink3 }}>{label}</span>
                  <span style={{ fontSize: 15, fontWeight: 600, color: c.ink, lineHeight: 1.5 }}>
                    {count(pts as number, 'מטופל', 'מטופלים')}
                    <br />
                    {countF(scs as number, 'סריקה', 'סריקות')}
                  </span>
                </div>
              ))}
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
              <span style={{ fontSize: 16, fontWeight: 600, color: c.ink }}>האם להחליף את המידע?</span>
              <span style={{ fontSize: 14, color: c.ink2, lineHeight: 1.6 }}>המידע שיש עכשיו יוחלף במידע מהקובץ, ואי אפשר לבטל את זה אחרי האישור.</span>
            </div>
          </Sheet>
        )}
        {askPw && (
          <Sheet
            title="הגיבוי נוצר עם סיסמה אחרת"
            icon={<KeyRound size={20} />}
            onClose={() => (setAskPw(null), setBackupPw(''), setBackupErr(undefined))}
            footer={
              <>
                <Button kind="primary" onClick={() => restoreBytes(askPw, backupPw)}>
                  פתיחת הגיבוי
                </Button>
                <Button kind="ghost" onClick={() => (setAskPw(null), setBackupPw(''), setBackupErr(undefined))}>
                  ביטול
                </Button>
              </>
            }
          >
            <form onSubmit={(e) => (e.preventDefault(), restoreBytes(askPw, backupPw))} style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
              <p style={{ margin: 0, fontSize: 15, color: c.ink2, lineHeight: 1.7 }}>מזינים את הסיסמה שהייתה בזמן יצירת הגיבוי.</p>
              <Field label="הסיסמה של הגיבוי" type="password" value={backupPw} onChange={(v) => (setBackupPw(v), setBackupErr(undefined))} autoFocus error={backupErr} />
              <button type="submit" hidden />
            </form>
          </Sheet>
        )}
        <input ref={fileIn} type="file" accept=".mrv,application/json,.json" hidden onChange={(e) => (restore(e.target.files?.[0]), (e.target.value = ''))} />
      </Section>

      <Section wide={ctx.wide} title="מחיקה" desc="מחיקה של כל המידע מהתיקייה ומהמחשב הזה.">
        <Button kind="danger" icon={<Trash2 size={18} />} onClick={() => setConfirmWipe(true)} style={{ alignSelf: 'flex-start' }}>
          מחיקת כל המידע
        </Button>
        {wiping && <WipeAnimation done={wiping === 'done'} />}
        {confirmWipe && !wiping && (
          <Sheet
            tone="danger"
            title="למחוק את כל המידע?"
            icon={<Trash2 size={20} />}
            onClose={() => setConfirmWipe(false)}
            footer={
                <>
                  <Button
                    kind="primary"
                    style={{ background: c.danger, boxShadow: 'none' }}
                    onClick={async () => {
                      setWiping('run')
                      const reduce = matchMedia('(prefers-reduced-motion: reduce)').matches
                      await Promise.all([vault.wipe(), new Promise((r) => setTimeout(r, reduce ? 0 : WIPE_MS))])
                      setWiping('done')
                      await new Promise((r) => setTimeout(r, 1100))
                      setWiping(null)
                      setConfirmWipe(false)
                      ctx.restart()
                      toast('כל המידע נמחק')
                    }}
                  >
                    מחיקת כל המידע
                  </Button>
                  <Button kind="ghost" onClick={() => setConfirmWipe(false)}>
                    ביטול
                  </Button>
                </>
            }
          >
              <p style={{ margin: 0, fontSize: 15, color: c.ink2, lineHeight: 1.7 }}>
                {vault.isFolder() ? <>כל המידע בתיקייה ״{vault.folderLabel()}״ במחשב יימחק: המטופלים, הסכומים, הסריקות והטבלאות שנשמרו.</> : 'כל המידע יימחק: המטופלים, הסכומים והסריקות.'}
                <br />
                אי אפשר לשחזר אותו בלי קובץ גיבוי.
              </p>
          </Sheet>
        )}
      </Section>
    </div>
  )
}

/** סעיף: כותרת והסבר מימין, ומשמאל משטח לבן אחד שמקבץ את הפקדים. הסעיפים מופרדים בקו */
function Section({ title, desc, wide, flush, children }: { title: string; desc: string; wide: boolean; flush?: boolean; children: React.ReactNode }) {
  return (
    <section aria-label={title} style={{ display: 'grid', gridTemplateColumns: wide ? '280px minmax(0, 1fr)' : '1fr', gap: wide ? 48 : 16, padding: wide ? '32px 0' : '24px 0', borderTop: `1px solid ${c.line}` }}>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 6, paddingTop: wide ? 22 : 0 }}>
        <h2 style={{ margin: 0, fontSize: 17, fontWeight: 600 }}>{title}</h2>
        <p style={{ margin: 0, fontSize: 14, color: c.ink3, lineHeight: 1.6 }}>{desc}</p>
      </div>
      <div style={{ background: c.surface, borderRadius: 20, boxShadow: lift, padding: flush ? 8 : 24, display: 'flex', flexDirection: 'column', gap: flush ? 0 : 20, minWidth: 0 }}>{children}</div>
    </section>
  )
}

const Divider = () => <div aria-hidden style={{ height: 1, background: c.line, margin: '0 16px' }} />

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

function Row({ title, desc, children }: { title: string; desc: string; children?: React.ReactNode }) {
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 16, flexWrap: 'wrap', padding: 16 }}>
      <div style={{ flex: '1 1 0', minWidth: 160 }}>
        <div style={{ fontWeight: 600, fontSize: 15 }}>{title}</div>
        <div style={{ color: c.ink3, fontSize: 13, marginTop: 2, lineHeight: 1.5 }}>{desc}</div>
      </div>
      {children}
    </div>
  )
}

function ChangePassword({ toast }: { toast: (t: string) => void }) {
  const [open, setOpen] = useState(false)
  const [cur, setCur] = useState('')
  const [next, setNext] = useState('')
  const [next2, setNext2] = useState('')
  const [err, setErr] = useState<string>()
  const [busy, setBusy] = useState(false)
  const close = () => (setOpen(false), setCur(''), setNext(''), setNext2(''), setErr(undefined))
  const submit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (next.length < 8) return setErr('הסיסמה החדשה קצרה מדי. צריך לפחות 8 תווים.')
    if (next !== next2) return setErr('הסיסמאות החדשות לא זהות.')
    setBusy(true)
    const ok = await vault.changePassword(cur, next)
    setBusy(false)
    if (!ok) return setErr('הסיסמה הנוכחית לא נכונה.')
    close()
    toast('הסיסמה הוחלפה. מעכשיו פותחים את הכלי בסיסמה החדשה.')
  }
  return (
    <div style={{ display: 'flex', flexDirection: 'column' }}>
      <Row title="סיסמה" desc="המידע מוצפן בסיסמה. אין דרך לשחזר סיסמה שנשכחה.">
        {!open && <Button onClick={() => setOpen(true)}>שינוי סיסמה</Button>}
      </Row>
      {open && (
        <form onSubmit={submit} style={{ display: 'flex', flexDirection: 'column', gap: 16, padding: '0 16px 20px', maxWidth: 32 + 480 }}>
          <Field label="הסיסמה הנוכחית" type="password" value={cur} onChange={(v) => (setCur(v), setErr(undefined))} autoFocus />
          <Field label="סיסמה חדשה" type="password" value={next} onChange={(v) => (setNext(v), setErr(undefined))} hint="לפחות 8 תווים" />
          <Field label="הקלדה חוזרת של הסיסמה החדשה" type="password" value={next2} onChange={(v) => (setNext2(v), setErr(undefined))} />
          {err && <span role="alert" style={{ color: c.danger, fontSize: 14 }}>{err}</span>}
          <div style={{ display: 'flex', gap: 8 }}>
            <Button kind="primary" type="submit" disabled={busy}>{busy ? 'מצפין מחדש…' : 'שמירת הסיסמה החדשה'}</Button>
            <Button kind="ghost" onClick={close}>ביטול</Button>
          </div>
        </form>
      )}
    </div>
  )
}

/** בחירה אחת מכמה אפשרויות גלויות. אותו פקד לכל בחירה כזו בהגדרות */
function Segmented<T extends string | number>({ label, value, onChange, options, disabled }: { label: string; disabled?: boolean; value: T; onChange: (v: T) => void; options: readonly (readonly [T, string])[] }) {
  return (
    <div role="radiogroup" aria-label={label} aria-disabled={disabled} style={{ opacity: disabled ? 0.5 : 1, display: 'inline-flex', alignSelf: 'flex-start', background: c.sub, borderRadius: 12, padding: 4, gap: 4 }}>
      {options.map(([v, l]) => {
        const on = value === v
        return (
          <button key={String(v)} role="radio" aria-checked={on} disabled={disabled} onClick={() => onChange(v)} style={{ height: 32, padding: '0 12px', borderRadius: 9, border: 'none', background: on ? c.primary : 'transparent', boxShadow: on ? '0 1px 2px rgba(69,102,232,0.3)' : 'none', color: on ? '#fff' : c.ink2, fontWeight: on ? 600 : 500, fontSize: 14, cursor: disabled ? 'not-allowed' : 'pointer', whiteSpace: 'nowrap', transition: `background 200ms ${EASE}` }}>
            {l}
          </button>
        )
      })}
    </div>
  )
}
