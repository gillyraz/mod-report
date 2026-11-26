import { useState } from 'react'
import { ArrowRight, FileStack, FileText, Trash2, Undo2 } from 'lucide-react'
import { Button, c, Sheet } from '../ui'
import type { Entry, Patient, Scan } from '../model'

type Choice = string | 'delete'

/**
 * שיוך סריקות: הבחירות נשמרות רק בלחיצה על כפתור השמירה.
 * סגירה בלי שמירה משאירה את הסריקות ממתינות לשיוך.
 */
export default function AssignSheet({
  scans,
  patients,
  entries,
  onSave,
  onClose,
}: {
  scans: Scan[]
  patients: Patient[]
  entries: Record<string, Entry>
  onSave: (choices: Record<string, Choice>) => void
  onClose: () => void
}) {
  const [big, setBig] = useState<Scan | null>(null)
  const [choices, setChoices] = useState<Record<string, Choice>>({})
  const set = (sid: string, v: Choice | undefined) =>
    setChoices((c0) => {
      const n = { ...c0 }
      if (v) n[sid] = v
      else delete n[sid]
      return n
    })

  const assigned = Object.values(choices).filter((v) => v !== 'delete').length
  const deleted = Object.values(choices).filter((v) => v === 'delete').length
  const takenBy = (pid: string, sid: string) => Object.entries(choices).some(([s, p]) => p === pid && s !== sid)
  const label = assigned && deleted ? `שיוך ${assigned} ומחיקת ${deleted}` : deleted ? (deleted === 1 ? 'מחיקת הסריקה' : `מחיקת ${deleted} סריקות`) : assigned === 1 ? 'שיוך הסריקה' : `שיוך ${assigned} סריקות`

  return (
    <Sheet
      title="שיוך סריקות למטופלים"
      icon={<FileStack size={20} />}
      onClose={onClose}
      wide
      footer={
        <>
          <Button kind="primary" disabled={!assigned && !deleted} onClick={() => onSave(choices)}>
            {assigned || deleted ? label : 'שיוך הסריקות'}
          </Button>
          <Button kind="ghost" onClick={onClose}>
            ביטול
          </Button>
        </>
      }
    >
      {big ? (
        // תצוגה מוגדלת בתוך אותו חלון, בלי חלון נוסף מעליו
        <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
          <Button kind="ghost" icon={<ArrowRight size={18} />} onClick={() => setBig(null)} style={{ alignSelf: 'flex-start' }}>
            חזרה לכל הסריקות
          </Button>
          <div style={{ background: c.sub, borderRadius: 12, padding: 16, display: 'flex', justifyContent: 'center' }}>
            {big.thumb ? <img src={big.thumb} alt={`סריקה ${big.name}`} style={{ maxWidth: '100%', maxHeight: '60vh', borderRadius: 4, background: '#fff', boxShadow: '0 1px 4px rgba(0,0,0,0.12)' }} /> : <FileText size={48} color={c.ink3} />}
          </div>
        </div>
      ) : (
        <>
          <p style={{ margin: 0, color: c.ink2, fontSize: 15 }}>לכל סריקה בוחרים את המטופל שלה, ובסוף לוחצים על שיוך. מטופלים שכבר יש להם סריקה מסומנים.</p>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(200px, 1fr))', gap: 16 }}>
            {scans.map((s) => {
              const v = choices[s.id]
              const gone = v === 'delete'
              return (
                <div key={s.id} style={{ background: c.surface, borderRadius: 12, padding: 8, display: 'flex', flexDirection: 'column', gap: 8, animation: 'rise 320ms cubic-bezier(0.16, 1, 0.3, 1)', boxShadow: v && !gone ? `inset 0 0 0 2px ${c.ok}` : undefined }}>
                  <button onClick={() => setBig(s)} title="הגדלה" aria-label={`הגדלת ${s.name}`} style={{ padding: 0, border: `1px solid ${c.line}`, borderRadius: 8, overflow: 'hidden', background: c.sub, cursor: 'zoom-in', aspectRatio: '3 / 4', display: 'flex', alignItems: 'center', justifyContent: 'center', opacity: gone ? 0.35 : 1 }}>
                    {s.thumb ? <img src={s.thumb} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover', objectPosition: 'top' }} /> : <FileText size={32} color={c.ink3} />}
                  </button>
                  <span style={{ fontSize: 12, color: c.ink2, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', direction: 'ltr', textAlign: 'right' }} title={s.name}>
                    {s.name}
                  </span>
                  {gone ? (
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8, height: 40 }}>
                      <span style={{ flex: 1, fontSize: 14, color: c.danger }}>תימחק בשמירה</span>
                      <Button kind="ghost" icon={<Undo2 size={16} />} onClick={() => set(s.id, undefined)} style={{ height: 40, padding: '0 8px', fontSize: 14 }}>
                        ביטול מחיקה
                      </Button>
                    </div>
                  ) : (
                    <div style={{ display: 'flex', gap: 8 }}>
                      <select
                        aria-label={`מטופל עבור ${s.name}`}
                        value={v ?? ''}
                        onChange={(e) => set(s.id, e.target.value || undefined)}
                        style={{ flex: 1, minWidth: 0, height: 40, borderRadius: 8, border: `1px solid ${v ? c.ok : c.line}`, background: c.surface, padding: '0 8px', fontSize: 15, color: c.ink }}
                      >
                        <option value="">בחירת מטופל</option>
                        {patients.map((p) => (
                          <option key={p.id} value={p.id} disabled={takenBy(p.id, s.id)}>
                            {p.name}
                            {takenBy(p.id, s.id) ? ' (נבחר לסריקה אחרת)' : entries[p.id]?.scanId ? ' (יש סריקה, תוחלף)' : ''}
                          </option>
                        ))}
                      </select>
                      <Button kind="danger" title="מחיקת הסריקה" icon={<Trash2 size={18} />} onClick={() => set(s.id, 'delete')} />
                    </div>
                  )}
                </div>
              )
            })}
          </div>
        </>
      )}
    </Sheet>
  )
}
