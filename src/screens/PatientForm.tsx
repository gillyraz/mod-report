import { useState } from 'react'
import { Archive, ArchiveRestore, CalendarPlus, UserPen, UserPlus } from 'lucide-react'
import { Button, c, Field, Sheet } from '../ui'
import { monthLabel, uid, type Patient } from '../model'

export default function PatientForm({
  patient,
  onSave,
  onClose,
  onArchive,
  others,
  month,
}: {
  others: Patient[]
  month: string
  patient?: Patient
  onSave: (p: Patient) => void
  onClose: () => void
  onArchive?: (p: Patient) => void
}) {
  const [name, setName] = useState(patient?.name ?? '')
  const [fileNo, setFileNo] = useState(patient?.fileNo ?? '')
  const [referralNo, setReferralNo] = useState(patient?.referralNo ?? '')
  const [rate, setRate] = useState(patient && patient.rate > 0 ? String(patient.rate) : '')
  const [tried, setTried] = useState(false)

  const rateNum = parseFloat(rate.replace(/[^\d.]/g, ''))
  const digits = (v: string) => v.replace(/\D/g, '')
  const dup = fileNo.trim() ? others.find((o) => o.id !== patient?.id && o.fileNo.trim() === fileNo.trim()) : undefined
  const changed = !!patient && ((rateNum > 0 && rateNum !== patient.rate) || referralNo.trim() !== patient.referralNo)
  const missing = [!name.trim() && 'שם', !fileNo.trim() && 'מספר תיק', !referralNo.trim() && 'מספר הפנייה', !(rateNum > 0) && 'סכום למפגש'].filter(Boolean) as string[]

  // An existing patient (e.g. imported with gaps) shows what's missing right away; a new one only after a save attempt.
  const show = tried || !!patient
  const err = (bad: boolean, msg: string) => (show && bad ? msg : undefined)

  const submit = () => {
    setTried(true)
    if (missing.length || dup) return
    onSave({ id: patient?.id ?? uid(), name: name.trim(), fileNo: fileNo.trim(), referralNo: referralNo.trim(), rate: rateNum, archived: patient?.archived, addedAt: patient?.addedAt ?? Date.now() })
  }

  return (
    <Sheet
      title={patient ? 'עריכת מטופל' : 'מטופל חדש'}
      icon={patient ? <UserPen size={20} /> : <UserPlus size={20} />}
      sub="הפרטים מוזנים פעם אחת."
      onClose={onClose}
      footer={
        <>
          <Button kind="primary" onClick={submit}>
            {patient ? 'שמירת השינויים' : 'הוספת המטופל'}
          </Button>
          <Button kind="ghost" onClick={onClose}>
            ביטול
          </Button>
          {patient && onArchive && (
            <Button kind="ghost" style={{ marginInlineStart: 'auto' }} icon={patient.archived ? <ArchiveRestore size={18} /> : <Archive size={18} />} onClick={() => onArchive(patient)}>
              {patient.archived ? 'החזרה לרשימה' : 'העברה לארכיון'}
            </Button>
          )}
        </>
      }
    >
      <form
        onSubmit={(e) => {
          e.preventDefault()
          submit()
        }}
        style={{ display: 'flex', flexDirection: 'column', gap: 16 }}
      >
        {patient?.addedAt && (
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 14, color: c.ink2 }}>
            <CalendarPlus size={16} />
            נוסף לרשימה ב-{new Date(patient.addedAt).toLocaleDateString('he-IL', { day: 'numeric', month: 'numeric', year: 'numeric' })}
          </div>
        )}
        <Field label="שם המטופל" value={name} onChange={setName} autoFocus={!patient} error={err(!name.trim(), 'חסר שם המטופל')} />
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: 16 }}>
          <Field label="מספר תיק" value={fileNo} onChange={(v) => setFileNo(digits(v))} inputMode="numeric" dirLtr error={dup ? `המספר כבר שייך ל${dup.name}${dup.archived ? ' (בארכיון)' : ''}` : err(!fileNo.trim(), 'חסר מספר תיק')} />
          <Field label="מספר הפנייה" value={referralNo} onChange={(v) => setReferralNo(digits(v))} inputMode="numeric" dirLtr hint="מתעדכן כשמגיעה התחייבות חדשה" error={err(!referralNo.trim(), 'חסר מספר הפנייה')} />
        </div>
        <Field label="סכום למפגש, לפני מע״מ" value={rate} onChange={(v) => setRate(v.replace(/[^\d.]/g, '').replace(/(\..*)\./g, '$1'))} inputMode="decimal" suffix="₪" dirLtr hint="כפי שמודפס בעמודת ״סכום לתשלום״ בטופס" error={err(!(rateNum > 0), 'חסר סכום למפגש')} />
        {changed && (
          <div style={{ display: 'flex', gap: 8, padding: '12px 16px', background: c.sub, borderRadius: 8, fontSize: 14, color: c.ink2, lineHeight: 1.5 }}>
            <CalendarPlus size={16} style={{ flex: '0 0 16px', marginTop: 2 }} />
            <span>השינוי בסכום או במספר ההפנייה חל מ{monthLabel(month)} והלאה. החודשים הקודמים נשארים כמו שדווחו.</span>
          </div>
        )}
        <button type="submit" hidden />
      </form>
    </Sheet>
  )
}
