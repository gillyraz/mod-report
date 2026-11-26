import { useEffect, useRef, useState } from 'react'
import { DatabaseBackup, FolderOpen, KeyRound, Lock, Trash2, Upload } from 'lucide-react'
import type { Ctx } from '../App'
import { Button, c, Card, EASE, Field } from '../ui'
import * as vault from '../vault'
import { monthLabel, setVatFrom, vatOf, type Data, type Settings } from '../model'
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

  const [folder, setFolder] = useState(vault.folderLabel())
  const [askPw, setAskPw] = useState<Uint8Array | null>(null) // גיבוי שהוצפן בסיסמה אחרת
  const [backupPw, setBackupPw] = useState('')
  const [backupErr, setBackupErr] = useState<string>()

  const backup = async () => {
    const bytes = await vault.backupBytes(data)
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
    if (!data.patients.length) return apply(r.data)
    setPending(r.data) // יש מידע קיים: מבקשים אישור לפני שמחליפים אותו
  }
  const apply = (d: Data) => {
    setScans(() => [])
    setData(() => d)
    setPending(null)
    toast(`שוחזרו ${d.patients.length} מטופלים`)
  }
  const move = async () => {
    const r = await vault.moveFolder()
    if (r.ok) return setFolder(r.label), toast(`המידע הועבר לתיקייה ״${r.label}״. העותק בתיקייה הקודמת נשאר מוצפן, ואפשר למחוק אותו.`)
    if (r.reason === 'existing') toast('בתיקייה הזו כבר שמור מידע של הכלי. בוחרים תיקייה ריקה.')
    if (r.reason === 'same') toast('זו התיקייה שבה המידע כבר נשמר.')
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
      <PageBar ctx={ctx} title="הגדרות" sub="שינויים נשמרים אוטומטית." />
      <span aria-hidden style={{ marginTop: -8 }} />

      <Section wide={ctx.wide} title="שמירה ואבטחה" desc="איפה המידע נשמר ומי יכול לפתוח אותו.">
        <Row icon={<FolderOpen size={18} />} title={vault.isFolder() ? `תיקייה ״${folder}״` : folder} desc={vault.isFolder() ? 'כאן נשמרים המטופלים, הסריקות והטבלאות. כל שינוי נשמר מיד.' : 'המידע נשמר מוצפן בדפדפן, במכשיר הזה בלבד.'}>
          {vault.isFolder() && vault.canPickFolder() && <Button onClick={move}>העברה לתיקייה אחרת</Button>}
        </Row>
        <ChangePassword toast={toast} />
        <Row icon={<Lock size={18} />} title="נעילה אוטומטית" desc={`הכלי ננעל אחרי ${s.lockMinutes} דקות בלי שימוש.`}>
          <select aria-label="נעילה אוטומטית אחרי" value={s.lockMinutes} onChange={(e) => set({ lockMinutes: Number(e.target.value) })} style={{ height: 40, borderRadius: 12, border: 'none', background: c.sub, padding: '0 12px', fontSize: 14, fontWeight: 500, color: c.ink, cursor: 'pointer' }}>
            {[5, 15, 30, 60].map((m) => (
              <option key={m} value={m}>
                {m} דקות
              </option>
            ))}
          </select>
        </Row>
      </Section>

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

      <Section wide={ctx.wide} title="גיבוי" desc="קובץ נוסף עם המטופלים והסכומים, למעבר מחשב או לשחזור.">
        <p style={{ margin: 0, color: c.ink2, fontSize: 15, lineHeight: 1.6 }}>
          {vault.isFolder() ? 'העתקה של התיקייה היא הגיבוי המלא, כולל הסריקות. ' : ''}קובץ הגיבוי שומר את המטופלים והסכומים בלבד, מוצפן באותה סיסמה. הסריקות לא נכללות בו.
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
          <div role="alert" style={{ display: 'flex', flexDirection: 'column', gap: 16, padding: 16, background: c.warnSoft, borderRadius: 12 }}>
            <span style={{ color: c.warn, fontSize: 15, lineHeight: 1.6 }}>
              השחזור יחליף את {data.patients.length} המטופלים והסכומים שיש עכשיו ב-{pending.patients.length} המטופלים מהקובץ. הסריקות שצורפו יוסרו, כי הן לא נשמרות בגיבוי.
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
        {askPw && (
          <form
            onSubmit={(e) => (e.preventDefault(), restoreBytes(askPw, backupPw))}
            style={{ display: 'flex', flexDirection: 'column', gap: 12, padding: 16, background: c.sub, borderRadius: 12 }}
          >
            <span style={{ fontSize: 15, lineHeight: 1.6 }}>הגיבוי הזה נוצר עם סיסמה אחרת. מזינים את הסיסמה שהייתה בזמן יצירת הגיבוי.</span>
            <Field label="הסיסמה של הגיבוי" type="password" value={backupPw} onChange={(v) => (setBackupPw(v), setBackupErr(undefined))} autoFocus />
            {backupErr && <span role="alert" style={{ color: c.danger, fontSize: 14 }}>{backupErr}</span>}
            <div style={{ display: 'flex', gap: 8 }}>
              <Button kind="primary" type="submit">פתיחת הגיבוי</Button>
              <Button kind="ghost" onClick={() => (setAskPw(null), setBackupPw(''), setBackupErr(undefined))}>ביטול</Button>
            </div>
          </form>
        )}
        <input ref={fileIn} type="file" accept=".mrv,application/json,.json" hidden onChange={(e) => (restore(e.target.files?.[0]), (e.target.value = ''))} />
      </Section>

      <Section wide={ctx.wide} title="מחיקה" desc="מחיקה של כל המידע מהתיקייה ומהמחשב הזה.">
        {!confirmWipe ? (
          <Button kind="danger" icon={<Trash2 size={18} />} onClick={() => setConfirmWipe(true)} style={{ alignSelf: 'flex-start' }}>
            מחיקת כל המידע
          </Button>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 16, padding: 16, background: c.dangerBg, borderRadius: 12 }}>
            <span style={{ color: c.danger, fontSize: 15 }}>כל המטופלים, הסכומים והסריקות יימחקו מהתיקייה ומהמחשב, והכלי יחזור למסך הפתיחה. אי אפשר לשחזר אותם בלי קובץ גיבוי. טבלאות שכבר הופקו נשארות בתיקייה.</span>
            <div style={{ display: 'flex', gap: 8 }}>
              <Button
                kind="primary"
                style={{ background: c.danger }}
                onClick={async () => {
                  await vault.wipe()
                  setConfirmWipe(false)
                  ctx.restart()
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

function Row({ icon, title, desc, children }: { icon: React.ReactNode; title: string; desc: string; children?: React.ReactNode }) {
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 16, flexWrap: 'wrap' }}>
      <span style={{ width: 40, height: 40, borderRadius: 14, background: c.primarySoft, color: c.primary, display: 'grid', placeItems: 'center', flex: 'none' }}>{icon}</span>
      <div style={{ flex: '1 1 200px', minWidth: 0 }}>
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
    <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
      <Row icon={<KeyRound size={18} />} title="סיסמה" desc="המידע מוצפן בסיסמה. אין דרך לשחזר סיסמה שנשכחה.">
        {!open && <Button onClick={() => setOpen(true)}>שינוי סיסמה</Button>}
      </Row>
      {open && (
        <form onSubmit={submit} style={{ display: 'flex', flexDirection: 'column', gap: 12, padding: 16, background: c.sub, borderRadius: 12 }}>
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
