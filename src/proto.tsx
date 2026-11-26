import { useState } from 'react'
import { c } from './ui'
import { FlaskConical } from 'lucide-react'
import { PDFDocument, rgb, StandardFonts } from 'pdf-lib'
import { Button } from './ui'
import type { Patient } from './model'

/** גרסת ניסיון לצפייה: המידע נשמר רק בזיכרון, ובמקום שמירת קבצים מוצגת רשימת הקבצים */
export const PROTO = import.meta.env.VITE_PROTO === '1'

async function samplePdf(label: string, rows: number) {
  const doc = await PDFDocument.create()
  const page = doc.addPage([595, 842])
  const f = await doc.embedFont(StandardFonts.Helvetica)
  const ink = rgb(0.15, 0.15, 0.2)
  page.drawText('RFR_12', { x: 40, y: 790, size: 12, font: f, color: ink })
  page.drawText(label, { x: 470, y: 790, size: 12, font: f, color: ink })
  page.drawRectangle({ x: 40, y: 700, width: 515, height: 70, borderColor: ink, borderWidth: 1 })
  for (let i = 0; i <= 12; i++) page.drawLine({ start: { x: 40, y: 660 - i * 32 }, end: { x: 555, y: 660 - i * 32 }, thickness: 0.6, color: ink })
  for (let i = 0; i < rows; i++) {
    const y = 640 - i * 32
    page.drawLine({ start: { x: 70, y }, end: { x: 110, y: y + 10 }, thickness: 1.2, color: rgb(0.1, 0.2, 0.6) })
    page.drawLine({ start: { x: 110, y: y + 10 }, end: { x: 140, y: y - 2 }, thickness: 1.2, color: rgb(0.1, 0.2, 0.6) })
  }
  page.drawRectangle({ x: 40, y: 150, width: 515, height: 60, borderColor: ink, borderWidth: 1 })
  const bytes = await doc.save()
  return new File([bytes as BlobPart], `${label}.pdf`, { type: 'application/pdf' })
}

/** פס עליון בגרסת הניסיון */
export function ProtoBar({ patients }: { patients: Patient[] }) {
  const [busy, setBusy] = useState(false)
  const sample = async () => {
    setBusy(true)
    const named = patients.filter((p) => !p.archived && p.referralNo).slice(0, 3)
    const files = [...(await Promise.all(named.map((p) => samplePdf(p.referralNo, 4)))), await samplePdf('scan_0007', 3)]
    window.dispatchEvent(new CustomEvent('proto-import', { detail: files }))
    setBusy(false)
  }
  return (
    <div style={{ background: '#FFF3DC', color: '#6B4100', borderBottom: '1px solid #F1DDB4' }}>
      <div style={{ maxWidth: 1184, margin: '0 auto', padding: '8px 32px', display: 'flex', alignItems: 'center', gap: 16, flexWrap: 'wrap', fontSize: 14 }}>
        <FlaskConical size={18} style={{ flex: '0 0 18px' }} />
        <span style={{ flex: 1, minWidth: 200 }}>גרסת ניסיון. המידע נמחק ברענון הדף, וקבצים לא נשמרים באמת.</span>
        <SelSwitch />
        <Button onClick={sample} disabled={busy} style={{ height: 32, fontSize: 14 }}>
          {busy ? 'מכין…' : 'ייבוא סריקות לדוגמה'}
        </Button>
      </div>
    </div>
  )
}

/** מתג בין שתי חלופות לפעולות הבחירה בהפקת דיווח */
function SelSwitch() {
  const [v, setV] = useState<'header' | 'float'>('header')
  const pick = (x: 'header' | 'float') => {
    setV(x)
    window.dispatchEvent(new CustomEvent('proto-sel', { detail: x }))
  }
  return (
    <div role="radiogroup" aria-label="פעולות הבחירה" style={{ display: 'flex', alignItems: 'center', gap: 4, background: '#fff', border: '1px solid #F1DDB4', borderRadius: 8, padding: 2 }}>
      {(
        [
          ['header', 'בחירה א · בכותרת הרשימה'],
          ['float', 'בחירה ב · פס צף'],
        ] as const
      ).map(([k, l]) => (
        <button key={k} role="radio" aria-checked={v === k} onClick={() => pick(k)} style={{ height: 28, padding: '0 12px', borderRadius: 6, border: 'none', background: v === k ? c.primary : 'transparent', color: v === k ? '#fff' : c.ink, fontSize: 13, fontWeight: v === k ? 600 : 400, cursor: 'pointer' }}>
          {l}
        </button>
      ))}
    </div>
  )
}
