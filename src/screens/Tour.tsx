import { useCallback, useEffect, useLayoutEffect, useRef, useState } from 'react'
import { Lightbulb, X } from 'lucide-react'
import { Button, c, EASE } from '../ui'

/** ההסבר על עמוד החודש: 4 בועות. בכניסה הבאה הוא מופיע מכווץ, ו-X מסתיר אותו לתמיד */
const KEY = 'mod-report:tour'
type State = 'seen' | 'off' | null
const read = (): State => {
  try {
    return localStorage.getItem(KEY) as State
  } catch {
    return null
  }
}
const write = (s: 'seen' | 'off') => {
  try {
    localStorage.setItem(KEY, s)
  } catch {
    /* בלי אחסון: ההסבר פשוט יוצג שוב */
  }
}
export const forgetTour = () => {
  try {
    localStorage.removeItem(KEY)
  } catch {
    /* */
  }
}
// ההסבר רץ בכניסה הזו (טעינת הדף הזו): הגרסה המכווצת מופיעה רק מהכניסה הבאה
let ranThisVisit = false

const STEPS: { target: string; title: string; body: string }[] = [
  { target: 'month', title: 'החודש שמדווחים עליו', body: 'כל חודש נשמר לחוד. עוברים בין החודשים בחיצים, והמידע של כל חודש נשאר במקומו.' },
  { target: 'sessions', title: 'מזינים את המפגשים החתומים', body: 'לכל מטופל סופרים את המפגשים שחתומים בטופס. הסכום מחושב לבד, כולל מע״מ.' },
  { target: 'scan', title: 'מצרפים את הטופס החתום', body: 'סורקים את הטופס בטלפון עם Google Drive ומצרפים אותו כאן. כמה סריקות יחד נכנסות דרך ״ייבוא סריקות״.' },
  { target: 'report', title: 'מפיקים את הטבלה החודשית', body: 'מטופל עם מפגשים, סריקה ופרטים מלאים עובר ל״מוכנים לדיווח״. כאן בוחרים מי נכנס לטבלה ושומרים אותה בתיקייה.' },
]

/** האלמנט הגלוי הראשון עם התווית, ואם אין גלוי: הראשון */
function find(name: string) {
  const all = [...document.querySelectorAll<HTMLElement>(`[data-tour="${name}"]`)].filter((el) => el.getClientRects().length > 0)
  const inView = all.find((el) => {
    const r = el.getBoundingClientRect()
    return r.top >= 0 && r.bottom <= innerHeight
  })
  return inView ?? all[0] ?? null
}

export default function Tour({ ready, headerH }: { ready: boolean; headerH: number }) {
  const [state, setState] = useState<State>(read)
  const [step, setStep] = useState<number | null>(null)
  // הגרסה המכווצת: רק אם ההסבר כבר הוצג בכניסה קודמת
  const [pill] = useState(() => read() === 'seen' && !ranThisVisit)

  // פעם ראשונה: נפתח לבד אחרי שנוספו המטופלים הראשונים
  useEffect(() => {
    if (!ready || state !== null || step !== null) return
    const t = window.setTimeout(() => {
      ranThisVisit = true
      setStep(0)
    }, 1200)
    return () => window.clearTimeout(t)
  }, [ready, state, step])

  const close = useCallback(() => {
    setStep(null)
    if (read() !== 'off') {
      write('seen')
      setState('seen')
    }
    window.scrollTo({ top: 0, behavior: 'smooth' })
  }, [])

  const hide = () => {
    write('off')
    setState('off')
  }

  return (
    <>
      {step !== null && <Spotlight step={step} headerH={headerH} onNext={() => (step + 1 < STEPS.length ? setStep(step + 1) : close())} onSkip={close} />}
      {step === null && pill && state === 'seen' && ready && <Collapsed onOpen={() => setStep(0)} onHide={hide} />}
    </>
  )
}

function Collapsed({ onOpen, onHide }: { onOpen: () => void; onHide: () => void }) {
  const [hover, setHover] = useState(false)
  return (
    <div
      role="region"
      aria-label="הסבר על המסך"
      style={{ position: 'fixed', bottom: 32, insetInlineEnd: 32, zIndex: 30, display: 'flex', alignItems: 'center', gap: 4, padding: 4, paddingInlineStart: 4, borderRadius: 16, background: c.surface, boxShadow: '0 0 0 1px rgba(69,102,232,0.14), 0 16px 32px -12px rgba(16,24,40,0.28)', animation: `rise 360ms ${EASE}` }}
    >
      <button
        onClick={onOpen}
        onMouseEnter={() => setHover(true)}
        onMouseLeave={() => setHover(false)}
        style={{ display: 'flex', alignItems: 'center', gap: 12, height: 48, padding: '0 12px', border: 'none', borderRadius: 12, background: hover ? c.primarySoft : 'transparent', cursor: 'pointer', font: 'inherit', color: c.ink, textAlign: 'start', transition: `background 200ms ${EASE}` }}
      >
        <span style={{ width: 32, height: 32, borderRadius: 10, background: c.primarySoft, color: c.primary, display: 'grid', placeItems: 'center' }}>
          <Lightbulb size={18} />
        </span>
        <span style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
          <span style={{ fontSize: 14, fontWeight: 600 }}>הצגת ההסבר על המסך</span>
          <span style={{ fontSize: 12, color: c.ink3 }}>4 צעדים קצרים</span>
        </span>
      </button>
      <span aria-hidden style={{ width: 1, height: 28, background: c.line }} />
      <Button kind="ghost" icon={<X size={18} />} onClick={onHide} title="לא להציג את ההסבר שוב" style={{ width: 40, height: 40, color: c.ink3 }} />
    </div>
  )
}

type Box = { top: number; left: number; width: number; height: number }
const PAD = 8
const W = 360

