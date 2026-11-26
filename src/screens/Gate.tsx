import { useState, type FormEvent, type ReactNode } from 'react'
import { AlertCircle, Check, Eye, EyeOff, FileText, FolderOpen, KeyRound, Lock, ShieldCheck, Sheet, Users } from 'lucide-react'
import logo from '../../public/favicon.svg'
import { Button, c, EASE } from '../ui'
import * as vault from '../vault'
import type { Data, Scan } from '../model'

type Opened = { data: Data; scans: Scan[] }
type Step = { s: 'folder' } | { s: 'password'; label: string } | { s: 'unlock'; label: string; needsPermission: boolean }

/** המסכים שלפני הכלי: בחירת תיקייה, יצירת סיסמה ופתיחה */
export default function Gate({ boot, wide, onOpen }: { boot: vault.Boot; wide: boolean; onOpen: (o: Opened) => void }) {
  const folders = vault.canPickFolder()
  const [step, setStep] = useState<Step>(() => (boot.state === 'locked' ? { s: 'unlock', label: boot.label, needsPermission: boot.needsPermission } : folders ? { s: 'folder' } : (vault.useBrowserStore(), { s: 'password', label: 'הדפדפן במכשיר הזה' })))
  const [note, setNote] = useState<string>()

  const pick = async () => {
    setNote(undefined)
    const r = await vault.pickFolder()
    if (!r.ok) return r.reason === 'unsupported' && setNote('הדפדפן הזה לא מאפשר לבחור תיקייה. כדאי לפתוח את הכלי בכרום במחשב.')
    // בתיקייה כבר יש מידע של הכלי: פותחים אותו במקום ליצור חדש
    setStep(r.existing ? { s: 'unlock', label: r.label, needsPermission: false } : { s: 'password', label: r.label })
    if (r.existing) setNote('בתיקייה הזו כבר שמור מידע של הכלי. מזינים את הסיסמה שלו כדי לפתוח אותו.')
  }

  return (
    <div style={{ minHeight: '100vh', display: 'flex', flexDirection: 'column' }}>
      <header style={{ background: 'rgba(255,255,255,0.78)', backdropFilter: 'blur(14px)', borderBottom: '1px solid rgba(230,235,243,0.9)' }}>
        <div style={{ maxWidth: 1184, margin: '0 auto', height: 64, padding: wide ? '0 32px' : '0 16px', display: 'flex', alignItems: 'center', gap: 12 }}>
          <img src={logo} alt="" width={36} height={36} style={{ borderRadius: 12, boxShadow: '0 4px 10px -4px rgba(69,102,232,0.6)' }} />
          <span style={{ fontSize: 16, fontWeight: 600 }}>דיווח חודשי</span>
          <span style={{ flex: 1 }} />
          {wide && (
            <span style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 13, color: c.ink3, height: 32, padding: '0 12px', borderRadius: 999, background: c.okSurf }}>
              <ShieldCheck size={15} style={{ color: c.ok }} />
              המידע נשמר רק במחשב הזה
            </span>
          )}
        </div>
      </header>
      <main style={{ flex: 1, padding: wide ? '56px 32px' : '24px 16px', display: 'flex', justifyContent: 'center', alignItems: 'flex-start' }}>
        {step.s === 'folder' && <FolderStep wide={wide} onPick={pick} note={note} />}
        {step.s === 'password' && <PasswordStep wide={wide} label={step.label} folders={folders} onBack={() => (setNote(undefined), setStep({ s: 'folder' }))} onOpen={onOpen} />}
        {step.s === 'unlock' && <UnlockStep wide={wide} label={step.label} note={note} onOpen={onOpen} onOther={folders ? pick : undefined} />}
      </main>
    </div>
  )
}

function Card({ children, width = 560, art }: { children: ReactNode; width?: number; art?: ReactNode }) {
  return (
    <section style={{ width: '100%', maxWidth: width, background: c.surface, borderRadius: 28, overflow: 'hidden', boxShadow: '0 0 0 1px rgba(16,24,40,0.05), 0 24px 48px -24px rgba(69,102,232,0.35)', animation: `rise 320ms ${EASE}` }}>
      {art}
      {children}
    </section>
  )
}

