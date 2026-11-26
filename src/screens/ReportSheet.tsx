import { useEffect, useRef, useState } from 'react'
import { AlertTriangle, Download, FileText, FolderDown, Share2 } from 'lucide-react'
import type { Ctx } from '../App'
import { Button, c, Sheet } from '../ui'
import { calc, ils, monthLabel, scanFileName, statusOf, type Patient } from '../model'
import { asPdfBytes, elementToPdf } from '../pdf'
import { PROTO } from '../proto'
import { canPickFolder, canShareFiles, downloadFiles, pdfFile, saveToFolder, shareFiles } from '../files'

const MAX = 20

export default function ReportSheet({ ctx, ready, patients, onClose }: { ctx: Ctx; ready: Patient[]; patients: Patient[]; onClose: () => void }) {
  const { data, scans, month, toast } = ctx
  const entries = data.months[month] ?? {}
  const batches: Patient[][] = []
  for (let i = 0; i < ready.length; i += MAX) batches.push(ready.slice(i, i + MAX))
  const notReady = patients.filter((p) => statusOf(entries[p.id]) === 'amounts')

  return (
    <Sheet title={`הפקת דיווח · ${monthLabel(month)}`} onClose={onClose} wide>
      {notReady.length > 0 && (
        <div style={{ display: 'flex', gap: 8, padding: 16, background: c.warnBg, color: c.warn, borderRadius: 12, fontSize: 15, lineHeight: 1.5 }}>
          <AlertTriangle size={20} style={{ flex: '0 0 20px', marginTop: 2 }} />
          <span>
            לא ייכללו בדיווח, כי חסרה להם סריקה או מספר מפגשים: <b>{notReady.map((p) => p.name).join(', ')}</b>
          </span>
        </div>
      )}
      {batches.length > 1 && <p style={{ margin: 0, color: c.ink2, fontSize: 15 }}>המערכת של המשרד מקבלת עד {MAX} מטופלים בבקשה, ולכן הדיווח חולק ל-{batches.length} בקשות.</p>}
      {batches.map((b, i) => (
        <Batch key={i} ctx={ctx} list={b} index={i} count={batches.length} scansFor={(p) => scans.find((s) => s.id === entries[p.id]?.scanId)} toast={toast} />
      ))}
    </Sheet>
  )
}

