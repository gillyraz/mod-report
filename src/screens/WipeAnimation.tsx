import { useEffect, useState } from 'react'
import { Check, FileImage, FileSpreadsheet, FileText, Table2, Users } from 'lucide-react'
import { c, EASE } from '../ui'

// Files and tables jump into a trash can while the data is deleted, then a short "deleted" state.
const ITEMS = [
  { Icon: FileText, x: -420, y: -300, r: -14 },
  { Icon: Table2, x: 400, y: -340, r: 12 },
  { Icon: FileImage, x: -240, y: -470, r: 8 },
  { Icon: FileSpreadsheet, x: 250, y: -500, r: -10 },
  { Icon: Users, x: -460, y: -520, r: 16 },
  { Icon: FileText, x: 460, y: -530, r: -16 },
  { Icon: Table2, x: -200, y: -240, r: 6 },
  { Icon: FileImage, x: 210, y: -250, r: -6 },
]
const STEP = 140
const JUMP = 760
export const WIPE_MS = 400 + STEP * (ITEMS.length - 1) + JUMP + 360

export function WipeAnimation({ done }: { done: boolean }) {
  const reduce = typeof matchMedia !== 'undefined' && matchMedia('(prefers-reduced-motion: reduce)').matches
  const [show, setShow] = useState(!reduce)
  useEffect(() => {
    if (done) setShow(false)
  }, [done])
  // The page behind never scrolls while the animation runs
  useEffect(() => {
    const html = document.documentElement
    const prev = html.style.overflow
    html.style.overflow = 'hidden'
    return () => {
      html.style.overflow = prev
    }
  }, [])
  return (
    <div
      role="status"
      aria-live="polite"
      style={{ position: 'fixed', inset: 0, zIndex: 50, background: 'rgba(244,247,255,0.35)', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'flex-end', paddingBottom: 48, overflow: 'hidden', animation: `fade 240ms ${EASE}` }}
    >
      <style>{`
        @keyframes wipe-jump {
          0% { transform: translate(var(--x), var(--y)) rotate(var(--r)) scale(1); opacity: 1 }
          55% { transform: translate(calc(var(--x) * 0.35), calc(var(--y) * 0.45 - 120px)) rotate(calc(var(--r) * -1.5)) scale(0.92) }
          82% { transform: translate(0, -12px) rotate(0deg) scale(0.5); opacity: 1 }
          100% { transform: translate(0, 26px) rotate(0deg) scale(0.4); opacity: 0 }
        }
        @keyframes wipe-lid {
          0% { transform: rotate(0) }
          14% { transform: rotate(-32deg) }
          86% { transform: rotate(-32deg) }
          94% { transform: rotate(5deg) }
          100% { transform: rotate(0) }
        }
        @keyframes wipe-thud { 0%,100% { transform: translateY(0) } 40% { transform: translateY(4px) scaleY(0.97) } }
        @keyframes wipe-in { from { opacity: 0; transform: scale(0.8) } to { opacity: 1; transform: scale(1) } }
      `}</style>
      {show ? (
        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 16 }}>
          <div style={{ position: 'relative', width: 84, height: 93 }}>
            <div style={{ position: 'absolute', left: '50%', top: 18, width: 0, height: 0 }}>
              {ITEMS.map(({ Icon, x, y, r }, i) => (
                <span
                  key={i}
                  style={{
                    position: 'absolute',
                    left: -24,
                    top: -24,
                    width: 48,
                    height: 48,
                    borderRadius: 12,
                    background: c.surface,
                    boxShadow: `inset 0 0 0 1px ${c.fieldLine}, 0 8px 20px -8px rgba(15,23,42,0.22)`,
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    color: i % 2 ? c.primary : c.ink3,
                    ['--x' as string]: `${x}px`,
                    ['--y' as string]: `${y}px`,
                    ['--r' as string]: `${r}deg`,
                    animation: `wipe-jump ${JUMP}ms cubic-bezier(0.45, 0, 0.55, 1) ${400 + i * STEP}ms both`,
                  }}
                >
                  <Icon size={24} strokeWidth={1.75} />
                </span>
              ))}
            </div>
            <svg width="84" height="93" viewBox="0 0 112 124" style={{ position: 'absolute', inset: 0, overflow: 'visible', animation: `wipe-thud 260ms ${EASE} ${WIPE_MS - 380}ms both` }}>
              <path d="M14 28 H98 L90 116 a8 8 0 0 1 -8 8 H30 a8 8 0 0 1 -8 -8 Z" fill={c.danger} />
              <path d="M14 28 H98 L97 40 H15 Z" fill="rgba(0,0,0,0.12)" />
              {[40, 56, 72].map((x) => (
                <rect key={x} x={x - 3} y={48} width={6} height={58} rx={3} fill="rgba(255,255,255,0.32)" />
              ))}
              <g style={{ transformOrigin: '8px 22px', animation: `wipe-lid ${WIPE_MS - 300}ms ${EASE} 120ms both` }}>
                <rect x={6} y={14} width={100} height={12} rx={6} fill={c.danger} />
                <rect x={42} y={4} width={28} height={12} rx={5} fill="none" stroke={c.danger} strokeWidth={5} />
              </g>
            </svg>
          </div>
          <span style={{ fontSize: 15, fontWeight: 600, color: c.ink, background: c.surface, padding: '8px 16px', borderRadius: 999, boxShadow: '0 8px 24px -8px rgba(15,23,42,0.25)' }}>מוחקים את כל המידע…</span>
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 16, animation: `wipe-in 360ms ${EASE} both` }}>
          <span style={{ width: 84, height: 84, borderRadius: 42, background: c.okBg, color: c.ok, display: 'flex', alignItems: 'center', justifyContent: 'center', boxShadow: '0 8px 24px -8px rgba(15,23,42,0.25)' }}>
            <Check size={40} strokeWidth={2.25} />
          </span>
          <span style={{ fontSize: 15, fontWeight: 600, color: c.ink, background: c.surface, padding: '8px 16px', borderRadius: 999, boxShadow: '0 8px 24px -8px rgba(15,23,42,0.25)' }}>כל המידע נמחק</span>
        </div>
      )}
    </div>
  )
}
