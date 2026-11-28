import { useEffect, useRef, useState } from 'react'
import { CheckCircle2, ChevronLeft, Download, FileOutput, FileText, Folder, Share2, Table2 } from 'lucide-react'
import type { Ctx } from '../App'
import { Button, c, Sheet } from '../ui'
import { calc, ils, monthLabel, refOf, safeName, vatOf, type Patient } from '../model'
import { asPdfBytes, elementToPdf } from '../pdf'
import { canShareFiles, downloadFiles, pdfFile, shareFiles } from '../files'
import * as vault from '../vault'
import { PROTO } from '../proto'

const MAX = 20

/** הפקת הדיווח: רק המטופלים שסומנו. בכל תיקייה הטבלה ו-PDF של הסריקה של כל מטופל */
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
          ? `המערכת של המשרד מקבלת עד ${MAX} מטופלים בבקשה, ולכן הדיווח חולק ל-${batches.length} תיקיות. כל תיקייה היא בקשה אחת: הטבלה והסריקות שלה.`
          : 'הטבלה והסריקות נשמרות יחד בתיקייה אחת, מוכנות להעלאה לאתר המשרד.'
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
  const folderName = `דיווח_${month}${part}`
  const scanOf = (p: Patient) => ctx.scans.find((x) => x.id === entries[p.id]?.scanId)
  const scanName = (p: Patient) => `${safeName(refOf(p, entries[p.id]) || p.fileNo)}_${safeName(p.name)}_${month}.pdf`
  const withScan = list.filter((p) => scanOf(p))
  const nScans = withScan.length
  const share = !wide && canShareFiles([new File([], 'x.pdf', { type: 'application/pdf' })])

  const save = async () => {
    if (PROTO) {
      toast(`בגרסה האמיתית נשמרים ${nScans + 1} קבצים בתיקייה ״${vault.folderLabel()}״ › ${vault.TABLE_DIR} › ${folderName}. בפרוטוטייפ אין שמירה.`)
      return onSaved()
    }
    setBusy(true)
    try {
      const f = pdfFile(await elementToPdf(ref.current!), tableName)
      // כל סריקה כ-PDF רגיל (לא מוצפן), כדי שאפשר יהיה להעלות אותה לאתר המשרד
      const files = [f, ...(await Promise.all(withScan.map(async (p) => pdfFile(await asPdfBytes(scanOf(p)!.blob), scanName(p)))))]
      const root = await vault.tablesDir()
      if (root) {
        const dir = await root.getDirectoryHandle(folderName, { create: true })
        for (const x of files) {
          const w = await (await dir.getFileHandle(x.name, { create: true })).createWritable()
          await w.write(x)
          await w.close()
        }
        toast(`נשמרו ${files.length} קבצים בתיקייה ״${vault.folderLabel()}״ › ${vault.TABLE_DIR} › ${folderName}`)
      } else if (share) await shareFiles(files, `דיווח ${monthLabel(month)}`)
      else {
        await downloadFiles(files)
        toast(`${files.length} קבצים נשמרו בתיקיית ההורדות`)
      }
      onSaved()
    } catch (err) {
      if ((err as Error)?.name !== 'AbortError') toast('השמירה לא הצליחה. נסו שוב.')
    }
    setBusy(false)
  }

  const what = nScans === 0 ? 'הטבלה' : nScans === 1 ? 'הטבלה וסריקה אחת' : `הטבלה ו-${nScans} סריקות`
  const label = saved ? `שמירה חוזרת של ${what}` : `שמירת ${what}`

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
            {list.length === 1 ? 'מטופל אחד' : `${list.length} מטופלים`} · {nScans + 1} קובצי PDF
          </span>
        </div>
        <Button kind={saved ? undefined : 'primary'} icon={share ? <Share2 size={18} /> : <Download size={18} />} onClick={save} disabled={busy}>
          {busy ? 'מכין את הקובץ…' : label}
        </Button>
      </div>

      {/* מה יישמר: התיקייה והקבצים שבה */}
      <Files folder={[vault.folderLabel(), vault.TABLE_DIR, folderName]} table={tableName} scans={withScan.map(scanName)} />

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

function Files({ folder, table, scans }: { folder: string[]; table: string; scans: string[] }) {
  const [all, setAll] = useState(false)
  const shown = all ? scans : scans.slice(0, 3)
  const row = (icon: React.ReactNode, name: string, note?: string) => (
    <li key={name} style={{ display: 'flex', alignItems: 'center', gap: 8, height: 32, fontSize: 14 }}>
      <span style={{ color: c.ink3, display: 'flex' }}>{icon}</span>
      <span title={name} style={{ flex: 1, minWidth: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{name.replace(/\.pdf$/, '').replace(/_/g, ' · ')}</span>
      {note && <span style={{ fontSize: 12, color: c.ink3 }}>{note}</span>}
    </li>
  )
  return (
    <div style={{ padding: 16, borderBottom: `1px solid ${c.line}`, display: 'flex', flexDirection: 'column', gap: 8 }}>
      <span style={{ display: 'flex', alignItems: 'center', gap: 4, fontSize: 13, color: c.ink2, flexWrap: 'wrap' }}>
        <Folder size={16} style={{ color: c.primary }} />
        {folder.map((f, i) => (
          <span key={i} style={{ display: 'inline-flex', alignItems: 'center', gap: 4, fontWeight: i === folder.length - 1 ? 600 : 400, color: i === folder.length - 1 ? c.ink : c.ink2 }}>
            {i > 0 && <ChevronLeft size={14} style={{ color: c.ink4 }} />}
            {f}
          </span>
        ))}
      </span>
      <ul style={{ listStyle: 'none', margin: 0, padding: '4px 12px', background: c.sub, borderRadius: 10 }}>
        {row(<Table2 size={16} />, table, 'הטבלה')}
        {shown.map((n) => row(<FileText size={16} />, n, 'סריקה'))}
        {scans.length > 3 && (
          <li style={{ height: 32, display: 'flex', alignItems: 'center' }}>
            <button className="link-btn" onClick={() => setAll(!all)} style={{ border: 'none', background: 'transparent', padding: 0, font: 'inherit', fontSize: 13, fontWeight: 600, color: c.primary, cursor: 'pointer' }}>
              {all ? 'הצגת פחות' : `הצגת כל ${scans.length} הסריקות`}
            </button>
          </li>
        )}
      </ul>
    </div>
  )
}