function Batch({ ctx, list, index, count, scansFor, toast }: { ctx: Ctx; list: Patient[]; index: number; count: number; scansFor: (p: Patient) => { blob: Blob } | undefined; toast: (t: string) => void }) {
  const { data, month, wide } = ctx
  const ref = useRef<HTMLDivElement>(null)
  const [busy, setBusy] = useState(false)
  const s = data.settings
  const entries = data.months[month] ?? {}
  const amount = (p: Patient) => {
    const r = calc(p, entries[p.id], s)
    return s.tableAmount === 'total' ? r.total : r.base
  }
  const sum = list.reduce((a, p) => a + amount(p), 0)
  const part = count > 1 ? `_חלק${index + 1}` : ''
  const tableName = `טבלה_${month}${part}.pdf`

  const buildTable = async () => pdfFile(await elementToPdf(ref.current!), tableName)
  const buildAll = async () => {
    const files = [await buildTable()]
    for (const p of list) {
      const sc = scansFor(p)
      if (sc) files.push(pdfFile(await asPdfBytes(sc.blob), scanFileName(p, month)))
    }
    return files
  }

  const run = async (mode: 'all' | 'table') => {
    if (PROTO) return toast('בגרסה האמיתית הקבצים נשמרים עכשיו. בפרוטוטייפ אין שמירה.')
    setBusy(true)
    try {
      const files = mode === 'all' ? await buildAll() : [await buildTable()]
      if (canPickFolder() && wide) {
        await saveToFolder(files)
        toast(`${files.length} קבצים נשמרו בתיקייה`)
      } else if (canShareFiles(files)) {
        await shareFiles(files, `דיווח ${monthLabel(month)}`)
      } else {
        await downloadFiles(files)
        if (!PROTO) toast(`${files.length} קבצים הורדו`)
      }
    } catch (err) {
      if ((err as Error)?.name !== 'AbortError') toast('השמירה לא הצליחה. נסו שוב.')
    }
    setBusy(false)
  }

  const saveIcon = (PROTO || canPickFolder()) && wide ? <FolderDown size={18} /> : canShareFiles([new File([], 'x.pdf', { type: 'application/pdf' })]) ? <Share2 size={18} /> : <Download size={18} />

  return (
    <div style={{ background: c.surface, borderRadius: 12, overflow: 'hidden', border: `1px solid ${c.line}` }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 16, padding: '16px 16px', flexWrap: 'wrap', borderBottom: `1px solid ${c.line}` }}>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
          <span style={{ fontWeight: 600 }}>{count > 1 ? `בקשה ${index + 1} מתוך ${count}` : 'הבקשה החודשית'}</span>
          <span style={{ fontSize: 14, color: c.ink2 }}>
            טבלה + {list.length === 1 ? 'טופס סרוק אחד' : `${list.length} טפסים סרוקים`} = {list.length + 1} קבצים
          </span>
        </div>
        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
          <Button icon={<FileText size={18} />} onClick={() => run('table')} disabled={busy}>
            שמירת הטבלה החודשית
          </Button>
          <Button kind="primary" icon={saveIcon} onClick={() => run('all')} disabled={busy}>
            {busy ? 'מכין קבצים…' : `שמירת ${list.length + 1} הקבצים`}
          </Button>
        </div>
      </div>

      {/* רשימת הקבצים שיישמרו */}
      <div style={{ padding: 16, borderBottom: `1px solid ${c.line}`, display: 'flex', flexDirection: 'column', gap: 8 }}>
        <span style={{ fontSize: 14, fontWeight: 600, color: c.ink2 }}>הקבצים שיישמרו</span>
        <div style={{ background: c.sub, borderRadius: 12, padding: 8, display: 'flex', flexDirection: 'column', gap: 4 }}>
          {[{ name: tableName, what: 'הטבלה החודשית' }, ...list.map((p) => ({ name: scanFileName(p, month), what: `הטופס החתום של ${p.name}` }))].map((f) => (
            <div key={f.name} style={{ background: c.surface, borderRadius: 8, padding: '8px 12px', display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
              <FileText size={16} color={c.ink2} style={{ flex: '0 0 16px' }} />
              <span style={{ fontSize: 15, flex: 1, minWidth: 140 }}>{f.what}</span>
              <span style={{ fontSize: 13, color: c.ink2 }}>{fileLabel(f.name)}</span>
            </div>
          ))}
        </div>
        <span style={{ fontSize: 13, color: c.ink2 }}>{wide && (PROTO || canPickFolder()) ? 'בלחיצה על שמירה בוחרים תיקייה במחשב, והקבצים נשמרים בה.' : 'בלחיצה על שמירה נפתח תפריט השיתוף, או שהקבצים יורדים לתיקיית ההורדות.'}</span>
      </div>

      {/* התצוגה הזו היא גם מה שנשמר כ-PDF */}
      <FitBox>
        <div ref={ref} dir="rtl" style={{ width: 720, margin: '0 auto', background: '#fff', padding: 32, fontFamily: "'Rubik Variable', Arial, sans-serif", color: '#111' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-end', marginBottom: 16 }}>
            <div>
              <div style={{ fontSize: 20, fontWeight: 700 }}>דיווח טיפולים · {monthLabel(month)}</div>
              {s.therapistName && <div style={{ fontSize: 14, marginTop: 4 }}>{s.therapistName}</div>}
            </div>
            {count > 1 && <div style={{ fontSize: 13 }}>חלק {index + 1} מתוך {count}</div>}
          </div>
          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 14 }}>
            <thead>
              <tr>
                {['#', 'שם', 'מספר תיק', 'מספר הפנייה', s.tableAmount === 'total' ? 'סכום (כולל מע״מ)' : 'סכום (לפני מע״מ)'].map((h) => (
                  <th key={h} style={{ textAlign: 'right', padding: '8px', borderBottom: '2px solid #111', fontWeight: 600 }}>
                    {h}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {list.map((p, i) => (
                <tr key={p.id}>
                  <td style={td}>{i + 1}</td>
                  <td style={td}>{p.name}</td>
                  <td style={td}>{p.fileNo}</td>
                  <td style={td}>{p.referralNo}</td>
                  <td style={td}>{ils(amount(p))}</td>
                </tr>
              ))}
              <tr>
                <td style={{ ...td, fontWeight: 700, borderBottom: 'none' }} colSpan={4}>
                  סה״כ
                </td>
                <td style={{ ...td, fontWeight: 700, borderBottom: 'none' }}>{ils(sum)}</td>
              </tr>
            </tbody>
          </table>
        </div>
      </FitBox>
    </div>
  )
}

/** מקטין את התצוגה המקדימה כך שכל הטבלה נראית גם בנייד; הקובץ עצמו נשמר בגודל מלא */
function FitBox({ children }: { children: React.ReactNode }) {
  const box = useRef<HTMLDivElement>(null)
  const [zoom, setZoom] = useState(1)
  useEffect(() => {
    const el = box.current!
    const ro = new ResizeObserver(() => setZoom(Math.min(1, (el.clientWidth - 32) / 720)))
    ro.observe(el)
    return () => ro.disconnect()
  }, [])
  return (
    <div ref={box} style={{ background: c.sub, padding: 16 }}>
      <div style={{ zoom }}>{children}</div>
    </div>
  )
}

/** שם קובץ עם עברית ומספרים, מוצג בסדר הנכון */
const fileLabel = (n: string) => <bdi dir="ltr">{n.replace(/_/g, '\u200E_\u200E')}</bdi>

const td = { padding: '8px', borderBottom: '1px solid #ccc', fontVariantNumeric: 'tabular-nums' as const }
