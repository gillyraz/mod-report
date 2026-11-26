import { useState } from 'react'
import { Archive, ArchiveRestore, CalendarPlus } from 'lucide-react'
import { Button, c, Field, Sheet } from '../ui'
import { uid, type Patient } from '../model'

export default function PatientForm({
  patient,
  onSave,
  onClose,
  onArchive,
}: {
  patient?: Patient
  onSave: (p: Patient) => void
  onClose: () => void
  onArchive?: (p: Patient) => void
}) {
  const [name, setName] = useState(patient?.name ?? '')
  const [fileNo, setFileNo] = useState(patient?.fileNo ?? '')
  const [referralNo, setReferralNo] = useState(patient?.referralNo ?? '')
  const [rate, setRate] = useState(patient ? String(patient.rate) : '')
  const [tried, setTried] = useState(false)

  const rateNum = parseFloat(rate.replace(/[^\d.]/g, ''))
  const missing = [!name.trim() && 'שם', !fileNo.trim() && 'מספר תיק', !referralNo.trim() && 'מספר הפנייה', !(rateNum > 0) && 'סכום למפגש'].filter(Boolean) as string[]

  const submit = () => {
    setTried(true)
    if (missing.length) return
    onSave({ id: patient?.id ?? uid(), name: name.trim(), fileNo: fileNo.trim(), referralNo: referralNo.trim(), rate: rateNum, archived: patient?.archived, addedAt: patient?.addedAt ?? Date.now() })
  }

  return (
    <Sheet
      title={patient ? 'עריכת מטופל' : 'מטופל חדש'}
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
        <Field label="שם המטופל" value={name} onChange={setName} autoFocus={!patient} />
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: 16 }}>
          <Field label="מספר תיק" value={fileNo} onChange={setFileNo} inputMode="numeric" dirLtr />
          <Field label="מספר הפנייה" value={referralNo} onChange={setReferralNo} inputMode="numeric" dirLtr hint="מתעדכן כשמגיעה התחייבות חדשה" />
        </div>
        <Field label="סכום למפגש, לפני מע״מ" value={rate} onChange={setRate} inputMode="decimal" suffix="₪" dirLtr hint="כפי שמודפס בעמודת ״סכום לתשלום״ בטופס" />
        {tried && missing.length > 0 && (
          <p role="alert" style={{ margin: 0, fontSize: 14, color: '#B3261E' }}>
            חסר: {missing.join(', ')}
          </p>
        )}
        <button type="submit" hidden />
      </form>
    </Sheet>
  )
}
