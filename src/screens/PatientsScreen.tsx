import ImportSheet from './ImportSheet'
import { useNewPatientShortcut } from './parts'
import { useState } from 'react'
import { ChevronLeft, FileSpreadsheet, UserPlus } from 'lucide-react'
import type { Ctx } from '../App'
import { Badge, Button, c, Card } from '../ui'
import { ils, updatePatient, type Patient } from '../model'
import PatientForm from './PatientForm'
import { Avatar, PageBar } from './parts'

const COLS = 'minmax(240px, 2fr) 1fr 1fr 1fr 24px'

export default function PatientsScreen({ ctx }: { ctx: Ctx }) {
  const { data, setData, toast, wide, month } = ctx
  const [editing, setEditing] = useState<Patient | 'new' | null>(null)
  useNewPatientShortcut(() => setEditing('new'))
  const [importing, setImporting] = useState(false)
  const [showArchived, setShowArchived] = useState(false)
  const active = data.patients.filter((p) => !p.archived)
  const archived = data.patients.filter((p) => p.archived)
  const list = showArchived ? archived : active

  const save = (p: Patient) => {
    setData((d) => (d.patients.some((x) => x.id === p.id) ? updatePatient(d, p, month) : { ...d, patients: [...d.patients, p] }))
    toast(editing === 'new' ? `${p.name} נוסף לרשימה` : 'השינויים נשמרו')
    setEditing(null)
  }
  const archive = (p: Patient) => {
    setData((d) => ({ ...d, patients: d.patients.map((x) => (x.id === p.id ? { ...x, archived: !x.archived } : x)) }))
    toast(p.archived ? `${p.name} חזר לרשימה` : `${p.name} הועבר לארכיון`)
    setEditing(null)
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 24 }}>
      <PageBar
        ctx={ctx}
        title="מטופלים"
        sub="הפרטים מוזנים פעם אחת ומשמשים לכל חודש."
        actions={
          <>
          <Button icon={<FileSpreadsheet size={18} />} onClick={() => setImporting(true)}>
            ייבוא מאקסל
          </Button>
          <Button kind="primary" icon={<UserPlus size={18} />} onClick={() => setEditing('new')} title="קיצור מקלדת: N" aria-keyshortcuts="N">
            הוספת מטופל
          </Button>
          </>
        }
      />

      {archived.length > 0 && (
        <div role="tablist" style={{ display: 'inline-flex', alignSelf: 'flex-start', background: c.group, borderRadius: 10, padding: 4, gap: 4 }}>
          {[
            [false, `פעילים (${active.length})`],
            [true, `ארכיון (${archived.length})`],
          ].map(([v, l]) => (
            <button
              key={String(v)}
              role="tab"
              aria-selected={showArchived === v}
              onClick={() => setShowArchived(v as boolean)}
              style={{ height: 32, padding: '0 16px', border: 'none', borderRadius: 8, background: showArchived === v ? c.surface : 'transparent', color: c.ink, fontWeight: showArchived === v ? 600 : 400, fontSize: 14, cursor: 'pointer', boxShadow: showArchived === v ? '0 1px 2px rgba(0,0,0,0.08)' : 'none' }}
            >
              {l as string}
            </button>
          ))}
        </div>
      )}

      {list.length === 0 ? (
        <Card style={{ padding: 32, textAlign: 'center', color: c.ink2 }}>{showArchived ? 'אין מטופלים בארכיון.' : 'עדיין לא נוספו מטופלים.'}</Card>
      ) : (
        <Card style={{ overflow: 'hidden' }}>
          {wide && (
            <div style={{ display: 'grid', gridTemplateColumns: COLS, gap: 24, padding: '14px 24px', background: c.sub, fontSize: 12, color: c.ink3, fontWeight: 500 }}>
              <span>מטופל</span>
              <span>מספר תיק</span>
              <span>מספר הפנייה</span>
              <span>סכום למפגש</span>
              <span />
            </div>
          )}
          {list.map((p, i) => (
            <button
              key={p.id}
              onClick={() => setEditing(p)}
              aria-label={`עריכת ${p.name}`}
              className="row-btn"
              style={{
                width: '100%',
                border: 'none',
                background: 'transparent',
                font: 'inherit',
                color: 'inherit',
                textAlign: 'start',
                cursor: 'pointer',
                display: 'grid',
                gridTemplateColumns: wide ? COLS : '1fr',
                gap: wide ? 24 : 8,
                alignItems: 'center',
                padding: wide ? '12px 24px' : 16,
                minHeight: wide ? 64 : undefined,
                borderTop: i ? `1px solid ${c.line}` : 'none',
              }}
            >
              <div style={{ display: 'flex', alignItems: 'center', gap: 16, minWidth: 0 }}>
                <Avatar name={p.name} />
                <div style={{ display: 'flex', flexDirection: 'column', gap: 4, minWidth: 0 }}>
                <span style={{ fontWeight: 600, fontSize: 16, display: 'flex', alignItems: 'center', gap: 8 }}>
                  {p.name} {p.archived && <Badge tone="muted">ארכיון</Badge>}
                </span>
                {!wide && (
                  <span style={{ fontSize: 14, color: c.ink2 }}>
                    תיק {p.fileNo} · הפנייה {p.referralNo} · {ils(p.rate)} למפגש
                  </span>
                )}
                </div>
              </div>
              {wide && (
                <>
                  <span style={{ fontVariantNumeric: 'tabular-nums' }}>{p.fileNo}</span>
                  <span style={{ fontVariantNumeric: 'tabular-nums' }}>{p.referralNo}</span>
                  <span style={{ fontVariantNumeric: 'tabular-nums', fontWeight: 500 }}>{ils(p.rate)}</span>
                  <ChevronLeft size={18} style={{ color: c.ink4, justifySelf: 'end' }} />
                </>
              )}
            </button>
          ))}
        </Card>
      )}

      {importing && <ImportSheet ctx={ctx} onClose={() => setImporting(false)} />}
      {editing && <PatientForm others={data.patients} month={month} patient={editing === 'new' ? undefined : editing} onSave={save} onClose={() => setEditing(null)} onArchive={archive} />}
    </div>
  )
}