function Steps({ n }: { n: 1 | 2 }) {
  const items: [string, 1 | 2][] = [
    ['בחירת תיקייה', 1],
    ['יצירת סיסמה', 2],
  ]
  return (
    <ol aria-label={`שלב ${n} מתוך 2`} style={{ display: 'flex', alignItems: 'center', gap: 8, margin: 0, padding: 0, listStyle: 'none', fontSize: 13, color: c.ink3 }}>
      {items.map(([t, i], k) => (
        <li key={t} style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          {k > 0 && <span aria-hidden style={{ width: 32, height: 2, borderRadius: 1, background: n > 1 ? c.ok : c.line }} />}
          <span aria-hidden style={{ width: 24, height: 24, borderRadius: '50%', display: 'grid', placeItems: 'center', fontSize: 12, fontWeight: 600, background: i < n ? c.ok : i === n ? c.primary : c.line, color: i <= n ? '#fff' : c.ink3 }}>{i < n ? <Check size={14} /> : i}</span>
          <span style={i === n ? { color: c.ink, fontWeight: 600 } : undefined} aria-current={i === n ? 'step' : undefined}>
            {t}
          </span>
        </li>
      ))}
    </ol>
  )
}

const Note = ({ tone, icon, children }: { tone: 'warn' | 'danger'; icon?: ReactNode; children: ReactNode }) => (
  <div role={tone === 'danger' ? 'alert' : undefined} style={{ display: 'flex', gap: 12, alignItems: 'flex-start', padding: '14px 16px', borderRadius: 14, background: tone === 'warn' ? c.warnSoft : c.dangerBg, color: tone === 'warn' ? c.warn : c.danger, fontSize: 13, lineHeight: 1.6 }}>
    <span style={{ flex: '0 0 18px', marginTop: 1 }}>{icon ?? <AlertCircle size={18} />}</span>
    <span>{children}</span>
  </div>
)

const h1 = { margin: 0, fontSize: 28, fontWeight: 600, letterSpacing: -0.4 } as const
const lead = { margin: 0, color: c.ink2, fontSize: 15, lineHeight: 1.65 } as const

function FolderArt() {
  const docs: [ReactNode, string][] = [
    [<Users size={20} />, 'מטופלים'],
    [<FileText size={20} />, 'סריקות'],
    [<Sheet size={20} />, 'טבלאות'],
  ]
  return (
    <div aria-hidden style={{ height: 208, paddingTop: 28, display: 'grid', placeItems: 'center', background: 'linear-gradient(120deg, #EEF3FF, #E6EDFF 50%, #EFEAFF)' }}>
      <div style={{ position: 'relative', width: 200, height: 132 }}>
        <div style={{ position: 'absolute', inset: '12px 0 0', borderRadius: 18, background: 'linear-gradient(180deg,#7C98F7,#5577F0)', boxShadow: '0 16px 32px -14px rgba(69,102,232,0.7)' }} />
        {docs.map(([icon, t], i) => (
          <div key={t} style={{ position: 'absolute', top: -8 + i * 4, left: 58 + (i - 1) * 22, width: 84, height: 96, borderRadius: 10, background: '#fff', transform: `rotate(${(i - 1) * 8}deg)`, boxShadow: '0 6px 14px -6px rgba(16,24,40,0.3)', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 6, fontSize: 11, fontWeight: 600, color: c.ink2 }}>
            <span style={{ color: c.primary }}>{icon}</span>
            {t}
          </div>
        ))}
        <div style={{ position: 'absolute', inset: '52px 0 0', borderRadius: 18, background: 'linear-gradient(180deg,#6A88F5,#4566E8)', display: 'flex', alignItems: 'flex-end', justifyContent: 'center', paddingBottom: 14, color: '#fff', fontSize: 13, fontWeight: 600, gap: 6 }}>
          <Lock size={14} />
          דיווח חודשי
        </div>
      </div>
    </div>
  )
}

function FolderStep({ wide, onPick, note }: { wide: boolean; onPick: () => void; note?: string }) {
  return (
    <Card art={<FolderArt />}>
      <div style={{ padding: wide ? '32px 40px 36px' : 24, display: 'flex', flexDirection: 'column', gap: 12 }}>
        <Steps n={1} />
        <h1 style={{ ...h1, marginTop: 12 }}>איפה לשמור את המידע?</h1>
        <p style={lead}>בוחרים תיקייה במחשב. רשימת המטופלים, הסריקות והטבלאות יישמרו בה ורק בה. התיקייה היא גם הגיבוי: מעתיקים אותה, ויש עותק של הכול.</p>
        <Note tone="warn">עדיף תיקייה שלא מסונכרנת לענן (לא בתוך Google Drive או OneDrive), כדי שהמידע לא ייצא מהמחשב.</Note>
        {note && <Note tone="danger">{note}</Note>}
        <div style={{ display: 'flex', alignItems: 'center', gap: 16, marginTop: 16, flexWrap: 'wrap' }}>
          <Button kind="primary" icon={<FolderOpen size={18} />} onClick={onPick} style={{ height: 48, padding: '0 22px', fontSize: 15 }}>
            בחירת תיקייה במחשב
          </Button>
          <span style={{ fontSize: 13, color: c.ink3 }}>כרום יבקש לאשר גישה לתיקייה</span>
        </div>
      </div>
    </Card>
  )
}

