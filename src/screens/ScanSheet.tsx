import { useEffect, useMemo, type ReactNode } from 'react'
import { AlertCircle, Check, ExternalLink, FileText, Loader2, RefreshCw, ScanLine, Trash2 } from 'lucide-react'
import { Button, c, Sheet } from '../ui'
import type { Patient, Scan } from '../model'

export default function ScanSheet({
  scan,
  patient,
  signed,
  onApply,
  onReplace,
  onRemove,
  onClose,
}: {
  scan: Scan
  patient: Patient
  signed: number
  onApply: (n: number) => void
  onReplace: () => void
  onRemove: () => void
  onClose: () => void
}) {
  const url = useMemo(() => URL.createObjectURL(scan.blob), [scan.blob])
  useEffect(() => () => URL.revokeObjectURL(url), [url])
  const sig = scan.sig
  const pending = scan.sigV === undefined
  const found = sig?.count

  const strip = pending ? (
    <Strip tone="muted" icon={<Loader2 size={18} style={{ animation: 'spin 1s linear infinite' }} />}>
      סופרים את השורות החתומות בטופס…
    </Strip>
  ) : found === undefined ? (
    <Strip tone="warn" icon={<AlertCircle size={18} />}>
      לא הצלחנו לספור את החתימות בסריקה הזו. יש להזין את מספר המפגשים החתומים ידנית.
    </Strip>
  ) : found === 0 ? (
    <Strip tone="warn" icon={<AlertCircle size={18} />}>
      לא זוהו שורות חתומות בטופס. כדאי לבדוק שזו הסריקה של הטופס החתום.
    </Strip>
  ) : found === signed ? (
    <Strip tone="ok" icon={<Check size={18} />}>
      <span>
        בסריקה זוהו <b style={{ fontWeight: 600 }}>{found}</b> שורות חתומות, כמו מספר המפגשים שהוזן.
      </span>
    </Strip>
  ) : (
    <Strip
      tone="primary"
      icon={<ScanLine size={18} />}
      action={
        <Button kind="primary" onClick={() => onApply(found)} style={{ height: 36, padding: '0 16px', fontSize: 14 }}>
          הזנת {found} מפגשים חתומים
        </Button>
      }
    >
      <span style={{ display: 'flex', flexDirection: 'column' }}>
        <span>
          בסריקה זוהו <b style={{ fontWeight: 600 }}>{found}</b> שורות חתומות
        </span>
        <span style={{ color: c.ink2, fontSize: 13 }}>{signed ? `כרגע מוזנים ${signed} מפגשים חתומים` : 'עדיין לא הוזנו מפגשים חתומים'}</span>
      </span>
    </Strip>
  )

  return (
    <Sheet
      title={`הסריקה של ${patient.name}`}
      icon={<FileText size={20} />}
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
      {strip}
      <div style={{ background: c.sub, borderRadius: 12, padding: 16, display: 'flex', justifyContent: 'center' }}>
        {scan.thumb ? (
          <span style={{ position: 'relative', display: 'inline-block', lineHeight: 0 }}>
            <img src={scan.thumb} alt={`סריקת הטופס של ${patient.name}`} style={{ maxWidth: '100%', maxHeight: '60vh', borderRadius: 4, background: '#fff', boxShadow: '0 1px 4px rgba(0,0,0,0.12)' }} />
            {sig && sig.rows.length > 0 && (
              <span aria-hidden style={{ position: 'absolute', inset: 0, transform: `rotate(${sig.angle}deg)`, pointerEvents: 'none' }}>
                {sig.rows.map((r, i) => (
                  <span
                    key={i}
                    style={{
                      position: 'absolute',
                      left: `${sig.table.x * 100}%`,
                      width: `${sig.table.w * 100}%`,
                      top: `${r.y * 100}%`,
                      height: `${r.h * 100}%`,
                      background: 'rgba(69,102,232,0.14)',
                      boxShadow: `inset 0 0 0 1.5px rgba(69,102,232,0.55)`,
                    }}
                  >
                    <span style={{ position: 'absolute', left: -22, top: '50%', transform: 'translateY(-50%)', minWidth: 16, height: 16, borderRadius: 8, background: c.primary, color: '#fff', fontSize: 10, fontWeight: 600, lineHeight: '16px', textAlign: 'center' }}>{i + 1}</span>
                  </span>
                ))}
              </span>
            )}
          </span>
        ) : (
          <span style={{ color: c.ink2 }}>אין תצוגה מקדימה לקובץ הזה.</span>
        )}
      </div>
      <span style={{ fontSize: 13, color: c.ink2, direction: 'ltr', textAlign: 'right' }}>{scan.name}</span>
    </Sheet>
  )
}

function Strip({ tone, icon, action, children }: { tone: 'ok' | 'warn' | 'muted' | 'primary'; icon: ReactNode; action?: ReactNode; children: ReactNode }) {
  const t = { ok: [c.okSurf, c.ok], warn: [c.warnSoft, c.warn], muted: [c.sub, c.ink2], primary: [c.primarySoft, c.primaryInk] }[tone]
  return (
    <div role="status" style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '12px 16px', borderRadius: 12, background: t[0], color: c.ink, fontSize: 14, lineHeight: 1.5 }}>
      <span style={{ color: t[1], display: 'flex', flex: '0 0 auto' }}>{icon}</span>
      <span style={{ flex: 1, minWidth: 0 }}>{children}</span>
      {action}
    </div>
  )
}
