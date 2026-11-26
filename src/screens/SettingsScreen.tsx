import { useEffect, useRef, useState } from 'react'
import { DatabaseBackup, Trash2, Upload } from 'lucide-react'
import type { Ctx } from '../App'
import { Button, c, Card, Field } from '../ui'
import { defaultSettings, wipeAll, type Settings } from '../model'
import { backupFile, readBackup } from '../backup'
import { downloadFiles } from '../files'
import { PageHead } from './parts'
import { PROTO } from '../proto'

export default function SettingsScreen({ ctx }: { ctx: Ctx }) {
  const { data, setData, setScans, toast } = ctx
  const s = data.settings
  const fileIn = useRef<HTMLInputElement>(null)
  const [confirmWipe, setConfirmWipe] = useState(false)
  const [vatText, setVatText] = useState(String(s.vatRate))
  useEffect(() => {
    if ((parseFloat(vatText) || 0) !== s.vatRate) setVatText(String(s.vatRate))
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [s.vatRate])
  const set = (patch: Partial<Settings>) => setData((d) => ({ ...d, settings: { ...d.settings, ...patch } }))

  const backup = () => {
    downloadFiles([backupFile(data)])
    toast(PROTO ? 'בפרוטוטייפ אין הורדת קבצים' : 'קובץ הגיבוי הורד')
  }
  const restore = async (f: File | undefined) => {
    if (!f) return
    const d = await readBackup(f)
    if (!d) return toast('הקובץ הזה אינו קובץ גיבוי של הכלי')
    setData(() => d)
    toast(`שוחזרו ${d.patients.length} מטופלים`)
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 24, maxWidth: 720 }}>
      <PageHead title="הגדרות" />

      <Section title="חישוב">
        <Field label="שיעור מע״מ" value={vatText} onChange={(v) => (setVatText(v), set({ vatRate: Math.max(0, parseFloat(v) || 0) }))} inputMode="decimal" suffix="%" dirLtr />
        <Toggle label="עוסק פטור (בלי מע״מ)" checked={s.vatExempt} onChange={(v) => set({ vatExempt: v })} />
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
          <span style={{ fontSize: 14, fontWeight: 500 }}>הסכום שמופיע בטבלה החודשית</span>
          <div role="radiogroup" style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
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
                style={{ height: 40, padding: '0 16px', borderRadius: 8, border: `1px solid ${s.tableAmount === v ? c.primary : c.line}`, background: s.tableAmount === v ? '#E8EEF6' : c.surface, color: c.ink, fontWeight: s.tableAmount === v ? 600 : 400, fontSize: 15, cursor: 'pointer' }}
              >
                {l}
              </button>
            ))}
          </div>
        </div>
      </Section>

      <Section title="פרטים בראש הטבלה">
        <Field label="שם המטפל/ת" value={s.therapistName} onChange={(v) => set({ therapistName: v })} hint="מופיע מעל הטבלה החודשית. לא חובה." />
      </Section>

      <Section title="גיבוי">
        <p style={{ margin: 0, color: c.ink2, fontSize: 15, lineHeight: 1.6 }}>
          המידע נשמר רק בדפדפן הזה. גיבוי שומר את המטופלים והסכומים לקובץ, כדי לעבור למכשיר אחר או לשחזר. הסריקות לא נכללות בגיבוי.
        </p>
        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
          <Button icon={<DatabaseBackup size={18} />} onClick={backup}>
            הורדת קובץ גיבוי
          </Button>
          <Button icon={<Upload size={18} />} onClick={() => fileIn.current?.click()}>
            שחזור מקובץ
          </Button>
        </div>
        <input ref={fileIn} type="file" accept="application/json,.json" hidden onChange={(e) => (restore(e.target.files?.[0]), (e.target.value = ''))} />
      </Section>

      <Section title="מחיקה">
        {!confirmWipe ? (
          <Button kind="danger" icon={<Trash2 size={18} />} onClick={() => setConfirmWipe(true)} style={{ alignSelf: 'flex-start' }}>
            מחיקת כל המידע מהמכשיר
          </Button>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 16, padding: 16, background: c.dangerBg, borderRadius: 8 }}>
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

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <Card style={{ padding: 24, display: 'flex', flexDirection: 'column', gap: 16 }}>
      <h2 style={{ margin: 0, fontSize: 17, fontWeight: 600 }}>{title}</h2>
      {children}
    </Card>
  )
}

function Toggle({ label, checked, onChange }: { label: string; checked: boolean; onChange: (v: boolean) => void }) {
  return (
    <label style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 16, cursor: 'pointer' }}>
      <span style={{ fontSize: 15 }}>{label}</span>
      <button
        role="switch"
        aria-checked={checked}
        onClick={() => onChange(!checked)}
        style={{ width: 48, height: 28, borderRadius: 999, border: 'none', background: checked ? c.primary : '#C9CED6', position: 'relative', cursor: 'pointer', transition: 'background 200ms cubic-bezier(0.16, 1, 0.3, 1)' }}
      >
        <span style={{ position: 'absolute', top: 4, insetInlineStart: checked ? 24 : 4, width: 20, height: 20, borderRadius: 999, background: '#fff', transition: 'inset-inline-start 200ms cubic-bezier(0.16, 1, 0.3, 1)' }} />
      </button>
    </label>
  )
}
