import { useRef, useState } from 'react'
import { AlertCircle, CheckCircle2, Download, FileSpreadsheet, RefreshCw } from 'lucide-react'
import type { Ctx } from '../App'
import { Button, c, Sheet } from '../ui'
import { ils, uid, type Patient } from '../model'
import { readPatientsFile, templateFile, type ImportRow } from '../importPatients'
import { downloadFiles } from '../files'
import { PROTO } from '../proto'

const HEADS = ['שם המטופל', 'מספר תיק', 'מספר הפנייה', 'סכום למפגש, לפני מע״מ']
const td = { padding: '8px 12px', fontSize: 14, textAlign: 'start' as const, whiteSpace: 'nowrap' as const }

export default function ImportSheet({ ctx, onClose, onDone }: { ctx: Ctx; onClose: () => void; onDone?: (ids: string[]) => void }) {
  const { data, setData, toast } = ctx
  const input = useRef<HTMLInputElement>(null)
  const [file, setFile] = useState<string>()
  const [rows, setRows] = useState<ImportRow[]>()
  const [error, setError] = useState<string>()
  const [busy, setBusy] = useState(false)
  const [over, setOver] = useState(false)

  const read = async (f: File | undefined) => {
    if (!f) return
    setBusy(true)
    const r = await readPatientsFile(f, data.patients)
    setBusy(false)
    setFile(f.name)
    if (r.ok) (setRows(r.rows), setError(undefined))
    else (setRows(undefined), setError(r.error))
  }
  const good = rows?.filter((r) => !r.problem) ?? []
  const bad = rows?.filter((r) => r.problem) ?? []

  const save = () => {
    const now = Date.now()
    const add: Patient[] = good.map((r, i) => ({ id: uid(), name: r.name, fileNo: r.fileNo, referralNo: r.referralNo, rate: r.rate, addedAt: now + i }))
    setData((d) => ({ ...d, patients: [...d.patients, ...add] }))
    toast(add.length === 1 ? 'מטופל אחד נוסף לרשימה' : `${add.length} מטופלים נוספו לרשימה`)
    onDone?.(add.map((p) => p.id))
    onClose()
  }
  const template = async () => {
    if (PROTO) return toast('בפרוטוטייפ אין הורדת קבצים. התבנית מצורפת בשיחה.')
    downloadFiles([await templateFile()])
  }
  const pick = () => input.current?.click()
  // אחרי שנבחר קובץ, השורה הזו תמיד מופיעה: גם בתצוגה המקדימה וגם כשיש שגיאה
  const fileRow = file && (
    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 16 }}>
      <span style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 14, color: c.ink2, minWidth: 0 }}>
        <FileSpreadsheet size={18} style={{ flex: '0 0 18px' }} />
        <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{file}</span>
      </span>
      <Button kind="ghost" icon={<RefreshCw size={16} />} onClick={pick} disabled={busy}>
        {busy ? 'קורא את הקובץ…' : 'בחירת קובץ אחר'}
      </Button>
    </div>
  )

  return (
    <Sheet
      title="ייבוא מטופלים מאקסל"
      wide
      onClose={onClose}
      footer={
        <>
          {rows ? (
            <Button kind="primary" onClick={save} disabled={!good.length}>
              {good.length === 1 ? 'הוספת מטופל אחד' : `הוספת ${good.length} מטופלים`}
            </Button>
          ) : file ? null : (
            <Button kind="primary" icon={<FileSpreadsheet size={18} />} onClick={pick} disabled={busy}>
              {busy ? 'קורא את הקובץ…' : 'בחירת קובץ'}
            </Button>
          )}
          <Button kind="ghost" onClick={onClose}>
            ביטול
          </Button>
        </>
      }
    >
      <input ref={input} type="file" accept=".xlsx,.csv,.xls,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet,text/csv" hidden onChange={(e) => (read(e.target.files?.[0]), (e.target.value = ''))} />

      {!rows ? (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
          <p style={{ margin: 0, fontSize: 15, color: c.ink2, lineHeight: 1.6 }}>
            קובץ אקסל (‎.xlsx) או CSV, עם שורת כותרות ומתחתיה מטופל אחד בכל שורה. הכלי מזהה את העמודות לפי הכותרות, בכל סדר.
          </p>

          {fileRow}
          {/* אזור ההעלאה: לחיצה או גרירת קובץ */}
          {!file && <button
            onClick={pick}
            onDragOver={(e) => (e.preventDefault(), setOver(true))}
            onDragLeave={() => setOver(false)}
            onDrop={(e) => (e.preventDefault(), setOver(false), read(e.dataTransfer.files[0]))}
            style={{ display: 'flex', flexDirection: 'column', gap: 16, padding: 16, background: over ? '#E8EEF6' : c.sub, border: `1px dashed ${over ? c.primary : c.line}`, borderRadius: 12, cursor: 'pointer', font: 'inherit', color: c.ink, textAlign: 'start', transition: 'background 160ms cubic-bezier(0.16, 1, 0.3, 1)' }}
          >
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, minmax(0, 1fr))', background: c.surface, borderRadius: 8, overflow: 'hidden', border: `1px solid ${c.line}` }}>
              {HEADS.map((h, i) => (
                <span key={h} style={{ padding: '8px 12px', fontSize: 13, fontWeight: 600, borderInlineStart: i ? `1px solid ${c.line}` : 'none', background: '#F7F8FA' }}>
                  {h}
                </span>
              ))}
              {['דנה לוי', '118204', '30481', '310'].map((v, i) => (
                <span key={i} style={{ padding: '8px 12px', fontSize: 13, color: c.ink2, borderInlineStart: i ? `1px solid ${c.line}` : 'none', borderTop: `1px solid ${c.line}` }}>
                  {v}
                </span>
              ))}
            </div>
            <span style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 14, color: c.ink2 }}>
              <FileSpreadsheet size={18} />
              גוררים לכאן את הקובץ, או לוחצים לבחירה
            </span>
          </button>}

          {error && (
            <div role="alert" style={{ display: 'flex', gap: 8, padding: '12px 16px', background: c.dangerBg, color: c.danger, borderRadius: 12, fontSize: 14, lineHeight: 1.5 }}>
              <AlertCircle size={18} style={{ flex: '0 0 18px', marginTop: 1 }} />
              <span>{error}</span>
            </div>
          )}

          <Button kind="ghost" icon={<Download size={18} />} onClick={template} style={{ alignSelf: 'flex-start' }}>
            הורדת תבנית אקסל
          </Button>
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
          {fileRow}

          {bad.length > 0 && (
            <Group tone="warn" title={bad.length === 1 ? 'שורה אחת לא תיכנס' : `${bad.length} שורות לא ייכנסו`} rows={bad} />
          )}
          {good.length > 0 ? (
            <Group tone="ok" title={good.length === 1 ? 'מטופל אחד ייכנס לרשימה' : `${good.length} מטופלים ייכנסו לרשימה`} rows={good} />
          ) : (
            <p style={{ margin: 0, fontSize: 14, color: c.ink2 }}>אין בקובץ מטופלים חדשים להוספה. אפשר לתקן את הקובץ ולבחור אותו שוב.</p>
          )}
        </div>
      )}
    </Sheet>
  )
}