function PasswordField({ label, value, onChange, hint, autoFocus, autoComplete, invalid }: { label: string; value: string; onChange: (v: string) => void; hint?: string; autoFocus?: boolean; autoComplete: string; invalid?: boolean }) {
  const [show, setShow] = useState(false)
  const [focus, setFocus] = useState(false)
  return (
    <label style={{ display: 'flex', flexDirection: 'column', gap: 6, textAlign: 'start' }}>
      <span style={{ fontSize: 13, fontWeight: 600, color: c.ink2 }}>{label}</span>
      <span style={{ position: 'relative', display: 'flex' }}>
        <input
          type={show ? 'text' : 'password'}
          value={value}
          autoFocus={autoFocus}
          autoComplete={autoComplete}
          aria-invalid={invalid || undefined}
          onChange={(e) => onChange(e.target.value)}
          onFocus={() => setFocus(true)}
          onBlur={() => setFocus(false)}
          dir="ltr"
          style={{ flex: 1, minWidth: 0, height: 48, padding: '0 16px 0 48px', textAlign: 'right', borderRadius: 12, border: 'none', outline: 'none', fontSize: 16, background: focus ? c.surface : c.field, boxShadow: invalid ? `inset 0 0 0 1px ${c.danger}` : focus ? `inset 0 0 0 1px ${c.primary}, 0 0 0 4px rgba(69,102,232,0.14)` : `inset 0 0 0 1px ${c.line}`, transition: `box-shadow 200ms ${EASE}` }}
        />
        <button type="button" onClick={() => setShow(!show)} aria-label={show ? 'הסתרת הסיסמה' : 'הצגת הסיסמה'} style={{ position: 'absolute', left: 6, top: 6, width: 36, height: 36, borderRadius: 10, border: 'none', background: 'transparent', color: c.ink3, display: 'grid', placeItems: 'center', cursor: 'pointer' }}>
          {show ? <EyeOff size={18} /> : <Eye size={18} />}
        </button>
      </span>
      {hint && <span style={{ fontSize: 12, color: invalid ? c.danger : c.ink3 }}>{hint}</span>}
    </label>
  )
}

function PasswordStep({ wide, label, folders, onBack, onOpen }: { wide: boolean; label: string; folders: boolean; onBack: () => void; onOpen: (o: Opened) => void }) {
  const [pw, setPw] = useState('')
  const [pw2, setPw2] = useState('')
  const [tried, setTried] = useState(false)
  const [busy, setBusy] = useState(false)
  const short = pw.length < 8
  const differ = pw2 !== pw
  const submit = async (e: FormEvent) => {
    e.preventDefault()
    setTried(true)
    if (short || differ) return
    setBusy(true)
    onOpen(await vault.create(pw))
  }
  return (
    <Card>
      <form onSubmit={submit} style={{ padding: wide ? '36px 40px' : 24, display: 'flex', flexDirection: 'column', gap: 12 }}>
        {folders && <Steps n={2} />}
        <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginTop: folders ? 12 : 0, padding: '12px 14px', borderRadius: 14, background: c.okSurf }}>
          <span style={{ width: 36, height: 36, borderRadius: 12, background: c.surface, color: c.ok, display: 'grid', placeItems: 'center', flex: 'none' }}>
            <FolderOpen size={18} />
          </span>
          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{ fontSize: 12, color: c.ink3 }}>{folders ? 'המידע יישמר בתיקייה' : 'המידע יישמר מוצפן ב'}</div>
            <div style={{ fontWeight: 600, fontSize: 14, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{label}</div>
          </div>
          {folders && (
            <Button kind="ghost" onClick={onBack} style={{ height: 32, color: c.primaryInk }}>
              בחירת תיקייה אחרת
            </Button>
          )}
        </div>
        <h1 style={{ ...h1, marginTop: 16 }}>סיסמה לפתיחת הכלי</h1>
        <p style={{ ...lead, marginBottom: 8 }}>המידע נשמר מוצפן. גם מי שפותח את התיקייה לא יכול לקרוא אותו בלי הסיסמה.</p>
        <PasswordField label="סיסמה" value={pw} onChange={setPw} autoFocus autoComplete="new-password" hint={tried && short ? 'הסיסמה קצרה מדי. צריך לפחות 8 תווים.' : 'לפחות 8 תווים'} invalid={tried && short} />
        <PasswordField label="הקלדה חוזרת של הסיסמה" value={pw2} onChange={setPw2} autoComplete="new-password" hint={tried && differ ? 'הסיסמאות לא זהות.' : undefined} invalid={tried && differ} />
        <Note tone="warn" icon={<KeyRound size={18} />}>
          <b>אין דרך לשחזר סיסמה שנשכחה.</b> כדאי לרשום אותה במקום בטוח מחוץ למחשב.
        </Note>
        <div style={{ marginTop: 16 }}>
          <Button kind="primary" type="submit" icon={<Lock size={18} />} disabled={busy} style={{ height: 48, padding: '0 22px', fontSize: 15 }}>
            {busy ? 'מצפין ושומר…' : 'שמירת הסיסמה וכניסה לכלי'}
          </Button>
        </div>
      </form>
    </Card>
  )
}

