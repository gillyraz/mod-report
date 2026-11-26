import { useEffect, useRef, useState } from 'react'
import { CheckCircle2, Download, FileOutput, Share2 } from 'lucide-react'
import type { Ctx } from '../App'
import { Button, c, Sheet } from '../ui'
import { calc, ils, monthLabel, refOf, vatOf, type Patient } from '../model'
import { elementToPdf } from '../pdf'
import { canShareFiles, downloadFiles, pdfFile, shareFiles } from '../files'
import * as vault from '../vault'
import { PROTO } from '../proto'

const MAX = 20

/** הפקת הדיווח: רק המטופלים שסומנו, וקובץ אחד בלבד, הטבלה החודשית */
export default function ReportSheet({ ctx, list, onClose, onDone }: { ctx: Ctx; list: Patient[]; onClose: () => void; onDone: () => void }) {
  const { month } = ctx
  const [saved, setSaved] = useState<Set<number>>(new Set())
  const batches: Patient[][] = []
  for (let i = 0; i < list.length; i += MAX) batches.push(list.slice(i, i + MAX))

  return (
    <Sheet
      title={`הפקת דיווח · ${monthLabel(month)}`}
      icon={<FileOutput size={20} />}
      sub={
        batches.length > 1
          ? `המערכת של המשרד מקבלת עד ${MAX} מטופלים בבקשה, ולכן הטבלה חולקה ל-${batches.length} טבלאות. שומרים כל אחת ומעלים אותה בבקשה נפרדת, יחד עם הטפסים הסרוקים מה-Drive.`
          : 'שומרים את הטבלה ומעלים אותה לאתר המשרד, יחד עם הטפסים הסרוקים מה-Drive.'
      }
      onClose={onClose}
      wide
    >
      {batches.map((b, i) => (
        <Batch
          key={i}
          ctx={ctx}
          list={b}
          index={i}
          count={batches.length}
          saved={saved.has(i)}
          onSaved={() => {
            const n = new Set(saved).add(i)
            setSaved(n)
            // כשכל הטבלאות נשמרו, יוצאים ממצב הבחירה
            if (n.size === batches.length) onDone()
          }}
        />
      ))}
    </Sheet>
  )
}

function Batch({ ctx, list, index, count, saved, onSaved }: { ctx: Ctx; list: Patient[]; index: number; count: number; saved: boolean; onSaved: () => void }) {
  const { data, month, wide, toast } = ctx
  const ref = useRef<HTMLDivElement>(null)
  const [busy, setBusy] = useState(false)
  const s = data.settings
  const entries = data.months[month] ?? {}
  const amount = (p: Patient) => {
    const r = calc(p, entries[p.id], vatOf(data, month))
    return s.tableAmount === 'total' ? r.total : r.base
  }
  const sum = list.reduce((a, p) => a + amount(p), 0)
  const part = count > 1 ? `_חלק${index + 1}` : ''
  const tableName = `טבלה_${month}${part}.pdf`
  const share = !wide && canShareFiles([new File([], 'x.pdf', { type: 'application/pdf' })])

  const save = async () => {
    if (PROTO) {
      toast(`בגרסה האמיתית הטבלה נשמרת כקובץ PDF בתיקייה ״${vault.folderLabel()}״ › ${vault.TABLE_DIR}. בפרוטוטייפ אין שמירה.`)
      return onSaved()
    }
    setBusy(true)
    try {
      const f = pdfFile(await elementToPdf(ref.current!), tableName)
      const dir = await vault.tablesDir()
      if (dir) {
        // נשמרת בתיקייה שבחר, בתת-תיקייה של הטבלאות (PDF רגיל, כדי שאפשר יהיה לשלוח אותה)
        const w = await (await dir.getFileHandle(f.name, { create: true })).createWritable()
        await w.write(f)
        await w.close()
        toast(`הטבלה נשמרה בתיקייה ״${vault.folderLabel()}״ › ${vault.TABLE_DIR}`)
      } else if (share) await shareFiles([f], `טבלה ${monthLabel(month)}`)
      else {
        await downloadFiles([f])
        toast('הטבלה נשמרה בתיקיית ההורדות')
      }
      onSaved()
    } catch (err) {
      if ((err as Error)?.name !== 'AbortError') toast('השמירה לא הצליחה. נסו שוב.')
    }
    setBusy(false)
  }

  const label = saved ? (count > 1 ? `שמירה חוזרת של טבלה ${index + 1}` : 'שמירה חוזרת של הטבלה') : count > 1 ? `שמירת טבלה ${index + 1} מתוך ${count}` : 'שמירת הטבלה החודשית'

  return (
    <div style={{ background: c.surface, borderRadius: 12, overflow: 'hidden', border: `1px solid ${c.line}` }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 16, padding: 16, flexWrap: 'wrap', borderBottom: `1px solid ${c.line}` }}>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
          <span style={{ fontWeight: 600, display: 'flex', alignItems: 'center', gap: 8 }}>
            {count > 1 ? `טבלה ${index + 1} מתוך ${count}` : 'הטבלה החודשית'}
            {saved && (
              <span style={{ display: 'inline-flex', alignItems: 'center', gap: 4, height: 24, padding: '0 8px', borderRadius: 999, background: c.okBg, color: c.ok, fontSize: 13, fontWeight: 500 }}>
                <CheckCircle2 size={14} /> נשמרה
              </span>
            )}
          </span>
          <span style={{ fontSize: 14, color: c.ink2 }}>
            {list.length === 1 ? 'מטופל אחד' : `${list.length} מטופלים`} · קובץ PDF בשם <bdi dir="ltr">{tableName.replace(/_/g, '‎_‎')}</bdi>
          </span>
        </div>
        <Button kind={saved ? undefined : 'primary'} icon={share ? <Share2 size={18} /> : <Download size={18} />} onClick={save} disabled={busy}>
          {busy ? 'מכין את הקובץ…' : label}
        </Button>
      </div>

      {/* התצוגה הזו היא גם מה שנשמר כ-PDF */}
      <FitBox>
        <div ref={ref} dir="rtl" style={{ width: 720, margin: '0 auto', background: '#fff', padding: 32, fontFamily: "'IBM Plex Sans Hebrew', Arial, sans-serif", color: '#111' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-end', marginBottom: 16 }}>
            <div>
              <div style={{ fontSize: 20, fontWeight: 700 }}>דיווח טיפולים · {monthLabel(month)}</div>
              {s.therapistName && <div style={{ fontSize: 14, marginTop: 4 }}>{s.therapistName}</div>}
            </div>
            {count > 1 && (
              <div style={{ fontSize: 13 }}>
                חלק {index + 1} מתוך {count}
              </div>
            )}
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
                  <td style={td}>{refOf(p, entries[p.id])}</td>
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

const td = { padding: '8px', borderBottom: '1px solid #ccc', fontVariantNumeric: 'tabular-nums' as const }
