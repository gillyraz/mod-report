import ImportSheet from './ImportSheet'
import { useNewPatientShortcut } from './parts'
import { useState } from 'react'
import { ChevronLeft, Download, FileSpreadsheet, UserPlus } from 'lucide-react'
import type { ReactNode } from 'react'
import { templateFile } from '../importPatients'
import { downloadFiles } from '../files'
import { PROTO } from '../proto'
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
  const firstRun = !showArchived && active.length === 0

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
          firstRun ? undefined : <>
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

      {firstRun ? (
        <EmptyPatients ctx={ctx} onAdd={() => setEditing('new')} onImport={() => setImporting(true)} />
      ) : list.length === 0 ? (
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
                    תיק {p.fileNo || <Missing />} · הפנייה {p.referralNo || <Missing />} · {p.rate > 0 ? `${ils(p.rate)} למפגש` : <>סכום <Missing /></>}
                  </span>
                )}
                </div>
              </div>
              {wide && (
                <>
                  <span style={{ fontVariantNumeric: 'tabular-nums' }}>{p.fileNo || <Missing />}</span>
                  <span style={{ fontVariantNumeric: 'tabular-nums' }}>{p.referralNo || <Missing />}</span>
                  <span style={{ fontVariantNumeric: 'tabular-nums', fontWeight: 500 }}>{p.rate > 0 ? ils(p.rate) : <Missing />}</span>
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

/** מצב ריק: שתי דרכים להתחיל, כל אחת עם איור של מה שיקרה */
function EmptyPatients({ ctx, onAdd, onImport }: { ctx: Ctx; onAdd: () => void; onImport: () => void }) {
  const { wide, toast } = ctx
  const template = async () => {
    if (PROTO) return toast('בפרוטוטייפ אין הורדת קבצים. התבנית מצורפת בשיחה.')
    downloadFiles([await templateFile()])
  }
  const fields = ['שם המטופל', 'מספר תיק', 'מספר הפנייה']
  const form = (
    <div aria-hidden style={{ width: 248, background: c.surface, borderRadius: 16, padding: 16, display: 'flex', flexDirection: 'column', gap: 8, boxShadow: '0 12px 30px -12px rgba(69,102,232,0.35)' }}>
      {fields.map((l, i) => (
        <div key={l}>
          <div style={{ fontSize: 11, color: c.ink3, marginBottom: 4 }}>{l}</div>
          <div style={{ height: 28, borderRadius: 8, background: c.field, boxShadow: `inset 0 0 0 ${i ? 1 : 2}px ${i ? c.fieldLine : c.primary}`, display: 'flex', alignItems: 'center', padding: '0 10px', fontSize: 13 }}>{i ? '' : 'דנה לוי'}</div>
        </div>
      ))}
    </div>
  )
  const rows = [['דנה לוי', '118204', '30481', '310'], ['יוסי כהן', '120933', '30522', '310'], ['מיכל אברהם', '121477', '30610', '345']]
  const grid = { display: 'grid', gridTemplateColumns: '1.4fr 1fr 1fr 0.8fr' } as const
  const sheet = (
    <div aria-hidden style={{ width: 300, background: c.surface, borderRadius: 14, overflow: 'hidden', fontSize: 12, boxShadow: '0 12px 30px -12px rgba(69,102,232,0.35)' }}>
      <div style={{ ...grid, background: c.okBg, color: c.ok, fontWeight: 600 }}>
        {['מטופל', 'תיק', 'הפנייה', 'סכום'].map((h) => <span key={h} style={{ padding: 8 }}>{h}</span>)}
      </div>
      {rows.map((r) => (
        <div key={r[0]} style={{ ...grid, borderTop: `1px solid ${c.line}`, fontVariantNumeric: 'tabular-nums' }}>
          {r.map((x) => <span key={x} style={{ padding: 8 }}>{x}</span>)}
        </div>
      ))}
    </div>
  )
  return (
    <div style={{ display: 'flex', flexDirection: wide ? 'row' : 'column', gap: 16 }}>
      <Way icon={<UserPlus size={20} />} title="הוספת מטופל" text="מתאים כשיש מטופל אחד או שניים. ממלאים שם, מספר תיק, מספר הפנייה וסכום למפגש." art={form}>
        <Button kind="primary" icon={<UserPlus size={18} />} onClick={onAdd} aria-keyshortcuts="N" style={{ height: 44 }}>
          הוספת מטופל
        </Button>
        {wide && (
          <span style={{ fontSize: 13, color: c.ink3, display: 'inline-flex', alignItems: 'center', gap: 6 }}>
            או מקש
            <kbd style={{ minWidth: 22, height: 22, borderRadius: 6, background: c.sub, color: c.ink2, fontSize: 12, fontWeight: 600, fontFamily: 'inherit', display: 'inline-grid', placeItems: 'center' }}>N</kbd>
          </span>
        )}
      </Way>
      <Way icon={<FileSpreadsheet size={20} />} title="ייבוא רשימה מאקסל" text="מתאים כשהרשימה כבר קיימת בקובץ. הכלי מזהה את העמודות לפי הכותרות, ומראה מה ייכנס לפני ששומרים." art={sheet}>
        <Button kind="primary" icon={<FileSpreadsheet size={18} />} onClick={onImport} style={{ height: 44 }}>
          בחירת קובץ אקסל
        </Button>
        <Button kind="ghost" icon={<Download size={16} />} onClick={template} style={{ color: c.primaryInk }}>
          הורדת תבנית אקסל
        </Button>
      </Way>
    </div>
  )
}

function Way({ icon, title, text, art, children }: { icon: ReactNode; title: string; text: string; art: ReactNode; children: ReactNode }) {
  return (
    <section aria-label={title} style={{ flex: 1, borderRadius: 24, background: c.surface, overflow: 'hidden', display: 'flex', flexDirection: 'column', boxShadow: '0 0 0 1px rgba(16,24,40,0.05), 0 1px 3px rgba(16,24,40,0.04)' }}>
      <div style={{ height: 200, display: 'grid', placeItems: 'center', background: 'linear-gradient(120deg, #EEF3FF, #E6EDFF 50%, #EFEAFF)' }}>{art}</div>
      <div style={{ padding: '24px 28px 28px', display: 'flex', flexDirection: 'column', gap: 8, flex: 1 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
          <span style={{ width: 40, height: 40, borderRadius: 14, background: c.primarySoft, color: c.primary, display: 'grid', placeItems: 'center', flex: 'none' }}>{icon}</span>
          <h2 style={{ margin: 0, fontSize: 20, fontWeight: 600 }}>{title}</h2>
        </div>
        <p style={{ margin: '4px 0 0', color: c.ink2, fontSize: 15, lineHeight: 1.6 }}>{text}</p>
        <span style={{ flex: 1 }} />
        <div style={{ display: 'flex', alignItems: 'center', gap: 16, marginTop: 16, flexWrap: 'wrap' }}>{children}</div>
      </div>
    </section>
  )
}

// פרט שחסר (למשל אחרי ייבוא מאקסל). לחיצה על השורה פותחת את הטופס להשלמה
const Missing = () => <span style={{ color: c.warn, fontWeight: 500 }}>חסר</span>