function UnlockStep({ wide, label, note, onOpen, onOther }: { wide: boolean; label: string; note?: string; onOpen: (o: Opened) => void; onOther?: () => void }) {
  const [pw, setPw] = useState('')
  const [err, setErr] = useState<string>()
  const [busy, setBusy] = useState(false)
  const submit = async (e: FormEvent) => {
    e.preventDefault()
    if (!pw) return setErr('צריך להזין סיסמה.')
    setBusy(true)
    setErr(undefined)
    // באותה לחיצה כרום מבקש גם אישור גישה לתיקייה
    const r = await vault.unlock(pw)
    setBusy(false)
    if (r.ok) return onOpen(r)
    setErr(r.reason === 'password' ? 'הסיסמה לא נכונה. נסו שוב.' : r.reason === 'permission' ? 'בלי אישור גישה לתיקייה אי אפשר לפתוח את המידע. לוחצים שוב ומאשרים בחלון של כרום.' : 'לא נמצא קובץ המידע בתיקייה. אולי התיקייה הועברה או נמחקה. אפשר לפתוח מתיקייה אחרת.')
  }
  return (
    <Card width={440}>
      <form onSubmit={submit} style={{ padding: wide ? 40 : 24, display: 'flex', flexDirection: 'column', alignItems: 'center', textAlign: 'center', gap: 8 }}>
        <div style={{ position: 'relative' }}>
          <span style={{ width: 72, height: 72, borderRadius: 22, background: c.primarySoft, color: c.primary, display: 'grid', placeItems: 'center' }}>
            <Lock size={32} />
          </span>
          <span style={{ position: 'absolute', bottom: -6, left: -6, width: 28, height: 28, borderRadius: '50%', background: c.ok, color: '#fff', display: 'grid', placeItems: 'center', boxShadow: '0 0 0 4px #fff' }}>
            <ShieldCheck size={14} />
          </span>
        </div>
        <h1 style={{ ...h1, marginTop: 20 }}>הכלי נעול</h1>
        <p style={{ ...lead, margin: 0 }}>
          המידע שמור ומוצפן ב<b style={{ color: c.ink }}>{label === 'הדפדפן במכשיר הזה' ? label : `תיקייה ״${label}״`}</b>.
        </p>
        {note && <div style={{ width: '100%', textAlign: 'start', marginTop: 8 }}><Note tone="warn">{note}</Note></div>}
        <div style={{ width: '100%', marginTop: 16 }}>
          <PasswordField label="סיסמה" value={pw} onChange={(v) => (setPw(v), setErr(undefined))} autoFocus autoComplete="current-password" invalid={!!err} />
        </div>
        {err && <div style={{ width: '100%', textAlign: 'start' }}><Note tone="danger">{err}</Note></div>}
        <Button kind="primary" type="submit" icon={<Lock size={18} />} disabled={busy} style={{ height: 48, width: '100%', justifyContent: 'center', fontSize: 15, marginTop: 8 }}>
          {busy ? 'פותח…' : 'פתיחת הכלי'}
        </Button>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginTop: 16, fontSize: 13, color: c.ink3 }}>
          <AlertCircle size={14} />
          הכלי ננעל לבד אחרי זמן בלי שימוש
        </div>
        {onOther && (
          <Button kind="ghost" icon={<FolderOpen size={16} />} onClick={onOther} style={{ height: 32, color: c.primaryInk, fontSize: 13 }}>
            פתיחה מתיקייה אחרת
          </Button>
        )}
      </form>
    </Card>
  )
}
