import { useEffect, useMemo } from 'react'
import { ExternalLink, RefreshCw, Trash2 } from 'lucide-react'
import { Button, c, Sheet } from '../ui'
import type { Patient, Scan } from '../model'

export default function ScanSheet({ scan, patient, onReplace, onRemove, onClose }: { scan: Scan; patient: Patient; onReplace: () => void; onRemove: () => void; onClose: () => void }) {
  const url = useMemo(() => URL.createObjectURL(scan.blob), [scan.blob])
  useEffect(() => () => URL.revokeObjectURL(url), [url])
  return (
    <Sheet
      title={`הסריקה של ${patient.name}`}
      onClose={onClose}
      footer={
        <>
          <Button icon={<ExternalLink size={18} />} onClick={() => window.open(url, '_blank')}>
            פתיחת הקובץ
          </Button>
          <Button icon={<RefreshCw size={18} />} onClick={onReplace}>
            החלפת הסריקה
          </Button>
          <Button kind="danger" icon={<Trash2 size={18} />} onClick={onRemove} style={{ marginInlineStart: 'auto' }}>
            הסרת הסריקה
          </Button>
        </>
      }
    >
      <div style={{ background: c.sub, borderRadius: 12, padding: 16, display: 'flex', justifyContent: 'center' }}>
        {scan.thumb ? <img src={scan.thumb} alt={`סריקת הטופס של ${patient.name}`} style={{ maxWidth: '100%', maxHeight: '60vh', borderRadius: 4, background: '#fff', boxShadow: '0 1px 4px rgba(0,0,0,0.12)' }} /> : <span style={{ color: c.ink2 }}>אין תצוגה מקדימה לקובץ הזה.</span>}
      </div>
      <span style={{ fontSize: 13, color: c.ink2, direction: 'ltr', textAlign: 'right' }}>{scan.name}</span>
    </Sheet>
  )
}