function Spotlight({ step, headerH, onNext, onSkip }: { step: number; headerH: number; onNext: () => void; onSkip: () => void }) {
  const s = STEPS[step]
  const [box, setBox] = useState<Box | null>(null)
  const next = useRef<HTMLButtonElement>(null)
  const bubble = useRef<HTMLDivElement>(null)
  const [bh, setBh] = useState(200)
  const nextRef = useRef(onNext)
  nextRef.current = onNext

  // העמוד מאחור לא נגלל בזמן ההסבר
  useEffect(() => {
    const el = document.documentElement
    const prev = el.style.overflow
    el.style.overflow = 'hidden'
    return () => void (el.style.overflow = prev)
  }, [])

  useLayoutEffect(() => {
    const el = find(s.target)
    if (!el) return void nextRef.current() // האלמנט לא קיים: ממשיכים לצעד הבא
    const r0 = el.getBoundingClientRect()
    const need = r0.top < headerH + 16 || r0.bottom + 240 > innerHeight
    if (need) window.scrollTo({ top: Math.max(0, scrollY + r0.top - innerHeight / 2 + r0.height / 2 - 80), behavior: 'auto' })
    const measure = () => {
      const r = el.getBoundingClientRect()
      setBox({ top: r.top - PAD, left: r.left - PAD, width: r.width + PAD * 2, height: r.height + PAD * 2 })
    }
    measure()
    addEventListener('resize', measure)
    return () => removeEventListener('resize', measure)
  }, [s.target, headerH])

  useLayoutEffect(() => {
    if (bubble.current) setBh(bubble.current.offsetHeight)
    next.current?.focus({ preventScroll: true })
  }, [step, box])

  useEffect(() => {
    const key = (e: KeyboardEvent) => {
      if (e.key === 'Escape') return void (e.preventDefault(), onSkip())
      const inside = bubble.current?.contains(document.activeElement)
      if (e.key === 'Enter' && !inside) return void (e.preventDefault(), nextRef.current())
      // המקלדת נשארת בתוך הבועה
      if (e.key === 'Tab') {
        const btns = [...(bubble.current?.querySelectorAll<HTMLButtonElement>('button') ?? [])]
        if (!btns.length) return
        e.preventDefault()
        const i = btns.indexOf(document.activeElement as HTMLButtonElement)
        btns[(i + (e.shiftKey ? -1 : 1) + btns.length) % btns.length].focus()
      }
    }
    addEventListener('keydown', key)
    return () => removeEventListener('keydown', key)
  }, [onSkip])

  if (!box) return null
  const below = box.top + box.height + 16 + bh < innerHeight - 16
  const top = below ? box.top + box.height + 16 : Math.max(16, box.top - 16 - bh)
  const cx = box.left + box.width / 2
  const left = Math.min(Math.max(16, cx - W / 2), innerWidth - W - 16)
  const arrow = Math.min(Math.max(24, cx - left), W - 24)
  const last = step === STEPS.length - 1

  return (
    <div style={{ position: 'fixed', inset: 0, zIndex: 40 }} role="dialog" aria-modal="true" aria-labelledby="tour-title" aria-describedby="tour-body">
      {/* שכבה שחוסמת לחיצות על העמוד */}
      <div style={{ position: 'absolute', inset: 0 }} onMouseDown={(e) => e.preventDefault()} />
      <div
        aria-hidden
        style={{ position: 'absolute', top: box.top, left: box.left, width: box.width, height: box.height, borderRadius: 16, boxShadow: `0 0 0 4px ${c.primary}, 0 0 0 9999px rgba(15,23,42,0.42)`, transition: `all 420ms ${EASE}`, pointerEvents: 'none' }}
      />
      <div
        ref={bubble}
        key={step}
        style={{ position: 'absolute', top, left, width: W, padding: 24, borderRadius: 20, background: c.surface, boxShadow: '0 24px 48px -16px rgba(16,24,40,0.35)', animation: `rise 360ms ${EASE}`, transition: `top 420ms ${EASE}, left 420ms ${EASE}` }}
      >
        <span aria-hidden style={{ position: 'absolute', [below ? 'top' : 'bottom']: -7, left: arrow - 8, width: 16, height: 16, background: c.surface, transform: 'rotate(45deg)', borderRadius: 3 }} />
        <div style={{ fontSize: 12, fontWeight: 600, color: c.ink3 }}>
          {step + 1} מתוך {STEPS.length}
        </div>
        <h2 id="tour-title" style={{ margin: '8px 0 0', fontSize: 18, fontWeight: 600 }}>
          {s.title}
        </h2>
        <p id="tour-body" style={{ margin: '8px 0 0', fontSize: 14, lineHeight: 1.65, color: c.ink2 }}>
          {s.body}
        </p>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginTop: 24 }}>
          <button ref={next} onClick={onNext} className="tour-next" style={{ height: 40, padding: '0 20px', border: 'none', borderRadius: 12, background: c.primary, color: '#fff', font: 'inherit', fontSize: 14, fontWeight: 600, cursor: 'pointer' }}>
            {last ? 'סיום ההסבר' : 'לצעד הבא'}
          </button>
          {!last && (
            <Button kind="ghost" onClick={onSkip} style={{ color: c.primaryInk, fontSize: 14 }}>
              דילוג על ההסבר
            </Button>
          )}
          <span style={{ flex: 1 }} />
          <span aria-hidden style={{ display: 'flex', gap: 6 }}>
            {STEPS.map((_, i) => (
              <span key={i} style={{ width: i === step ? 20 : 6, height: 6, borderRadius: 3, background: i === step ? c.primary : c.line, transition: `all 320ms ${EASE}` }} />
            ))}
          </span>
        </div>
      </div>
    </div>
  )
}