/** קבוצת שורות על משטח משותף: אלה שייכנסו, ואלה שלא */
function Group({ tone, title, rows }: { tone: 'ok' | 'warn'; title: string; rows: ImportRow[] }) {
  const warn = tone === 'warn'
  return (
    <section style={{ background: warn ? c.warnBg : c.sub, borderRadius: 12, padding: 8, display: 'flex', flexDirection: 'column', gap: 8 }}>
      <h3 style={{ margin: 0, padding: '4px 8px', fontSize: 15, fontWeight: 600, display: 'flex', alignItems: 'center', gap: 8, color: warn ? c.warn : c.ink }}>
        {warn ? <AlertCircle size={18} /> : <CheckCircle2 size={18} color={c.ok} />}
        {title}
      </h3>
      <div style={{ background: c.surface, borderRadius: 8, overflowX: 'auto' }}>
        <table style={{ width: '100%', borderCollapse: 'collapse' }}>
          <thead>
            <tr style={{ color: c.ink2 }}>
              {['שורה', 'שם המטופל', 'מספר תיק', 'מספר הפנייה', 'סכום למפגש', ...(warn ? ['הסיבה'] : [])].map((h) => (
                <th key={h} style={{ ...td, fontSize: 13, fontWeight: 500, borderBottom: `1px solid ${c.line}` }}>
                  {h}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {rows.map((r) => (
              <tr key={r.line} style={{ borderTop: `1px solid ${c.line}` }}>
                <td style={{ ...td, color: c.ink2, fontVariantNumeric: 'tabular-nums' }}>{r.line}</td>
                <td style={{ ...td, fontWeight: 500 }}>{r.name || <Empty />}</td>
                <td style={{ ...td, fontVariantNumeric: 'tabular-nums' }}>{r.fileNo || <Empty />}</td>
                <td style={{ ...td, fontVariantNumeric: 'tabular-nums' }}>{r.referralNo || <Empty />}</td>
                <td style={{ ...td, fontVariantNumeric: 'tabular-nums' }}>{r.rate > 0 && !warn ? ils(r.rate) : r.rateText || <Empty />}</td>
                {warn && <td style={{ ...td, color: c.warn, fontWeight: 500 }}>{r.problem}</td>}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </section>
  )
}

const Empty = () => <span style={{ color: c.ink3 }}>חסר</span>
